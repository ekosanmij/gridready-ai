-- GEO-010 / REP-005 / REP-006 / REP-008 / REP-010:
-- versioned report artifacts, deterministic map output and secure customer delivery.

create table if not exists public.assessment_report_versions (
  id uuid primary key default gen_random_uuid(),
  report_export_id uuid not null references public.assessment_report_exports(id) on delete restrict,
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  template_id uuid not null references public.report_templates(id) on delete restrict,
  template_version text not null,
  version_number integer not null,
  status text not null default 'generating',
  content_snapshot jsonb not null,
  snapshot_checksum text not null,
  generation_attempts integer not null default 1,
  generation_error text,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  generated_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_report_versions_unique_version unique (report_export_id, version_number),
  constraint assessment_report_versions_number_check check (version_number > 0),
  constraint assessment_report_versions_status_check check (status in ('generating', 'ready', 'failed', 'delivered')),
  constraint assessment_report_versions_checksum_check check (snapshot_checksum ~ '^[a-f0-9]{64}$')
);

create index if not exists assessment_report_versions_assessment_version_idx
  on public.assessment_report_versions (site_assessment_id, version_number desc, created_at desc);
create index if not exists assessment_report_versions_organisation_status_idx
  on public.assessment_report_versions (organisation_id, status, updated_at desc);

create table if not exists public.report_artifacts (
  id uuid primary key default gen_random_uuid(),
  report_version_id uuid not null references public.assessment_report_versions(id) on delete restrict,
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  artifact_type text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null,
  sha256 text not null,
  metadata jsonb not null default '{}'::jsonb,
  generated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint report_artifacts_version_type_key unique (report_version_id, artifact_type),
  constraint report_artifacts_type_check check (artifact_type in ('report_pdf', 'site_map')),
  constraint report_artifacts_size_check check (byte_size > 0 and byte_size <= 52428800),
  constraint report_artifacts_checksum_check check (sha256 ~ '^[a-f0-9]{64}$'),
  constraint report_artifacts_mime_check check (
    (artifact_type = 'report_pdf' and mime_type = 'application/pdf')
    or (artifact_type = 'site_map' and mime_type = 'image/png')
  )
);

create index if not exists report_artifacts_assessment_idx
  on public.report_artifacts (site_assessment_id, created_at desc);

create table if not exists public.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  report_version_id uuid not null references public.assessment_report_versions(id) on delete restrict,
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  recipient_user_id uuid references auth.users(id) on delete set null,
  delivered_by uuid not null references auth.users(id) on delete restrict,
  delivered_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text,
  created_at timestamptz not null default now(),
  constraint report_deliveries_revocation_check check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null and revoked_by is not null and length(btrim(coalesce(revocation_reason, ''))) >= 10)
  )
);

