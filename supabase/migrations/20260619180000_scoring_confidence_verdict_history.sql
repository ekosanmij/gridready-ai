-- AN-008 / AN-009 / AN-010 / AN-011: exact weighted readiness,
-- independent confidence, canonical verdicts, and immutable history.

create table if not exists public.analysis_methodology_versions (
  id uuid primary key default gen_random_uuid(),
  methodology_key text not null,
  version text not null,
  name text not null,
  status text not null default 'draft',
  component_weights jsonb not null,
  readiness_bands jsonb not null,
  confidence_rules jsonb not null,
  verdict_values jsonb not null,
  rationale text not null,
  effective_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_methodology_versions_key unique (methodology_key, version),
  constraint analysis_methodology_versions_status_check check (status in ('active', 'draft', 'retired'))
);

create unique index if not exists analysis_methodology_one_active_idx
  on public.analysis_methodology_versions (methodology_key)
  where status = 'active';

insert into public.analysis_methodology_versions (
  methodology_key, version, name, status, component_weights,
  readiness_bands, confidence_rules, verdict_values, rationale,
  effective_at, approved_at
)
values (
  'gridready_power_readiness',
  '1.0.0',
  'GridReady Power Readiness Methodology',
  'active',
  '{
    "power_feasibility": 0.30,
    "interconnection_readiness": 0.20,
    "reliability_risk": 0.15,
    "energy_economics": 0.10,
    "flexibility": 0.10,
    "site_non_power_risks": 0.10,
    "evidence_quality": 0.05
  }'::jsonb,
  '[
    {"minimum": 0, "maximum": 24, "key": "reject_not_currently_viable", "label": "Reject / not currently viable"},
    {"minimum": 25, "maximum": 44, "key": "high_risk_major_blockers", "label": "High risk / major blockers"},
    {"minimum": 45, "maximum": 59, "key": "targeted_diligence_only", "label": "Targeted diligence only"},
    {"minimum": 60, "maximum": 74, "key": "plausible_unresolved_risks", "label": "Plausible with unresolved risks"},
    {"minimum": 75, "maximum": 84, "key": "strong_candidate", "label": "Strong candidate"},
    {"minimum": 85, "maximum": 100, "key": "highly_attractive_candidate", "label": "Highly attractive candidate"}
  ]'::jsonb,
  '{
    "component_confidence_weight": 0.70,
    "expert_review_weight": 0.20,
    "evidence_recency_weight": 0.10,
    "component_points": {"high": 100, "medium": 70, "low": 40, "unknown": 0},
    "review_points": {"approved": 100, "not_required": 80, "other": 40},
    "recency_points": {"current": 100, "stale": 50, "missing": 40},
    "stale_after_months": 18,
    "high_minimum": 80,
    "medium_minimum": 55,
    "incomplete_is_low": true,
    "unknown_is_low": true
  }'::jsonb,
  '[
    "reject",
    "pause",
    "proceed_targeted_diligence",
    "proceed_with_caution",
    "strong_candidate",
    "strong_candidate_subject_to_utility_confirmation"
  ]'::jsonb,
  'Implements the approved seven-factor weighting, readiness bands, independent confidence and canonical verdict model from the development specification.',
  now(),
  now()
)
on conflict (methodology_key, version) do update
set name = excluded.name,
    status = excluded.status,
    component_weights = excluded.component_weights,
    readiness_bands = excluded.readiness_bands,
    confidence_rules = excluded.confidence_rules,
    verdict_values = excluded.verdict_values,
    rationale = excluded.rationale,
    effective_at = excluded.effective_at,
    updated_at = now();

