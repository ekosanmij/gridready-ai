create extension if not exists pgcrypto;

create table if not exists public.evidence_sources (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  title text not null,
  source_type text not null default 'other',
  publisher text,
  url text,
  file_reference text,
  accessed_at date,
  published_at date,
  confidence_level text not null default 'unknown',
  license_notes text,
  limitation_notes text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evidence_sources_title_check check (length(btrim(title)) > 0),
  constraint evidence_sources_source_type_check check (
    source_type in (
      'official_iso_rto',
      'utility_tsp_dsp',
      'government_regulator',
      'customer_provided',
      'commercial_dataset',
      'public_gis_dataset',
      'analyst_assumption',
      'analyst_derived',
      'expert_judgement',
      'unverified_web',
      'other'
    )
  ),
  constraint evidence_sources_confidence_level_check check (
    confidence_level in ('high', 'medium', 'low', 'unknown')
  )
);

create index if not exists evidence_sources_assessment_idx
  on public.evidence_sources (site_assessment_id);

create index if not exists evidence_sources_source_type_idx
  on public.evidence_sources (site_assessment_id, source_type);

create index if not exists evidence_sources_confidence_idx
  on public.evidence_sources (site_assessment_id, confidence_level);

create table if not exists public.assessment_findings (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  module_key text not null,
  title text not null,
  finding_type text not null default 'finding',
  risk_level text not null default 'unknown',
  confidence_level text not null default 'unknown',
  statement text,
  assumption_note text,
  recommendation text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_findings_title_check check (length(btrim(title)) > 0),
  constraint assessment_findings_module_key_check check (
    module_key in (
      'power_feasibility',
      'interconnection_readiness',
      'reliability_risk',
      'energy_economics',
      'flexibility',
      'site_non_power_risks',
      'evidence',
      'expert_review'
    )
  ),
  constraint assessment_findings_risk_level_check check (
    risk_level in ('critical', 'high', 'medium', 'low', 'unknown')
  ),
  constraint assessment_findings_confidence_level_check check (
    confidence_level in ('high', 'medium', 'low', 'unknown')
  ),
  constraint assessment_findings_status_check check (
    status in ('open', 'needs_review', 'resolved', 'superseded')
  )
);

create index if not exists assessment_findings_assessment_idx
  on public.assessment_findings (site_assessment_id);

create index if not exists assessment_findings_module_idx
  on public.assessment_findings (site_assessment_id, module_key);

create index if not exists assessment_findings_risk_idx
  on public.assessment_findings (site_assessment_id, risk_level);

create table if not exists public.finding_evidence_links (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.assessment_findings(id) on delete cascade,
  evidence_source_id uuid not null references public.evidence_sources(id) on delete cascade,
  link_note text,
  created_at timestamptz not null default now(),
  constraint finding_evidence_links_unique_link unique (finding_id, evidence_source_id)
);

create index if not exists finding_evidence_links_finding_idx
  on public.finding_evidence_links (finding_id);

create index if not exists finding_evidence_links_evidence_source_idx
  on public.finding_evidence_links (evidence_source_id);

create or replace function public.set_evidence_findings_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = now();
  return new;
end;
';

drop trigger if exists evidence_sources_set_updated_at on public.evidence_sources;
create trigger evidence_sources_set_updated_at
  before update on public.evidence_sources
  for each row
  execute function public.set_evidence_findings_updated_at();

drop trigger if exists assessment_findings_set_updated_at on public.assessment_findings;
create trigger assessment_findings_set_updated_at
  before update on public.assessment_findings
  for each row
  execute function public.set_evidence_findings_updated_at();

create or replace function public.validate_finding_evidence_link_assessment()
returns trigger
language plpgsql
as '
declare
  finding_assessment_id uuid;
  evidence_assessment_id uuid;
begin
  select site_assessment_id
    into finding_assessment_id
    from public.assessment_findings
    where id = new.finding_id;

  select site_assessment_id
    into evidence_assessment_id
    from public.evidence_sources
    where id = new.evidence_source_id;

  if finding_assessment_id is null
    or evidence_assessment_id is null
    or finding_assessment_id <> evidence_assessment_id then
    raise exception ''Finding and evidence source must belong to the same site assessment.'';
  end if;

  return new;
end;
';

drop trigger if exists finding_evidence_links_validate_assessment on public.finding_evidence_links;
create trigger finding_evidence_links_validate_assessment
  before insert or update on public.finding_evidence_links
  for each row
  execute function public.validate_finding_evidence_link_assessment();

alter table public.evidence_sources enable row level security;
alter table public.assessment_findings enable row level security;
alter table public.finding_evidence_links enable row level security;

drop policy if exists "Allow MVP manage evidence sources" on public.evidence_sources;
create policy "Allow MVP manage evidence sources"
  on public.evidence_sources
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow MVP manage assessment findings" on public.assessment_findings;
create policy "Allow MVP manage assessment findings"
  on public.assessment_findings
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow MVP manage finding evidence links" on public.finding_evidence_links;
create policy "Allow MVP manage finding evidence links"
  on public.finding_evidence_links
  for all
  to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
