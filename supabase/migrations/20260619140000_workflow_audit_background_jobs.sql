-- WF-001 / WF-005 / PLAT-001 / SEC-003: canonical assessment transitions,
-- append-only activity events, and durable background jobs.

alter table public.uploaded_files
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.assessment_status_transitions (
  from_status text not null,
  to_status text not null,
  allowed_roles public.app_role[] not null,
  created_at timestamptz not null default now(),
  primary key (from_status, to_status),
  constraint assessment_status_transition_change_check check (from_status <> to_status)
);

insert into public.assessment_status_transitions (from_status, to_status, allowed_roles)
values
  ('draft', 'intake_incomplete', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('draft', 'intake_complete', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('draft', 'archived', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('intake_incomplete', 'draft', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('intake_incomplete', 'intake_complete', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('intake_incomplete', 'archived', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('intake_complete', 'intake_incomplete', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('intake_complete', 'in_analyst_review', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('intake_complete', 'archived', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('in_analyst_review', 'intake_incomplete', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('in_analyst_review', 'in_expert_review', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('in_analyst_review', 'report_drafting', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('in_analyst_review', 'archived', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('in_expert_review', 'in_analyst_review', array['admin'::public.app_role, 'analyst'::public.app_role, 'reviewer'::public.app_role]),
  ('in_expert_review', 'report_drafting', array['admin'::public.app_role, 'analyst'::public.app_role, 'reviewer'::public.app_role]),
  ('in_expert_review', 'final_review', array['admin'::public.app_role, 'analyst'::public.app_role, 'reviewer'::public.app_role]),
  ('in_expert_review', 'archived', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('report_drafting', 'in_analyst_review', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('report_drafting', 'in_expert_review', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('report_drafting', 'final_review', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('report_drafting', 'archived', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('final_review', 'report_drafting', array['admin'::public.app_role, 'analyst'::public.app_role, 'reviewer'::public.app_role]),
  ('final_review', 'in_expert_review', array['admin'::public.app_role, 'analyst'::public.app_role, 'reviewer'::public.app_role]),
  ('final_review', 'delivered', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('final_review', 'archived', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('delivered', 'archived', array['admin'::public.app_role, 'analyst'::public.app_role]),
  ('delivered', 'in_analyst_review', array['admin'::public.app_role]),
  ('archived', 'in_analyst_review', array['admin'::public.app_role])
on conflict (from_status, to_status) do update
set allowed_roles = excluded.allowed_roles;

create table if not exists public.assessment_events (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  visibility text not null default 'internal',
  source_table text,
  source_record_id text,
  from_state text,
  to_state text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint assessment_events_visibility_check check (visibility in ('customer', 'internal', 'shared'))
);

create index if not exists assessment_events_assessment_created_idx
  on public.assessment_events (site_assessment_id, created_at desc);
create unique index if not exists assessment_events_source_idx
  on public.assessment_events (source_table, source_record_id, event_type)
  where source_table is not null and source_record_id is not null;

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  state text not null default 'queued',
  priority integer not null default 100,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  last_error text,
  idempotency_key text unique,
  correlation_id uuid not null default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint background_jobs_state_check check (state in ('cancelled', 'failed', 'queued', 'running', 'succeeded')),
  constraint background_jobs_attempts_check check (attempts >= 0 and max_attempts > 0),
  constraint background_jobs_priority_check check (priority >= 0)
);

drop index if exists public.background_jobs_claim_idx;
create index background_jobs_claim_idx
  on public.background_jobs (priority, run_after, created_at)
  where state in ('queued', 'failed', 'running');
create index if not exists background_jobs_entity_idx
  on public.background_jobs (entity_type, entity_id, created_at desc)
  where entity_id is not null;

create or replace function public.enforce_assessment_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role public.app_role := public.current_app_role();
  v_reason text := nullif(current_setting('app.assessment_transition_reason', true), '');
  v_history_id text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not exists (
    select 1
    from public.assessment_status_transitions t
    where t.from_status = old.status::text
      and t.to_status = new.status::text
      and v_role = any(t.allowed_roles)
  ) then
    raise exception 'Transition from % to % is not permitted for role %.', old.status, new.status, v_role
      using errcode = '42501';
  end if;

  insert into public.status_history
    (site_assessment_id, from_status, to_status, reason)
  values
    (new.id, old.status, new.status, v_reason)
  returning id::text into v_history_id;

  insert into public.assessment_events (
    site_assessment_id,
    event_type,
    actor_id,
    actor_role,
    visibility,
    source_table,
    source_record_id,
    from_state,
    to_state,
    reason,
    metadata
  ) values (
    new.id,
    'status_changed',
    auth.uid(),
    v_role,
    'shared',
    'status_history',
    v_history_id,
    old.status::text,
    new.status::text,
    v_reason,
    jsonb_build_object('source', coalesce(nullif(current_setting('app.assessment_transition_source', true), ''), 'database'))
  );

  perform set_config('app.assessment_transition_reason', '', true);
  perform set_config('app.assessment_transition_source', '', true);
  return new;
end;
$$;

drop trigger if exists site_assessment_status_transition on public.site_assessments;
create trigger site_assessment_status_transition
  before update of status on public.site_assessments
  for each row execute function public.enforce_assessment_status_transition();

create or replace function public.transition_assessment_status(
  p_assessment_id uuid,
  p_to_status text,
  p_reason text default null,
  p_source text default 'application'
)
returns table (
  assessment_id uuid,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_current_status text;
  v_role public.app_role := public.current_app_role();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not public.can_access_assessment(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  select a.status::text into v_current_status
  from public.site_assessments a
  where a.id = p_assessment_id
  for update;

  if v_current_status is null then
    raise exception 'Assessment is not available.' using errcode = 'P0002';
  end if;

  if v_current_status = p_to_status then
    return query
      select a.id, a.status::text, a.updated_at
      from public.site_assessments a
      where a.id = p_assessment_id;
    return;
  end if;

  if not exists (
    select 1
    from public.assessment_status_transitions t
    where t.from_status = v_current_status
      and t.to_status = p_to_status
      and v_role = any(t.allowed_roles)
  ) then
    raise exception 'Transition from % to % is not permitted for role %.', v_current_status, p_to_status, v_role
      using errcode = '42501';
  end if;

  perform set_config('app.assessment_transition_reason', left(coalesce(p_reason, ''), 1000), true);
  perform set_config('app.assessment_transition_source', left(coalesce(p_source, 'application'), 100), true);

  update public.site_assessments a
  set status = p_to_status,
      updated_at = now()
  where a.id = p_assessment_id;

  return query
    select a.id, a.status::text, a.updated_at
    from public.site_assessments a
    where a.id = p_assessment_id;
end;
$$;

create or replace function public.record_assessment_created_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, to_state, metadata, created_at
  ) values (
    new.id, 'assessment_created', auth.uid(), public.current_app_role(), 'shared',
    'site_assessments', new.id::text, new.status::text,
    jsonb_build_object('assessment_name', new.assessment_name), coalesce(new.created_at, now())
  ) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists site_assessment_created_event on public.site_assessments;
create trigger site_assessment_created_event
  after insert on public.site_assessments
  for each row execute function public.record_assessment_created_event();

create or replace function public.record_assignment_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, reason, metadata, created_at
  ) values (
    new.site_assessment_id, 'assignment_changed', new.assigned_by, public.current_app_role(), 'internal',
    'assessment_assignments', new.id::text, new.note,
    jsonb_build_object('owner_id', new.owner_id, 'sla_due_at', new.sla_due_at), new.created_at
  ) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists assessment_assignment_event on public.assessment_assignments;
create trigger assessment_assignment_event
  after insert on public.assessment_assignments
  for each row execute function public.record_assignment_event();

create or replace function public.record_note_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, metadata, created_at
  ) values (
    new.site_assessment_id, 'note_added', auth.uid(), public.current_app_role(),
    case when new.is_internal then 'internal' else 'shared' end,
    'assessment_notes', new.id::text,
    jsonb_build_object('note_type', new.note_type), new.created_at
  ) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists assessment_note_event on public.assessment_notes;
create trigger assessment_note_event
  after insert on public.assessment_notes
  for each row execute function public.record_note_event();

create or replace function public.record_uploaded_file_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, metadata, created_at
  ) values (
    new.site_assessment_id, 'file_uploaded', new.uploaded_by, public.current_app_role(), 'shared',
    'uploaded_files', new.id::text,
    jsonb_build_object(
      'file_name', new.file_name,
      'document_category', new.document_category,
      'processing_status', new.processing_status,
      'malware_scan_status', new.malware_scan_status
    ), new.created_at
  ) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists uploaded_file_event on public.uploaded_files;
create trigger uploaded_file_event
  after insert on public.uploaded_files
  for each row execute function public.record_uploaded_file_event();

-- Backfill a coherent timeline for records created before this migration.
insert into public.assessment_events (
  site_assessment_id, event_type, visibility, source_table, source_record_id,
  to_state, metadata, created_at
)
select
  a.id, 'assessment_created', 'shared', 'site_assessments', a.id::text,
  a.status::text, jsonb_build_object('assessment_name', a.assessment_name), a.created_at
from public.site_assessments a
on conflict do nothing;

insert into public.assessment_events (
  site_assessment_id, event_type, visibility, source_table, source_record_id,
  from_state, to_state, reason, created_at
)
select
  h.site_assessment_id, 'status_changed', 'shared', 'status_history', h.id::text,
  h.from_status::text, h.to_status::text, h.reason, h.created_at
from public.status_history h
on conflict do nothing;

insert into public.assessment_events (
  site_assessment_id, event_type, visibility, source_table, source_record_id,
  metadata, created_at
)
select
  n.site_assessment_id, 'note_added', case when n.is_internal then 'internal' else 'shared' end,
  'assessment_notes', n.id::text, jsonb_build_object('note_type', n.note_type), n.created_at
from public.assessment_notes n
on conflict do nothing;

insert into public.assessment_events (
  site_assessment_id, event_type, actor_id, visibility, source_table, source_record_id,
  reason, metadata, created_at
)
select
  a.site_assessment_id, 'assignment_changed', a.assigned_by, 'internal',
  'assessment_assignments', a.id::text, a.note,
  jsonb_build_object('owner_id', a.owner_id, 'sla_due_at', a.sla_due_at), a.created_at
from public.assessment_assignments a
on conflict do nothing;

insert into public.assessment_events (
  site_assessment_id, event_type, actor_id, visibility, source_table, source_record_id,
  metadata, created_at
)
select
  f.site_assessment_id, 'file_uploaded', f.uploaded_by, 'shared',
  'uploaded_files', f.id::text,
  jsonb_build_object(
    'file_name', f.file_name,
    'document_category', f.document_category,
    'processing_status', f.processing_status,
    'malware_scan_status', f.malware_scan_status
  ), f.created_at
from public.uploaded_files f
on conflict do nothing;

create or replace function public.enqueue_uploaded_file_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.background_jobs (
    job_type, entity_type, entity_id, payload, priority, idempotency_key, created_by
  ) values (
    'malware_scan', 'uploaded_file', new.id,
    jsonb_build_object('storage_path', new.storage_path, 'mime_type', new.mime_type),
    10, 'malware_scan:' || new.id::text, new.uploaded_by
  ) on conflict (idempotency_key) do nothing;

  return new;
end;
$$;

drop trigger if exists uploaded_file_background_jobs on public.uploaded_files;
create trigger uploaded_file_background_jobs
  after insert on public.uploaded_files
  for each row execute function public.enqueue_uploaded_file_jobs();

-- Resume processing for files that pre-date the durable queue. Extraction is
-- only eligible after malware scanning has reported a clean result.
insert into public.background_jobs (
  job_type, entity_type, entity_id, payload, priority, idempotency_key, created_by, created_at
)
select
  'malware_scan', 'uploaded_file', f.id,
  jsonb_build_object('storage_path', f.storage_path, 'mime_type', f.mime_type),
  10, 'malware_scan:' || f.id::text, f.uploaded_by, f.created_at
from public.uploaded_files f
where f.malware_scan_status = 'pending'
on conflict (idempotency_key) do nothing;

insert into public.background_jobs (
  job_type, entity_type, entity_id, payload, priority, idempotency_key, created_by, created_at
)
select
  'document_extract', 'uploaded_file', f.id,
  jsonb_build_object('storage_path', f.storage_path, 'mime_type', f.mime_type),
  50, 'document_extract:' || f.id::text, f.uploaded_by, f.created_at
from public.uploaded_files f
where f.malware_scan_status = 'clean'
  and f.processing_status not in ('ready', 'failed')
on conflict (idempotency_key) do nothing;

create or replace function public.enqueue_background_job(
  p_job_type text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_run_after timestamptz default now(),
  p_priority integer default 100
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_job_id uuid;
begin
  if auth.uid() is null or public.current_app_role() not in ('admin', 'analyst') then
    raise exception 'Only internal users can enqueue jobs.' using errcode = '42501';
  end if;

  insert into public.background_jobs (
    job_type, entity_type, entity_id, payload, idempotency_key,
    run_after, priority, created_by
  ) values (
    p_job_type, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb),
    p_idempotency_key, coalesce(p_run_after, now()), greatest(p_priority, 0), auth.uid()
  )
  on conflict (idempotency_key) do update
  set state = 'queued',
      run_after = least(public.background_jobs.run_after, excluded.run_after),
      last_error = null,
      completed_at = null,
      updated_at = now()
  where public.background_jobs.state in ('cancelled', 'failed')
  returning id into v_job_id;

  if v_job_id is null and p_idempotency_key is not null then
    select j.id into v_job_id
    from public.background_jobs j
    where j.idempotency_key = p_idempotency_key;
  end if;

  return v_job_id;
end;
$$;

create or replace function public.claim_background_jobs(
  p_worker_id text,
  p_job_types text[] default null,
  p_limit integer default 10
)
returns setof public.background_jobs
language sql
security definer
set search_path = public
set row_security = off
as $$
  with candidates as (
    select j.id
    from public.background_jobs j
    where (
        (j.state in ('queued', 'failed') and j.run_after <= now())
        or (j.state = 'running' and j.locked_at < now() - interval '15 minutes')
      )
      and j.attempts < j.max_attempts
      and (p_job_types is null or j.job_type = any(p_job_types))
    order by j.priority asc, j.run_after asc, j.created_at asc
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  update public.background_jobs j
  set state = 'running',
      attempts = j.attempts + 1,
      locked_by = p_worker_id,
      locked_at = now(),
      started_at = coalesce(j.started_at, now()),
      updated_at = now()
  from candidates c
  where j.id = c.id
  returning j.*;
$$;

create or replace function public.complete_background_job(
  p_job_id uuid,
  p_success boolean,
  p_result jsonb default '{}'::jsonb,
  p_error text default null
)
returns public.background_jobs
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_job public.background_jobs;
  v_next_state text;
  v_scan_status text;
begin
  select * into v_job
  from public.background_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Background job was not found.' using errcode = 'P0002';
  end if;

  if p_success then
    v_next_state := 'succeeded';
  elsif v_job.attempts < v_job.max_attempts then
    v_next_state := 'queued';
  else
    v_next_state := 'failed';
  end if;

  update public.background_jobs j
  set state = v_next_state,
      result = coalesce(p_result, '{}'::jsonb),
      last_error = case when p_success then null else left(coalesce(p_error, 'Job failed.'), 4000) end,
      run_after = case
        when v_next_state = 'queued' then now() + make_interval(secs => least(3600, (30 * power(2, greatest(v_job.attempts - 1, 0)))::integer))
        else j.run_after
      end,
      locked_by = null,
      locked_at = null,
      completed_at = case when v_next_state in ('succeeded', 'failed') then now() else null end,
      updated_at = now()
  where j.id = p_job_id
  returning * into v_job;

  if v_job.entity_type = 'uploaded_file' and v_job.entity_id is not null then
    if v_job.job_type = 'malware_scan' then
      v_scan_status := case
        when p_success and coalesce(p_result ->> 'status', 'clean') in ('clean', 'quarantined')
          then coalesce(p_result ->> 'status', 'clean')
        when v_next_state = 'failed' then 'failed'
        else 'pending'
      end;
      update public.uploaded_files
      set malware_scan_status = v_scan_status,
          processing_status = case when v_scan_status = 'quarantined' then 'failed' else processing_status end,
          updated_at = now()
      where id = v_job.entity_id;

      if v_scan_status = 'clean' then
        insert into public.background_jobs (
          job_type, entity_type, entity_id, payload, priority, idempotency_key, created_by
        )
        select
          'document_extract', 'uploaded_file', f.id,
          jsonb_build_object('storage_path', f.storage_path, 'mime_type', f.mime_type),
          50, 'document_extract:' || f.id::text, f.uploaded_by
        from public.uploaded_files f
        where f.id = v_job.entity_id
        on conflict (idempotency_key) do nothing;
      end if;
    elsif v_job.job_type = 'document_extract' then
      update public.uploaded_files
      set processing_status = case
            when p_success then 'ready'
            when v_next_state = 'failed' then 'failed'
            else 'processing'
          end,
          updated_at = now()
      where id = v_job.entity_id;
    end if;

    if v_next_state in ('succeeded', 'failed') then
      insert into public.assessment_events (
        site_assessment_id, event_type, visibility, source_table, source_record_id,
        reason, metadata
      )
      select
        f.site_assessment_id, 'file_processing_updated', 'shared',
        'background_jobs', v_job.id::text, v_job.last_error,
        jsonb_build_object(
          'file_id', f.id,
          'file_name', f.file_name,
          'job_type', v_job.job_type,
          'state', v_job.state
        )
      from public.uploaded_files f
      where f.id = v_job.entity_id
      on conflict do nothing;
    end if;
  end if;

  return v_job;
end;
$$;

alter table public.assessment_status_transitions enable row level security;
alter table public.assessment_events enable row level security;
alter table public.background_jobs enable row level security;

drop policy if exists assessment_status_transitions_read on public.assessment_status_transitions;
create policy assessment_status_transitions_read on public.assessment_status_transitions
  for select to authenticated using (true);

drop policy if exists assessment_events_read on public.assessment_events;
create policy assessment_events_read on public.assessment_events
  for select to authenticated
  using (
    public.can_access_assessment(site_assessment_id)
    and (visibility <> 'internal' or public.is_internal_user())
  );

drop policy if exists background_jobs_internal_read on public.background_jobs;
create policy background_jobs_internal_read on public.background_jobs
  for select to authenticated
  using (public.current_app_role() in ('admin', 'analyst'));

grant select on public.assessment_status_transitions to authenticated;
grant select on public.assessment_events to authenticated;
grant select on public.background_jobs to authenticated;
grant select, insert, update, delete on public.background_jobs to service_role;

revoke all on function public.transition_assessment_status(uuid, text, text, text) from public, anon;
revoke all on function public.enqueue_background_job(text, text, uuid, jsonb, text, timestamptz, integer) from public, anon;
revoke all on function public.claim_background_jobs(text, text[], integer) from public, anon, authenticated;
revoke all on function public.complete_background_job(uuid, boolean, jsonb, text) from public, anon, authenticated;
grant execute on function public.transition_assessment_status(uuid, text, text, text) to authenticated;
grant execute on function public.enqueue_background_job(text, text, uuid, jsonb, text, timestamptz, integer) to authenticated;
grant execute on function public.claim_background_jobs(text, text[], integer) to service_role;
grant execute on function public.complete_background_job(uuid, boolean, jsonb, text) to service_role;

revoke all on function public.enforce_assessment_status_transition() from public, anon, authenticated;
revoke all on function public.record_assessment_created_event() from public, anon, authenticated;
revoke all on function public.record_assignment_event() from public, anon, authenticated;
revoke all on function public.record_note_event() from public, anon, authenticated;
revoke all on function public.record_uploaded_file_event() from public, anon, authenticated;
revoke all on function public.enqueue_uploaded_file_jobs() from public, anon, authenticated;

notify pgrst, 'reload schema';