create unique index if not exists report_deliveries_active_recipient_idx
  on public.report_deliveries (
    report_version_id,
    organisation_id,
    coalesce(recipient_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where revoked_at is null;
create index if not exists report_deliveries_organisation_active_idx
  on public.report_deliveries (organisation_id, delivered_at desc) where revoked_at is null;

create table if not exists public.report_artifact_download_events (
  id uuid primary key default gen_random_uuid(),
  report_artifact_id uuid not null references public.report_artifacts(id) on delete restrict,
  report_delivery_id uuid references public.report_deliveries(id) on delete set null,
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  downloaded_by uuid not null references auth.users(id) on delete restrict,
  actor_role public.app_role not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists report_artifact_download_events_artifact_idx
  on public.report_artifact_download_events (report_artifact_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-artifacts', 'report-artifacts', false, 52428800, array['application/pdf', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.report_artifact_assessment_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public, storage
as $$
begin
  return (storage.foldername(object_name))[2]::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.can_download_report_artifact(p_artifact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.report_artifacts a
    join public.assessment_report_versions v on v.id = a.report_version_id
    where a.id = p_artifact_id
      and (
        (public.current_app_role() in ('admin', 'analyst', 'reviewer') and public.can_access_assessment(a.site_assessment_id))
        or exists (
          select 1
          from public.report_deliveries d
          join public.organisation_memberships m
            on m.organisation_id = d.organisation_id
           and m.user_id = auth.uid()
           and m.is_active
          where d.report_version_id = v.id
            and d.revoked_at is null
            and (d.recipient_user_id is null or d.recipient_user_id = auth.uid())
        )
      )
  );
$$;

create or replace function public.enforce_report_artifact_workflow_path()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.report_artifact_write_authorized', true), '') = 'true' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'Report versions, artifacts and deliveries must be changed through the controlled report artifact workflow.' using errcode = '42501';
end;
$$;

create or replace function public.prevent_report_download_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Report artifact download history is immutable.' using errcode = '42501';
end;
$$;

drop trigger if exists assessment_report_versions_controlled_workflow on public.assessment_report_versions;
create trigger assessment_report_versions_controlled_workflow
  before insert or update or delete on public.assessment_report_versions
  for each row execute function public.enforce_report_artifact_workflow_path();
drop trigger if exists report_artifacts_controlled_workflow on public.report_artifacts;
create trigger report_artifacts_controlled_workflow
  before insert or update or delete on public.report_artifacts
  for each row execute function public.enforce_report_artifact_workflow_path();
drop trigger if exists report_deliveries_controlled_workflow on public.report_deliveries;
create trigger report_deliveries_controlled_workflow
  before insert or update or delete on public.report_deliveries
  for each row execute function public.enforce_report_artifact_workflow_path();
drop trigger if exists report_artifact_download_events_immutable on public.report_artifact_download_events;
create trigger report_artifact_download_events_immutable
  before update or delete on public.report_artifact_download_events
  for each row execute function public.prevent_report_download_event_mutation();

create or replace function public.request_report_artifact_generation(
  p_assessment_id uuid,
  p_export_id uuid default null,
  p_force boolean default false
)
returns public.assessment_report_versions
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_export public.assessment_report_exports;
  v_existing public.assessment_report_versions;
  v_version public.assessment_report_versions;
  v_preflight public.assessment_preflight_runs;
  v_snapshot jsonb;
  v_organisation_id uuid;
  v_template_version text;
begin
  if auth.uid() is null or not public.can_author_report(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;
  if public.current_app_role() not in ('admin', 'analyst') then
    raise exception 'Only an administrator or analyst can generate report artifacts.' using errcode = '42501';
  end if;

  select e.* into v_export
  from public.assessment_report_exports e
  where e.site_assessment_id = p_assessment_id
    and (p_export_id is null or e.id = p_export_id)
  order by e.version_number desc, e.updated_at desc
  limit 1
  for update;

  if v_export.id is null or v_export.status not in ('ready_for_review', 'exported')
    or v_export.version_number <= 0 or v_export.finalized_at is null then
    raise exception 'Finalize the report before generating issued artifacts.' using errcode = '22023';
  end if;

  select v.* into v_existing
  from public.assessment_report_versions v
  where v.report_export_id = v_export.id and v.version_number = v_export.version_number
  for update;

  if v_existing.id is not null and v_existing.status in ('ready', 'delivered') then
    return v_existing;
  end if;

  select * into v_preflight from public.run_assessment_preflight(p_assessment_id, 'delivery');
  if v_preflight.status <> 'passed' then
    raise exception 'Delivery preflight is blocked. Resolve the saved blockers before generating issued artifacts.' using errcode = '22023';
  end if;

  select pr.organisation_id, rt.version
  into v_organisation_id, v_template_version
  from public.site_assessments a
  join public.projects pr on pr.id = a.project_id
  join public.report_templates rt on rt.id = v_export.template_id
  where a.id = p_assessment_id;

  select jsonb_build_object(
    'schema_version', 1,
    'captured_at', now(),
    'report_version', jsonb_build_object(
      'export_id', v_export.id,
      'version_number', v_export.version_number,
      'finalized_at', v_export.finalized_at,
      'template_id', v_export.template_id,
      'template_version', v_template_version,
      'preflight_run_id', v_preflight.id
    ),
    'assessment', to_jsonb(a),
    'project', to_jsonb(pr),
    'organisation', to_jsonb(o),
    'site', to_jsonb(s),
    'template', to_jsonb(rt),
    'sections', coalesce((
      select jsonb_agg(to_jsonb(rs) order by ts.sort_order)
      from public.assessment_report_sections rs
      join public.report_template_sections ts on ts.id = rs.template_section_id
      where rs.site_assessment_id = a.id and rs.status = 'final'
    ), '[]'::jsonb),
    'scores', coalesce((select jsonb_agg(to_jsonb(sc) order by sc.module_key) from public.assessment_scores sc where sc.site_assessment_id = a.id), '[]'::jsonb),
    'score_calculation', (select to_jsonb(calc) from public.assessment_score_calculations calc where calc.site_assessment_id = a.id order by calc.created_at desc limit 1),
    'verdict', (select to_jsonb(ver) from public.assessment_verdicts ver where ver.site_assessment_id = a.id limit 1),
    'findings', coalesce((select jsonb_agg(to_jsonb(f) order by f.risk_level desc, f.created_at) from public.assessment_findings f where f.site_assessment_id = a.id and f.status <> 'superseded'), '[]'::jsonb),
    'evidence_sources', coalesce((select jsonb_agg(to_jsonb(es) order by es.created_at) from public.evidence_sources es where es.site_assessment_id = a.id), '[]'::jsonb),
    'evidence_gaps', coalesce((select jsonb_agg(to_jsonb(eg) order by eg.severity desc, eg.created_at) from public.evidence_gaps eg where eg.site_assessment_id = a.id), '[]'::jsonb),
    'grid_assets', coalesce((select jsonb_agg(to_jsonb(ga) order by ga.distance_miles nulls last, ga.asset_name) from public.assessment_grid_assets ga where ga.site_assessment_id = a.id), '[]'::jsonb),
    'expert_review', (select to_jsonb(er) from public.expert_reviews er where er.site_assessment_id = a.id and er.status = 'approved' and er.report_export_id = v_export.id and er.report_export_version = v_export.version_number order by er.approved_at desc limit 1),
    'expert_review_checklist', coalesce((
      select jsonb_agg(to_jsonb(ci) order by ci.sort_order, ci.item_key)
      from public.expert_review_checklist_items ci
      join public.expert_reviews er on er.id = ci.expert_review_id
      where er.site_assessment_id = a.id and er.status = 'approved'
        and er.report_export_id = v_export.id and er.report_export_version = v_export.version_number
    ), '[]'::jsonb),
    'claim_lineage', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.report_claims c where c.site_assessment_id = a.id), '[]'::jsonb),
    'claim_evidence_links', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at)
      from public.report_claim_evidence_links l
      join public.report_claims c on c.id = l.report_claim_id
      where c.site_assessment_id = a.id
    ), '[]'::jsonb)
  ) into v_snapshot
  from public.site_assessments a
  join public.projects pr on pr.id = a.project_id
  join public.organisations o on o.id = pr.organisation_id
  left join public.sites s on s.id = a.site_id
  join public.report_templates rt on rt.id = v_export.template_id
  where a.id = p_assessment_id;

  perform set_config('app.report_artifact_write_authorized', 'true', true);
  if v_existing.id is null then
    insert into public.assessment_report_versions (
      report_export_id, site_assessment_id, organisation_id, template_id,
      template_version, version_number, status, content_snapshot,
      snapshot_checksum, requested_by
    ) values (
      v_export.id, p_assessment_id, v_organisation_id, v_export.template_id,
      v_template_version, v_export.version_number, 'generating', v_snapshot,
      encode(digest(convert_to(v_snapshot::text, 'utf8'), 'sha256'), 'hex'), auth.uid()
    ) returning * into v_version;
  else
    update public.assessment_report_versions
    set status = 'generating', content_snapshot = v_snapshot,
        snapshot_checksum = encode(digest(convert_to(v_snapshot::text, 'utf8'), 'sha256'), 'hex'),
        generation_attempts = generation_attempts + 1, generation_error = null,
        requested_by = auth.uid(), requested_at = now(), updated_at = now()
    where id = v_existing.id
    returning * into v_version;
  end if;
  perform set_config('app.report_artifact_write_authorized', '', true);

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, metadata
  ) values (
    p_assessment_id, 'report_artifact_generation_requested', auth.uid(), public.current_app_role(),
    'internal', 'assessment_report_versions', v_version.id::text, 'generating',
    jsonb_build_object('report_version', v_version.version_number, 'attempt', v_version.generation_attempts)
  );
  return v_version;
