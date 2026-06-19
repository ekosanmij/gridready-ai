-- REV-001 / REV-002 / REP-008: structured expert review and exact report-version approval.

alter table public.assessment_report_exports
  add column if not exists version_number integer not null default 0,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalization_snapshot jsonb not null default '{}'::jsonb;

alter table public.assessment_report_exports
  drop constraint if exists assessment_report_exports_version_number_check;
alter table public.assessment_report_exports
  add constraint assessment_report_exports_version_number_check check (version_number >= 0);

alter table public.expert_reviews
  add column if not exists report_export_id uuid references public.assessment_report_exports(id) on delete set null,
  add column if not exists report_export_version integer,
  add column if not exists reviewer_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_by uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists decision_by uuid references auth.users(id) on delete set null,
  add column if not exists decision_at timestamptz,
  add column if not exists decision_reason text,
  add column if not exists report_snapshot jsonb not null default '{}'::jsonb;

alter table public.expert_reviews
  drop constraint if exists expert_reviews_status_check;
alter table public.expert_reviews
  add constraint expert_reviews_status_check check (
    status in (
      'not_started',
      'requested',
      'in_review',
      'changes_requested',
      'approved',
      'rejected',
      'not_required'
    )
  );

alter table public.expert_reviews
  drop constraint if exists expert_reviews_report_export_version_check;
alter table public.expert_reviews
  add constraint expert_reviews_report_export_version_check check (
    report_export_version is null or report_export_version >= 0
  );

create index if not exists assessment_report_exports_assessment_version_idx
  on public.assessment_report_exports (site_assessment_id, version_number desc, updated_at desc);
create index if not exists expert_reviews_report_version_idx
  on public.expert_reviews (site_assessment_id, report_export_id, report_export_version, status);
create index if not exists expert_reviews_reviewer_status_idx
  on public.expert_reviews (reviewer_id, status, updated_at desc);

create table if not exists public.expert_review_checklist_items (
  id uuid primary key default gen_random_uuid(),
  expert_review_id uuid not null references public.expert_reviews(id) on delete cascade,
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  item_key text not null,
  label text not null,
  status text not null default 'not_checked',
  reviewer_comment text,
  required_change text,
  sort_order integer not null default 0,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_review_checklist_items_key_check check (length(btrim(item_key)) > 0),
  constraint expert_review_checklist_items_label_check check (length(btrim(label)) > 0),
  constraint expert_review_checklist_items_status_check check (
    status in ('not_checked', 'pass', 'warning', 'fail', 'not_applicable')
  ),
  constraint expert_review_checklist_items_unique unique (expert_review_id, item_key)
);

create index if not exists expert_review_checklist_items_review_idx
  on public.expert_review_checklist_items (expert_review_id, sort_order, item_key);
create index if not exists expert_review_checklist_items_assessment_status_idx
  on public.expert_review_checklist_items (site_assessment_id, status);

create table if not exists public.expert_review_decisions (
  id uuid primary key default gen_random_uuid(),
  expert_review_id uuid not null references public.expert_reviews(id) on delete restrict,
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  report_export_id uuid not null references public.assessment_report_exports(id) on delete restrict,
  report_export_version integer not null,
  decision text not null,
  decision_reason text,
  review_snapshot jsonb not null,
  checklist_snapshot jsonb not null,
  decided_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint expert_review_decisions_version_check check (report_export_version > 0),
  constraint expert_review_decisions_status_check check (decision in ('changes_requested', 'approved', 'rejected'))
);

create index if not exists expert_review_decisions_assessment_version_idx
  on public.expert_review_decisions (site_assessment_id, report_export_version desc, created_at desc);

create or replace function public.prevent_expert_review_decision_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Expert review decision history is immutable.' using errcode = '42501';
end;
$$;

drop trigger if exists expert_review_decisions_immutable on public.expert_review_decisions;
create trigger expert_review_decisions_immutable
  before update or delete on public.expert_review_decisions
  for each row execute function public.prevent_expert_review_decision_mutation();

drop trigger if exists expert_review_checklist_items_set_updated_at on public.expert_review_checklist_items;
create trigger expert_review_checklist_items_set_updated_at
  before update on public.expert_review_checklist_items
  for each row execute function public.set_scorecard_updated_at();

