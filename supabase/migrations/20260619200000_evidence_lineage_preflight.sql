-- EV-001 / EV-002 / EV-003 / EV-004 / REP-007: complete evidence metadata,
-- finding and report-claim lineage, explicit evidence gaps, and server-side preflight.

alter table public.evidence_sources
  add column if not exists notes text,
  add column if not exists authored_by uuid references auth.users(id) on delete set null,
  add column if not exists metadata_version integer not null default 1;

alter table public.evidence_sources
  alter column authored_by set default auth.uid();

alter table public.evidence_sources
  drop constraint if exists evidence_sources_metadata_version_check;
alter table public.evidence_sources
  add constraint evidence_sources_metadata_version_check check (metadata_version > 0);

alter table public.assessment_findings
  add column if not exists support_status text not null default 'unsupported';

alter table public.assessment_findings
  drop constraint if exists assessment_findings_support_status_check;
alter table public.assessment_findings
  add constraint assessment_findings_support_status_check check (
    support_status in ('contradicted', 'mixed', 'not_applicable', 'supported', 'unsupported')
  );

alter table public.finding_evidence_links
  add column if not exists relationship text not null default 'supporting',
  add column if not exists linked_by uuid references auth.users(id) on delete set null;

alter table public.finding_evidence_links
  drop constraint if exists finding_evidence_links_relationship_check;
alter table public.finding_evidence_links
  add constraint finding_evidence_links_relationship_check check (
    relationship in ('context', 'contradicting', 'supporting')
  );

update public.assessment_findings f
set support_status = case
  when exists (
    select 1 from public.finding_evidence_links l
    where l.finding_id = f.id and l.relationship = 'supporting'
  ) then 'supported'
  else 'unsupported'
end;

create table if not exists public.evidence_source_events (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  evidence_source_id uuid references public.evidence_sources(id) on delete set null,
  operation text not null,
  previous_snapshot jsonb,
  new_snapshot jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  created_at timestamptz not null default now(),
  constraint evidence_source_events_operation_check check (operation in ('created', 'deleted', 'updated'))
);

create index if not exists evidence_source_events_assessment_created_idx
  on public.evidence_source_events (site_assessment_id, created_at desc);

create table if not exists public.assessment_delivery_exceptions (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  blocker_key text not null,
  reason text not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_role public.app_role not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  constraint assessment_delivery_exceptions_key_check check (length(btrim(blocker_key)) > 0),
  constraint assessment_delivery_exceptions_reason_check check (length(btrim(reason)) >= 10),
  constraint assessment_delivery_exceptions_approval_role_check check (approved_role in ('admin', 'reviewer'))
);

create index if not exists assessment_delivery_exceptions_active_idx
  on public.assessment_delivery_exceptions (site_assessment_id, blocker_key, approved_at desc)
  where revoked_at is null;

