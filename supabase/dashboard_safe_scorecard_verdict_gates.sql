create extension if not exists pgcrypto;

create table if not exists public.assessment_scores (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  module_key text not null,
  score integer not null,
  risk_level text not null default 'unknown',
  confidence_level text not null default 'unknown',
  rationale text,
  override_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_scores_unique_module unique (site_assessment_id, module_key),
  constraint assessment_scores_score_range_check check (score >= 0 and score <= 100),
  constraint assessment_scores_module_key_check check (
    module_key in (
      'power_feasibility',
      'interconnection_readiness',
      'reliability_risk',
      'energy_economics',
      'flexibility',
      'site_non_power_risks',
      'evidence_quality',
      'overall_readiness'
    )
  ),
  constraint assessment_scores_risk_level_check check (
    risk_level in ('critical', 'high', 'medium', 'low', 'unknown')
  ),
  constraint assessment_scores_confidence_level_check check (
    confidence_level in ('high', 'medium', 'low', 'unknown')
  )
);

create index if not exists assessment_scores_assessment_idx
  on public.assessment_scores (site_assessment_id);

create index if not exists assessment_scores_module_idx
  on public.assessment_scores (site_assessment_id, module_key);

create index if not exists assessment_scores_risk_idx
  on public.assessment_scores (site_assessment_id, risk_level);

create table if not exists public.assessment_verdicts (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  verdict text not null default 'insufficient_information',
  summary text,
  key_strengths text,
  key_risks text,
  recommended_next_steps text,
  limitations_note text,
  approved_by_analyst boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_verdicts_unique_assessment unique (site_assessment_id),
  constraint assessment_verdicts_verdict_check check (
    verdict in (
      'proceed',
      'proceed_with_conditions',
      'escalate_deeper_diligence',
      'pause',
      'reject',
      'insufficient_information'
    )
  )
);

create index if not exists assessment_verdicts_assessment_idx
  on public.assessment_verdicts (site_assessment_id);

create table if not exists public.expert_reviews (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  review_type text not null default 'final_report',
  reviewer_name text,
  status text not null default 'not_started',
  trigger_reason text,
  comments text,
  required_changes text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_reviews_review_type_check check (
    review_type in (
      'final_report',
      'power_systems',
      'interconnection',
      'reliability',
      'energy_markets',
      'legal_regulatory',
      'other'
    )
  ),
  constraint expert_reviews_status_check check (
    status in (
      'not_started',
      'requested',
      'in_review',
      'changes_requested',
      'approved',
      'not_required'
    )
  )
);

create index if not exists expert_reviews_assessment_idx
  on public.expert_reviews (site_assessment_id);

create index if not exists expert_reviews_status_idx
  on public.expert_reviews (site_assessment_id, status);

create unique index if not exists expert_reviews_one_final_report_per_assessment_idx
  on public.expert_reviews (site_assessment_id)
  where review_type = 'final_report';

create or replace function public.set_scorecard_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = now();
  return new;
end;
';

drop trigger if exists assessment_scores_set_updated_at on public.assessment_scores;
create trigger assessment_scores_set_updated_at
  before update on public.assessment_scores
  for each row
  execute function public.set_scorecard_updated_at();

drop trigger if exists assessment_verdicts_set_updated_at on public.assessment_verdicts;
create trigger assessment_verdicts_set_updated_at
  before update on public.assessment_verdicts
  for each row
  execute function public.set_scorecard_updated_at();

drop trigger if exists expert_reviews_set_updated_at on public.expert_reviews;
create trigger expert_reviews_set_updated_at
  before update on public.expert_reviews
  for each row
  execute function public.set_scorecard_updated_at();

alter table public.assessment_scores enable row level security;
alter table public.assessment_verdicts enable row level security;
alter table public.expert_reviews enable row level security;

drop policy if exists "Allow MVP manage assessment scores" on public.assessment_scores;
create policy "Allow MVP manage assessment scores"
  on public.assessment_scores
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow MVP manage assessment verdicts" on public.assessment_verdicts;
create policy "Allow MVP manage assessment verdicts"
  on public.assessment_verdicts
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow MVP manage expert reviews" on public.expert_reviews;
create policy "Allow MVP manage expert reviews"
  on public.expert_reviews
  for all
  to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
