create extension if not exists pgcrypto;

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  market_region text not null default 'ERCOT',
  version text not null,
  description text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_templates_market_version_key unique (market_region, version)
);

create unique index if not exists checklist_templates_one_active_per_market_idx
  on public.checklist_templates (market_region)
  where is_active;

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  module_key text not null,
  module_name text not null,
  module_sort_order integer not null,
  item_key text not null,
  prompt text not null,
  guidance text,
  is_required boolean not null default true,
  item_sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_template_items_template_item_key unique (template_id, item_key)
);

create index if not exists checklist_template_items_template_sort_idx
  on public.checklist_template_items (template_id, module_sort_order, item_sort_order);

create table if not exists public.assessment_checklist_responses (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  template_item_id uuid not null references public.checklist_template_items(id) on delete cascade,
  status text not null default 'not_started',
  analyst_note text,
  evidence_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_checklist_responses_unique_response unique (site_assessment_id, template_item_id),
  constraint assessment_checklist_responses_status_check check (
    status in ('not_started', 'pass', 'risk', 'blocked', 'not_applicable')
  )
);

create index if not exists assessment_checklist_responses_assessment_idx
  on public.assessment_checklist_responses (site_assessment_id);

create index if not exists assessment_checklist_responses_template_item_idx
  on public.assessment_checklist_responses (template_item_id);

create or replace function public.set_checklist_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists checklist_templates_set_updated_at on public.checklist_templates;
create trigger checklist_templates_set_updated_at
  before update on public.checklist_templates
  for each row
  execute function public.set_checklist_updated_at();

drop trigger if exists checklist_template_items_set_updated_at on public.checklist_template_items;
create trigger checklist_template_items_set_updated_at
  before update on public.checklist_template_items
  for each row
  execute function public.set_checklist_updated_at();

drop trigger if exists assessment_checklist_responses_set_updated_at on public.assessment_checklist_responses;
create trigger assessment_checklist_responses_set_updated_at
  before update on public.assessment_checklist_responses
  for each row
  execute function public.set_checklist_updated_at();

do $$
declare
  template_uuid uuid;