create table if not exists public.evidence_gaps (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  category text not null,
  title text not null,
  description text,
  impact text not null,
  severity text not null default 'medium',
  owner_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  status text not null default 'open',
  blocks_confidence boolean not null default true,
  blocks_review boolean not null default false,
  blocks_delivery boolean not null default false,
  resolution_type text,
  resolution_note text,
  resolved_source_id uuid references public.evidence_sources(id) on delete set null,
  approved_exception_id uuid references public.assessment_delivery_exceptions(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evidence_gaps_category_check check (category in (
    'commercial', 'environmental', 'grid', 'interconnection', 'market',
    'permitting', 'reliability', 'site', 'source_quality', 'water', 'other'
  )),
  constraint evidence_gaps_severity_check check (severity in ('critical', 'high', 'low', 'medium')),
  constraint evidence_gaps_status_check check (status in (
    'accepted_unknown', 'exception_approved', 'in_progress', 'open', 'resolved'
  )),
  constraint evidence_gaps_resolution_type_check check (
    resolution_type is null or resolution_type in ('accepted_unknown', 'approved_exception', 'source')
  ),
  constraint evidence_gaps_title_check check (length(btrim(title)) > 0),
  constraint evidence_gaps_impact_check check (length(btrim(impact)) > 0)
);

create index if not exists evidence_gaps_assessment_status_idx
  on public.evidence_gaps (site_assessment_id, status, severity);
create index if not exists evidence_gaps_owner_due_idx
  on public.evidence_gaps (owner_id, due_at)
  where status in ('in_progress', 'open');

create table if not exists public.report_claims (
  id uuid primary key default gen_random_uuid(),
  report_section_id uuid not null references public.assessment_report_sections(id) on delete cascade,
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  claim_text text not null,
  is_material boolean not null default true,
  support_status text not null default 'unsupported',
  confidence_level text not null default 'unknown',
  rationale text,
  authored_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_claims_claim_text_check check (length(btrim(claim_text)) > 0),
  constraint report_claims_support_status_check check (
    support_status in ('contradicted', 'mixed', 'not_applicable', 'supported', 'unsupported')
  ),
  constraint report_claims_confidence_check check (confidence_level in ('high', 'low', 'medium', 'unknown'))
);

create index if not exists report_claims_section_idx
  on public.report_claims (report_section_id, is_material, support_status);
create index if not exists report_claims_assessment_idx
  on public.report_claims (site_assessment_id, created_at desc);

create table if not exists public.report_claim_evidence_links (
  id uuid primary key default gen_random_uuid(),
  report_claim_id uuid not null references public.report_claims(id) on delete cascade,
  evidence_source_id uuid not null references public.evidence_sources(id) on delete restrict,
  relationship text not null default 'supporting',
  citation_locator text,
  link_note text,
  evidence_snapshot jsonb not null,
  linked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint report_claim_evidence_links_unique unique (report_claim_id, evidence_source_id, relationship),
  constraint report_claim_evidence_links_relationship_check check (
    relationship in ('context', 'contradicting', 'supporting')
  )
);

create index if not exists report_claim_evidence_links_claim_idx
  on public.report_claim_evidence_links (report_claim_id);
create index if not exists report_claim_evidence_links_evidence_idx
  on public.report_claim_evidence_links (evidence_source_id);

create table if not exists public.report_section_finding_links (
  id uuid primary key default gen_random_uuid(),
  report_section_id uuid not null references public.assessment_report_sections(id) on delete cascade,
  finding_id uuid not null references public.assessment_findings(id) on delete restrict,
  relationship text not null default 'supports_section',
  linked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint report_section_finding_links_unique unique (report_section_id, finding_id),
  constraint report_section_finding_links_relationship_check check (
    relationship in ('contradicts_section', 'context', 'supports_section')
  )
);

create table if not exists public.assessment_preflight_runs (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  purpose text not null,
  status text not null,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  bypassed_blockers jsonb not null default '[]'::jsonb,
  lineage_snapshot jsonb not null default '{}'::jsonb,
  run_by uuid references auth.users(id) on delete set null,
  run_role public.app_role,
  created_at timestamptz not null default now(),
  constraint assessment_preflight_runs_purpose_check check (purpose in ('delivery', 'finalization', 'review')),
  constraint assessment_preflight_runs_status_check check (status in ('blocked', 'passed'))
);

create index if not exists assessment_preflight_runs_latest_idx
  on public.assessment_preflight_runs (site_assessment_id, created_at desc);

create or replace function public.set_evidence_lineage_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists evidence_gaps_set_updated_at on public.evidence_gaps;
create trigger evidence_gaps_set_updated_at
  before update on public.evidence_gaps
  for each row execute function public.set_evidence_lineage_updated_at();

drop trigger if exists report_claims_set_updated_at on public.report_claims;
create trigger report_claims_set_updated_at
  before update on public.report_claims
  for each row execute function public.set_evidence_lineage_updated_at();

create or replace function public.capture_evidence_source_event()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_operation text;
  v_assessment_id uuid;
  v_source_id uuid;
begin
  v_operation := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  v_assessment_id := case when tg_op = 'DELETE' then old.site_assessment_id else new.site_assessment_id end;
  v_source_id := case when tg_op = 'DELETE' then old.id else new.id end;

  insert into public.evidence_source_events (
    site_assessment_id, evidence_source_id, operation,
    previous_snapshot, new_snapshot, actor_id, actor_role
  ) values (
    v_assessment_id,
    case when tg_op = 'DELETE' then null else v_source_id end,
    v_operation,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    auth.uid(), public.current_app_role()
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists evidence_sources_capture_event on public.evidence_sources;
create trigger evidence_sources_capture_event
  after insert or update or delete on public.evidence_sources
  for each row execute function public.capture_evidence_source_event();

create or replace function public.increment_evidence_metadata_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if to_jsonb(new) - array['updated_at', 'metadata_version']
     is distinct from to_jsonb(old) - array['updated_at', 'metadata_version'] then
    new.metadata_version = old.metadata_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists evidence_sources_increment_metadata_version on public.evidence_sources;
create trigger evidence_sources_increment_metadata_version
  before update on public.evidence_sources
  for each row execute function public.increment_evidence_metadata_version();

create or replace function public.validate_evidence_gap_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.status in ('in_progress', 'open') and (new.owner_id is null or new.due_at is null) then
    raise exception 'Open evidence gaps require an owner and due date.' using errcode = '22023';
  end if;
  if new.status in ('resolved', 'accepted_unknown', 'exception_approved') then
    if new.resolution_type = 'source' and not exists (
      select 1 from public.evidence_sources e
      where e.id = new.resolved_source_id and e.site_assessment_id = new.site_assessment_id
    ) then
      raise exception 'Resolving an evidence gap from a source requires the source.' using errcode = '22023';
    elsif new.resolution_type = 'accepted_unknown'
      and length(btrim(coalesce(new.resolution_note, ''))) < 10 then
      raise exception 'Accepting an unknown requires a documented rationale.' using errcode = '22023';
    elsif new.resolution_type = 'approved_exception'
      and not exists (
        select 1 from public.assessment_delivery_exceptions x
        where x.id = new.approved_exception_id
          and x.site_assessment_id = new.site_assessment_id
          and x.revoked_at is null
          and (x.expires_at is null or x.expires_at > now())
      ) then
      raise exception 'Resolving an evidence gap by exception requires an active approved exception.' using errcode = '22023';
    elsif new.resolution_type is null then
      raise exception 'A resolution type is required to close an evidence gap.' using errcode = '22023';
    end if;
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := coalesce(new.resolved_by, auth.uid());
  else
    new.resolved_at := null;
    new.resolved_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists evidence_gaps_validate_resolution on public.evidence_gaps;
create trigger evidence_gaps_validate_resolution
  before insert or update on public.evidence_gaps
  for each row execute function public.validate_evidence_gap_resolution();

create or replace function public.validate_delivery_exception_update()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if row(
    new.site_assessment_id, new.blocker_key, new.reason, new.approved_by,
    new.approved_role, new.approved_at, new.expires_at
  ) is distinct from row(
    old.site_assessment_id, old.blocker_key, old.reason, old.approved_by,
    old.approved_role, old.approved_at, old.expires_at
  ) then
    raise exception 'Approved exception details are immutable.' using errcode = '42501';
  end if;
  if old.revoked_at is not null then
    raise exception 'A revoked exception cannot be changed.' using errcode = '42501';
  end if;
  if new.revoked_at is not null then
    if public.current_app_role() not in ('admin', 'reviewer')
       or length(btrim(coalesce(new.revocation_reason, ''))) < 10 then
      raise exception 'Revoking an exception requires an authorised reviewer and reason.' using errcode = '42501';
    end if;
    new.revoked_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_delivery_exceptions_validate_update on public.assessment_delivery_exceptions;
create trigger assessment_delivery_exceptions_validate_update
  before update on public.assessment_delivery_exceptions
  for each row execute function public.validate_delivery_exception_update();

create or replace function public.validate_finding_support_status()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.support_status in ('supported', 'mixed')
     and not exists (
       select 1 from public.finding_evidence_links l
       where l.finding_id = new.id and l.relationship = 'supporting'
     ) then
    raise exception 'A supported finding requires at least one supporting evidence link.' using errcode = '22023';
  end if;
  if new.support_status in ('contradicted', 'mixed')
     and not exists (
       select 1 from public.finding_evidence_links l
       where l.finding_id = new.id and l.relationship = 'contradicting'
     ) then
    raise exception 'A contradicted or mixed finding requires contradictory evidence.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_findings_validate_support on public.assessment_findings;
create trigger assessment_findings_validate_support
  before insert or update of support_status on public.assessment_findings
  for each row execute function public.validate_finding_support_status();

create or replace function public.validate_report_lineage_assessment()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_section_assessment uuid;
  v_related_assessment uuid;
begin
  if tg_table_name = 'report_claims' then
    select site_assessment_id into v_section_assessment
    from public.assessment_report_sections where id = new.report_section_id;
    if v_section_assessment is null or v_section_assessment <> new.site_assessment_id then
      raise exception 'The report claim must belong to the report section assessment.' using errcode = '22023';
    end if;
  elsif tg_table_name = 'report_claim_evidence_links' then
    select c.site_assessment_id into v_section_assessment
    from public.report_claims c where c.id = new.report_claim_id;
    select e.site_assessment_id into v_related_assessment
    from public.evidence_sources e where e.id = new.evidence_source_id;
    if v_section_assessment is null or v_related_assessment is null or v_section_assessment <> v_related_assessment then
      raise exception 'Report claims and evidence must belong to the same assessment.' using errcode = '22023';
    end if;
    if new.evidence_snapshot is null or new.evidence_snapshot = '{}'::jsonb then
      select to_jsonb(e) into new.evidence_snapshot
      from public.evidence_sources e where e.id = new.evidence_source_id;
    end if;
  else
    select site_assessment_id into v_section_assessment
    from public.assessment_report_sections where id = new.report_section_id;
    select site_assessment_id into v_related_assessment
    from public.assessment_findings where id = new.finding_id;
    if v_section_assessment is null or v_related_assessment is null or v_section_assessment <> v_related_assessment then
      raise exception 'Report sections and findings must belong to the same assessment.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists report_claims_validate_assessment on public.report_claims;
create trigger report_claims_validate_assessment
  before insert or update on public.report_claims
  for each row execute function public.validate_report_lineage_assessment();

drop trigger if exists report_claim_evidence_links_validate_assessment on public.report_claim_evidence_links;
create trigger report_claim_evidence_links_validate_assessment
  before insert or update on public.report_claim_evidence_links
  for each row execute function public.validate_report_lineage_assessment();

drop trigger if exists report_section_finding_links_validate_assessment on public.report_section_finding_links;
create trigger report_section_finding_links_validate_assessment
  before insert or update on public.report_section_finding_links
  for each row execute function public.validate_report_lineage_assessment();

create or replace function public.validate_report_claim_support_status()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.support_status in ('supported', 'mixed')
     and not exists (
       select 1 from public.report_claim_evidence_links l
       where l.report_claim_id = new.id and l.relationship = 'supporting'
     ) then
    raise exception 'A supported report claim requires supporting evidence.' using errcode = '22023';
  end if;
  if new.support_status in ('contradicted', 'mixed')
     and not exists (
       select 1 from public.report_claim_evidence_links l
       where l.report_claim_id = new.id and l.relationship = 'contradicting'
     ) then
    raise exception 'A contradicted or mixed report claim requires contradictory evidence.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists report_claims_validate_support on public.report_claims;
create trigger report_claims_validate_support
  before insert or update of support_status on public.report_claims
  for each row execute function public.validate_report_claim_support_status();

create or replace function public.enforce_immutable_preflight_history()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if tg_op = 'DELETE'
     and not exists (
       select 1 from public.site_assessments a where a.id = old.site_assessment_id
     ) then
    return old;
  end if;
  raise exception 'Preflight and evidence history is append-only.' using errcode = '42501';
end;
$$;

drop trigger if exists assessment_preflight_runs_immutable on public.assessment_preflight_runs;
create trigger assessment_preflight_runs_immutable
  before update or delete on public.assessment_preflight_runs
  for each row execute function public.enforce_immutable_preflight_history();

drop trigger if exists evidence_source_events_immutable on public.evidence_source_events;
create trigger evidence_source_events_immutable
  before update or delete on public.evidence_source_events
  for each row execute function public.enforce_immutable_preflight_history();

create or replace function public.save_assessment_finding(
  p_assessment_id uuid,
  p_finding jsonb,
  p_links jsonb default '[]'::jsonb
)
returns public.assessment_findings
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_finding public.assessment_findings;
  v_finding_id uuid := coalesce(nullif(p_finding ->> 'id', '')::uuid, gen_random_uuid());
  v_support_status text := coalesce(nullif(p_finding ->> 'support_status', ''), 'unsupported');
  v_link jsonb;
begin
  if auth.uid() is null or not public.can_edit_assessment(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_links) <> 'array' then
    raise exception 'Finding links must be supplied as an array.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.assessment_findings f
    where f.id = v_finding_id and f.site_assessment_id <> p_assessment_id
  ) then
    raise exception 'Finding is not available.' using errcode = '42501';
  end if;

  insert into public.assessment_findings (
    id, site_assessment_id, module_key, title, finding_type, risk_level,
    confidence_level, statement, assumption_note, recommendation, status,
    support_status
  ) values (
    v_finding_id, p_assessment_id, p_finding ->> 'module_key',
    p_finding ->> 'title', coalesce(p_finding ->> 'finding_type', 'finding'),
    coalesce(p_finding ->> 'risk_level', 'unknown'),
    coalesce(p_finding ->> 'confidence_level', 'unknown'),
    nullif(p_finding ->> 'statement', ''), nullif(p_finding ->> 'assumption_note', ''),
    nullif(p_finding ->> 'recommendation', ''), coalesce(p_finding ->> 'status', 'open'),
    'unsupported'
  )
  on conflict (id) do update
  set module_key = excluded.module_key,
      title = excluded.title,
      finding_type = excluded.finding_type,
      risk_level = excluded.risk_level,
      confidence_level = excluded.confidence_level,
      statement = excluded.statement,
      assumption_note = excluded.assumption_note,
      recommendation = excluded.recommendation,
      status = excluded.status,
      support_status = 'unsupported',
      updated_at = now()
  where assessment_findings.site_assessment_id = p_assessment_id;

  delete from public.finding_evidence_links where finding_id = v_finding_id;
  for v_link in select value from jsonb_array_elements(p_links) loop
    insert into public.finding_evidence_links (
      finding_id, evidence_source_id, relationship, link_note, linked_by
    ) values (
      v_finding_id, (v_link ->> 'evidence_source_id')::uuid,
      coalesce(nullif(v_link ->> 'relationship', ''), 'supporting'),
      nullif(v_link ->> 'link_note', ''), auth.uid()
    );
  end loop;

  update public.assessment_findings
  set support_status = v_support_status, updated_at = now()
  where id = v_finding_id and site_assessment_id = p_assessment_id
  returning * into v_finding;

  if v_finding.id is null then
    raise exception 'Finding could not be saved.' using errcode = 'P0002';
  end if;

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, metadata
  ) values (
    p_assessment_id, 'finding_saved', auth.uid(), public.current_app_role(),
    'internal', null, null,
    jsonb_build_object('finding_id', v_finding_id, 'support_status', v_support_status, 'link_count', jsonb_array_length(p_links))
  );

  return v_finding;