create table if not exists public.assessment_score_events (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  module_key text not null,
  previous_score integer,
  new_score integer not null,
  previous_risk_level text,
  new_risk_level text not null,
  previous_confidence_level text,
  new_confidence_level text not null,
  origin text not null,
  reason text,
  rationale text,
  methodology_version_id uuid references public.analysis_methodology_versions(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  reviewer_approved_by uuid references auth.users(id) on delete set null,
  reviewer_approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assessment_score_events_origin_check check (origin in ('automated', 'initial_manual', 'legacy', 'manual_override')),
  constraint assessment_score_events_score_check check (
    (previous_score is null or previous_score between 0 and 100) and new_score between 0 and 100
  ),
  constraint assessment_score_events_module_check check (module_key in (
    'power_feasibility', 'interconnection_readiness', 'reliability_risk',
    'energy_economics', 'flexibility', 'site_non_power_risks',
    'evidence_quality', 'overall_readiness'
  )),
  constraint assessment_score_events_risk_check check (
    (previous_risk_level is null or previous_risk_level in ('critical', 'high', 'medium', 'low', 'unknown'))
    and new_risk_level in ('critical', 'high', 'medium', 'low', 'unknown')
  ),
  constraint assessment_score_events_confidence_check check (
    (previous_confidence_level is null or previous_confidence_level in ('high', 'medium', 'low', 'unknown'))
    and new_confidence_level in ('high', 'medium', 'low', 'unknown')
  )
);

create index if not exists assessment_score_events_assessment_created_idx
  on public.assessment_score_events (site_assessment_id, created_at desc);
create index if not exists assessment_score_events_module_created_idx
  on public.assessment_score_events (site_assessment_id, module_key, created_at desc);

create table if not exists public.assessment_verdict_events (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  previous_verdict text,
  new_verdict text not null,
  previous_confidence_level text,
  new_confidence_level text not null,
  previous_approved_by_analyst boolean,
  new_approved_by_analyst boolean not null,
  origin text not null,
  reason text,
  conditions text,
  summary text,
  methodology_version_id uuid references public.analysis_methodology_versions(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  reviewer_approved_by uuid references auth.users(id) on delete set null,
  reviewer_approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assessment_verdict_events_origin_check check (origin in ('initial_manual', 'legacy_migration', 'manual_override')),
  constraint assessment_verdict_events_new_verdict_check check (new_verdict in (
    'reject', 'pause', 'proceed_targeted_diligence', 'proceed_with_caution',
    'strong_candidate', 'strong_candidate_subject_to_utility_confirmation'
  )),
  constraint assessment_verdict_events_confidence_check check (
    (previous_confidence_level is null or previous_confidence_level in ('high', 'medium', 'low', 'unknown'))
    and new_confidence_level in ('high', 'medium', 'low', 'unknown')
  )
);

create index if not exists assessment_verdict_events_assessment_created_idx
  on public.assessment_verdict_events (site_assessment_id, created_at desc);

create table if not exists public.assessment_score_calculations (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  methodology_version_id uuid not null references public.analysis_methodology_versions(id) on delete restrict,
  component_snapshot jsonb not null,
  completed_component_count integer not null,
  overall_score integer,
  readiness_band text not null,
  confidence_points numeric(6,2) not null,
  overall_confidence text not null,
  blockers jsonb not null default '[]'::jsonb,
  calculated_by uuid references auth.users(id) on delete set null,
  calculation_reason text,
  created_at timestamptz not null default now(),
  constraint assessment_score_calculations_component_count_check check (completed_component_count between 0 and 7),
  constraint assessment_score_calculations_score_check check (overall_score is null or overall_score between 0 and 100),
  constraint assessment_score_calculations_confidence_check check (overall_confidence in ('high', 'low', 'medium')),
  constraint assessment_score_calculations_band_check check (readiness_band in (
    'incomplete', 'reject_not_currently_viable', 'high_risk_major_blockers',
    'targeted_diligence_only', 'plausible_unresolved_risks',
    'strong_candidate', 'highly_attractive_candidate'
  ))
);

create index if not exists assessment_score_calculations_latest_idx
  on public.assessment_score_calculations (site_assessment_id, created_at desc);

alter table public.assessment_scores
  add column if not exists methodology_version_id uuid references public.analysis_methodology_versions(id) on delete restrict,
  add column if not exists current_event_id uuid references public.assessment_score_events(id) on delete restrict,
  add column if not exists calculation_origin text not null default 'legacy',
  add column if not exists weight numeric(5,4),
  add column if not exists weighted_contribution numeric(7,3),
  add column if not exists is_derived boolean not null default false;

alter table public.assessment_scores
  drop constraint if exists assessment_scores_calculation_origin_check;
alter table public.assessment_scores
  add constraint assessment_scores_calculation_origin_check
  check (calculation_origin in ('automated', 'initial_manual', 'legacy', 'manual_override'));

alter table public.assessment_verdicts
  add column if not exists confidence_level text not null default 'unknown',
  add column if not exists conditions text,
  add column if not exists legacy_verdict text,
  add column if not exists authored_by uuid references auth.users(id) on delete set null,
  add column if not exists methodology_version_id uuid references public.analysis_methodology_versions(id) on delete restrict,
  add column if not exists current_event_id uuid references public.assessment_verdict_events(id) on delete restrict;

alter table public.assessment_verdicts
  drop constraint if exists assessment_verdicts_verdict_check;

alter table public.assessment_verdicts
  alter column verdict set default 'pause';

update public.assessment_verdicts
set legacy_verdict = coalesce(legacy_verdict, verdict),
    verdict = case verdict
  when 'proceed' then 'strong_candidate'
  when 'proceed_with_conditions' then 'proceed_with_caution'
  when 'escalate_deeper_diligence' then 'proceed_targeted_diligence'
  when 'insufficient_information' then 'pause'
  else verdict
end;

alter table public.assessment_verdicts
  add constraint assessment_verdicts_verdict_check check (
    verdict in (
      'reject',
      'pause',
      'proceed_targeted_diligence',
      'proceed_with_caution',
      'strong_candidate',
      'strong_candidate_subject_to_utility_confirmation'
    )
  );

alter table public.assessment_verdicts
  drop constraint if exists assessment_verdicts_confidence_level_check;
alter table public.assessment_verdicts
  add constraint assessment_verdicts_confidence_level_check
  check (confidence_level in ('high', 'low', 'medium', 'unknown'));

do $$
declare
  v_methodology_id uuid;
  v_score public.assessment_scores;
  v_event_id uuid;
  v_verdict public.assessment_verdicts;
begin
  select id into v_methodology_id
  from public.analysis_methodology_versions
  where methodology_key = 'gridready_power_readiness' and status = 'active';

  for v_score in select * from public.assessment_scores where current_event_id is null loop
    insert into public.assessment_score_events (
      site_assessment_id, module_key, new_score, new_risk_level,
      new_confidence_level, origin, reason, rationale, methodology_version_id,
      created_at
    ) values (
      v_score.site_assessment_id, v_score.module_key, v_score.score,
      v_score.risk_level, v_score.confidence_level, 'legacy',
      'Migrated from the pre-versioned scorecard.', v_score.rationale,
      v_methodology_id, v_score.created_at
    ) returning id into v_event_id;

    update public.assessment_scores
    set current_event_id = v_event_id,
        methodology_version_id = v_methodology_id,
        calculation_origin = 'legacy',
        is_derived = false
    where id = v_score.id;
  end loop;

  for v_verdict in select * from public.assessment_verdicts where current_event_id is null loop
    insert into public.assessment_verdict_events (
      site_assessment_id, previous_verdict, new_verdict, new_confidence_level,
      new_approved_by_analyst, origin, reason, conditions, summary,
      methodology_version_id, created_at
    ) values (
      v_verdict.site_assessment_id,
      case when v_verdict.legacy_verdict is distinct from v_verdict.verdict then v_verdict.legacy_verdict else null end,
      v_verdict.verdict,
      v_verdict.confidence_level, v_verdict.approved_by_analyst,
      'legacy_migration', format('Mapped legacy verdict %s to %s.', coalesce(v_verdict.legacy_verdict, v_verdict.verdict), v_verdict.verdict),
      v_verdict.conditions, v_verdict.summary, v_methodology_id,
      v_verdict.created_at
    ) returning id into v_event_id;

    update public.assessment_verdicts
    set current_event_id = v_event_id,
        methodology_version_id = v_methodology_id,
        authored_by = coalesce(authored_by, null)
    where id = v_verdict.id;
  end loop;
end;
$$;

create or replace function public.enforce_score_mutation_path()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.score_mutation_authorized', true), '') <> 'true' then
    raise exception 'Scores must be changed through save_assessment_scores().' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.enforce_verdict_mutation_path()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.verdict_mutation_authorized', true), '') <> 'true' then
    raise exception 'Verdicts must be changed through save_assessment_verdict().' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.enforce_immutable_analysis_history()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if tg_op = 'DELETE'
     and not exists (
       select 1 from public.site_assessments a where a.id = old.site_assessment_id
     ) then
    return old;
  end if;
  raise exception 'Analysis history is append-only.' using errcode = '42501';
end;
$$;

create or replace function public.calculate_assessment_readiness(
  p_assessment_id uuid,
  p_reason text default 'Scorecard recalculated'
)
returns table (
  calculation_id uuid,
  overall_score integer,
  readiness_band text,
  overall_confidence text,
  blockers jsonb
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_methodology_id uuid;
  v_completed integer;
  v_unknown integer;
  v_weighted numeric;
  v_score integer;
  v_band text;
  v_component_confidence numeric;
  v_review_points numeric := 40;
  v_recency_points numeric := 40;
  v_evidence_count integer := 0;
  v_stale_sources integer := 0;
  v_confidence_points numeric;
  v_confidence text;
  v_snapshot jsonb;
  v_blockers jsonb := '[]'::jsonb;
  v_calculation_id uuid;
  v_existing public.assessment_scores;
  v_event_id uuid;
  v_risk text;
begin
  if auth.uid() is null or not public.can_edit_assessment(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  select id into v_methodology_id
  from public.analysis_methodology_versions
  where methodology_key = 'gridready_power_readiness' and status = 'active'
  order by effective_at desc nulls last
  limit 1;

  if v_methodology_id is null then
    raise exception 'No active readiness methodology is configured.' using errcode = 'P0002';
  end if;

  perform set_config('app.score_mutation_authorized', 'true', true);

  update public.assessment_scores s
  set methodology_version_id = v_methodology_id,
      weight = case s.module_key
        when 'power_feasibility' then 0.30
        when 'interconnection_readiness' then 0.20
        when 'reliability_risk' then 0.15
        when 'energy_economics' then 0.10
        when 'flexibility' then 0.10
        when 'site_non_power_risks' then 0.10
        when 'evidence_quality' then 0.05
        else s.weight
      end,
      weighted_contribution = case s.module_key
        when 'power_feasibility' then s.score * 0.30
        when 'interconnection_readiness' then s.score * 0.20
        when 'reliability_risk' then s.score * 0.15
        when 'energy_economics' then s.score * 0.10
        when 'flexibility' then s.score * 0.10
        when 'site_non_power_risks' then s.score * 0.10
        when 'evidence_quality' then s.score * 0.05
        else s.weighted_contribution
      end
  where s.site_assessment_id = p_assessment_id
    and s.module_key <> 'overall_readiness';

  select
    count(*),
    count(*) filter (where s.confidence_level = 'unknown'),
    coalesce(sum(s.weighted_contribution), 0),
    coalesce(sum(case s.confidence_level
      when 'high' then 100
      when 'medium' then 70
      when 'low' then 40
      else 0
    end), 0) / 7.0,
    coalesce(jsonb_object_agg(
      s.module_key,
      jsonb_build_object(
        'score', s.score,
        'weight', s.weight,
        'contribution', s.weighted_contribution,
        'confidence', s.confidence_level,
        'risk', s.risk_level,
        'event_id', s.current_event_id
      )
    ), '{}'::jsonb)
  into v_completed, v_unknown, v_weighted, v_component_confidence, v_snapshot
  from public.assessment_scores s
  where s.site_assessment_id = p_assessment_id
    and s.module_key in (
      'power_feasibility', 'interconnection_readiness', 'reliability_risk',
      'energy_economics', 'flexibility', 'site_non_power_risks', 'evidence_quality'
    );

  select case r.status
    when 'approved' then 100
    when 'not_required' then 80
    else 40
  end
  into v_review_points
  from public.expert_reviews r
  where r.site_assessment_id = p_assessment_id and r.review_type = 'final_report'
  order by r.created_at desc
  limit 1;
  v_review_points := coalesce(v_review_points, 40);

  select
    count(*),
    count(*) filter (
      where coalesce(e.accessed_at, e.published_at, e.created_at) < now() - interval '18 months'
    )
  into v_evidence_count, v_stale_sources
  from public.evidence_sources e
  where e.site_assessment_id = p_assessment_id;

  v_recency_points := case
    when v_evidence_count = 0 then 40
    when v_stale_sources > 0 then 50
    else 100
  end;

  v_confidence_points := round(
    (v_component_confidence * 0.70) +
    (v_review_points * 0.20) +
    (v_recency_points * 0.10),
    2
  );
  v_confidence := case
    when v_completed < 7 or v_unknown > 0 or v_evidence_count = 0 then 'low'
    when v_confidence_points >= 80 then 'high'
    when v_confidence_points >= 55 then 'medium'
    else 'low'
  end;

  if v_completed < 7 then
    v_score := null;
    v_band := 'incomplete';
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'missing_score_components',
      'message', format('%s of 7 required score components are complete.', v_completed),
      'remediation', 'Complete every weighted score component.'
    ));
  else
    v_score := round(v_weighted)::integer;
    v_band := case
      when v_score <= 24 then 'reject_not_currently_viable'
      when v_score <= 44 then 'high_risk_major_blockers'
      when v_score <= 59 then 'targeted_diligence_only'
      when v_score <= 74 then 'plausible_unresolved_risks'
      when v_score <= 84 then 'strong_candidate'
      else 'highly_attractive_candidate'
    end;
  end if;

  if v_unknown > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'unknown_component_confidence',
      'message', format('%s score component(s) have unknown confidence.', v_unknown),
      'remediation', 'Document source quality and select a supported confidence level.'
    ));
  end if;

  if v_evidence_count = 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'missing_evidence_sources',
      'message', 'No evidence sources are registered for the assessment.',
      'remediation', 'Register the sources supporting component scores before relying on confidence.'
    ));
  elsif v_stale_sources > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'stale_evidence_sources',
      'message', format('%s evidence source(s) are older than the 18-month recency threshold.', v_stale_sources),
      'remediation', 'Refresh stale sources or document why they remain decision-useful.'
    ));
  end if;

  if v_confidence = 'low' then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'key', 'low_overall_confidence',
      'message', 'Overall confidence is low and must remain separate from readiness.',
      'remediation', 'Resolve unknowns, improve source quality, or complete required expert review.'
    ));
  end if;

  insert into public.assessment_score_calculations (
    site_assessment_id, methodology_version_id, component_snapshot,
    completed_component_count, overall_score, readiness_band,
    confidence_points, overall_confidence, blockers, calculated_by,
    calculation_reason
  ) values (
    p_assessment_id, v_methodology_id, v_snapshot, v_completed, v_score,
    v_band, v_confidence_points, v_confidence, v_blockers, auth.uid(),
    nullif(left(coalesce(p_reason, ''), 1000), '')
  ) returning id into v_calculation_id;

  if v_score is not null then
    select * into v_existing
    from public.assessment_scores s
    where s.site_assessment_id = p_assessment_id and s.module_key = 'overall_readiness'
    for update;

    if v_existing.id is null
       or v_existing.score is distinct from v_score
       or v_existing.confidence_level is distinct from v_confidence
       or v_existing.calculation_origin is distinct from 'automated' then
      v_risk := case
        when v_score <= 24 then 'critical'
        when v_score <= 44 then 'high'
        when v_score <= 74 then 'medium'
        else 'low'
      end;

      insert into public.assessment_score_events (
        site_assessment_id, module_key, previous_score, new_score,
        previous_risk_level, new_risk_level, previous_confidence_level,
        new_confidence_level, origin, reason, rationale,
        methodology_version_id, actor_id, actor_role
      ) values (
        p_assessment_id, 'overall_readiness', v_existing.score, v_score,
        v_existing.risk_level, v_risk, v_existing.confidence_level,
        v_confidence, 'automated', nullif(left(coalesce(p_reason, ''), 1000), ''),
        format('Weighted score %s; band %s; confidence %s.', v_score, v_band, v_confidence),
        v_methodology_id, auth.uid(), public.current_app_role()
      ) returning id into v_event_id;

      insert into public.assessment_scores (
        id, site_assessment_id, module_key, score, risk_level,
        confidence_level, rationale, override_note, methodology_version_id,
        current_event_id, calculation_origin, weight,
        weighted_contribution, is_derived
      ) values (
        coalesce(v_existing.id, gen_random_uuid()), p_assessment_id,
        'overall_readiness', v_score, v_risk, v_confidence,
        format('Weighted readiness using methodology 1.0.0; band %s.', v_band),
        null, v_methodology_id, v_event_id, 'automated', 1.0, v_score, true
      )
      on conflict (site_assessment_id, module_key) do update
      set score = excluded.score,
          risk_level = excluded.risk_level,
          confidence_level = excluded.confidence_level,
          rationale = excluded.rationale,
          override_note = null,
          methodology_version_id = excluded.methodology_version_id,
          current_event_id = excluded.current_event_id,
          calculation_origin = excluded.calculation_origin,
          weight = excluded.weight,
          weighted_contribution = excluded.weighted_contribution,
          is_derived = true,
          updated_at = now();

      insert into public.assessment_events (
        site_assessment_id, event_type, actor_id, actor_role, visibility,
        source_table, source_record_id, reason, metadata
      ) values (
        p_assessment_id, 'readiness_calculated', auth.uid(), public.current_app_role(),
        'internal', 'assessment_score_calculations', v_calculation_id::text,
        nullif(left(coalesce(p_reason, ''), 1000), ''),
        jsonb_build_object('score', v_score, 'band', v_band, 'confidence', v_confidence, 'methodology_version', '1.0.0')
      ) on conflict do nothing;
    end if;
  end if;

  perform set_config('app.score_mutation_authorized', '', true);

  return query select v_calculation_id, v_score, v_band, v_confidence, v_blockers;
