-- REP-011 / SEC-005: make issued storage objects write-once and bind artifact
-- completion/failure to the exact generation attempt that requested it.

alter table public.assessment_report_versions
  add column if not exists generation_token uuid not null default gen_random_uuid();

create or replace function public.rotate_report_generation_token()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.generation_token := coalesce(new.generation_token, gen_random_uuid());
  elsif new.generation_attempts is distinct from old.generation_attempts
     or (new.status = 'generating' and old.status is distinct from 'generating') then
    new.generation_token := gen_random_uuid();
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_report_versions_rotate_generation_token on public.assessment_report_versions;
create trigger assessment_report_versions_rotate_generation_token
  before insert or update on public.assessment_report_versions
  for each row execute function public.rotate_report_generation_token();

create or replace function public.can_upload_report_artifact(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.assessment_report_versions v
    where v.status = 'generating'
      and v.requested_by = auth.uid()
      and public.current_app_role() in ('admin', 'analyst')
      and public.can_author_report(v.site_assessment_id)
      and object_name like v.organisation_id::text || '/' || v.site_assessment_id::text
        || '/v' || v.version_number::text || '/a' || v.generation_attempts::text || '/%'
  );
$$;

-- Existing registered objects must never be replaced. A retry writes to the
-- next attempt directory and atomically repoints metadata while generating.
drop policy if exists report_artifacts_storage_insert on storage.objects;
create policy report_artifacts_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-artifacts'
    and public.can_upload_report_artifact(name)
  );

drop policy if exists report_artifacts_storage_update on storage.objects;

create or replace function public.complete_report_artifact_generation(
  p_report_version_id uuid,
  p_generation_token uuid,
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
  v_expected_prefix text;
  v_completed public.assessment_report_versions;
begin
  select * into v_version
  from public.assessment_report_versions
  where id = p_report_version_id
  for update;

  if v_version.id is null
     or v_version.status <> 'generating'
     or v_version.generation_token is distinct from p_generation_token then
    raise exception 'This report generation attempt is no longer active.' using errcode = '40001';
  end if;

  v_expected_prefix := v_version.organisation_id::text || '/' || v_version.site_assessment_id::text
    || '/v' || v_version.version_number::text || '/a' || v_version.generation_attempts::text || '/';

  if jsonb_typeof(p_artifacts) <> 'array' then
    raise exception 'Artifacts do not belong to the active generation attempt.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_artifacts) artifact
    where coalesce(artifact ->> 'storage_path', '') not like v_expected_prefix || '%'
  ) then
    raise exception 'Artifacts do not belong to the active generation attempt.' using errcode = '22023';
  end if;

  select public.complete_report_artifact_generation(p_report_version_id, p_artifacts)
  into v_completed;
  return v_completed;
end;
$$;

create or replace function public.fail_report_artifact_generation(
  p_report_version_id uuid,
  p_generation_token uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_version public.assessment_report_versions;
begin
  select * into v_version
  from public.assessment_report_versions
  where id = p_report_version_id
  for update;

  if v_version.id is null
     or v_version.status <> 'generating'
     or v_version.generation_token is distinct from p_generation_token then
    return;
  end if;

  perform public.fail_report_artifact_generation(p_report_version_id, p_error);
end;
$$;

revoke all on function public.complete_report_artifact_generation(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_report_artifact_generation(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_report_artifact_generation(uuid, uuid, jsonb) from public, anon;
revoke all on function public.fail_report_artifact_generation(uuid, uuid, text) from public, anon;
revoke all on function public.can_upload_report_artifact(text) from public, anon;
revoke all on function public.rotate_report_generation_token() from public, anon, authenticated;

grant execute on function public.complete_report_artifact_generation(uuid, uuid, jsonb) to authenticated;
grant execute on function public.fail_report_artifact_generation(uuid, uuid, text) to authenticated;
grant execute on function public.can_upload_report_artifact(text) to authenticated;

notify pgrst, 'reload schema';
