create extension if not exists pgcrypto;
create extension if not exists postgis;

do $$
begin
  create type public.app_role as enum ('admin', 'analyst', 'reviewer', 'customer');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete set null,
  full_name text,
  role public.app_role not null default 'customer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The deployed project may already have a smaller profiles table. CREATE TABLE
-- IF NOT EXISTS does not add missing columns, so upgrade that table explicitly.
-- Keep a pre-existing text role column compatible; current_app_role normalises it.
alter table public.profiles
  add column if not exists organisation_id uuid references public.organisations(id) on delete set null,
  add column if not exists full_name text,
  add column if not exists role public.app_role not null default 'customer',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists profiles_organisation_role_idx
  on public.profiles (organisation_id, role)
  where is_active;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_created_profile on auth.users;
create trigger auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, full_name, role)
select u.id, nullif(u.raw_user_meta_data ->> 'full_name', ''), 'customer'
from auth.users u
on conflict (id) do nothing;

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select p from public.profiles p where p.id = auth.uid() and p.is_active limit 1;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select case
    when role_text in ('admin', 'analyst', 'reviewer', 'customer')
      then role_text::public.app_role
    else 'customer'::public.app_role
  end
  from (
    select lower(coalesce(
      (
        select p.role::text
        from public.profiles p
        where p.id = auth.uid()
          and p.is_active
      ),
      'customer'
    )) as role_text
  ) normalised_role;
$$;

create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.current_app_role() in ('admin', 'analyst', 'reviewer');
$$;