end;
$$;

create or replace function public.save_assessment_scores(
  p_assessment_id uuid,
  p_scores jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_methodology_id uuid;
  v_item jsonb;
  v_module text;
  v_score integer;
  v_risk text;
  v_confidence text;
  v_rationale text;
  v_reason text;
  v_old public.assessment_scores;
  v_event_id uuid;
  v_origin text;
  v_saved integer := 0;
  v_calculation record;
begin
  if auth.uid() is null or not public.can_edit_assessment(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_scores) <> 'array' then
    raise exception 'Scores must be supplied as an array.' using errcode = '22023';
  end if;

  select id into v_methodology_id
  from public.analysis_methodology_versions
  where methodology_key = 'gridready_power_readiness' and status = 'active'
  order by effective_at desc nulls last
  limit 1;

  perform set_config('app.score_mutation_authorized', 'true', true);

  for v_item in select value from jsonb_array_elements(p_scores) loop
    v_module := v_item ->> 'module_key';
    if v_module not in (
      'power_feasibility', 'interconnection_readiness', 'reliability_risk',
      'energy_economics', 'flexibility', 'site_non_power_risks', 'evidence_quality'
    ) then
      raise exception 'Score module % is not a manual weighted component.', v_module using errcode = '22023';
    end if;

    v_score := (v_item ->> 'score')::integer;
    if v_score < 0 or v_score > 100 then
      raise exception 'Score for % must be between 0 and 100.', v_module using errcode = '22023';
    end if;

    v_risk := coalesce(nullif(v_item ->> 'risk_level', ''), 'unknown');
    v_confidence := coalesce(nullif(v_item ->> 'confidence_level', ''), 'unknown');
    if v_risk not in ('critical', 'high', 'medium', 'low', 'unknown') then
      raise exception 'Risk level for % is invalid.', v_module using errcode = '22023';
    end if;
    if v_confidence not in ('high', 'medium', 'low', 'unknown') then
      raise exception 'Confidence level for % is invalid.', v_module using errcode = '22023';
    end if;

    v_rationale := nullif(left(coalesce(v_item ->> 'rationale', ''), 4000), '');
    v_reason := coalesce(
      nullif(left(coalesce(v_item ->> 'override_note', ''), 2000), ''),
      nullif(left(coalesce(p_reason, ''), 2000), '')
    );
    v_old := null;
    select * into v_old
    from public.assessment_scores s
    where s.site_assessment_id = p_assessment_id and s.module_key = v_module
    for update;

    if v_old.id is not null
       and (v_old.score is distinct from v_score
         or v_old.risk_level is distinct from v_risk
         or v_old.confidence_level is distinct from v_confidence)
       and v_reason is null then
      raise exception 'A reason is required to override %.', v_module using errcode = '22023';
    end if;

    if v_old.id is not null
       and v_old.score is not distinct from v_score
       and v_old.risk_level is not distinct from v_risk
       and v_old.confidence_level is not distinct from v_confidence
       and v_old.rationale is not distinct from v_rationale then
      continue;
    end if;

    v_origin := case when v_old.id is null then 'initial_manual' else 'manual_override' end;
    insert into public.assessment_score_events (
      site_assessment_id, module_key, previous_score, new_score,
      previous_risk_level, new_risk_level, previous_confidence_level,
      new_confidence_level, origin, reason, rationale,
      methodology_version_id, actor_id, actor_role
    ) values (
      p_assessment_id, v_module, v_old.score, v_score,
      v_old.risk_level, v_risk, v_old.confidence_level, v_confidence,
      v_origin, v_reason, v_rationale, v_methodology_id,
      auth.uid(), public.current_app_role()
    ) returning id into v_event_id;

    insert into public.assessment_scores (
      id, site_assessment_id, module_key, score, risk_level,
      confidence_level, rationale, override_note, methodology_version_id,
      current_event_id, calculation_origin, is_derived
    ) values (
      coalesce(v_old.id, gen_random_uuid()), p_assessment_id, v_module,
      v_score, v_risk, v_confidence, v_rationale,
      case when v_origin = 'manual_override' then v_reason else null end,
      v_methodology_id, v_event_id, v_origin, false
    )
    on conflict (site_assessment_id, module_key) do update
    set score = excluded.score,
        risk_level = excluded.risk_level,
        confidence_level = excluded.confidence_level,
        rationale = excluded.rationale,
        override_note = excluded.override_note,
        methodology_version_id = excluded.methodology_version_id,
        current_event_id = excluded.current_event_id,
        calculation_origin = excluded.calculation_origin,
        is_derived = false,
        updated_at = now();

    insert into public.assessment_events (
      site_assessment_id, event_type, actor_id, actor_role, visibility,
      source_table, source_record_id, reason, metadata
    ) values (
      p_assessment_id, 'score_changed', auth.uid(), public.current_app_role(),
      'internal', 'assessment_score_events', v_event_id::text, v_reason,
      jsonb_build_object('module_key', v_module, 'previous_score', v_old.score, 'new_score', v_score, 'origin', v_origin)
    );
    v_saved := v_saved + 1;
  end loop;

  select * into v_calculation
  from public.calculate_assessment_readiness(p_assessment_id, coalesce(p_reason, 'Scorecard saved'));

  perform set_config('app.score_mutation_authorized', '', true);
  return jsonb_build_object(
    'saved_component_count', v_saved,
    'calculation_id', v_calculation.calculation_id,
    'overall_score', v_calculation.overall_score,
    'readiness_band', v_calculation.readiness_band,
    'overall_confidence', v_calculation.overall_confidence,
    'blockers', v_calculation.blockers
  );
end;
$$;

create or replace function public.save_assessment_verdict(
  p_assessment_id uuid,
  p_verdict text,
  p_confidence_level text,
  p_summary text,
  p_conditions text,
  p_key_strengths text,
  p_key_risks text,
  p_recommended_next_steps text,
  p_limitations_note text,
  p_approved_by_analyst boolean,
  p_reason text default null
)
returns public.assessment_verdicts
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_methodology_id uuid;
  v_old public.assessment_verdicts;
  v_saved public.assessment_verdicts;
  v_latest public.assessment_score_calculations;
  v_event_id uuid;
  v_origin text;
  v_reason text := nullif(left(coalesce(p_reason, ''), 2000), '');
begin
  if auth.uid() is null or not public.can_edit_assessment(p_assessment_id) then
    raise exception 'Assessment is not available.' using errcode = '42501';
  end if;

  if p_verdict not in (
    'reject', 'pause', 'proceed_targeted_diligence', 'proceed_with_caution',
    'strong_candidate', 'strong_candidate_subject_to_utility_confirmation'
  ) then
    raise exception 'Verdict value is not canonical.' using errcode = '22023';
  end if;
  if p_confidence_level not in ('high', 'low', 'medium') then
    raise exception 'A supported verdict confidence is required.' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_summary, '')), '') is null then
    raise exception 'Verdict rationale is required.' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_conditions, '')), '') is null then
    raise exception 'Verdict conditions are required; use an explicit not-applicable statement when none apply.' using errcode = '22023';
  end if;

  select id into v_methodology_id
  from public.analysis_methodology_versions
  where methodology_key = 'gridready_power_readiness' and status = 'active'
  order by effective_at desc nulls last
  limit 1;

  select * into v_old
  from public.assessment_verdicts v
  where v.site_assessment_id = p_assessment_id
  for update;

  if v_old.id is not null and (
      v_old.verdict is distinct from p_verdict
      or v_old.confidence_level is distinct from p_confidence_level
      or v_old.approved_by_analyst is distinct from p_approved_by_analyst
    ) and v_reason is null then
    raise exception 'A reason is required to change the verdict, confidence or approval.' using errcode = '22023';
  end if;

  select * into v_latest
  from public.assessment_score_calculations c
  where c.site_assessment_id = p_assessment_id
  order by c.created_at desc
  limit 1;

  if p_approved_by_analyst and (v_latest.id is null or v_latest.overall_score is null) then
    raise exception 'The seven weighted score components must be complete before approval.' using errcode = '22023';
  end if;

  if p_approved_by_analyst
     and v_latest.overall_confidence = 'low'
     and p_verdict not in ('pause', 'proceed_targeted_diligence') then
    raise exception 'Low overall confidence may only support Pause or Proceed with targeted diligence.' using errcode = '22023';
  end if;

  v_origin := case when v_old.id is null then 'initial_manual' else 'manual_override' end;
  insert into public.assessment_verdict_events (
    site_assessment_id, previous_verdict, new_verdict,
    previous_confidence_level, new_confidence_level,
    previous_approved_by_analyst, new_approved_by_analyst,
    origin, reason, conditions, summary, methodology_version_id,
    actor_id, actor_role
  ) values (
    p_assessment_id, v_old.verdict, p_verdict, v_old.confidence_level,
    p_confidence_level, v_old.approved_by_analyst, p_approved_by_analyst,
    v_origin, v_reason, nullif(left(coalesce(p_conditions, ''), 4000), ''),
    left(p_summary, 8000), v_methodology_id, auth.uid(), public.current_app_role()
  ) returning id into v_event_id;

  perform set_config('app.verdict_mutation_authorized', 'true', true);
  insert into public.assessment_verdicts (
    id, site_assessment_id, verdict, confidence_level, conditions,
    summary, key_strengths, key_risks, recommended_next_steps,
    limitations_note, approved_by_analyst, approved_at, authored_by,
    methodology_version_id, current_event_id
  ) values (
    coalesce(v_old.id, gen_random_uuid()), p_assessment_id, p_verdict,
    p_confidence_level, nullif(left(coalesce(p_conditions, ''), 4000), ''),
    left(p_summary, 8000), nullif(left(coalesce(p_key_strengths, ''), 8000), ''),
    nullif(left(coalesce(p_key_risks, ''), 8000), ''),
    nullif(left(coalesce(p_recommended_next_steps, ''), 8000), ''),
    nullif(left(coalesce(p_limitations_note, ''), 8000), ''),
    p_approved_by_analyst,
    case when p_approved_by_analyst then coalesce(v_old.approved_at, now()) else null end,
    auth.uid(), v_methodology_id, v_event_id
  )
  on conflict (site_assessment_id) do update
  set verdict = excluded.verdict,
      confidence_level = excluded.confidence_level,
      conditions = excluded.conditions,
      summary = excluded.summary,
      key_strengths = excluded.key_strengths,
      key_risks = excluded.key_risks,
      recommended_next_steps = excluded.recommended_next_steps,
      limitations_note = excluded.limitations_note,
      approved_by_analyst = excluded.approved_by_analyst,
      approved_at = excluded.approved_at,
      authored_by = excluded.authored_by,
      methodology_version_id = excluded.methodology_version_id,
      current_event_id = excluded.current_event_id,
      updated_at = now()
  returning * into v_saved;
  perform set_config('app.verdict_mutation_authorized', '', true);

  insert into public.assessment_events (
    site_assessment_id, event_type, actor_id, actor_role, visibility,
    source_table, source_record_id, reason, metadata
  ) values (
    p_assessment_id, 'verdict_changed', auth.uid(), public.current_app_role(),
    'internal', 'assessment_verdict_events', v_event_id::text, v_reason,
    jsonb_build_object(
      'previous_verdict', v_old.verdict,
      'new_verdict', p_verdict,
      'confidence', p_confidence_level,
      'approved', p_approved_by_analyst,
      'origin', v_origin
    )
  );

  return v_saved;