end;
$$;

create or replace function public.complete_report_artifact_generation(
  p_report_version_id uuid,
  p_artifacts jsonb
)
returns public.assessment_report_versions
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_version public.assessment_report_versions;
  v_artifact jsonb;
  v_type text;
begin
  select * into v_version from public.assessment_report_versions where id = p_report_version_id for update;
  if v_version.id is null or not public.can_author_report(v_version.site_assessment_id)
    or public.current_app_role() not in ('admin', 'analyst') then
    raise exception 'Report version is not available.' using errcode = '42501';
  end if;
  if v_version.status <> 'generating' then
    raise exception 'Only an active generation attempt can be marked failed.' using errcode = '22023';
  end if;
  if v_version.status <> 'generating' then
    raise exception 'Only a generating report version can be completed.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_artifacts) <> 'array' or jsonb_array_length(p_artifacts) <> 2 then
    raise exception 'A report PDF and site map artifact are required.' using errcode = '22023';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_artifacts) x where x ->> 'artifact_type' = 'report_pdf')
    or not exists (select 1 from jsonb_array_elements(p_artifacts) x where x ->> 'artifact_type' = 'site_map') then
    raise exception 'A report PDF and site map artifact are required.' using errcode = '22023';
  end if;

  perform set_config('app.report_artifact_write_authorized', 'true', true);
  for v_artifact in select value from jsonb_array_elements(p_artifacts) loop
    v_type := v_artifact ->> 'artifact_type';
    if v_type not in ('report_pdf', 'site_map')
      or coalesce(v_artifact ->> 'sha256', '') !~ '^[a-f0-9]{64}$'
      or coalesce((v_artifact ->> 'byte_size')::bigint, 0) <= 0
      or coalesce(v_artifact ->> 'storage_path', '') not like v_version.organisation_id::text || '/' || v_version.site_assessment_id::text || '/v' || v_version.version_number::text || '/%' then
      raise exception 'Generated artifact metadata is invalid.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from storage.objects so
      where so.bucket_id = 'report-artifacts'
        and so.name = v_artifact ->> 'storage_path'
        and coalesce(so.metadata ->> 'mimetype', '') = v_artifact ->> 'mime_type'
        and coalesce((so.metadata ->> 'size')::bigint, 0) = (v_artifact ->> 'byte_size')::bigint
    ) then
      raise exception 'The generated artifact is not present in private storage.' using errcode = '22023';
    end if;

    insert into public.report_artifacts (
      report_version_id, site_assessment_id, organisation_id, artifact_type,
      file_name, storage_path, mime_type, byte_size, sha256, metadata, generated_by
    ) values (
      v_version.id, v_version.site_assessment_id, v_version.organisation_id, v_type,
      v_artifact ->> 'file_name', v_artifact ->> 'storage_path', v_artifact ->> 'mime_type',
      (v_artifact ->> 'byte_size')::bigint, v_artifact ->> 'sha256',
      coalesce(v_artifact -> 'metadata', '{}'::jsonb), auth.uid()
    )
    on conflict (report_version_id, artifact_type) do update
    set file_name = excluded.file_name, storage_path = excluded.storage_path,
        mime_type = excluded.mime_type, byte_size = excluded.byte_size,
        sha256 = excluded.sha256, metadata = excluded.metadata,
        generated_by = excluded.generated_by, created_at = now();
  end loop;

  update public.assessment_report_versions
  set status = 'ready', generation_error = null, generated_at = now(), updated_at = now()
  where id = v_version.id returning * into v_version;

  perform set_config('app.report_finalization_authorized', 'true', true);
  update public.assessment_report_exports set status = 'exported', updated_at = now()
  where id = v_version.report_export_id;
  perform set_config('app.report_finalization_authorized', '', true);
  perform set_config('app.report_artifact_write_authorized', '', true);

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, metadata
  ) values (
    v_version.site_assessment_id, 'report_artifacts_generated', auth.uid(), public.current_app_role(),
    'internal', 'assessment_report_versions', v_version.id::text, 'ready',
    jsonb_build_object('report_version', v_version.version_number, 'artifact_count', 2)
  );
  return v_version;