create or replace function public.can_access_assessment(assessment_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select auth.uid() is not null and (
    public.is_internal_user()
    or exists (
      select 1
      from public.site_assessments a
      join public.projects pr on pr.id = a.project_id
      join public.profiles pf on pf.id = auth.uid() and pf.is_active
      where a.id = assessment_uuid
        and pf.organisation_id = pr.organisation_id
    )
  );
$$;

create or replace function public.can_edit_assessment(assessment_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.current_app_role() in ('admin', 'analyst');
$$;

create or replace function public.can_author_report(assessment_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.current_app_role() in ('admin', 'analyst', 'reviewer')
    and public.can_access_assessment(assessment_uuid);
$$;

alter table public.site_assessments
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists sla_due_at timestamptz,
  add column if not exists sla_days integer,
  add column if not exists assignment_note text;

create index if not exists site_assessments_owner_sla_idx
  on public.site_assessments (owner_id, sla_due_at)
  where status not in ('delivered', 'archived');

create table if not exists public.assessment_assignments (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  sla_due_at timestamptz,
  note text,
  assigned_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists assessment_assignments_assessment_created_idx
  on public.assessment_assignments (site_assessment_id, created_at desc);

create or replace function public.record_assessment_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is distinct from old.owner_id
     or new.sla_due_at is distinct from old.sla_due_at
     or new.assignment_note is distinct from old.assignment_note then
    insert into public.assessment_assignments (site_assessment_id, owner_id, sla_due_at, note, assigned_by)
    values (new.id, new.owner_id, new.sla_due_at, new.assignment_note, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists site_assessment_assignment_audit on public.site_assessments;
create trigger site_assessment_assignment_audit
  after update of owner_id, sla_due_at, assignment_note on public.site_assessments
  for each row execute function public.record_assessment_assignment();

create table if not exists public.utility_service_territories (
  id uuid primary key default gen_random_uuid(),
  utility_name text not null,
  tsp_name text,
  market_region text not null default 'ERCOT',
  source_name text not null,
  source_url text,
  confidence_level text not null default 'medium',
  priority integer not null default 100,
  boundary geometry(MultiPolygon, 4326) not null,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint utility_service_territories_confidence_check
    check (confidence_level in ('high', 'medium', 'low'))
);

create index if not exists utility_service_territories_boundary_gix
  on public.utility_service_territories using gist (boundary);
create index if not exists utility_service_territories_market_priority_idx
  on public.utility_service_territories (market_region, priority);

create or replace function public.infer_utility_tsp(latitude double precision, longitude double precision, market text default null)
returns table (
  utility_name text,
  tsp_name text,
  confidence_level text,
  source_name text,
  source_url text
)
language sql
stable
security invoker
set search_path = public
as $$
  select t.utility_name, t.tsp_name, t.confidence_level, t.source_name, t.source_url
  from public.utility_service_territories t
  where (market is null or t.market_region = market)
    and (t.valid_from is null or t.valid_from <= current_date)
    and (t.valid_to is null or t.valid_to >= current_date)
    and st_covers(t.boundary, st_setsrid(st_makepoint(longitude, latitude), 4326))
  order by t.priority asc, st_area(t.boundary::geography) asc
  limit 1;
$$;

create table if not exists public.assessment_suggestions (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  suggestion_type text not null,
  field_name text not null,
  suggested_value text not null,
  confidence_level text not null default 'medium',
  rationale text,
  source text,
  status text not null default 'pending',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_suggestions_confidence_check check (confidence_level in ('high', 'medium', 'low')),
  constraint assessment_suggestions_status_check check (status in ('pending', 'accepted', 'dismissed')),
  constraint assessment_suggestions_unique_pending unique (site_assessment_id, field_name, suggested_value, status)
);

create index if not exists assessment_suggestions_pending_idx
  on public.assessment_suggestions (site_assessment_id, created_at desc)
  where status = 'pending';

insert into storage.buckets (id, name, public, file_size_limit)
values ('assessment-evidence', 'assessment-evidence', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function public.storage_assessment_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create table if not exists public.portal_search_documents (
  document_type text not null,
  record_id uuid not null,
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  title text not null,
  subtitle text,
  href text not null,
  search_text text not null,
  search_vector tsvector generated always as (to_tsvector('english', search_text)) stored,
  updated_at timestamptz not null default now(),
  primary key (document_type, record_id)
);

create index if not exists portal_search_documents_vector_gin
  on public.portal_search_documents using gin (search_vector);
create index if not exists portal_search_documents_assessment_idx
  on public.portal_search_documents (site_assessment_id, updated_at desc);

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
end;
$$;

create or replace function public.refresh_portal_search_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_portal_search_for_assessment(old.site_assessment_id);
    return old;
  end if;
  perform public.refresh_portal_search_for_assessment(new.site_assessment_id);
  return new;
end;
$$;

create or replace function public.refresh_portal_assessment_search_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_portal_search_for_assessment(old.id);
    return old;
  end if;
  perform public.refresh_portal_search_for_assessment(new.id);
  return new;
end;
$$;

create or replace function public.refresh_portal_related_search_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare assessment_uuid uuid;
begin
  if tg_table_name = 'sites' then
    for assessment_uuid in select a.id from public.site_assessments a where a.site_id = new.id loop
      perform public.refresh_portal_search_for_assessment(assessment_uuid);
    end loop;
  elsif tg_table_name = 'projects' then
    for assessment_uuid in select a.id from public.site_assessments a where a.project_id = new.id loop
      perform public.refresh_portal_search_for_assessment(assessment_uuid);
    end loop;
  elsif tg_table_name = 'organisations' then
    for assessment_uuid in
      select a.id from public.site_assessments a join public.projects pr on pr.id = a.project_id where pr.organisation_id = new.id
    loop
      perform public.refresh_portal_search_for_assessment(assessment_uuid);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists portal_search_assessment_refresh on public.site_assessments;
create trigger portal_search_assessment_refresh after insert or update on public.site_assessments
  for each row execute function public.refresh_portal_assessment_search_trigger();
drop trigger if exists portal_search_evidence_refresh on public.evidence_sources;
create trigger portal_search_evidence_refresh after insert or update or delete on public.evidence_sources
  for each row execute function public.refresh_portal_search_trigger();
drop trigger if exists portal_search_finding_refresh on public.assessment_findings;
create trigger portal_search_finding_refresh after insert or update or delete on public.assessment_findings
  for each row execute function public.refresh_portal_search_trigger();
drop trigger if exists portal_search_report_refresh on public.assessment_report_sections;
create trigger portal_search_report_refresh after insert or update or delete on public.assessment_report_sections
  for each row execute function public.refresh_portal_search_trigger();
drop trigger if exists portal_search_site_refresh on public.sites;
create trigger portal_search_site_refresh after update on public.sites
  for each row execute function public.refresh_portal_related_search_trigger();
drop trigger if exists portal_search_project_refresh on public.projects;
create trigger portal_search_project_refresh after update on public.projects
  for each row execute function public.refresh_portal_related_search_trigger();
drop trigger if exists portal_search_organisation_refresh on public.organisations;
create trigger portal_search_organisation_refresh after update on public.organisations
  for each row execute function public.refresh_portal_related_search_trigger();

do $$
declare assessment_uuid uuid;
begin
  for assessment_uuid in select id from public.site_assessments loop
    perform public.refresh_portal_search_for_assessment(assessment_uuid);
  end loop;
end $$;

create or replace function public.search_portal(query_text text, result_limit integer default 20)
returns table (
  id text,
  type text,
  title text,
  subtitle text,
  href text,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  with query as (select websearch_to_tsquery('english', query_text) value)
  select d.document_type || '-' || d.record_id, d.document_type, d.title, d.subtitle, d.href,
    ts_rank_cd(d.search_vector, query.value) rank
  from public.portal_search_documents d cross join query
  where public.can_access_assessment(d.site_assessment_id)
    and d.search_vector @@ query.value
  order by rank desc, d.updated_at desc
  limit least(greatest(result_limit, 1), 50);
$$;

alter table public.profiles enable row level security;
alter table public.assessment_assignments enable row level security;
alter table public.utility_service_territories enable row level security;
alter table public.assessment_suggestions enable row level security;
alter table public.portal_search_documents enable row level security;
alter table public.organisations enable row level security;
alter table public.contacts enable row level security;
alter table public.projects enable row level security;
alter table public.sites enable row level security;
alter table public.site_assessments enable row level security;
alter table public.assessment_notes enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.status_history enable row level security;

do $$
declare policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('organisations', 'contacts', 'projects', 'sites', 'site_assessments', 'assessment_notes', 'uploaded_files', 'status_history')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

create policy organisations_scoped_read on public.organisations for select to authenticated
  using (public.is_internal_user() or id = (public.current_profile()).organisation_id);
create policy organisations_internal_manage on public.organisations for all to authenticated
  using (public.current_app_role() in ('admin', 'analyst')) with check (public.current_app_role() in ('admin', 'analyst'));
create policy projects_scoped_read on public.projects for select to authenticated
  using (public.is_internal_user() or organisation_id = (public.current_profile()).organisation_id);
create policy projects_internal_manage on public.projects for all to authenticated
  using (public.current_app_role() in ('admin', 'analyst')) with check (public.current_app_role() in ('admin', 'analyst'));
create policy contacts_scoped_read on public.contacts for select to authenticated
  using (public.is_internal_user() or exists (
    select 1 from public.projects pr
    where pr.lead_contact_id = contacts.id and pr.organisation_id = (public.current_profile()).organisation_id
  ));
create policy contacts_internal_manage on public.contacts for all to authenticated
  using (public.current_app_role() in ('admin', 'analyst')) with check (public.current_app_role() in ('admin', 'analyst'));
create policy sites_scoped_read on public.sites for select to authenticated
  using (public.is_internal_user() or exists (
    select 1 from public.site_assessments a where a.site_id = sites.id and public.can_access_assessment(a.id)
  ));
create policy sites_internal_manage on public.sites for all to authenticated
  using (public.current_app_role() in ('admin', 'analyst')) with check (public.current_app_role() in ('admin', 'analyst'));
create policy assessments_scoped_read on public.site_assessments for select to authenticated
  using (public.can_access_assessment(id));
create policy assessments_analyst_manage on public.site_assessments for all to authenticated
  using (public.can_edit_assessment(id)) with check (public.current_app_role() in ('admin', 'analyst'));
create policy notes_scoped_read on public.assessment_notes for select to authenticated
  using (public.can_access_assessment(site_assessment_id) and (not is_internal or public.is_internal_user()));
create policy notes_analyst_manage on public.assessment_notes for all to authenticated
  using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));
create policy files_scoped_read on public.uploaded_files for select to authenticated
  using (public.can_access_assessment(site_assessment_id));
create policy files_analyst_manage on public.uploaded_files for all to authenticated
  using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));
create policy history_scoped_read on public.status_history for select to authenticated
  using (public.can_access_assessment(site_assessment_id));
create policy history_analyst_manage on public.status_history for all to authenticated
  using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_internal_user());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

drop policy if exists assignments_read on public.assessment_assignments;
create policy assignments_read on public.assessment_assignments for select to authenticated
  using (public.can_access_assessment(site_assessment_id));
drop policy if exists assignments_manage on public.assessment_assignments;
create policy assignments_manage on public.assessment_assignments for all to authenticated
  using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));