end;
$$;

drop trigger if exists assessment_scores_controlled_mutation on public.assessment_scores;
create trigger assessment_scores_controlled_mutation
  before insert or update or delete on public.assessment_scores
  for each row execute function public.enforce_score_mutation_path();

drop trigger if exists assessment_verdicts_controlled_mutation on public.assessment_verdicts;
create trigger assessment_verdicts_controlled_mutation
  before insert or update or delete on public.assessment_verdicts
  for each row execute function public.enforce_verdict_mutation_path();

drop trigger if exists assessment_score_events_immutable on public.assessment_score_events;
create trigger assessment_score_events_immutable
  before update or delete on public.assessment_score_events
  for each row execute function public.enforce_immutable_analysis_history();

drop trigger if exists assessment_verdict_events_immutable on public.assessment_verdict_events;
create trigger assessment_verdict_events_immutable
  before update or delete on public.assessment_verdict_events
  for each row execute function public.enforce_immutable_analysis_history();

drop trigger if exists assessment_score_calculations_immutable on public.assessment_score_calculations;
create trigger assessment_score_calculations_immutable
  before update or delete on public.assessment_score_calculations
  for each row execute function public.enforce_immutable_analysis_history();

alter table public.analysis_methodology_versions enable row level security;
alter table public.assessment_score_events enable row level security;
alter table public.assessment_verdict_events enable row level security;
alter table public.assessment_score_calculations enable row level security;

