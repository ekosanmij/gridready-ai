create extension if not exists pgcrypto;

create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  market_region text not null default 'ERCOT',
  version text not null,
  report_type text not null default 'single_site',
  description text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_templates_market_version_type_key unique (market_region, version, report_type),
  constraint report_templates_report_type_check check (
    report_type in ('single_site', 'investor_memo', 'multi_site')
  )
);

create unique index if not exists report_templates_one_active_per_market_type_idx
  on public.report_templates (market_region, report_type)
  where is_active;

create table if not exists public.report_template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_templates(id) on delete cascade,
  section_key text not null,
  title text not null,
  sort_order integer not null,
  is_required boolean not null default true,
  default_guidance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_template_sections_template_section_key unique (template_id, section_key),
  constraint report_template_sections_section_key_check check (
    section_key in (
      'executive_verdict',
      'site_overview',
      'project_assumptions',
      'power_feasibility_score',
      'nearby_grid_infrastructure',
      'utility_market_context',
      'interconnection_pathway',
      'required_information_missing_diligence',
      'grid_reliability_risk_assessment',
      'energy_economics_congestion_view',
      'nearby_generation_procurement_options',
      'flexibility_demand_response_potential',
      'permitting_water_cooling_community_risks',
      'key_risks_mitigants',
      'recommended_next_steps',
      'investor_utility_ready_memo',
      'evidence_appendix',
      'assumptions_limitations'
    )
  )
);

create index if not exists report_template_sections_template_sort_idx
  on public.report_template_sections (template_id, sort_order);

create table if not exists public.assessment_report_sections (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  template_section_id uuid not null references public.report_template_sections(id) on delete cascade,
  section_key text not null,
  title text not null,
  content text not null default '',
  status text not null default 'draft',
  is_edited boolean not null default false,
  generated_at timestamptz,
  generation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_report_sections_unique_section unique (site_assessment_id, template_section_id),
  constraint assessment_report_sections_status_check check (
    status in ('draft', 'needs_review', 'ready', 'final')
  ),
  constraint assessment_report_sections_section_key_check check (
    section_key in (
      'executive_verdict',
      'site_overview',
      'project_assumptions',
      'power_feasibility_score',
      'nearby_grid_infrastructure',
      'utility_market_context',
      'interconnection_pathway',
      'required_information_missing_diligence',
      'grid_reliability_risk_assessment',
      'energy_economics_congestion_view',
      'nearby_generation_procurement_options',
      'flexibility_demand_response_potential',
      'permitting_water_cooling_community_risks',
      'key_risks_mitigants',
      'recommended_next_steps',
      'investor_utility_ready_memo',
      'evidence_appendix',
      'assumptions_limitations'
    )
  )
);

create index if not exists assessment_report_sections_assessment_idx
  on public.assessment_report_sections (site_assessment_id);

create index if not exists assessment_report_sections_status_idx
  on public.assessment_report_sections (site_assessment_id, status);

create table if not exists public.assessment_report_exports (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  template_id uuid not null references public.report_templates(id) on delete cascade,
  export_type text not null default 'print_preview',
  status text not null default 'not_started',
  notes text,
  ready_for_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_report_exports_unique_export unique (site_assessment_id, template_id, export_type),
  constraint assessment_report_exports_export_type_check check (
    export_type in ('print_preview', 'draft_package')
  ),
  constraint assessment_report_exports_status_check check (
    status in ('not_started', 'draft_generated', 'analyst_edited', 'ready_for_review', 'exported')
  )
);

create index if not exists assessment_report_exports_assessment_idx
  on public.assessment_report_exports (site_assessment_id);

create or replace function public.set_report_builder_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists report_templates_set_updated_at on public.report_templates;
create trigger report_templates_set_updated_at
  before update on public.report_templates
  for each row
  execute function public.set_report_builder_updated_at();

drop trigger if exists report_template_sections_set_updated_at on public.report_template_sections;
create trigger report_template_sections_set_updated_at
  before update on public.report_template_sections
  for each row
  execute function public.set_report_builder_updated_at();

drop trigger if exists assessment_report_sections_set_updated_at on public.assessment_report_sections;
create trigger assessment_report_sections_set_updated_at
  before update on public.assessment_report_sections
  for each row
  execute function public.set_report_builder_updated_at();

drop trigger if exists assessment_report_exports_set_updated_at on public.assessment_report_exports;
create trigger assessment_report_exports_set_updated_at
  before update on public.assessment_report_exports
  for each row
  execute function public.set_report_builder_updated_at();

