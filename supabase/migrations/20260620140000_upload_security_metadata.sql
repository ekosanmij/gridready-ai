-- SEC-007: customer uploads are write-once, security metadata is server-owned,
-- and private files cannot be downloaded until malware scanning reports clean.

alter table public.customer_intake_files
  drop constraint if exists customer_intake_files_checksum_format_check;
alter table public.customer_intake_files
  add constraint customer_intake_files_checksum_format_check
  check (checksum_sha256 ~ '^[a-f0-9]{64}$') not valid;

create or replace function public.enforce_customer_intake_file_security()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if tg_op = 'UPDATE' then
    if coalesce(current_setting('app.customer_file_link_authorized', true), '') = 'true' then
      return new;
    end if;
    if new.uploaded_by is distinct from old.uploaded_by
       or new.draft_id is distinct from old.draft_id
       or new.storage_path is distinct from old.storage_path
       or new.original_filename is distinct from old.original_filename
       or new.mime_type is distinct from old.mime_type
       or new.size_bytes is distinct from old.size_bytes
       or new.checksum_sha256 is distinct from old.checksum_sha256
       or new.processing_status is distinct from old.processing_status
       or new.malware_scan_status is distinct from old.malware_scan_status
       or new.retention_state is distinct from old.retention_state then
      if coalesce(auth.role(), '') <> 'service_role' then
        raise exception 'Upload security metadata is immutable outside the processing worker.' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if coalesce(auth.role(), '') = 'authenticated' and public.current_app_role() = 'customer' then
    new.uploaded_by := auth.uid();
    new.site_assessment_id := null;
    new.processing_status := 'uploaded';
    new.malware_scan_status := 'pending';
    new.retention_state := 'active';

    if public.storage_intake_user_id(new.storage_path) is distinct from auth.uid()
       or public.storage_intake_draft_id(new.storage_path) is distinct from new.draft_id
       or not public.can_manage_customer_intake_draft(new.draft_id) then
      raise exception 'Customer upload path does not belong to the active draft.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_intake_files_enforce_security on public.customer_intake_files;
create trigger customer_intake_files_enforce_security
  before insert or update on public.customer_intake_files
  for each row execute function public.enforce_customer_intake_file_security();

create or replace function public.enforce_uploaded_file_security()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_intake_file public.customer_intake_files;
  v_submitted_assessment_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.uploaded_by is distinct from old.uploaded_by
       or new.storage_path is distinct from old.storage_path
       or new.original_filename is distinct from old.original_filename
       or new.mime_type is distinct from old.mime_type
       or new.size_bytes is distinct from old.size_bytes
       or new.checksum_sha256 is distinct from old.checksum_sha256
       or new.processing_status is distinct from old.processing_status
       or new.malware_scan_status is distinct from old.malware_scan_status
       or new.retention_state is distinct from old.retention_state
       or new.customer_intake_file_id is distinct from old.customer_intake_file_id then
      if coalesce(auth.role(), '') <> 'service_role'
         and coalesce(current_setting('app.customer_file_link_authorized', true), '') <> 'true' then
        raise exception 'Upload security metadata is immutable outside the processing worker.' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if coalesce(auth.role(), '') = 'authenticated' and public.current_app_role() = 'customer' then
    new.uploaded_by := auth.uid();
    new.document_category := 'customer_evidence';
    new.processing_status := 'uploaded';
    new.malware_scan_status := 'pending';
    new.retention_state := 'active';

    if new.customer_intake_file_id is not null then
      select f.* into v_intake_file
      from public.customer_intake_files f
      join public.customer_intake_drafts d on d.id = f.draft_id
      where f.id = new.customer_intake_file_id
        and f.uploaded_by = auth.uid()
        and d.user_id = auth.uid();

      if v_intake_file.id is not null then
        select d.submitted_assessment_id into v_submitted_assessment_id
        from public.customer_intake_drafts d
        where d.id = v_intake_file.draft_id;
      end if;

      if v_intake_file.id is null or v_submitted_assessment_id is distinct from new.site_assessment_id then
        raise exception 'Customer intake file is not linked to this assessment.' using errcode = '42501';
      end if;

      new.storage_path := v_intake_file.storage_path;
      new.original_filename := v_intake_file.original_filename;
      new.file_name := v_intake_file.original_filename;
      new.mime_type := v_intake_file.mime_type;
      new.size_bytes := v_intake_file.size_bytes;
      new.checksum_sha256 := v_intake_file.checksum_sha256;
    else
      if public.storage_assessment_id(new.storage_path) is distinct from new.site_assessment_id
         or public.storage_customer_uploader_id(new.storage_path) is distinct from auth.uid()
         or not public.can_access_assessment(new.site_assessment_id) then
        raise exception 'Customer upload path does not belong to this assessment.' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists uploaded_files_enforce_security on public.uploaded_files;