create policy methodology_versions_read on public.analysis_methodology_versions
  for select to authenticated using (status = 'active' or public.current_app_role() = 'admin');
create policy methodology_versions_admin_manage on public.analysis_methodology_versions
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy score_events_internal_read on public.assessment_score_events
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));
create policy verdict_events_internal_read on public.assessment_verdict_events
  for select to authenticated
  using (public.is_internal_user() and public.can_access_assessment(site_assessment_id));
create policy score_calculations_read on public.assessment_score_calculations
  for select to authenticated
  using (public.can_access_assessment(site_assessment_id));

grant select on public.analysis_methodology_versions to authenticated;
grant select on public.assessment_score_events to authenticated;
grant select on public.assessment_verdict_events to authenticated;
grant select on public.assessment_score_calculations to authenticated;

revoke all on function public.save_assessment_scores(uuid, jsonb, text) from public, anon;
revoke all on function public.calculate_assessment_readiness(uuid, text) from public, anon;
revoke all on function public.save_assessment_verdict(uuid, text, text, text, text, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.save_assessment_scores(uuid, jsonb, text) to authenticated;
grant execute on function public.calculate_assessment_readiness(uuid, text) to authenticated;
grant execute on function public.save_assessment_verdict(uuid, text, text, text, text, text, text, text, text, boolean, text) to authenticated;

revoke all on function public.enforce_score_mutation_path() from public, anon, authenticated;
revoke all on function public.enforce_verdict_mutation_path() from public, anon, authenticated;
revoke all on function public.enforce_immutable_analysis_history() from public, anon, authenticated;

notify pgrst, 'reload schema';