do $$
declare
  template_uuid uuid;
begin
  insert into public.report_templates (
    name,
    market_region,
    version,
    report_type,
    description,
    is_active
  )
  values (
    'ERCOT v1 single-site feasibility report',
    'ERCOT',
    'v1',
    'single_site',
    'Internal MVP template for GridReady AI Site Power Feasibility & Interconnection Readiness reports.',
    true
  )
  on conflict (market_region, version, report_type) do update
    set name = excluded.name,
        description = excluded.description,
        is_active = excluded.is_active,
        updated_at = now()
  returning id into template_uuid;

  insert into public.report_template_sections (
    template_id,
    section_key,
    title,
    sort_order,
    is_required,
    default_guidance
  )
  values
    (template_uuid, 'executive_verdict', 'Executive Verdict', 10, true, 'Summarise verdict, score, confidence, primary reasons, and next action.'),
    (template_uuid, 'site_overview', 'Site Overview', 20, true, 'Summarise customer, project, site, location, load, and timeline context.'),
    (template_uuid, 'project_assumptions', 'Project Assumptions', 30, true, 'Separate customer assumptions, analyst assumptions, and missing confirmations.'),
    (template_uuid, 'power_feasibility_score', 'Power Feasibility Score', 40, true, 'Explain power feasibility score, strengths, weaknesses, and evidence status.'),
    (template_uuid, 'nearby_grid_infrastructure', 'Nearby Grid Infrastructure', 50, true, 'List saved grid assets and candidate POIs.'),
    (template_uuid, 'utility_market_context', 'Utility / TSP / DSP / Market Context', 60, true, 'Summarise known utility, TSP, market, and source confidence.'),
    (template_uuid, 'interconnection_pathway', 'Likely Interconnection Pathway', 70, true, 'Describe likely process and open confirmation questions.'),
    (template_uuid, 'required_information_missing_diligence', 'Required Information and Missing Diligence', 80, true, 'Use checklist status and findings to identify missing diligence.'),
    (template_uuid, 'grid_reliability_risk_assessment', 'Grid Reliability Risk Assessment', 90, true, 'Summarise reliability risks and expert review status.'),
    (template_uuid, 'energy_economics_congestion_view', 'Energy Economics and Congestion View', 100, true, 'Summarise economics score, congestion findings, and procurement uncertainty.'),
    (template_uuid, 'nearby_generation_procurement_options', 'Nearby Generation and Power Procurement Options', 110, true, 'Summarise generation context and likely procurement options.'),
    (template_uuid, 'flexibility_demand_response_potential', 'Flexibility and Demand-Response Potential', 120, true, 'Summarise curtailable/staged/flexible load posture.'),
    (template_uuid, 'permitting_water_cooling_community_risks', 'Permitting, Water, Cooling, and Community Risk Flags', 130, true, 'Summarise site and non-power risk flags.'),
    (template_uuid, 'key_risks_mitigants', 'Key Risks and Mitigants', 140, true, 'Summarise critical/high risks and mitigants.'),
    (template_uuid, 'recommended_next_steps', 'Recommended Next Steps', 150, true, 'List next diligence actions.'),
    (template_uuid, 'investor_utility_ready_memo', 'Investor/Utility-Ready Memo', 160, true, 'Create concise memo for investor or utility/TSP conversations.'),
    (template_uuid, 'evidence_appendix', 'Evidence Appendix', 170, true, 'List source library and evidence coverage.'),
    (template_uuid, 'assumptions_limitations', 'Assumptions and Limitations', 180, true, 'Include explicit assumptions and limitations language.')
  on conflict (template_id, section_key) do update
    set title = excluded.title,
        sort_order = excluded.sort_order,
        is_required = excluded.is_required,
        default_guidance = excluded.default_guidance,
        updated_at = now();
end $$;

alter table public.report_templates enable row level security;
alter table public.report_template_sections enable row level security;
alter table public.assessment_report_sections enable row level security;
alter table public.assessment_report_exports enable row level security;

drop policy if exists "Allow MVP read report templates" on public.report_templates;
create policy "Allow MVP read report templates"
  on public.report_templates
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow MVP read report template sections" on public.report_template_sections;
create policy "Allow MVP read report template sections"
  on public.report_template_sections
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow MVP manage assessment report sections" on public.assessment_report_sections;
create policy "Allow MVP manage assessment report sections"
  on public.assessment_report_sections
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow MVP manage assessment report exports" on public.assessment_report_exports;
create policy "Allow MVP manage assessment report exports"
  on public.assessment_report_exports
  for all
  to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