end;
$$;

create or replace function public.save_report_claim(
  p_assessment_id uuid,
  p_claim jsonb,
  p_links jsonb default '[]'::jsonb
)
returns public.report_claims
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_claim public.report_claims;
  v_claim_id uuid := coalesce(nullif(p_claim ->> 'id', '')::uuid, gen_random_uuid());
  v_support_status text := coalesce(nullif(p_claim ->> 'support_status', ''), 'unsupported');
  v_link jsonb;
begin
  if auth.uid() is null or not public.can_author_report(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_links) <> 'array' then
    raise exception 'Claim links must be supplied as an array.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.report_claims c
    where c.id = v_claim_id and c.site_assessment_id <> p_assessment_id
  ) then
    raise exception 'Report claim is not available.' using errcode = '42501';
  end if;

  insert into public.report_claims (
    id, report_section_id, site_assessment_id, claim_text, is_material,
    support_status, confidence_level, rationale, authored_by
  ) values (
    v_claim_id, (p_claim ->> 'report_section_id')::uuid, p_assessment_id,
    p_claim ->> 'claim_text', coalesce((p_claim ->> 'is_material')::boolean, true),
    'unsupported', coalesce(p_claim ->> 'confidence_level', 'unknown'),
    nullif(p_claim ->> 'rationale', ''), auth.uid()
  )
  on conflict (id) do update
  set report_section_id = excluded.report_section_id,
      claim_text = excluded.claim_text,
      is_material = excluded.is_material,
      support_status = 'unsupported',
      confidence_level = excluded.confidence_level,
      rationale = excluded.rationale,
      authored_by = auth.uid(),
      updated_at = now()
  where report_claims.site_assessment_id = p_assessment_id;

  delete from public.report_claim_evidence_links where report_claim_id = v_claim_id;
  for v_link in select value from jsonb_array_elements(p_links) loop
    insert into public.report_claim_evidence_links (
      report_claim_id, evidence_source_id, relationship, citation_locator,
      link_note, evidence_snapshot, linked_by
    ) values (
      v_claim_id, (v_link ->> 'evidence_source_id')::uuid,
      coalesce(nullif(v_link ->> 'relationship', ''), 'supporting'),
      nullif(v_link ->> 'citation_locator', ''), nullif(v_link ->> 'link_note', ''),
      '{}'::jsonb, auth.uid()
    );
  end loop;

  update public.report_claims
  set support_status = v_support_status, updated_at = now()
  where id = v_claim_id and site_assessment_id = p_assessment_id
  returning * into v_claim;

  if v_claim.id is null then
    raise exception 'Report claim could not be saved.' using errcode = 'P0002';
  end if;

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, metadata
  ) values (
    p_assessment_id, 'report_claim_saved', auth.uid(), public.current_app_role(),
    'internal', null, null,
    jsonb_build_object('report_claim_id', v_claim_id, 'material', v_claim.is_material, 'support_status', v_support_status, 'link_count', jsonb_array_length(p_links))
  );
  return v_claim;