end;
$$;

create or replace function public.fail_report_artifact_generation(
  p_report_version_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare v_version public.assessment_report_versions;
begin
  select * into v_version from public.assessment_report_versions where id = p_report_version_id for update;
  if v_version.id is null or not public.can_author_report(v_version.site_assessment_id)
    or public.current_app_role() not in ('admin', 'analyst') then
    raise exception 'Report version is not available.' using errcode = '42501';
  end if;
  perform set_config('app.report_artifact_write_authorized', 'true', true);
  update public.assessment_report_versions
  set status = 'failed', generation_error = left(coalesce(nullif(btrim(p_error), ''), 'Artifact generation failed.'), 2000), updated_at = now()
  where id = p_report_version_id;
  perform set_config('app.report_artifact_write_authorized', '', true);
end;
$$;

create or replace function public.deliver_report_version(
  p_report_version_id uuid,
  p_recipient_user_id uuid default null
)
returns public.report_deliveries
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_version public.assessment_report_versions;
  v_delivery public.report_deliveries;
  v_preflight public.assessment_preflight_runs;
  v_assessment_status text;
begin
  select * into v_version from public.assessment_report_versions where id = p_report_version_id for update;
  if v_version.id is null or not public.can_access_assessment(v_version.site_assessment_id)
    or public.current_app_role() not in ('admin', 'analyst') then
    raise exception 'Report version is not available.' using errcode = '42501';
  end if;
  if v_version.status not in ('ready', 'delivered') or not exists (
    select 1 from public.report_artifacts a where a.report_version_id = v_version.id and a.artifact_type = 'report_pdf'
  ) or not exists (
    select 1 from public.report_artifacts a where a.report_version_id = v_version.id and a.artifact_type = 'site_map'
  ) then
    raise exception 'The complete report artifact package is not ready.' using errcode = '22023';
  end if;
  if p_recipient_user_id is not null and not exists (
    select 1 from public.organisation_memberships m
    where m.user_id = p_recipient_user_id and m.organisation_id = v_version.organisation_id
      and m.is_active and m.role = 'customer'
  ) then
    raise exception 'The selected recipient is not an active customer member of this organisation.' using errcode = '22023';
  end if;

  select * into v_preflight from public.run_assessment_preflight(v_version.site_assessment_id, 'delivery');
  if v_preflight.status <> 'passed' then
    raise exception 'Delivery preflight is blocked.' using errcode = '22023';
  end if;

  perform set_config('app.report_artifact_write_authorized', 'true', true);
  insert into public.report_deliveries (
    report_version_id, site_assessment_id, organisation_id, recipient_user_id, delivered_by
  ) values (
    v_version.id, v_version.site_assessment_id, v_version.organisation_id, p_recipient_user_id, auth.uid()
  ) returning * into v_delivery;
  update public.assessment_report_versions
  set status = 'delivered', delivered_at = coalesce(delivered_at, now()), updated_at = now()
  where id = v_version.id;
  perform set_config('app.report_artifact_write_authorized', '', true);

  select status::text into v_assessment_status from public.site_assessments where id = v_version.site_assessment_id;
  if v_assessment_status = 'final_review' then
    perform public.transition_assessment_status(v_version.site_assessment_id, 'delivered', 'Approved report version delivered to the customer organisation.', 'report_delivery');
  elsif v_assessment_status <> 'delivered' then
    raise exception 'Assessment must be in final review before report delivery.' using errcode = '22023';
  end if;

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, metadata
  ) values (
    v_version.site_assessment_id, 'report_delivered', auth.uid(), public.current_app_role(),
    'shared', 'report_deliveries', v_delivery.id::text, 'delivered',
    jsonb_build_object('report_version', v_version.version_number, 'organisation_id', v_version.organisation_id, 'recipient_user_id', p_recipient_user_id)
  );
  return v_delivery;