create or replace function public.current_report_export_snapshot(p_export_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_snapshot jsonb;
begin
  select jsonb_build_object(
    'captured_at', now(),
    'export', jsonb_build_object(
      'id', e.id,
      'site_assessment_id', e.site_assessment_id,
      'template_id', e.template_id,
      'export_type', e.export_type,
      'status', e.status,
      'version_number', e.version_number,
      'ready_for_review_at', e.ready_for_review_at,
      'finalized_at', e.finalized_at,
      'updated_at', e.updated_at
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'template_section_id', s.template_section_id,
        'section_key', s.section_key,
        'title', s.title,
        'status', s.status,
        'is_edited', s.is_edited,
        'content', s.content,
        'generation_notes', s.generation_notes,
        'updated_at', s.updated_at
      ) order by s.section_key)
      from public.assessment_report_sections s
      where s.site_assessment_id = e.site_assessment_id
    ), '[]'::jsonb),
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'report_section_id', c.report_section_id,
        'claim_text', c.claim_text,
        'support_status', c.support_status,
        'confidence_level', c.confidence_level,
        'is_material', c.is_material,
        'rationale', c.rationale,
        'updated_at', c.updated_at
      ) order by c.created_at)
      from public.report_claims c
      where c.site_assessment_id = e.site_assessment_id
    ), '[]'::jsonb),
    'latest_preflight', (
      select jsonb_build_object(
        'id', p.id,
        'purpose', p.purpose,
        'status', p.status,
        'created_at', p.created_at
      )
      from public.assessment_preflight_runs p
      where p.site_assessment_id = e.site_assessment_id
      order by p.created_at desc
      limit 1
    )
  ) into v_snapshot
  from public.assessment_report_exports e
  where e.id = p_export_id;

  return coalesce(v_snapshot, '{}'::jsonb);
end;
$$;

create or replace function public.enforce_expert_review_workflow_path()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.expert_review_save_authorized', true), '') = 'true' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'Expert reviews must be changed through save_expert_review_packet().' using errcode = '42501';
end;
$$;

drop trigger if exists expert_reviews_controlled_workflow on public.expert_reviews;
create trigger expert_reviews_controlled_workflow
  before insert or update or delete on public.expert_reviews
  for each row execute function public.enforce_expert_review_workflow_path();

drop trigger if exists expert_review_checklist_items_controlled_workflow on public.expert_review_checklist_items;
create trigger expert_review_checklist_items_controlled_workflow
  before insert or update or delete on public.expert_review_checklist_items
  for each row execute function public.enforce_expert_review_workflow_path();

create or replace function public.save_expert_review_packet(
  p_assessment_id uuid,
  p_review jsonb,
  p_checklist jsonb default '[]'::jsonb
)
returns public.expert_reviews
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role public.app_role := public.current_app_role();
  v_review public.expert_reviews;
  v_review_id uuid := nullif(p_review ->> 'id', '')::uuid;
  v_export_id uuid := nullif(p_review ->> 'report_export_id', '')::uuid;
  v_export public.assessment_report_exports;
  v_snapshot jsonb := '{}'::jsonb;
  v_review_type text := coalesce(nullif(p_review ->> 'review_type', ''), 'final_report');
  v_status text := coalesce(nullif(p_review ->> 'status', ''), 'not_started');
  v_reviewer_name text := nullif(btrim(coalesce(p_review ->> 'reviewer_name', '')), '');
  v_reviewer_id uuid := nullif(p_review ->> 'reviewer_id', '')::uuid;
  v_trigger_reason text := nullif(btrim(coalesce(p_review ->> 'trigger_reason', '')), '');
  v_comments text := nullif(btrim(coalesce(p_review ->> 'comments', '')), '');
  v_required_changes text := nullif(btrim(coalesce(p_review ->> 'required_changes', '')), '');
  v_decision_reason text := nullif(btrim(coalesce(p_review ->> 'decision_reason', '')), '');
  v_item jsonb;
  v_item_status text;
  v_has_failed_check boolean := false;
  v_version_changed boolean := false;