end;
$$;

create or replace function public.save_evidence_gap(
  p_assessment_id uuid,
  p_gap jsonb
)
returns public.evidence_gaps
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_gap public.evidence_gaps;
  v_gap_id uuid := coalesce(nullif(p_gap ->> 'id', '')::uuid, gen_random_uuid());
begin
  if auth.uid() is null or not public.can_edit_assessment(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.evidence_gaps g
    where g.id = v_gap_id and g.site_assessment_id <> p_assessment_id
  ) then
    raise exception 'Evidence gap is not available.' using errcode = '42501';
  end if;

  insert into public.evidence_gaps (
    id, site_assessment_id, category, title, description, impact, severity,
    owner_id, due_at, status, blocks_confidence, blocks_review, blocks_delivery,
    resolution_type, resolution_note, resolved_source_id, approved_exception_id,
    created_by
  ) values (
    v_gap_id, p_assessment_id, coalesce(p_gap ->> 'category', 'other'),
    p_gap ->> 'title', nullif(p_gap ->> 'description', ''), p_gap ->> 'impact',
    coalesce(p_gap ->> 'severity', 'medium'), nullif(p_gap ->> 'owner_id', '')::uuid,
    nullif(p_gap ->> 'due_at', '')::timestamptz, coalesce(p_gap ->> 'status', 'open'),
    coalesce((p_gap ->> 'blocks_confidence')::boolean, true),
    coalesce((p_gap ->> 'blocks_review')::boolean, false),
    coalesce((p_gap ->> 'blocks_delivery')::boolean, false),
    nullif(p_gap ->> 'resolution_type', ''), nullif(p_gap ->> 'resolution_note', ''),
    nullif(p_gap ->> 'resolved_source_id', '')::uuid,
    nullif(p_gap ->> 'approved_exception_id', '')::uuid, auth.uid()
  )
  on conflict (id) do update
  set category = excluded.category,
      title = excluded.title,
      description = excluded.description,
      impact = excluded.impact,
      severity = excluded.severity,
      owner_id = excluded.owner_id,
      due_at = excluded.due_at,
      status = excluded.status,
      blocks_confidence = excluded.blocks_confidence,
      blocks_review = excluded.blocks_review,
      blocks_delivery = excluded.blocks_delivery,
      resolution_type = excluded.resolution_type,
      resolution_note = excluded.resolution_note,
      resolved_source_id = excluded.resolved_source_id,
      approved_exception_id = excluded.approved_exception_id,
      updated_at = now()
  where evidence_gaps.site_assessment_id = p_assessment_id
  returning * into v_gap;

  if v_gap.id is null then
    raise exception 'Evidence gap could not be saved.' using errcode = 'P0002';
  end if;

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, metadata
  ) values (
    p_assessment_id, 'evidence_gap_saved', auth.uid(), public.current_app_role(),
    'internal', null, null, v_gap.status,
    jsonb_build_object('evidence_gap_id', v_gap_id, 'severity', v_gap.severity, 'blocks_delivery', v_gap.blocks_delivery)
  );
  return v_gap;