drop policy if exists territories_read on public.utility_service_territories;
create policy territories_read on public.utility_service_territories for select to authenticated using (true);
drop policy if exists territories_admin_manage on public.utility_service_territories;
create policy territories_admin_manage on public.utility_service_territories for all to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

drop policy if exists suggestions_read on public.assessment_suggestions;
create policy suggestions_read on public.assessment_suggestions for select to authenticated
  using (public.can_access_assessment(site_assessment_id));
drop policy if exists suggestions_manage on public.assessment_suggestions;
create policy suggestions_manage on public.assessment_suggestions for all to authenticated
  using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));

drop policy if exists portal_search_read on public.portal_search_documents;
create policy portal_search_read on public.portal_search_documents for select to authenticated
  using (public.can_access_assessment(site_assessment_id));

drop policy if exists assessment_evidence_read on storage.objects;
create policy assessment_evidence_read on storage.objects for select to authenticated
  using (bucket_id = 'assessment-evidence' and public.can_access_assessment(public.storage_assessment_id(name)));
drop policy if exists assessment_evidence_insert on storage.objects;
create policy assessment_evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'assessment-evidence' and public.can_edit_assessment(public.storage_assessment_id(name)));
drop policy if exists assessment_evidence_update on storage.objects;
create policy assessment_evidence_update on storage.objects for update to authenticated
  using (bucket_id = 'assessment-evidence' and public.can_edit_assessment(public.storage_assessment_id(name)))
  with check (bucket_id = 'assessment-evidence' and public.can_edit_assessment(public.storage_assessment_id(name)));