begin
  insert into public.checklist_templates (
    name,
    market_region,
    version,
    description,
    is_active
  )
  values (
    'ERCOT v1 analyst checklist',
    'ERCOT',
    'v1',
    'Structured MVP analyst checklist for ERCOT large-load and AI data-centre site assessments.',
    true
  )
  on conflict (market_region, version) do update
    set name = excluded.name,
        description = excluded.description,
        is_active = excluded.is_active,
        updated_at = now()
  returning id into template_uuid;

  insert into public.checklist_template_items (
    template_id,
    module_key,
    module_name,
    module_sort_order,
    item_key,
    prompt,
    guidance,
    is_required,
    item_sort_order
  )
  values
    (template_uuid, 'intake_completeness', 'Intake completeness', 10, 'minimum_site_identity', 'Minimum site identity is present.', 'Confirm site name, customer organisation, project name, and contact email are available.', true, 10),
    (template_uuid, 'intake_completeness', 'Intake completeness', 10, 'location_basis', 'Location basis is usable for analysis.', 'Confirm address or latitude/longitude is available and plausible enough for screening.', true, 20),
    (template_uuid, 'intake_completeness', 'Intake completeness', 10, 'load_and_timing', 'Load and timing assumptions are captured.', 'Confirm target load, initial phase load where known, full buildout load where known, and desired energization date.', true, 30),
    (template_uuid, 'intake_completeness', 'Intake completeness', 10, 'project_stage_land_control', 'Project stage and land control are recorded.', 'Capture land control status, project stage, and any known site-control evidence.', true, 40),
    (template_uuid, 'intake_completeness', 'Intake completeness', 10, 'customer_documents_logged', 'Customer documents and claims are logged.', 'Confirm existing studies, power quotes, maps, parcel files, or customer claims are referenced.', false, 50),

    (template_uuid, 'power_feasibility', 'Power feasibility', 20, 'market_region_identified', 'Market region is identified.', 'For MVP, confirm ERCOT / Texas is the relevant starting market or flag uncertainty.', true, 10),
    (template_uuid, 'power_feasibility', 'Power feasibility', 20, 'utility_tsp_context', 'Likely utility, TSP, DSP, or service provider context is captured.', 'Record known providers, source evidence, confidence, and open questions.', true, 20),
    (template_uuid, 'power_feasibility', 'Power feasibility', 20, 'nearby_transmission_context', 'Nearby transmission context is captured.', 'Record relevant transmission assets, voltage where known, distance, source, and confidence.', true, 30),
    (template_uuid, 'power_feasibility', 'Power feasibility', 20, 'nearby_substation_context', 'Nearby substation context is captured.', 'Record relevant substations, owner/operator where known, distance, source, and confidence.', true, 40),
    (template_uuid, 'power_feasibility', 'Power feasibility', 20, 'candidate_poi_notes', 'Candidate point-of-interconnection notes are recorded.', 'Capture possible POIs, rationale, source evidence, and confidence level.', false, 50),
    (template_uuid, 'power_feasibility', 'Power feasibility', 20, 'time_to_power_risk', 'Time-to-power risk has an initial assessment.', 'Summarise timeline constraints, unknowns, and whether direct utility/TSP confirmation is needed.', true, 60),

    (template_uuid, 'interconnection_readiness', 'Interconnection readiness', 30, 'large_load_threshold', 'Large-load eligibility is checked.', 'Flag ERCOT sites at or above 75 MW as potentially subject to large-load interconnection requirements.', true, 10),
    (template_uuid, 'interconnection_readiness', 'Interconnection readiness', 30, 'required_entity_and_control', 'Legal entity and site control information are available or flagged.', 'Check legal entity, site ownership/control, and any missing entity or control information.', true, 20),
    (template_uuid, 'interconnection_readiness', 'Interconnection readiness', 30, 'load_ramp_and_energization', 'Load ramp and energization inputs are available or flagged.', 'Check load size, load ramp schedule, requested energization date, and phasing assumptions.', true, 30),
    (template_uuid, 'interconnection_readiness', 'Interconnection readiness', 30, 'engineering_inputs', 'Core engineering inputs are available or flagged.', 'Check one-line diagram, load model, protection settings, voltage ride-through, and frequency ride-through inputs.', true, 40),
    (template_uuid, 'interconnection_readiness', 'Interconnection readiness', 30, 'power_strategy_inputs', 'Backup, battery, UPS, and curtailment inputs are available or flagged.', 'Capture planned backup generation, storage, UPS configuration, curtailment capability, and gaps.', true, 50),
    (template_uuid, 'interconnection_readiness', 'Interconnection readiness', 30, 'commissioning_and_telemetry', 'Commissioning, telemetry, and metering needs are considered.', 'Record known commissioning plan, telemetry, metering, and missing information.', true, 60),
    (template_uuid, 'interconnection_readiness', 'Interconnection readiness', 30, 'studies_financial_communications', 'Studies, financial security, and utility/TSP communications are recorded.', 'Capture existing studies, financial-security readiness, prior utility/TSP communications, and missing next steps.', true, 70),

    (template_uuid, 'reliability_risk', 'Reliability risk', 40, 'ride_through_assumptions', 'Voltage and frequency ride-through assumptions are known or flagged.', 'Unknown or unsupported ride-through assumptions should be treated as high risk for large electronic loads.', true, 10),
    (template_uuid, 'reliability_risk', 'Reliability risk', 40, 'protection_and_trip_settings', 'Protection and staged trip settings are known or flagged.', 'Capture known protection settings, staged trip settings, and simultaneous trip risk.', true, 20),
    (template_uuid, 'reliability_risk', 'Reliability risk', 40, 'ups_backup_storage_behaviour', 'UPS, backup generation, and battery transition behaviour are considered.', 'Record expected transition behaviour and control assumptions for UPS, backup generation, and battery/storage.', true, 30),
    (template_uuid, 'reliability_risk', 'Reliability risk', 40, 'sudden_load_drop_risk', 'Sudden load drop risk is assessed.', 'Estimate total load, interruptible load, and load that could trip simultaneously during disturbances.', true, 40),
    (template_uuid, 'reliability_risk', 'Reliability risk', 40, 'observability_and_models', 'Telemetry, observability, and dynamic model availability are known or flagged.', 'Capture telemetry requirements, observability maturity, dynamic model availability, and confidence.', true, 50),
    (template_uuid, 'reliability_risk', 'Reliability risk', 40, 'disturbance_and_power_quality', 'Disturbance response, reactive power, harmonics, and power quality issues are considered.', 'Record known disturbance response plan, reactive power considerations, harmonics, and power quality assumptions.', false, 60),
    (template_uuid, 'reliability_risk', 'Reliability risk', 40, 'expert_review_trigger', 'Reliability expert review trigger is assessed.', 'Trigger expert review for 75 MW+ load, unknown ride-through, backup/storage strategy, critical risk, or energization within 24 months.', true, 70),

    (template_uuid, 'energy_economics', 'Energy economics', 50, 'pricing_zone_context', 'Pricing zone, hub, or load-zone context is recorded.', 'Identify the relevant pricing zone or market context where available.', true, 10),
    (template_uuid, 'energy_economics', 'Energy economics', 50, 'congestion_risk_summary', 'Congestion risk is summarised.', 'Classify congestion exposure as low, moderate, high, or unknown with supporting evidence or assumptions.', true, 20),
    (template_uuid, 'energy_economics', 'Energy economics', 50, 'nearby_generation_summary', 'Nearby generation context is captured.', 'Record nearby generation assets, technology, status, capacity where known, distance, source, and relevance.', false, 30),
    (template_uuid, 'energy_economics', 'Energy economics', 50, 'procurement_options', 'Power procurement options are noted.', 'Capture likely supply pathways: retail supply, utility tariff, PPA, virtual PPA, behind-the-meter generation, storage, hybrid supply, curtailable service, demand response, or backup generation.', true, 40),
    (template_uuid, 'energy_economics', 'Energy economics', 50, 'tariff_and_capacity_uncertainty', 'Tariff, service, and capacity/resource adequacy uncertainty is flagged.', 'Record commercial uncertainties that require deeper market, utility, or legal diligence.', false, 50),

    (template_uuid, 'flexibility', 'Flexibility', 60, 'curtailment_capability', 'Curtailment capability is captured.', 'Record whether load can be curtailed, curtailable MW, notice, duration, and annual hours where known.', true, 10),
    (template_uuid, 'flexibility', 'Flexibility', 60, 'workload_shift_and_ramp', 'Workload shifting and gradual ramp assumptions are captured.', 'Capture whether compute workloads can shift geographically and whether load can ramp gradually.', true, 20),
    (template_uuid, 'flexibility', 'Flexibility', 60, 'staged_energization', 'Staged energization potential is assessed.', 'Record whether energization can be staged across phases and what constraints apply.', true, 30),
    (template_uuid, 'flexibility', 'Flexibility', 60, 'storage_backup_thermal', 'Battery, backup generation, and thermal storage flexibility are considered.', 'Capture planned storage, backup generation, thermal storage, and grid-supportive uses.', false, 40),
    (template_uuid, 'flexibility', 'Flexibility', 60, 'demand_response_positioning', 'Demand-response or grid-supportive positioning is assessed.', 'Record demand-response interest and how the site could be positioned as flexible or grid-supportive.', false, 50),

    (template_uuid, 'site_non_power_risks', 'Site/non-power risks', 70, 'land_and_zoning', 'Land control and zoning risk are captured.', 'Record land control, zoning compatibility, and gaps that may affect project viability.', true, 10),
    (template_uuid, 'site_non_power_risks', 'Site/non-power risks', 70, 'water_and_cooling', 'Water and cooling risk are captured.', 'Record cooling approach, water requirements, water source uncertainty, and permitting implications.', true, 20),
    (template_uuid, 'site_non_power_risks', 'Site/non-power risks', 70, 'environmental_permitting_community', 'Environmental, permitting, and community risk flags are captured.', 'Record visible environmental, permitting, local opposition, tax, or economic-development issues.', false, 30),
    (template_uuid, 'site_non_power_risks', 'Site/non-power risks', 70, 'access_and_fibre', 'Road/access and fibre-connectivity assumptions are captured.', 'Record access, major road proximity, fibre/connectivity assumptions, and unknowns.', false, 40),
    (template_uuid, 'site_non_power_risks', 'Site/non-power risks', 70, 'backup_generation_permitting', 'Backup-generation permitting risk is considered.', 'Flag local permitting or emissions issues where backup generation is part of the strategy.', false, 50),

    (template_uuid, 'evidence', 'Evidence', 80, 'source_list_started', 'Evidence source list is started.', 'Each project should have source title, source type, publisher, URL or file reference, access date, and relevance notes.', true, 10),
    (template_uuid, 'evidence', 'Evidence', 80, 'key_claims_supported', 'Key claims are tied to evidence, customer data, analyst assumptions, or expert judgement.', 'Do not leave major report conclusions unsupported.', true, 20),
    (template_uuid, 'evidence', 'Evidence', 80, 'source_confidence_classified', 'Source confidence is classified.', 'Classify sources as official, utility/TSP/DSP, ISO/RTO, government/regulator, customer-provided, commercial data, analyst-derived estimate, or unverified.', true, 30),
    (template_uuid, 'evidence', 'Evidence', 80, 'evidence_gaps_flagged', 'Evidence gaps are flagged.', 'Flag report sections that rely heavily on assumptions rather than direct evidence.', true, 40),
    (template_uuid, 'evidence', 'Evidence', 80, 'assumptions_separated', 'Evidence, assumptions, and customer claims are separated.', 'Make sure the analyst can distinguish independent evidence from sponsor claims and analyst assumptions.', true, 50),

    (template_uuid, 'expert_review', 'Expert review', 90, 'review_trigger_checked', 'Expert review trigger is checked.', 'Trigger review for 75 MW+ load, reliability score below threshold, interconnection readiness concerns, unknown ride-through, backup/storage strategy, investor-use reports, or critical risk.', true, 10),
    (template_uuid, 'expert_review', 'Expert review', 90, 'reviewer_assigned', 'Reviewer assignment is recorded when required.', 'Record reviewer type: power systems, interconnection, reliability, energy markets, legal/regulatory, or final report.', false, 20),
    (template_uuid, 'expert_review', 'Expert review', 90, 'review_comments_tracked', 'Expert comments and required changes are tracked.', 'Capture comments, required changes, and approval status before delivery.', false, 30),
    (template_uuid, 'expert_review', 'Expert review', 90, 'delivery_gate_checked', 'Delivery gates are checked.', 'Before delivery, confirm critical sections are complete, high-risk assumptions are flagged, required evidence is attached, expert review is complete if triggered, limitations language is included, and final verdict is selected.', true, 40)
  on conflict (template_id, item_key) do update
    set module_key = excluded.module_key,
        module_name = excluded.module_name,
        module_sort_order = excluded.module_sort_order,
        prompt = excluded.prompt,
        guidance = excluded.guidance,
        is_required = excluded.is_required,
        item_sort_order = excluded.item_sort_order,
        updated_at = now();
end $$;

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.assessment_checklist_responses enable row level security;

drop policy if exists "Allow MVP read checklist templates" on public.checklist_templates;
create policy "Allow MVP read checklist templates"
  on public.checklist_templates
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow MVP read checklist items" on public.checklist_template_items;
create policy "Allow MVP read checklist items"
  on public.checklist_template_items
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow MVP manage checklist responses" on public.assessment_checklist_responses;
create policy "Allow MVP manage checklist responses"
  on public.assessment_checklist_responses
  for all
  to anon, authenticated
  using (true)
  with check (true);