end;
$$;

create or replace function public.approve_delivery_exception(
  p_assessment_id uuid,
  p_blocker_key text,
  p_reason text,
  p_expires_at timestamptz default null
)
returns public.assessment_delivery_exceptions
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_exception public.assessment_delivery_exceptions;
  v_role public.app_role := public.current_app_role();
begin
  if auth.uid() is null or v_role not in ('admin', 'reviewer')
     or not public.can_access_assessment(p_assessment_id) then
    raise exception 'Only an authorised administrator or reviewer can approve an exception.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'An exception requires a substantive reason.' using errcode = '22023';
  end if;

  insert into public.assessment_delivery_exceptions (
    site_assessment_id, blocker_key, reason, approved_by, approved_role, expires_at
  ) values (
    p_assessment_id, p_blocker_key, p_reason, auth.uid(), v_role, p_expires_at
  ) returning * into v_exception;

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, reason, metadata
  ) values (
    p_assessment_id, 'delivery_exception_approved', auth.uid(), v_role,
    'internal', 'assessment_delivery_exceptions', v_exception.id::text,
    p_reason, jsonb_build_object('blocker_key', p_blocker_key, 'expires_at', p_expires_at)
  );
  return v_exception;
end;
$$;

create or replace function public.run_assessment_preflight(
  p_assessment_id uuid,
  p_purpose text default 'review'
)
returns public.assessment_preflight_runs
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_run public.assessment_preflight_runs;
  v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_effective_blockers jsonb := '[]'::jsonb;
  v_bypassed jsonb := '[]'::jsonb;
  v_blocker jsonb;
  v_exception public.assessment_delivery_exceptions;
  v_missing_required integer := 0;
  v_review_required boolean := false;
  v_lineage_snapshot jsonb;