drop policy if exists assessment_evidence_delete on storage.objects;
create policy assessment_evidence_delete on storage.objects for delete to authenticated
  using (bucket_id = 'assessment-evidence' and public.can_edit_assessment(public.storage_assessment_id(name)));

-- Remove permissive MVP policies before adding organization- and role-aware policies.
drop policy if exists "Allow MVP manage assessment grid assets" on public.assessment_grid_assets;
drop policy if exists "Allow MVP manage evidence sources" on public.evidence_sources;
drop policy if exists "Allow MVP manage assessment findings" on public.assessment_findings;
drop policy if exists "Allow MVP manage finding evidence links" on public.finding_evidence_links;
drop policy if exists "Allow MVP manage assessment scores" on public.assessment_scores;
drop policy if exists "Allow MVP manage assessment verdicts" on public.assessment_verdicts;
drop policy if exists "Allow MVP manage expert reviews" on public.expert_reviews;
drop policy if exists "Allow MVP manage checklist responses" on public.assessment_checklist_responses;
drop policy if exists "Allow MVP manage assessment report sections" on public.assessment_report_sections;
drop policy if exists "Allow MVP manage assessment report exports" on public.assessment_report_exports;
drop policy if exists "Allow MVP read checklist templates" on public.checklist_templates;
drop policy if exists "Allow MVP read checklist items" on public.checklist_template_items;
drop policy if exists "Allow MVP read report templates" on public.report_templates;
drop policy if exists "Allow MVP read report template sections" on public.report_template_sections;