begin
  if auth.uid() is null or not public.can_author_report(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  if v_role not in ('admin', 'analyst', 'reviewer') then
    raise exception 'Expert review changes require an internal role.' using errcode = '42501';
  end if;

  if v_status not in ('not_started', 'requested', 'in_review', 'changes_requested', 'approved', 'rejected', 'not_required') then
    raise exception 'Expert review status is invalid.' using errcode = '22023';
  end if;

  if v_status in ('changes_requested', 'approved', 'rejected') and v_role not in ('admin', 'reviewer') then
    raise exception 'Only an administrator or reviewer can record a review decision.' using errcode = '42501';
  end if;

  if v_review_id is not null then
    select * into v_review
    from public.expert_reviews r
    where r.id = v_review_id and r.site_assessment_id = p_assessment_id
    for update;
  end if;

  if v_review.id is null and v_review_type = 'final_report' then
    select * into v_review
    from public.expert_reviews r
    where r.site_assessment_id = p_assessment_id and r.review_type = 'final_report'
    order by r.created_at desc
    limit 1
    for update;
  end if;

  if v_status in ('requested', 'in_review', 'changes_requested', 'approved', 'rejected') then
    if v_export_id is not null then
      select * into v_export
      from public.assessment_report_exports e
      where e.id = v_export_id and e.site_assessment_id = p_assessment_id;
    else
      select * into v_export
      from public.assessment_report_exports e
      where e.site_assessment_id = p_assessment_id
        and e.status in ('ready_for_review', 'exported')
      order by e.version_number desc, e.ready_for_review_at desc nulls last, e.updated_at desc
      limit 1;
    end if;

    if v_status in ('changes_requested', 'approved', 'rejected')
      and (v_export.id is null or v_export.status not in ('ready_for_review', 'exported') or v_export.version_number <= 0) then
      raise exception 'Review decisions require a finalized report package version.' using errcode = '22023';
    end if;

    if v_export.id is not null and v_export.status in ('ready_for_review', 'exported') and v_export.version_number > 0 then
      v_snapshot := public.current_report_export_snapshot(v_export.id);
    else
      v_export := null;
    end if;
  end if;

  if v_status in ('changes_requested', 'approved', 'rejected')
    and (
      v_review.id is null
      or v_review.report_export_id is distinct from v_export.id
      or v_review.report_export_version is distinct from v_export.version_number
    ) then
    raise exception 'Assign the current finalized report version for review before recording a decision.' using errcode = '22023';
  end if;

  if v_status in ('requested', 'in_review') and v_review.id is not null and v_export.id is not null then
    v_version_changed := v_review.report_export_id is distinct from v_export.id
      or v_review.report_export_version is distinct from v_export.version_number;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) loop
    v_item_status := coalesce(nullif(v_item ->> 'status', ''), 'not_checked');
    if v_item_status not in ('not_checked', 'pass', 'warning', 'fail', 'not_applicable') then
      raise exception 'Expert review checklist status is invalid.' using errcode = '22023';
    end if;
    if v_item_status = 'fail' then
      v_has_failed_check := true;
    end if;
  end loop;

  if v_status = 'approved' then
    if jsonb_array_length(coalesce(p_checklist, '[]'::jsonb)) = 0 then
      raise exception 'Approval requires a completed review checklist.' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) item
      where coalesce(nullif(item.value ->> 'status', ''), 'not_checked') in ('fail', 'not_checked')
    ) then
      raise exception 'Approval requires every checklist item to be passed, warned, or marked not applicable.' using errcode = '22023';
    end if;
  end if;

  if v_status = 'changes_requested' and v_required_changes is null and not v_has_failed_check then
    raise exception 'Requested changes require required-change text or a failed checklist item.' using errcode = '22023';
  end if;

  if v_status = 'rejected' and v_decision_reason is null and v_comments is null then
    raise exception 'Rejected reviews require a decision reason or reviewer comments.' using errcode = '22023';
  end if;

  perform set_config('app.expert_review_save_authorized', 'true', true);

  if v_review.id is null then
    insert into public.expert_reviews (
      site_assessment_id, review_type, reviewer_name, reviewer_id, status,
      trigger_reason, comments, required_changes, approved_at,
      report_export_id, report_export_version, report_snapshot,
      assigned_by, assigned_at, submitted_by, submitted_at, decision_by,
      decision_at, decision_reason
    ) values (
      p_assessment_id, v_review_type, v_reviewer_name,
      coalesce(v_reviewer_id, case when v_role in ('admin', 'reviewer') then auth.uid() else null end),
      v_status, v_trigger_reason, v_comments, v_required_changes,
      case when v_status = 'approved' then now() else null end,
      v_export.id, v_export.version_number, v_snapshot,
      case when v_status in ('requested', 'in_review') then auth.uid() else null end,
      case when v_status in ('requested', 'in_review') then now() else null end,
      case when v_status in ('changes_requested', 'approved', 'rejected') then auth.uid() else null end,
      case when v_status in ('changes_requested', 'approved', 'rejected') then now() else null end,
      case when v_status in ('changes_requested', 'approved', 'rejected') then auth.uid() else null end,
      case when v_status in ('changes_requested', 'approved', 'rejected') then now() else null end,
      v_decision_reason
    )
    returning * into v_review;
  else
    update public.expert_reviews
    set review_type = v_review_type,
        reviewer_name = v_reviewer_name,
        reviewer_id = coalesce(v_reviewer_id, expert_reviews.reviewer_id, case when v_role in ('admin', 'reviewer') then auth.uid() else null end),
        status = v_status,
        trigger_reason = v_trigger_reason,
        comments = v_comments,
        required_changes = v_required_changes,
        approved_at = case when v_status = 'approved' then coalesce(expert_reviews.approved_at, now()) else null end,
        report_export_id = coalesce(v_export.id, expert_reviews.report_export_id),
        report_export_version = coalesce(v_export.version_number, expert_reviews.report_export_version),
        report_snapshot = case when v_export.id is not null then v_snapshot else expert_reviews.report_snapshot end,
        assigned_by = case when v_status in ('requested', 'in_review') and expert_reviews.assigned_at is null then auth.uid() else expert_reviews.assigned_by end,
        assigned_at = case when v_status in ('requested', 'in_review') and expert_reviews.assigned_at is null then now() else expert_reviews.assigned_at end,
        submitted_by = case when v_status in ('changes_requested', 'approved', 'rejected') then auth.uid() else expert_reviews.submitted_by end,
        submitted_at = case when v_status in ('changes_requested', 'approved', 'rejected') then now() else expert_reviews.submitted_at end,
        decision_by = case when v_status in ('changes_requested', 'approved', 'rejected') then auth.uid() else expert_reviews.decision_by end,
        decision_at = case when v_status in ('changes_requested', 'approved', 'rejected') then now() else expert_reviews.decision_at end,
        decision_reason = v_decision_reason,
        updated_at = now()
    where expert_reviews.id = v_review.id
    returning * into v_review;
  end if;

  if v_version_changed then
    update public.expert_review_checklist_items
    set status = 'not_checked', reviewer_comment = null, required_change = null,
        reviewed_by = null, reviewed_at = null, updated_at = now()
    where expert_review_id = v_review.id;
  else
    for v_item in select value from jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) loop
      insert into public.expert_review_checklist_items (
      expert_review_id, site_assessment_id, item_key, label, status,
      reviewer_comment, required_change, sort_order, reviewed_by, reviewed_at
    ) values (
      v_review.id,
      p_assessment_id,
      coalesce(nullif(v_item ->> 'item_key', ''), nullif(v_item ->> 'key', '')),
      coalesce(nullif(v_item ->> 'label', ''), coalesce(nullif(v_item ->> 'item_key', ''), nullif(v_item ->> 'key', ''))),
      coalesce(nullif(v_item ->> 'status', ''), 'not_checked'),
      nullif(btrim(coalesce(v_item ->> 'reviewer_comment', v_item ->> 'comment', '')), ''),
      nullif(btrim(coalesce(v_item ->> 'required_change', '')), ''),
      coalesce(nullif(v_item ->> 'sort_order', '')::integer, 0),
      case when coalesce(nullif(v_item ->> 'status', ''), 'not_checked') <> 'not_checked' then auth.uid() else null end,
      case when coalesce(nullif(v_item ->> 'status', ''), 'not_checked') <> 'not_checked' then now() else null end
    )
      on conflict (expert_review_id, item_key) do update
      set label = excluded.label,
          status = excluded.status,
          reviewer_comment = excluded.reviewer_comment,
          required_change = excluded.required_change,
          sort_order = excluded.sort_order,
          reviewed_by = excluded.reviewed_by,
          reviewed_at = excluded.reviewed_at,
          updated_at = now();
    end loop;
  end if;

  if v_status in ('changes_requested', 'approved', 'rejected') then
    insert into public.expert_review_decisions (
      expert_review_id, site_assessment_id, report_export_id, report_export_version,
      decision, decision_reason, review_snapshot, checklist_snapshot, decided_by
    ) values (
      v_review.id, p_assessment_id, v_review.report_export_id, v_review.report_export_version,
      v_status, v_decision_reason, to_jsonb(v_review),
      coalesce((
        select jsonb_agg(to_jsonb(ci) order by ci.sort_order, ci.item_key)
        from public.expert_review_checklist_items ci
        where ci.expert_review_id = v_review.id
      ), '[]'::jsonb),
      auth.uid()
    );
  end if;

  perform set_config('app.expert_review_save_authorized', '', true);

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, reason, metadata
  ) values (
    p_assessment_id, 'expert_review_' || v_status, auth.uid(), v_role,
    'internal', 'expert_reviews', v_review.id::text, v_status, v_decision_reason,
    jsonb_build_object(
      'review_type', v_review.review_type,
      'report_export_id', v_review.report_export_id,
      'report_export_version', v_review.report_export_version,
      'checklist_count', jsonb_array_length(coalesce(p_checklist, '[]'::jsonb))
    )
  );

  return v_review;