begin
  if p_purpose not in ('delivery', 'finalization', 'review') then
    raise exception 'Preflight purpose is invalid.' using errcode = '22023';
  end if;
  if auth.uid() is null or not public.can_author_report(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.evidence_sources e where e.site_assessment_id = p_assessment_id) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'no_evidence_sources', 'label', 'Evidence library is empty',
      'remediation', 'Add and validate at least one evidence source.'
    ));
  end if;

  for v_blocker in
    select jsonb_build_object(
      'key', 'incomplete_evidence_metadata:' || e.id::text,
      'label', 'Evidence metadata is incomplete: ' || e.title,
      'remediation', 'Add summary, confidence, source location, publisher/date where applicable, limitations and notes.'
    )
    from public.evidence_sources e
    where e.site_assessment_id = p_assessment_id
      and (
        e.confidence_level = 'unknown'
        or nullif(btrim(coalesce(e.summary, '')), '') is null
        or nullif(btrim(coalesce(e.notes, '')), '') is null
        or nullif(btrim(coalesce(e.url, '')), '') is null and nullif(btrim(coalesce(e.file_reference, '')), '') is null
        or e.source_type in ('commercial_dataset', 'government_regulator', 'official_iso_rto', 'public_gis_dataset', 'utility_tsp_dsp')
           and nullif(btrim(coalesce(e.publisher, '')), '') is null
        or e.url is not null and e.accessed_at is null
        or e.source_type in ('commercial_dataset', 'unverified_web')
           and nullif(btrim(coalesce(e.license_notes, e.limitation_notes, '')), '') is null
      )
  loop
    v_blockers := v_blockers || jsonb_build_array(v_blocker);
  end loop;

  for v_blocker in
    select jsonb_build_object(
      'key', 'unresolved_critical_finding:' || f.id::text,
      'label', 'Critical finding remains unresolved: ' || f.title,
      'remediation', 'Resolve or supersede the finding, or obtain an approved exception.'
    )
    from public.assessment_findings f
    where f.site_assessment_id = p_assessment_id
      and f.risk_level = 'critical'
      and f.status not in ('resolved', 'superseded')
  loop
    v_blockers := v_blockers || jsonb_build_array(v_blocker);
  end loop;

  for v_blocker in
    select jsonb_build_object(
      'key', 'unsupported_critical_finding:' || f.id::text,
      'label', 'Critical finding lacks supporting evidence: ' || f.title,
      'remediation', 'Link a supporting source, revise the finding, or obtain an approved exception.'
    )
    from public.assessment_findings f
    where f.site_assessment_id = p_assessment_id
      and f.risk_level = 'critical'
      and f.status not in ('resolved', 'superseded')
      and not exists (
        select 1 from public.finding_evidence_links l
        where l.finding_id = f.id and l.relationship = 'supporting'
      )
  loop
    v_blockers := v_blockers || jsonb_build_array(v_blocker);
  end loop;

  for v_blocker in
    select jsonb_build_object(
      'key', 'unsupported_material_claim:' || c.id::text,
      'label', 'Material report claim is unsupported',
      'detail', c.claim_text,
      'remediation', 'Link supporting evidence, mark the claim non-material, or obtain an approved exception.'
    )
    from public.report_claims c
    where c.site_assessment_id = p_assessment_id
      and c.is_material
      and not exists (
        select 1 from public.report_claim_evidence_links l
        where l.report_claim_id = c.id and l.relationship = 'supporting'
      )
  loop
    v_blockers := v_blockers || jsonb_build_array(v_blocker);
  end loop;

  for v_blocker in
    select jsonb_build_object(
      'key', 'open_preflight_gap:' || g.id::text,
      'label', 'Open evidence gap blocks this preflight: ' || g.title,
      'detail', g.impact,
      'remediation', 'Resolve from a source, accept the unknown with rationale, or attach an approved exception.'
    )
    from public.evidence_gaps g
    where g.site_assessment_id = p_assessment_id
      and g.status in ('in_progress', 'open')
      and (
        g.severity = 'critical'
        or p_purpose in ('finalization', 'review') and g.blocks_review
        or p_purpose in ('delivery', 'finalization') and g.blocks_delivery
      )
  loop
    v_blockers := v_blockers || jsonb_build_array(v_blocker);
  end loop;

  for v_blocker in
    select jsonb_build_object(
      'key', 'open_confidence_gap:' || g.id::text,
      'label', 'Open evidence gap blocks confidence: ' || g.title,
      'detail', g.impact,
      'remediation', 'Resolve the gap, accept the unknown with rationale, or obtain an approved exception.'
    )
    from public.evidence_gaps g
    where g.site_assessment_id = p_assessment_id
      and g.status in ('in_progress', 'open')
      and g.blocks_confidence
  loop
    v_blockers := v_blockers || jsonb_build_array(v_blocker);
  end loop;

  if not exists (
    select 1 from (
      select c.completed_component_count, c.overall_score
      from public.assessment_score_calculations c
      where c.site_assessment_id = p_assessment_id
      order by c.created_at desc
      limit 1
    ) latest
    where latest.completed_component_count = 7 and latest.overall_score is not null
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'score_incomplete', 'label', 'Weighted scorecard is incomplete',
      'remediation', 'Complete all seven score components and recalculate readiness.'
    ));
  end if;

  if not exists (
    select 1 from public.assessment_verdicts v
    where v.site_assessment_id = p_assessment_id
      and v.approved_by_analyst
      and v.confidence_level in ('high', 'low', 'medium')
      and nullif(btrim(coalesce(v.summary, '')), '') is not null
      and nullif(btrim(coalesce(v.conditions, '')), '') is not null
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'verdict_incomplete', 'label', 'Approved canonical verdict is incomplete',
      'remediation', 'Record and approve the verdict, rationale, conditions and confidence.'
    ));
  end if;

  select (
    coalesce(a.target_load_mw, 0) >= 75
    or nullif(btrim(coalesce(a.backup_generation_assumptions, '')), '') is not null
    or nullif(btrim(coalesce(a.battery_storage_assumptions, '')), '') is not null
    or coalesce(pr.project_type, '') = 'investor_underwriting'
    or exists (
      select 1 from public.assessment_findings f
      where f.site_assessment_id = a.id and f.risk_level = 'critical'
        and f.status not in ('resolved', 'superseded')
    )
    or exists (
      select 1 from public.assessment_scores s
      where s.site_assessment_id = a.id
        and s.module_key in ('interconnection_readiness', 'reliability_risk')
        and s.score < 70
    )
  ) into v_review_required
  from public.site_assessments a
  join public.projects pr on pr.id = a.project_id
  where a.id = p_assessment_id;

  if v_review_required and not exists (
    select 1 from public.expert_reviews r
    where r.site_assessment_id = p_assessment_id and r.status = 'approved'
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'review_incomplete', 'label', 'Required expert review is not approved',
      'remediation', 'Complete the triggered expert review and resolve requested changes.'
    ));
  end if;

  if not exists (
    select 1
    from public.report_templates rt
    join public.site_assessments a on a.id = p_assessment_id
    where rt.is_active and rt.report_type = 'single_site'
      and rt.market_region = coalesce(nullif(a.market_region, ''), 'ERCOT')
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'no_active_report_template', 'label', 'No active report template matches the assessment market',
      'remediation', 'Activate a single-site report template for the assessment market.'
    ));
  end if;

  select count(*) into v_missing_required
  from public.report_template_sections t
  join public.report_templates rt on rt.id = t.template_id and rt.is_active
  join public.site_assessments a on a.id = p_assessment_id
  where t.is_required
    and rt.report_type = 'single_site'
    and rt.market_region = coalesce(nullif(a.market_region, ''), 'ERCOT')
    and not exists (
      select 1 from public.assessment_report_sections s
      where s.site_assessment_id = p_assessment_id
        and s.template_section_id = t.id
        and s.status in ('final', 'ready')
        and nullif(btrim(coalesce(s.content, '')), '') is not null
    );

  if v_missing_required > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'required_sections_incomplete',
      'label', format('%s required report section(s) are incomplete', v_missing_required),
      'remediation', 'Complete required sections and mark each one ready.'
    ));
  end if;

  for v_blocker in
    select jsonb_build_object(
      'key', 'section_claim_lineage_missing:' || s.id::text,
      'label', 'Required report section has no material claim lineage: ' || s.title,
      'remediation', 'Record the section material claim(s) and link their evidence before finalization.'
    )
    from public.assessment_report_sections s
    join public.report_template_sections t on t.id = s.template_section_id and t.is_required
    where s.site_assessment_id = p_assessment_id
      and s.status in ('final', 'ready')
      and nullif(btrim(coalesce(s.content, '')), '') is not null
      and not exists (
        select 1 from public.report_claims c
        where c.report_section_id = s.id and c.is_material
      )
  loop
    v_blockers := v_blockers || jsonb_build_array(v_blocker);
  end loop;

  if not exists (
    select 1 from public.assessment_verdicts v
    where v.site_assessment_id = p_assessment_id
      and nullif(btrim(coalesce(v.limitations_note, '')), '') is not null
  ) or not exists (
    select 1 from public.assessment_report_sections s
    where s.site_assessment_id = p_assessment_id
      and s.section_key = 'assumptions_limitations'
      and s.status in ('final', 'ready')
      and nullif(btrim(coalesce(s.content, '')), '') is not null
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'limitations_incomplete', 'label', 'Limitations are incomplete',
      'remediation', 'Complete verdict limitations and the ready assumptions-and-limitations section.'
    ));
  end if;

  for v_blocker in
    select jsonb_build_object(
      'key', 'high_risk_finding_without_support:' || f.id::text,
      'label', 'High-risk finding has no supporting evidence: ' || f.title
    )
    from public.assessment_findings f
    where f.site_assessment_id = p_assessment_id and f.risk_level = 'high'
      and f.status not in ('resolved', 'superseded')
      and not exists (
        select 1 from public.finding_evidence_links l
        where l.finding_id = f.id and l.relationship = 'supporting'
      )
  loop
    v_warnings := v_warnings || jsonb_build_array(v_blocker);
  end loop;

  for v_blocker in select value from jsonb_array_elements(v_blockers) loop
    v_exception := null;
    select * into v_exception
    from public.assessment_delivery_exceptions x
    where x.site_assessment_id = p_assessment_id
      and x.blocker_key in (v_blocker ->> 'key', '*')
      and x.revoked_at is null
      and (x.expires_at is null or x.expires_at > now())
    order by x.approved_at desc
    limit 1;

    if v_exception.id is null then
      v_effective_blockers := v_effective_blockers || jsonb_build_array(v_blocker);
    else
      v_bypassed := v_bypassed || jsonb_build_array(
        v_blocker || jsonb_build_object(
          'exception_id', v_exception.id,
          'exception_reason', v_exception.reason,
          'approved_by', v_exception.approved_by,
          'approved_at', v_exception.approved_at
        )
      );
    end if;
  end loop;

  select jsonb_build_object(
    'evidence_sources', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at)
      from public.evidence_sources e where e.site_assessment_id = p_assessment_id
    ), '[]'::jsonb),
    'finding_links', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at)
      from public.finding_evidence_links l
      join public.assessment_findings f on f.id = l.finding_id
      where f.site_assessment_id = p_assessment_id
    ), '[]'::jsonb),
    'claims', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
      from public.report_claims c where c.site_assessment_id = p_assessment_id
    ), '[]'::jsonb),
    'claim_evidence_links', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at)
      from public.report_claim_evidence_links l
      join public.report_claims c on c.id = l.report_claim_id
      where c.site_assessment_id = p_assessment_id
    ), '[]'::jsonb),
    'evidence_gaps', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.created_at)
      from public.evidence_gaps g where g.site_assessment_id = p_assessment_id
    ), '[]'::jsonb)
  ) into v_lineage_snapshot;

  insert into public.assessment_preflight_runs (
    site_assessment_id, purpose, status, blockers, warnings,
    bypassed_blockers, lineage_snapshot, run_by, run_role
  ) values (
    p_assessment_id, p_purpose,
    case when jsonb_array_length(v_effective_blockers) = 0 then 'passed' else 'blocked' end,
    v_effective_blockers, v_warnings, v_bypassed, v_lineage_snapshot,
    auth.uid(), public.current_app_role()
  ) returning * into v_run;

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, metadata
  ) values (
    p_assessment_id, 'report_preflight_run', auth.uid(), public.current_app_role(),
    'internal', 'assessment_preflight_runs', v_run.id::text, v_run.status,
    jsonb_build_object(
      'purpose', p_purpose,
      'blocker_count', jsonb_array_length(v_effective_blockers),
      'warning_count', jsonb_array_length(v_warnings),
      'bypassed_count', jsonb_array_length(v_bypassed)
    )
  );
  return v_run;