create policy checklist_templates_authenticated_read on public.checklist_templates for select to authenticated using (true);
create policy checklist_items_authenticated_read on public.checklist_template_items for select to authenticated using (true);
create policy report_templates_authenticated_read on public.report_templates for select to authenticated using (true);
create policy report_template_sections_authenticated_read on public.report_template_sections for select to authenticated using (true);

create policy grid_assets_scoped_read on public.assessment_grid_assets for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy grid_assets_analyst_manage on public.assessment_grid_assets for all to authenticated using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));
create policy evidence_scoped_read on public.evidence_sources for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy evidence_analyst_manage on public.evidence_sources for all to authenticated using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));
create policy findings_scoped_read on public.assessment_findings for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy findings_analyst_manage on public.assessment_findings for all to authenticated using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));
create policy finding_links_scoped_read on public.finding_evidence_links for select to authenticated
  using (exists (select 1 from public.assessment_findings f where f.id = finding_id and public.can_access_assessment(f.site_assessment_id)));
create policy finding_links_analyst_manage on public.finding_evidence_links for all to authenticated
  using (exists (select 1 from public.assessment_findings f where f.id = finding_id and public.can_edit_assessment(f.site_assessment_id)))
  with check (exists (select 1 from public.assessment_findings f where f.id = finding_id and public.can_edit_assessment(f.site_assessment_id)));
create policy scores_scoped_read on public.assessment_scores for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy scores_analyst_manage on public.assessment_scores for all to authenticated using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));
create policy verdicts_scoped_read on public.assessment_verdicts for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy verdicts_analyst_manage on public.assessment_verdicts for all to authenticated using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));
create policy reviews_scoped_read on public.expert_reviews for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy reviews_internal_manage on public.expert_reviews for all to authenticated using (public.can_author_report(site_assessment_id)) with check (public.can_author_report(site_assessment_id));
create policy checklist_responses_scoped_read on public.assessment_checklist_responses for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy checklist_responses_analyst_manage on public.assessment_checklist_responses for all to authenticated using (public.can_edit_assessment(site_assessment_id)) with check (public.can_edit_assessment(site_assessment_id));
create policy report_sections_scoped_read on public.assessment_report_sections for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy report_sections_author_manage on public.assessment_report_sections for all to authenticated using (public.can_author_report(site_assessment_id)) with check (public.can_author_report(site_assessment_id));
create policy report_exports_scoped_read on public.assessment_report_exports for select to authenticated using (public.can_access_assessment(site_assessment_id));
create policy report_exports_author_manage on public.assessment_report_exports for all to authenticated using (public.can_author_report(site_assessment_id)) with check (public.can_author_report(site_assessment_id));

grant execute on function public.search_portal(text, integer) to authenticated;
grant execute on function public.infer_utility_tsp(double precision, double precision, text) to authenticated;
grant execute on function public.current_app_role() to authenticated;
revoke all on function public.refresh_portal_search_for_assessment(uuid) from public, anon, authenticated;
revoke all on function public.refresh_portal_search_trigger() from public, anon, authenticated;
revoke all on function public.refresh_portal_assessment_search_trigger() from public, anon, authenticated;
revoke all on function public.refresh_portal_related_search_trigger() from public, anon, authenticated;

notify pgrst, 'reload schema';