end;
$$;

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
  set status = 'ready_for_review',
      ready_for_review_at = now(),
      finalized_at = now(),
      version_number = coalesce(version_number, 0) + 1,
      updated_at = now()
  where id = v_export.id
  returning * into v_export;

  update public.assessment_report_exports
  set finalization_snapshot = public.current_report_export_snapshot(v_export.id)
  where id = v_export.id
  returning * into v_export;
  perform set_config('app.report_finalization_authorized', '', true);

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, metadata
  ) values (
    p_assessment_id, 'report_finalized_for_review', auth.uid(), public.current_app_role(),
    'internal', 'assessment_report_exports', v_export.id::text, 'ready_for_review',
    jsonb_build_object('preflight_run_id', v_preflight.id, 'version_number', v_export.version_number)
  );

  return jsonb_build_object('finalized', true, 'export', to_jsonb(v_export), 'preflight', to_jsonb(v_preflight));
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
  v_ready_export public.assessment_report_exports;
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

  if v_review_required and p_purpose in ('delivery', 'review') then
    select * into v_ready_export
    from public.assessment_report_exports e
    where e.site_assessment_id = p_assessment_id
      and e.status in ('ready_for_review', 'exported')
    order by e.version_number desc, e.ready_for_review_at desc nulls last, e.updated_at desc
    limit 1;

    if v_ready_export.id is null or not exists (
      select 1 from public.expert_reviews r
      where r.site_assessment_id = p_assessment_id
        and r.status = 'approved'
        and r.approved_at is not null
        and r.report_export_id = v_ready_export.id
        and r.report_export_version = v_ready_export.version_number
        and not exists (
          select 1 from public.expert_review_checklist_items ci
          where ci.expert_review_id = r.id
            and ci.status in ('fail', 'not_checked')
        )
    ) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'key', 'review_incomplete',
        'label', 'Required expert review is not approved for the current report version',
        'remediation', 'Finalize the report package, complete the review checklist, and approve that exact version.'
      ));
    end if;
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
    ), '[]'::jsonb),
    'report_export', case when v_ready_export.id is null then null else to_jsonb(v_ready_export) end,
    'expert_reviews', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.updated_at)
      from public.expert_reviews r where r.site_assessment_id = p_assessment_id
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