end;
$$;

create or replace function public.revoke_report_delivery(
  p_delivery_id uuid,
  p_reason text
)
returns public.report_deliveries
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare v_delivery public.report_deliveries;
begin
  select * into v_delivery from public.report_deliveries where id = p_delivery_id for update;
  if v_delivery.id is null or not public.can_access_assessment(v_delivery.site_assessment_id)
    or public.current_app_role() not in ('admin', 'analyst') then
    raise exception 'Delivery is not available.' using errcode = '42501';
  end if;
  if v_delivery.revoked_at is not null then return v_delivery; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'A substantive revocation reason is required.' using errcode = '22023';
  end if;
  perform set_config('app.report_artifact_write_authorized', 'true', true);
  update public.report_deliveries
  set revoked_at = now(), revoked_by = auth.uid(), revocation_reason = btrim(p_reason)
  where id = p_delivery_id returning * into v_delivery;
  perform set_config('app.report_artifact_write_authorized', '', true);
  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, reason, metadata
  ) values (
    v_delivery.site_assessment_id, 'report_delivery_revoked', auth.uid(), public.current_app_role(),
    'shared', 'report_deliveries', v_delivery.id::text, 'revoked', btrim(p_reason),
    jsonb_build_object('report_version_id', v_delivery.report_version_id, 'recipient_user_id', v_delivery.recipient_user_id)
  );
  return v_delivery;
