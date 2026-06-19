-- INT-002 / INT-004 / INT-005: server-backed customer drafts and private
-- supporting-file upload metadata.

create table if not exists public.customer_intake_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete cascade,
  request_type text not null,
  form_data jsonb not null default '{}'::jsonb,
  field_states jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  status text not null default 'active',
  submitted_assessment_id uuid references public.site_assessments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_intake_drafts_status_check
    check (status in ('active', 'submitted', 'discarded'))
);

create index if not exists customer_intake_drafts_user_active_idx
  on public.customer_intake_drafts (user_id, request_type, updated_at desc)
  where status = 'active';
create index if not exists customer_intake_drafts_assessment_idx
  on public.customer_intake_drafts (submitted_assessment_id)
  where submitted_assessment_id is not null;

alter table public.site_assessments
  add column if not exists customer_intake_draft_id uuid references public.customer_intake_drafts(id) on delete set null;

create unique index if not exists site_assessments_customer_intake_draft_idx
  on public.site_assessments (customer_intake_draft_id);

create table if not exists public.customer_intake_files (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.customer_intake_drafts(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  site_assessment_id uuid references public.site_assessments(id) on delete set null,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text,
  size_bytes bigint not null,
  checksum_sha256 text not null,
  processing_status text not null default 'uploaded',
  malware_scan_status text not null default 'pending',
  retention_state text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_intake_files_size_check check (size_bytes > 0 and size_bytes <= 52428800),
  constraint customer_intake_files_processing_check
    check (processing_status in ('uploading', 'uploaded', 'processing', 'ready', 'failed')),
  constraint customer_intake_files_malware_check
    check (malware_scan_status in ('pending', 'clean', 'quarantined', 'failed')),
  constraint customer_intake_files_retention_check
    check (retention_state in ('active', 'deleted', 'retained'))
);

create unique index if not exists customer_intake_files_active_checksum_idx
  on public.customer_intake_files (draft_id, checksum_sha256)
  where retention_state = 'active';
create index if not exists customer_intake_files_assessment_idx
  on public.customer_intake_files (site_assessment_id, created_at desc)
  where site_assessment_id is not null;

alter table public.uploaded_files
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null,
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists checksum_sha256 text,
  add column if not exists processing_status text not null default 'uploaded',
  add column if not exists malware_scan_status text not null default 'pending',
  add column if not exists retention_state text not null default 'active',
  add column if not exists customer_intake_file_id uuid references public.customer_intake_files(id) on delete set null;

create unique index if not exists uploaded_files_customer_intake_file_idx
  on public.uploaded_files (customer_intake_file_id);
create index if not exists uploaded_files_checksum_idx
  on public.uploaded_files (site_assessment_id, checksum_sha256)
  where checksum_sha256 is not null and retention_state = 'active';

-- Keep the private bucket at the product limit and, where supported by the
-- installed Storage schema, constrain accepted MIME types at the bucket layer.
update storage.buckets
set public = false,
    file_size_limit = 52428800
where id = 'assessment-evidence';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'allowed_mime_types'
  ) then
    update storage.buckets
    set allowed_mime_types = array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/vnd.google-earth.kml+xml',
      'application/vnd.google-earth.kmz',
      'application/zip',
      'application/x-zip-compressed',
      'application/geo+json',
      'application/json',
      'application/octet-stream',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/webp'
    ]
    where id = 'assessment-evidence';
  end if;
end $$;

create or replace function public.can_access_customer_intake_draft(draft_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.customer_intake_drafts d
    where d.id = draft_uuid
      and (
        d.user_id = auth.uid()
        or public.is_internal_user()
        or (
          d.submitted_assessment_id is not null
          and public.can_access_assessment(d.submitted_assessment_id)
        )
      )
  );
$$;

create or replace function public.can_manage_customer_intake_draft(draft_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.customer_intake_drafts d
    where d.id = draft_uuid
      and d.user_id = auth.uid()
      and d.status = 'active'
  );
$$;

create or replace function public.storage_intake_draft_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if (storage.foldername(object_name))[1] <> 'drafts' then
    return null;
  end if;
  return (storage.foldername(object_name))[3]::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.storage_intake_user_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if (storage.foldername(object_name))[1] <> 'drafts' then
    return null;
  end if;
  return (storage.foldername(object_name))[2]::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.storage_customer_uploader_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if (storage.foldername(object_name))[2] <> 'customer' then
    return null;
  end if;
  return (storage.foldername(object_name))[3]::uuid;
exception when others then
  return null;
end;
$$;

alter table public.customer_intake_drafts enable row level security;
alter table public.customer_intake_files enable row level security;

create policy customer_intake_drafts_read on public.customer_intake_drafts
  for select to authenticated
  using (user_id = auth.uid() or public.is_internal_user());
create policy customer_intake_drafts_create on public.customer_intake_drafts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (organisation_id is null or public.is_organisation_member(organisation_id))
  );
create policy customer_intake_drafts_update on public.customer_intake_drafts
  for update to authenticated
  using (user_id = auth.uid() and status = 'active')
  with check (
    user_id = auth.uid()
    and (organisation_id is null or public.is_organisation_member(organisation_id))
  );
create policy customer_intake_drafts_discard on public.customer_intake_drafts
  for delete to authenticated
  using (user_id = auth.uid() and status = 'active');
create policy customer_intake_drafts_internal_manage on public.customer_intake_drafts
  for all to authenticated
  using (public.current_app_role() in ('admin', 'analyst'))
  with check (public.current_app_role() in ('admin', 'analyst'));