alter table public.expert_review_checklist_items enable row level security;
alter table public.expert_review_decisions enable row level security;

drop policy if exists expert_review_checklist_items_scoped_read on public.expert_review_checklist_items;
create policy expert_review_checklist_items_scoped_read on public.expert_review_checklist_items
  for select to authenticated
  using (public.can_access_assessment(site_assessment_id));

drop policy if exists expert_review_checklist_items_internal_manage on public.expert_review_checklist_items;
create policy expert_review_checklist_items_internal_manage on public.expert_review_checklist_items
  for all to authenticated
  using (public.can_author_report(site_assessment_id))
  with check (public.can_author_report(site_assessment_id));

grant select, insert, update, delete on public.expert_review_checklist_items to authenticated;

drop policy if exists expert_review_decisions_scoped_read on public.expert_review_decisions;
create policy expert_review_decisions_scoped_read on public.expert_review_decisions
  for select to authenticated
  using (public.can_access_assessment(site_assessment_id));

grant select on public.expert_review_decisions to authenticated;

revoke all on function public.current_report_export_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.save_expert_review_packet(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.enforce_expert_review_workflow_path() from public, anon, authenticated;
revoke all on function public.prevent_expert_review_decision_mutation() from public, anon, authenticated;
grant execute on function public.save_expert_review_packet(uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