end;
$$;

create or replace function public.enforce_report_finalization_path()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'assessment_report_sections'
       and old.status = 'final'
       and coalesce(current_setting('app.report_finalization_authorized', true), '') <> 'true' then
      raise exception 'Final report sections are locked and cannot be deleted directly.' using errcode = '42501';
    end if;
    if tg_table_name = 'assessment_report_exports'
       and old.status in ('exported', 'ready_for_review')
       and coalesce(current_setting('app.report_finalization_authorized', true), '') <> 'true' then
      raise exception 'Finalized report packages are locked and cannot be deleted directly.' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_table_name = 'assessment_report_sections'
     and tg_op = 'UPDATE'
     and old.status = 'final'
     and new is distinct from old
     and coalesce(current_setting('app.report_finalization_authorized', true), '') <> 'true' then
    raise exception 'Final report sections are locked and cannot be edited directly.' using errcode = '42501';
  end if;
  if tg_table_name = 'assessment_report_exports'
     and tg_op = 'UPDATE'
     and old.status in ('exported', 'ready_for_review')
     and new is distinct from old
     and coalesce(current_setting('app.report_finalization_authorized', true), '') <> 'true' then
    raise exception 'Finalized report packages are locked and cannot be edited directly.' using errcode = '42501';
  end if;
  if tg_table_name = 'assessment_report_sections'
     and new.status = 'final'
     and (tg_op = 'INSERT' or new.status is distinct from old.status)
     and coalesce(current_setting('app.report_finalization_authorized', true), '') <> 'true' then
    raise exception 'Final report sections must be changed through finalize_assessment_report().' using errcode = '42501';
  end if;
  if tg_table_name = 'assessment_report_exports'
     and new.status in ('exported', 'ready_for_review')
     and (tg_op = 'INSERT' or new.status is distinct from old.status)
     and coalesce(current_setting('app.report_finalization_authorized', true), '') <> 'true' then
    raise exception 'Report finalization must use finalize_assessment_report().' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_report_sections_controlled_finalization on public.assessment_report_sections;
create trigger assessment_report_sections_controlled_finalization
  before insert or update or delete on public.assessment_report_sections
  for each row execute function public.enforce_report_finalization_path();

drop trigger if exists assessment_report_exports_controlled_finalization on public.assessment_report_exports;
create trigger assessment_report_exports_controlled_finalization
  before insert or update or delete on public.assessment_report_exports
  for each row execute function public.enforce_report_finalization_path();