create trigger uploaded_files_enforce_security
  before insert or update on public.uploaded_files
  for each row execute function public.enforce_uploaded_file_security();

drop policy if exists customer_intake_files_update on public.customer_intake_files;
drop policy if exists files_customer_link_update on public.uploaded_files;

create or replace function public.link_customer_intake_files(
  p_draft_id uuid,
  p_assessment_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_draft public.customer_intake_drafts;
  v_linked_count integer := 0;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then
    raise exception 'Customer authentication is required.' using errcode = '42501';
  end if;

  select * into v_draft
  from public.customer_intake_drafts d
  where d.id = p_draft_id and d.user_id = auth.uid()
  for update;

  if v_draft.id is null
     or v_draft.status <> 'submitted'
     or v_draft.submitted_assessment_id is distinct from p_assessment_id
     or not public.can_access_assessment(p_assessment_id) then
    raise exception 'Submitted intake files are not available for this assessment.' using errcode = '42501';
  end if;

  perform set_config('app.customer_file_link_authorized', 'true', true);

  insert into public.uploaded_files (
    checksum_sha256, customer_intake_file_id, document_category, file_name,
    malware_scan_status, mime_type, original_filename, processing_status,
    retention_state, site_assessment_id, size_bytes, storage_path, uploaded_by
  )
  select
    f.checksum_sha256, f.id, 'customer_evidence', f.original_filename,
    'pending', f.mime_type, f.original_filename, 'uploaded',
    'active', p_assessment_id, f.size_bytes, f.storage_path, auth.uid()
  from public.customer_intake_files f
  where f.draft_id = p_draft_id
    and f.uploaded_by = auth.uid()
    and f.retention_state = 'active'
  on conflict (customer_intake_file_id) do nothing;

  get diagnostics v_linked_count = row_count;

  update public.customer_intake_files
  set site_assessment_id = p_assessment_id,
      updated_at = now()
  where draft_id = p_draft_id
    and uploaded_by = auth.uid()
    and site_assessment_id is distinct from p_assessment_id;

  perform set_config('app.customer_file_link_authorized', '', true);
  return v_linked_count;
end;
$$;

-- Evidence objects are immutable after metadata registration. Failed metadata
-- writes may still clean up the just-uploaded unregistered object.
drop policy if exists assessment_evidence_update on storage.objects;
drop policy if exists customer_intake_storage_update on storage.objects;
drop policy if exists customer_assessment_storage_update on storage.objects;

drop policy if exists assessment_evidence_delete on storage.objects;
create policy assessment_evidence_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and public.can_edit_assessment(public.storage_assessment_id(name))
    and not exists (
      select 1 from public.uploaded_files f where f.storage_path = name
    )
  );

drop policy if exists assessment_evidence_internal_read on storage.objects;
create policy assessment_evidence_internal_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and public.is_internal_user()
    and (
      exists (
        select 1 from public.uploaded_files f
        where f.storage_path = name
          and f.malware_scan_status = 'clean'
          and f.retention_state = 'active'
          and public.can_access_assessment(f.site_assessment_id)
      )
      or exists (
        select 1 from public.customer_intake_files f
        where f.storage_path = name
          and f.malware_scan_status = 'clean'
          and f.retention_state = 'active'
          and public.can_access_customer_intake_draft(f.draft_id)
      )
    )
  );

drop policy if exists customer_intake_storage_read on storage.objects;
create policy customer_intake_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and exists (
      select 1 from public.customer_intake_files f
      where f.storage_path = name
        and f.uploaded_by = auth.uid()
        and f.malware_scan_status = 'clean'
        and f.retention_state = 'active'
        and public.can_access_customer_intake_draft(f.draft_id)
    )
  );

drop policy if exists customer_assessment_storage_read on storage.objects;
create policy customer_assessment_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and exists (
      select 1 from public.uploaded_files f
      where f.storage_path = name
        and f.uploaded_by = auth.uid()
        and f.malware_scan_status = 'clean'
        and f.retention_state = 'active'
        and public.can_access_assessment(f.site_assessment_id)
    )
  );

drop policy if exists customer_assessment_storage_delete on storage.objects;
create policy customer_assessment_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and public.current_app_role() = 'customer'
    and public.storage_customer_uploader_id(name) = auth.uid()
    and public.can_access_assessment(public.storage_assessment_id(name))
    and not exists (
      select 1 from public.uploaded_files f where f.storage_path = name
    )
  );

revoke all on function public.enforce_customer_intake_file_security() from public, anon, authenticated;
revoke all on function public.enforce_uploaded_file_security() from public, anon, authenticated;
revoke all on function public.link_customer_intake_files(uuid, uuid) from public, anon;
grant execute on function public.link_customer_intake_files(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