create policy customer_intake_files_read on public.customer_intake_files
  for select to authenticated
  using (public.can_access_customer_intake_draft(draft_id));
create policy customer_intake_files_create on public.customer_intake_files
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.can_manage_customer_intake_draft(draft_id)
  );
create policy customer_intake_files_update on public.customer_intake_files
  for update to authenticated
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());
create policy customer_intake_files_delete on public.customer_intake_files
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    and public.can_manage_customer_intake_draft(draft_id)
  );
create policy customer_intake_files_internal_manage on public.customer_intake_files
  for all to authenticated
  using (public.current_app_role() in ('admin', 'analyst'))
  with check (public.current_app_role() in ('admin', 'analyst'));

drop policy if exists assessments_customer_create on public.site_assessments;
create policy assessments_customer_create on public.site_assessments
  for insert to authenticated
  with check (
    public.current_app_role() = 'customer'
    and customer_intake_draft_id is not null
    and public.can_manage_customer_intake_draft(customer_intake_draft_id)
    and exists (
      select 1
      from public.projects p
      join public.sites s on s.id = site_id
      where p.id = project_id
        and public.is_organisation_member(p.organisation_id)
        and s.organisation_id = p.organisation_id
    )
    and status in ('draft', 'intake_incomplete', 'intake_complete')
  );

drop policy if exists files_customer_create on public.uploaded_files;
create policy files_customer_create on public.uploaded_files
  for insert to authenticated
  with check (
    public.current_app_role() = 'customer'
    and uploaded_by = auth.uid()
    and public.can_access_assessment(site_assessment_id)
    and exists (
      select 1
      from public.customer_intake_files f
      join public.customer_intake_drafts d on d.id = f.draft_id
      where f.id = customer_intake_file_id
        and f.uploaded_by = auth.uid()
        and d.user_id = auth.uid()
    )
  );
drop policy if exists files_customer_link_update on public.uploaded_files;
create policy files_customer_link_update on public.uploaded_files
  for update to authenticated
  using (
    public.current_app_role() = 'customer'
    and uploaded_by = auth.uid()
    and public.can_access_assessment(site_assessment_id)
  )
  with check (
    public.current_app_role() = 'customer'
    and uploaded_by = auth.uid()
    and public.can_access_assessment(site_assessment_id)
  );
drop policy if exists files_customer_followup_create on public.uploaded_files;
create policy files_customer_followup_create on public.uploaded_files
  for insert to authenticated
  with check (
    public.current_app_role() = 'customer'
    and uploaded_by = auth.uid()
    and customer_intake_file_id is null
    and public.can_access_assessment(site_assessment_id)
  );

create policy customer_intake_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and public.can_access_customer_intake_draft(public.storage_intake_draft_id(name))
  );
create policy customer_intake_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assessment-evidence'
    and public.storage_intake_user_id(name) = auth.uid()
    and public.can_manage_customer_intake_draft(public.storage_intake_draft_id(name))
  );
create policy customer_intake_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and public.storage_intake_user_id(name) = auth.uid()
    and public.can_manage_customer_intake_draft(public.storage_intake_draft_id(name))
  )
  with check (
    bucket_id = 'assessment-evidence'
    and public.storage_intake_user_id(name) = auth.uid()
    and public.can_manage_customer_intake_draft(public.storage_intake_draft_id(name))
  );
create policy customer_intake_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and public.storage_intake_user_id(name) = auth.uid()
    and public.can_manage_customer_intake_draft(public.storage_intake_draft_id(name))
  );

create policy customer_assessment_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assessment-evidence'
    and public.current_app_role() = 'customer'
    and public.storage_customer_uploader_id(name) = auth.uid()
    and public.can_access_assessment(public.storage_assessment_id(name))
  );
create policy customer_assessment_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and public.current_app_role() = 'customer'
    and public.storage_customer_uploader_id(name) = auth.uid()
    and public.can_access_assessment(public.storage_assessment_id(name))
  )
  with check (
    bucket_id = 'assessment-evidence'
    and public.current_app_role() = 'customer'
    and public.storage_customer_uploader_id(name) = auth.uid()
    and public.can_access_assessment(public.storage_assessment_id(name))
  );
create policy customer_assessment_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assessment-evidence'
    and public.current_app_role() = 'customer'
    and public.storage_customer_uploader_id(name) = auth.uid()
    and public.can_access_assessment(public.storage_assessment_id(name))
  );

grant select, insert, update, delete on public.customer_intake_drafts to authenticated;
grant select, insert, update, delete on public.customer_intake_files to authenticated;

revoke all on function public.can_access_customer_intake_draft(uuid) from public, anon;
revoke all on function public.can_manage_customer_intake_draft(uuid) from public, anon;
revoke all on function public.storage_intake_draft_id(text) from public, anon;
revoke all on function public.storage_intake_user_id(text) from public, anon;
revoke all on function public.storage_customer_uploader_id(text) from public, anon;
grant execute on function public.can_access_customer_intake_draft(uuid) to authenticated;
grant execute on function public.can_manage_customer_intake_draft(uuid) to authenticated;
grant execute on function public.storage_intake_draft_id(text) to authenticated;
grant execute on function public.storage_intake_user_id(text) to authenticated;
grant execute on function public.storage_customer_uploader_id(text) to authenticated;

notify pgrst, 'reload schema';