end;
$$;

create or replace function public.authorize_report_artifact_download(p_artifact_id uuid)
returns table (
  artifact_id uuid,
  delivery_id uuid,
  storage_path text,
  file_name text,
  mime_type text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare v_role public.app_role := public.current_app_role();
begin
  if auth.uid() is null or not public.can_download_report_artifact(p_artifact_id) then
    raise exception 'Artifact is not available.' using errcode = '42501';
  end if;
  return query
  select a.id,
    case when v_role = 'customer' then (
      select d.id from public.report_deliveries d
      join public.organisation_memberships m on m.organisation_id = d.organisation_id
        and m.user_id = auth.uid() and m.is_active
      where d.report_version_id = a.report_version_id and d.revoked_at is null
        and (d.recipient_user_id is null or d.recipient_user_id = auth.uid())
      order by d.delivered_at desc limit 1
    ) else null end,
    a.storage_path, a.file_name, a.mime_type
  from public.report_artifacts a where a.id = p_artifact_id;
end;
$$;

create or replace function public.record_report_artifact_download(
  p_artifact_id uuid,
  p_delivery_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare v_artifact public.report_artifacts; v_event_id uuid;
begin
  if not public.can_download_report_artifact(p_artifact_id) then
    raise exception 'Artifact is not available.' using errcode = '42501';
  end if;
  select * into v_artifact from public.report_artifacts where id = p_artifact_id;
  if public.current_app_role() = 'customer' and not exists (
    select 1 from public.report_deliveries d
    where d.id = p_delivery_id and d.report_version_id = v_artifact.report_version_id
      and d.revoked_at is null and d.organisation_id = v_artifact.organisation_id
      and (d.recipient_user_id is null or d.recipient_user_id = auth.uid())
  ) then
    raise exception 'Delivery authorization is no longer active.' using errcode = '42501';
  end if;
  insert into public.report_artifact_download_events (
    report_artifact_id, report_delivery_id, site_assessment_id, organisation_id,
    downloaded_by, actor_role, metadata
  ) values (
    v_artifact.id, p_delivery_id, v_artifact.site_assessment_id, v_artifact.organisation_id,
    auth.uid(), public.current_app_role(), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_event_id;
  return v_event_id;
end;
$$;

alter table public.assessment_report_versions enable row level security;
alter table public.report_artifacts enable row level security;
alter table public.report_deliveries enable row level security;
alter table public.report_artifact_download_events enable row level security;

drop policy if exists report_versions_scoped_read on public.assessment_report_versions;
create policy report_versions_scoped_read on public.assessment_report_versions
  for select to authenticated using (
    (public.current_app_role() in ('admin', 'analyst', 'reviewer') and public.can_access_assessment(site_assessment_id))
    or exists (
      select 1 from public.report_deliveries d
      join public.organisation_memberships m on m.organisation_id = d.organisation_id
        and m.user_id = auth.uid() and m.is_active
      where d.report_version_id = assessment_report_versions.id and d.revoked_at is null
        and (d.recipient_user_id is null or d.recipient_user_id = auth.uid())
    )
  );

drop policy if exists report_artifacts_scoped_read on public.report_artifacts;
create policy report_artifacts_scoped_read on public.report_artifacts
  for select to authenticated using (public.can_download_report_artifact(id));

drop policy if exists report_deliveries_scoped_read on public.report_deliveries;
create policy report_deliveries_scoped_read on public.report_deliveries
  for select to authenticated using (
    (public.current_app_role() in ('admin', 'analyst', 'reviewer') and public.can_access_assessment(site_assessment_id))
    or (
      revoked_at is null and public.is_organisation_member(organisation_id)
      and (recipient_user_id is null or recipient_user_id = auth.uid())
    )
  );

drop policy if exists report_download_events_internal_read on public.report_artifact_download_events;
create policy report_download_events_internal_read on public.report_artifact_download_events
  for select to authenticated using (
    public.current_app_role() in ('admin', 'analyst') and public.can_access_assessment(site_assessment_id)
  );

drop policy if exists report_artifacts_storage_read on storage.objects;
create policy report_artifacts_storage_read on storage.objects
  for select to authenticated using (
    bucket_id = 'report-artifacts' and exists (
      select 1 from public.report_artifacts a
      where a.storage_path = name and public.can_download_report_artifact(a.id)
    )
  );
drop policy if exists report_artifacts_storage_insert on storage.objects;
create policy report_artifacts_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'report-artifacts'
    and public.current_app_role() in ('admin', 'analyst')
    and public.can_author_report(public.report_artifact_assessment_id(name))
  );
drop policy if exists report_artifacts_storage_update on storage.objects;
create policy report_artifacts_storage_update on storage.objects
  for update to authenticated using (
    bucket_id = 'report-artifacts'
    and public.current_app_role() in ('admin', 'analyst')
    and public.can_author_report(public.report_artifact_assessment_id(name))
  ) with check (
    bucket_id = 'report-artifacts'
    and public.current_app_role() in ('admin', 'analyst')
    and public.can_author_report(public.report_artifact_assessment_id(name))
  );

revoke all on public.assessment_report_versions from anon, authenticated;
grant select (
  id, report_export_id, site_assessment_id, organisation_id, template_id,
  template_version, version_number, status, snapshot_checksum,
  generation_attempts, generation_error, requested_by, requested_at,
  generated_at, delivered_at, created_at, updated_at
) on public.assessment_report_versions to authenticated;
revoke all on public.report_artifacts from anon, authenticated;
grant select (
  id, report_version_id, site_assessment_id, organisation_id, artifact_type,
  file_name, mime_type, byte_size, sha256, metadata, generated_by, created_at
) on public.report_artifacts to authenticated;
grant select on public.report_deliveries to authenticated;
grant select on public.report_artifact_download_events to authenticated;

revoke all on function public.request_report_artifact_generation(uuid, uuid, boolean) from public, anon;
revoke all on function public.complete_report_artifact_generation(uuid, jsonb) from public, anon;
revoke all on function public.fail_report_artifact_generation(uuid, text) from public, anon;
revoke all on function public.deliver_report_version(uuid, uuid) from public, anon;
revoke all on function public.revoke_report_delivery(uuid, text) from public, anon;
revoke all on function public.authorize_report_artifact_download(uuid) from public, anon;
revoke all on function public.record_report_artifact_download(uuid, uuid, jsonb) from public, anon;
revoke all on function public.can_download_report_artifact(uuid) from public, anon;
revoke all on function public.enforce_report_artifact_workflow_path() from public, anon, authenticated;
revoke all on function public.prevent_report_download_event_mutation() from public, anon, authenticated;
grant execute on function public.request_report_artifact_generation(uuid, uuid, boolean) to authenticated;
grant execute on function public.complete_report_artifact_generation(uuid, jsonb) to authenticated;
grant execute on function public.fail_report_artifact_generation(uuid, text) to authenticated;
grant execute on function public.deliver_report_version(uuid, uuid) to authenticated;
grant execute on function public.revoke_report_delivery(uuid, text) to authenticated;
grant execute on function public.authorize_report_artifact_download(uuid) to authenticated;
grant execute on function public.record_report_artifact_download(uuid, uuid, jsonb) to authenticated;
grant execute on function public.can_download_report_artifact(uuid) to authenticated;

notify pgrst, 'reload schema';