create or replace function public.finalize_assessment_report(
  p_assessment_id uuid,
  p_export_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_preflight public.assessment_preflight_runs;
  v_export public.assessment_report_exports;
begin
  if auth.uid() is null or not public.can_author_report(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  if p_export_id is not null then
    select * into v_export from public.assessment_report_exports
    where id = p_export_id and site_assessment_id = p_assessment_id for update;
  else
    select * into v_export from public.assessment_report_exports
    where site_assessment_id = p_assessment_id and export_type = 'print_preview'
    order by updated_at desc limit 1 for update;
  end if;
  if v_export.id is null then
    raise exception 'Initialize the report package before finalization.' using errcode = '22023';
  end if;

  select * into v_preflight from public.run_assessment_preflight(p_assessment_id, 'finalization');
  if v_preflight.status <> 'passed' then
    return jsonb_build_object(
      'finalized', false,
      'export', to_jsonb(v_export),
      'preflight', to_jsonb(v_preflight)
    );
  end if;

  perform set_config('app.report_finalization_authorized', 'true', true);
  update public.assessment_report_sections
  set status = 'final', updated_at = now()
  where site_assessment_id = p_assessment_id
    and status = 'ready'
    and nullif(btrim(coalesce(content, '')), '') is not null;

  update public.assessment_report_exports
  set status = 'ready_for_review', ready_for_review_at = now(), updated_at = now()
  where id = v_export.id
  returning * into v_export;
  perform set_config('app.report_finalization_authorized', '', true);

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, metadata
  ) values (
    p_assessment_id, 'report_finalized_for_review', auth.uid(), public.current_app_role(),
    'internal', 'assessment_report_exports', v_export.id::text, 'ready_for_review',
    jsonb_build_object('preflight_run_id', v_preflight.id)
  );

  return jsonb_build_object('finalized', true, 'export', to_jsonb(v_export), 'preflight', to_jsonb(v_preflight));
end;
$$;

alter table public.evidence_source_events enable row level security;
alter table public.assessment_delivery_exceptions enable row level security;
alter table public.evidence_gaps enable row level security;
alter table public.report_claims enable row level security;
alter table public.report_claim_evidence_links enable row level security;
alter table public.report_section_finding_links enable row level security;
alter table public.assessment_preflight_runs enable row level security;

create policy evidence_source_events_internal_read on public.evidence_source_events
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

create policy delivery_exceptions_internal_read on public.assessment_delivery_exceptions
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));
create policy delivery_exceptions_reviewer_manage on public.assessment_delivery_exceptions
  for update to authenticated
  using (public.current_app_role() in ('admin', 'reviewer') and public.can_access_assessment(site_assessment_id))
  with check (public.current_app_role() in ('admin', 'reviewer') and public.can_access_assessment(site_assessment_id));

create policy evidence_gaps_scoped_read on public.evidence_gaps
  for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy evidence_gaps_analyst_manage on public.evidence_gaps
  for all to authenticated
  using (public.can_edit_assessment(site_assessment_id))
  with check (public.can_edit_assessment(site_assessment_id));

create policy report_claims_scoped_read on public.report_claims
  for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy report_claims_author_manage on public.report_claims
  for all to authenticated
  using (public.can_author_report(site_assessment_id))
  with check (public.can_author_report(site_assessment_id));

create policy report_claim_evidence_links_scoped_read on public.report_claim_evidence_links
  for select to authenticated using (exists (
    select 1 from public.report_claims c
    where c.id = report_claim_id and public.can_access_assessment(c.site_assessment_id)
  ));
create policy report_claim_evidence_links_author_manage on public.report_claim_evidence_links
  for all to authenticated using (exists (
    select 1 from public.report_claims c
    where c.id = report_claim_id and public.can_author_report(c.site_assessment_id)
  )) with check (exists (
    select 1 from public.report_claims c
    where c.id = report_claim_id and public.can_author_report(c.site_assessment_id)
  ));

create policy report_section_finding_links_scoped_read on public.report_section_finding_links
  for select to authenticated using (exists (
    select 1 from public.assessment_report_sections s
    where s.id = report_section_id and public.can_access_assessment(s.site_assessment_id)
  ));
create policy report_section_finding_links_author_manage on public.report_section_finding_links
  for all to authenticated using (exists (
    select 1 from public.assessment_report_sections s
    where s.id = report_section_id and public.can_author_report(s.site_assessment_id)
  )) with check (exists (
    select 1 from public.assessment_report_sections s
    where s.id = report_section_id and public.can_author_report(s.site_assessment_id)
  ));

create policy assessment_preflight_runs_internal_read on public.assessment_preflight_runs
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));

grant select on public.evidence_source_events to authenticated;
grant select, update on public.assessment_delivery_exceptions to authenticated;
grant select, insert, update, delete on public.evidence_gaps to authenticated;
grant select, insert, update, delete on public.report_claims to authenticated;
grant select, insert, update, delete on public.report_claim_evidence_links to authenticated;
grant select, insert, update, delete on public.report_section_finding_links to authenticated;
grant select on public.assessment_preflight_runs to authenticated;

revoke all on function public.save_assessment_finding(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.save_report_claim(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.save_evidence_gap(uuid, jsonb) from public, anon;
revoke all on function public.approve_delivery_exception(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.run_assessment_preflight(uuid, text) from public, anon;
revoke all on function public.finalize_assessment_report(uuid, uuid) from public, anon;
grant execute on function public.save_assessment_finding(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.save_report_claim(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.save_evidence_gap(uuid, jsonb) to authenticated;
grant execute on function public.approve_delivery_exception(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.run_assessment_preflight(uuid, text) to authenticated;
grant execute on function public.finalize_assessment_report(uuid, uuid) to authenticated;

revoke all on function public.capture_evidence_source_event() from public, anon, authenticated;
revoke all on function public.increment_evidence_metadata_version() from public, anon, authenticated;
revoke all on function public.validate_evidence_gap_resolution() from public, anon, authenticated;
revoke all on function public.validate_delivery_exception_update() from public, anon, authenticated;
revoke all on function public.validate_finding_support_status() from public, anon, authenticated;
revoke all on function public.validate_report_lineage_assessment() from public, anon, authenticated;
revoke all on function public.validate_report_claim_support_status() from public, anon, authenticated;
revoke all on function public.enforce_immutable_preflight_history() from public, anon, authenticated;
revoke all on function public.enforce_report_finalization_path() from public, anon, authenticated;

notify pgrst, 'reload schema';
