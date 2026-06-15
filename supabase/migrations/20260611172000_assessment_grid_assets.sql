create extension if not exists pgcrypto;

create table if not exists public.assessment_grid_assets (
  id uuid primary key default gen_random_uuid(),
  site_assessment_id uuid not null references public.site_assessments(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  asset_name text not null,
  asset_type text not null,
  latitude numeric not null,
  longitude numeric not null,
  voltage_kv numeric,
  owner_operator text,
  source text,
  confidence_level text not null default 'unknown',
  is_candidate_poi boolean not null default false,
  rationale text,
  analyst_notes text,
  distance_miles numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_grid_assets_asset_type_check check (
    asset_type in (
      'substation',
      'transmission_line',
      'generation_asset',
      'switching_station',
      'distribution_substation',
      'interconnection_point',
      'major_road',
      'water_source',
      'other'
    )
  ),
  constraint assessment_grid_assets_confidence_level_check check (
    confidence_level in ('high', 'medium', 'low', 'unknown')
  ),
  constraint assessment_grid_assets_latitude_check check (latitude >= -90 and latitude <= 90),
  constraint assessment_grid_assets_longitude_check check (longitude >= -180 and longitude <= 180)
);

create index if not exists assessment_grid_assets_assessment_idx
  on public.assessment_grid_assets (site_assessment_id);

create index if not exists assessment_grid_assets_site_idx
  on public.assessment_grid_assets (site_id);

create index if not exists assessment_grid_assets_distance_idx
  on public.assessment_grid_assets (site_assessment_id, distance_miles);

create or replace function public.set_assessment_grid_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assessment_grid_assets_set_updated_at on public.assessment_grid_assets;
create trigger assessment_grid_assets_set_updated_at
  before update on public.assessment_grid_assets
  for each row
  execute function public.set_assessment_grid_assets_updated_at();

alter table public.assessment_grid_assets enable row level security;

drop policy if exists "Allow MVP manage assessment grid assets" on public.assessment_grid_assets;
create policy "Allow MVP manage assessment grid assets"
  on public.assessment_grid_assets
  for all
  to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
