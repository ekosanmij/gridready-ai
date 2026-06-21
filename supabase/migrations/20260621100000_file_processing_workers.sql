-- EV-006 / PLAT-001 / PLAT-002: persist searchable document extraction output
-- and require background-job completions to come from the worker that owns the
-- active lease.

create table if not exists public.uploaded_file_extractions (
  id uuid primary key default gen_random_uuid(),
  uploaded_file_id uuid not null unique references public.uploaded_files(id) on delete cascade,
  background_job_id uuid not null references public.background_jobs(id) on delete restrict,
  extractor text not null,
  extractor_version text,
  source_mime_type text,
  source_size_bytes bigint,
  content_text text not null,
  content_checksum text not null,
  page_count integer,
  language text,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (to_tsvector('english', content_text)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uploaded_file_extractions_content_check check (length(content_text) > 0 and length(content_text) <= 5000000),
  constraint uploaded_file_extractions_checksum_check check (content_checksum ~ '^[a-f0-9]{64}$'),
  constraint uploaded_file_extractions_page_count_check check (page_count is null or page_count >= 0),
  constraint uploaded_file_extractions_source_size_check check (source_size_bytes is null or source_size_bytes >= 0)
);

create index if not exists uploaded_file_extractions_search_gin
  on public.uploaded_file_extractions using gin (search_vector);
create index if not exists uploaded_file_extractions_job_idx
  on public.uploaded_file_extractions (background_job_id);

alter table public.uploaded_file_extractions enable row level security;

drop policy if exists uploaded_file_extractions_internal_read on public.uploaded_file_extractions;
create policy uploaded_file_extractions_internal_read on public.uploaded_file_extractions
  for select to authenticated
  using (
    public.is_internal_user()
    and exists (
      select 1
      from public.uploaded_files f
      where f.id = uploaded_file_id
        and public.can_access_assessment(f.site_assessment_id)
    )
  );

grant select on public.uploaded_file_extractions to authenticated;
grant select, insert, update, delete on public.uploaded_file_extractions to service_role;

create or replace function public.save_uploaded_file_extraction(
  p_job_id uuid,
  p_worker_id text,
  p_extraction jsonb
)
returns public.uploaded_file_extractions
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_job public.background_jobs;
  v_file public.uploaded_files;
  v_content text := coalesce(p_extraction ->> 'content_text', '');
  v_checksum text := lower(coalesce(p_extraction ->> 'content_checksum', ''));
  v_extraction public.uploaded_file_extractions;
begin
  select * into v_job
  from public.background_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null
     or v_job.job_type <> 'document_extract'
     or v_job.entity_type <> 'uploaded_file'
     or v_job.entity_id is null
     or v_job.state <> 'running'
     or v_job.locked_by is distinct from nullif(btrim(coalesce(p_worker_id, '')), '') then
    raise exception 'The document extraction job is not leased by this worker.' using errcode = '42501';
  end if;

  select * into v_file
  from public.uploaded_files f
  where f.id = v_job.entity_id
  for update;

  if v_file.id is null
     or v_file.malware_scan_status <> 'clean'
     or v_file.retention_state <> 'active' then
    raise exception 'The uploaded file is not eligible for extraction.' using errcode = '22023';
  end if;

  if length(v_content) = 0 or length(v_content) > 5000000 then
    raise exception 'Extracted content must contain between 1 and 5000000 characters.' using errcode = '22023';
  end if;

  if v_checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'Extracted content checksum must be SHA-256.' using errcode = '22023';
  end if;

  insert into public.uploaded_file_extractions (
    uploaded_file_id, background_job_id, extractor, extractor_version,
    source_mime_type, source_size_bytes, content_text, content_checksum,
    page_count, language, metadata
  ) values (
    v_file.id,
    v_job.id,
    coalesce(nullif(btrim(p_extraction ->> 'extractor'), ''), 'configured-adapter'),
    nullif(btrim(p_extraction ->> 'extractor_version'), ''),
    v_file.mime_type,
    v_file.size_bytes,
    v_content,
    v_checksum,
    case
      when coalesce(p_extraction ->> 'page_count', '') ~ '^[0-9]+$'
        then (p_extraction ->> 'page_count')::integer
      else null
    end,
    nullif(btrim(p_extraction ->> 'language'), ''),
    coalesce(p_extraction -> 'metadata', '{}'::jsonb)
  )
  on conflict (uploaded_file_id) do update
  set background_job_id = excluded.background_job_id,
      extractor = excluded.extractor,
      extractor_version = excluded.extractor_version,
      source_mime_type = excluded.source_mime_type,
      source_size_bytes = excluded.source_size_bytes,
      content_text = excluded.content_text,
      content_checksum = excluded.content_checksum,
      page_count = excluded.page_count,
      language = excluded.language,
      metadata = excluded.metadata,
      updated_at = now()
  returning * into v_extraction;

  return v_extraction;
end;
$$;

create or replace function public.complete_claimed_background_job(
  p_job_id uuid,
  p_worker_id text,
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
begin
  select * into v_job
  from public.background_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null
     or v_job.state <> 'running'
     or v_job.locked_by is distinct from nullif(btrim(coalesce(p_worker_id, '')), '') then
    raise exception 'The background job is not leased by this worker.' using errcode = '42501';
  end if;

  return public.complete_background_job(p_job_id, p_success, p_result, p_error);
end;
$$;

-- Include extracted document text in the existing permission-aware portal
-- search index. Rebuilding an assessment search document must retain these rows.
create or replace function public.refresh_portal_search_for_assessment(assessment_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  delete from public.portal_search_documents where site_assessment_id = assessment_uuid;

  insert into public.portal_search_documents
    (document_type, record_id, site_assessment_id, title, subtitle, href, search_text, updated_at)
  select 'assessment', a.id, a.id, a.assessment_name,
    concat_ws(' · ', o.name, s.site_name, a.status),
    '/intake/assessments/' || a.id,
    concat_ws(' ', a.assessment_name, a.market_region, a.status, a.known_utility, a.known_tsp,
      s.site_name, s.address, s.city, s.county, s.state, pr.name, o.name),
    a.updated_at
  from public.site_assessments a
  left join public.sites s on s.id = a.site_id
  left join public.projects pr on pr.id = a.project_id
  left join public.organisations o on o.id = pr.organisation_id
  where a.id = assessment_uuid;

  insert into public.portal_search_documents
    (document_type, record_id, site_assessment_id, title, subtitle, href, search_text, updated_at)
  select 'evidence', e.id, e.site_assessment_id, e.title,
    concat_ws(' · ', e.source_type, e.confidence_level),
    '/intake/assessments/' || e.site_assessment_id || '?module=evidence',
    concat_ws(' ', e.title, e.publisher, e.summary, e.file_reference, e.source_type), e.updated_at
  from public.evidence_sources e where e.site_assessment_id = assessment_uuid;

  insert into public.portal_search_documents
    (document_type, record_id, site_assessment_id, title, subtitle, href, search_text, updated_at)
  select 'finding', f.id, f.site_assessment_id, f.title,
    concat_ws(' · ', f.module_key, f.risk_level, f.status),
    '/intake/assessments/' || f.site_assessment_id || '?module=findings',
    concat_ws(' ', f.title, f.statement, f.recommendation, f.assumption_note, f.module_key, f.risk_level), f.updated_at
  from public.assessment_findings f where f.site_assessment_id = assessment_uuid;

  insert into public.portal_search_documents
    (document_type, record_id, site_assessment_id, title, subtitle, href, search_text, updated_at)
  select 'report', r.id, r.site_assessment_id, r.title,
    concat_ws(' · ', r.section_key, r.status),
    '/intake/assessments/' || r.site_assessment_id || '?module=report',
    concat_ws(' ', r.title, r.content, r.generation_notes, r.section_key, r.status), r.updated_at
  from public.assessment_report_sections r where r.site_assessment_id = assessment_uuid;

  insert into public.portal_search_documents
    (document_type, record_id, site_assessment_id, title, subtitle, href, search_text, updated_at)
  select 'document', x.id, f.site_assessment_id, f.file_name,
    concat_ws(' · ', f.document_category, f.mime_type, x.page_count || ' pages'),
    '/intake/assessments/' || f.site_assessment_id || '?module=evidence',
    concat_ws(' ', f.file_name, f.description, f.document_category, left(x.content_text, 1000000)),
    x.updated_at
  from public.uploaded_file_extractions x
  join public.uploaded_files f on f.id = x.uploaded_file_id
  where f.site_assessment_id = assessment_uuid
    and f.retention_state = 'active';
end;
$$;

create or replace function public.refresh_uploaded_file_extraction_search()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_assessment_id uuid;
begin
  select f.site_assessment_id into v_assessment_id
  from public.uploaded_files f
  where f.id = case when tg_op = 'DELETE' then old.uploaded_file_id else new.uploaded_file_id end;

  if v_assessment_id is not null then
    perform public.refresh_portal_search_for_assessment(v_assessment_id);
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists portal_search_file_extraction_refresh on public.uploaded_file_extractions;
create trigger portal_search_file_extraction_refresh
  after insert or update or delete on public.uploaded_file_extractions
  for each row execute function public.refresh_uploaded_file_extraction_search();

revoke all on function public.save_uploaded_file_extraction(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.complete_claimed_background_job(uuid, text, boolean, jsonb, text) from public, anon, authenticated;
revoke execute on function public.complete_background_job(uuid, boolean, jsonb, text) from service_role;
grant execute on function public.save_uploaded_file_extraction(uuid, text, jsonb) to service_role;
grant execute on function public.complete_claimed_background_job(uuid, text, boolean, jsonb, text) to service_role;

revoke all on function public.refresh_uploaded_file_extraction_search() from public, anon, authenticated;

notify pgrst, 'reload schema';
