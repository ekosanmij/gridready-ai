-- GEO-001 / GEO-003 / GEO-004 / GEO-005 / GEO-007 / GEO-011:
-- governed geospatial datasets, versioned territory inference, market-zone
-- context, and reportable provenance.

create extension if not exists postgis;

create table if not exists public.geospatial_datasets (
  id uuid primary key default gen_random_uuid(),
  dataset_key text not null unique,
  dataset_type text not null,
  name text not null,
  provider text not null,
  source_url text not null,
  license_name text,
  license_url text,
  geographic_coverage text not null,
  market_region text,
  version text not null,
  status text not null default 'staging',
  confidence_level text not null default 'medium',
  published_at date,
  retrieved_at timestamptz,
  activated_at timestamptz,
  activated_by uuid references auth.users(id) on delete set null,
  feature_count integer not null default 0,
  checksum_sha256 text,
  refresh_interval_days integer,
  limitations text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geospatial_datasets_type_check check (
    dataset_type in ('environmental', 'grid_asset', 'market_zone', 'parcel', 'utility_territory', 'water')
  ),
  constraint geospatial_datasets_status_check check (
    status in ('active', 'failed', 'importing', 'retired', 'staging')
  ),
  constraint geospatial_datasets_confidence_check check (
    confidence_level in ('high', 'low', 'medium')
  ),
  constraint geospatial_datasets_feature_count_check check (feature_count >= 0),
  constraint geospatial_datasets_refresh_check check (refresh_interval_days is null or refresh_interval_days > 0)
);

create index if not exists geospatial_datasets_type_status_idx
  on public.geospatial_datasets (dataset_type, status, market_region, updated_at desc);

create table if not exists public.market_zones (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.geospatial_datasets(id) on delete restrict,
  market_region text not null,
  zone_name text not null,
  zone_type text not null default 'load_zone',
  source_feature_id text,
  confidence_level text not null default 'medium',
  boundary geometry(MultiPolygon, 4326) not null,
  valid_from date,
  valid_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_zones_type_check check (zone_type in ('load_zone', 'pricing_zone', 'study_area', 'weather_zone')),
  constraint market_zones_confidence_check check (confidence_level in ('high', 'low', 'medium')),
  constraint market_zones_dataset_feature_key unique (dataset_id, source_feature_id)
);

create index if not exists market_zones_boundary_gix
  on public.market_zones using gist (boundary);
create index if not exists market_zones_market_type_idx
  on public.market_zones (market_region, zone_type, zone_name);

alter table public.utility_service_territories
  add column if not exists dataset_id uuid references public.geospatial_datasets(id) on delete restrict,
  add column if not exists source_feature_id text,
  add column if not exists utility_type text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists utility_service_territories_dataset_feature_idx
  on public.utility_service_territories (dataset_id, source_feature_id)
  where dataset_id is not null and source_feature_id is not null;

alter table public.assessment_grid_assets
  add column if not exists source_dataset_id uuid references public.geospatial_datasets(id) on delete set null,
  add column if not exists source_feature_id text,
  add column if not exists source_version text,
  add column if not exists source_url text,
  add column if not exists source_observed_at timestamptz;

create or replace function public.calculate_grid_asset_distance()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
set row_security = off
as $$
declare
  v_site_latitude double precision;
  v_site_longitude double precision;
begin
  select s.latitude::double precision, s.longitude::double precision
  into v_site_latitude, v_site_longitude
  from public.sites s
  where s.id = new.site_id;

  if v_site_latitude is null or v_site_longitude is null then
    new.distance_miles := null;
  else
    new.distance_miles := st_distance(
      st_setsrid(st_makepoint(v_site_longitude, v_site_latitude), 4326)::geography,
      st_setsrid(st_makepoint(new.longitude::double precision, new.latitude::double precision), 4326)::geography
    ) / 1609.344;
  end if;

  return new;
end;
$$;

drop trigger if exists assessment_grid_assets_calculate_distance on public.assessment_grid_assets;
create trigger assessment_grid_assets_calculate_distance
  before insert or update of site_id, latitude, longitude on public.assessment_grid_assets
  for each row execute function public.calculate_grid_asset_distance();

update public.assessment_grid_assets a
set distance_miles = st_distance(
  st_setsrid(st_makepoint(s.longitude::double precision, s.latitude::double precision), 4326)::geography,
  st_setsrid(st_makepoint(a.longitude::double precision, a.latitude::double precision), 4326)::geography
) / 1609.344
from public.sites s
where s.id = a.site_id
  and s.latitude is not null
  and s.longitude is not null;

create or replace function public.find_nearest_assessment_assets(
  p_assessment_id uuid,
  p_radius_miles double precision default 50
)
returns table (
  asset_id uuid,
  asset_name text,
  asset_type text,
  distance_miles double precision,
  voltage_kv numeric,
  owner_operator text,
  confidence_level text,
  source text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    a.id,
    a.asset_name,
    a.asset_type,
    st_distance(
      st_setsrid(st_makepoint(s.longitude::double precision, s.latitude::double precision), 4326)::geography,
      st_setsrid(st_makepoint(a.longitude::double precision, a.latitude::double precision), 4326)::geography
    ) / 1609.344,
    a.voltage_kv,
    a.owner_operator,
    a.confidence_level,
    a.source
  from public.assessment_grid_assets a
  join public.sites s on s.id = a.site_id
  where a.site_assessment_id = p_assessment_id
    and public.can_access_assessment(p_assessment_id)
    and s.latitude is not null
    and s.longitude is not null
    and st_dwithin(
      st_setsrid(st_makepoint(s.longitude::double precision, s.latitude::double precision), 4326)::geography,
      st_setsrid(st_makepoint(a.longitude::double precision, a.latitude::double precision), 4326)::geography,
      greatest(coalesce(p_radius_miles, 50), 0) * 1609.344
    )
  order by distance_miles asc, a.asset_type, a.asset_name;
$$;

insert into public.geospatial_datasets (
  dataset_key, dataset_type, name, provider, source_url, license_name,
  geographic_coverage, market_region, version, status, confidence_level,
  published_at, retrieved_at, refresh_interval_days, limitations, metadata
)
values (
  'puct_iou_service_areas',
  'utility_territory',
  'PUCT approximate investor-owned utility service areas',
  'Public Utility Commission of Texas GIS staff',
  'https://services6.arcgis.com/N6Lzvtb46cpxThhu/ArcGIS/rest/services/IOU/FeatureServer/300',
  'Publicly accessible government GIS service; verify reuse terms before redistribution',
  'Texas investor-owned electric utility service areas',
  'ERCOT',
  '2025-08-20',
  'staging',
  'medium',
  '2025-08-20',
  now(),
  90,
  'PUCT describes this digital layer as unofficial and approximate. It is suitable for screening only and must not be represented as a legal service-territory determination.',
  jsonb_build_object(
    'arcgis_layer_id', 300,
    'source_item_id', 'f7edde48d50140fe93a6fd4797693a9c',
    'source_spatial_reference', 3857,
    'target_spatial_reference', 4326
  )
)
on conflict (dataset_key) do update
set name = excluded.name,
    provider = excluded.provider,
    source_url = excluded.source_url,
    version = excluded.version,
    published_at = excluded.published_at,
    retrieved_at = excluded.retrieved_at,
    refresh_interval_days = excluded.refresh_interval_days,
    limitations = excluded.limitations,
    metadata = excluded.metadata,
    updated_at = now();

insert into public.geospatial_datasets (
  dataset_key, dataset_type, name, provider, source_url,
  geographic_coverage, market_region, version, status, confidence_level,
  retrieved_at, limitations, metadata
)
values (
  'ercot_load_zones_reference',
  'market_zone',
  'ERCOT load-zone reference map',
  'Electric Reliability Council of Texas',
  'https://www.ercot.com/news/mediakit/maps/index',
  'ERCOT market footprint',
  'ERCOT',
  'accessed-2026-06-19',
  'staging',
  'medium',
  now(),
  'The current source is a reference map, not an importable polygon dataset. Pricing-zone inference remains unavailable until governed geometry is loaded.',
  jsonb_build_object('reference_only', true)
)
on conflict (dataset_key) do update
set source_url = excluded.source_url,
    version = excluded.version,
    retrieved_at = excluded.retrieved_at,
    limitations = excluded.limitations,
    metadata = excluded.metadata,
    updated_at = now();

-- Preserve any pre-registry territories without silently upgrading their
-- confidence. Their original row-level source fields remain visible.
insert into public.geospatial_datasets (
  dataset_key, dataset_type, name, provider, source_url,
  geographic_coverage, version, status, confidence_level, limitations
)
values (
  'legacy_utility_territories',
  'utility_territory',
  'Legacy utility territories',
  'GridReady pre-registry import',
  'https://gridready.local/datasets/legacy-utility-territories',
  'As recorded on existing territory rows',
  'legacy-v1',
  'staging',
  'low',
  'Imported before dataset governance. Validate provider, licence, freshness and geometry before relying on a match.'
)
on conflict (dataset_key) do nothing;

update public.utility_service_territories t
set dataset_id = d.id
from public.geospatial_datasets d
where t.dataset_id is null
  and d.dataset_key = 'legacy_utility_territories';

create or replace function public.set_geospatial_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists geospatial_datasets_set_updated_at on public.geospatial_datasets;
create trigger geospatial_datasets_set_updated_at
  before update on public.geospatial_datasets
  for each row execute function public.set_geospatial_updated_at();

drop trigger if exists market_zones_set_updated_at on public.market_zones;
create trigger market_zones_set_updated_at
  before update on public.market_zones
  for each row execute function public.set_geospatial_updated_at();

create or replace function public.replace_utility_territory_dataset(
  p_dataset_key text,
  p_features jsonb,
  p_checksum_sha256 text default null
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
set row_security = off
as $$
declare
  v_dataset public.geospatial_datasets;
  v_feature_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service-role authentication is required.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_features) <> 'array' then
    raise exception 'GeoJSON features must be supplied as an array.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_features) = 0 then
    raise exception 'At least one GeoJSON feature is required.' using errcode = '22023';
  end if;

  select * into v_dataset
  from public.geospatial_datasets d
  where d.dataset_key = p_dataset_key
    and d.dataset_type = 'utility_territory'
  for update;

  if v_dataset.id is null then
    raise exception 'Utility-territory dataset % was not found.', p_dataset_key using errcode = 'P0002';
  end if;

  update public.geospatial_datasets
  set status = 'importing', updated_at = now()
  where id = v_dataset.id;

  delete from public.utility_service_territories
  where dataset_id = v_dataset.id;

  insert into public.utility_service_territories (
    dataset_id, source_feature_id, utility_name, tsp_name, utility_type,
    market_region, source_name, source_url, confidence_level, priority,
    boundary, valid_from, valid_to, metadata
  )
  select
    v_dataset.id,
    nullif(feature -> 'properties' ->> 'source_feature_id', ''),
    feature -> 'properties' ->> 'utility_name',
    nullif(feature -> 'properties' ->> 'tsp_name', ''),
    nullif(feature -> 'properties' ->> 'utility_type', ''),
    coalesce(nullif(feature -> 'properties' ->> 'market_region', ''), v_dataset.market_region, 'ERCOT'),
    v_dataset.name,
    v_dataset.source_url,
    coalesce(nullif(feature -> 'properties' ->> 'confidence_level', ''), v_dataset.confidence_level),
    coalesce((feature -> 'properties' ->> 'priority')::integer, 100),
    st_multi(
      st_collectionextract(
        st_makevalid(st_setsrid(st_geomfromgeojson((feature -> 'geometry')::text), 4326)),
        3
      )
    )::geometry(MultiPolygon, 4326),
    nullif(feature -> 'properties' ->> 'valid_from', '')::date,
    nullif(feature -> 'properties' ->> 'valid_to', '')::date,
    coalesce(feature -> 'properties' -> 'metadata', '{}'::jsonb)
  from jsonb_array_elements(p_features) feature
  where jsonb_typeof(feature -> 'geometry') = 'object'
    and nullif(feature -> 'properties' ->> 'utility_name', '') is not null;

  get diagnostics v_feature_count = row_count;

  if v_feature_count = 0 then
    raise exception 'No valid utility territory features were imported.' using errcode = '22023';
  end if;

  update public.geospatial_datasets
  set status = 'active',
      feature_count = v_feature_count,
      checksum_sha256 = nullif(p_checksum_sha256, ''),
      retrieved_at = now(),
      activated_at = now(),
      activated_by = auth.uid(),
      updated_at = now()
  where id = v_dataset.id;

  return v_feature_count;
end;
$$;

create or replace function public.resolve_site_geospatial_context(
  latitude double precision,
  longitude double precision,
  market text default null
)
returns table (
  coverage_status text,
  utility_name text,
  tsp_name text,
  utility_confidence text,
  pricing_zone text,
  zone_confidence text,
  territory_dataset_key text,
  territory_dataset_name text,
  territory_dataset_version text,
  territory_source_url text,
  territory_limitations text,
  territory_geojson jsonb,
  zone_dataset_key text,
  zone_dataset_name text,
  zone_dataset_version text,
  zone_source_url text,
  zone_limitations text,
  zone_geojson jsonb
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
begin
  if latitude < -90 or latitude > 90 or longitude < -180 or longitude > 180 then
    raise exception 'Latitude or longitude is outside the valid range.' using errcode = '22023';
  end if;

  return query
  with point as (
    select st_setsrid(st_makepoint(longitude, latitude), 4326) geometry
  )
  select
    case
      when territory.id is not null and zone.id is not null then 'territory_and_zone_matched'
      when territory.id is not null then 'territory_matched_zone_unavailable'
      when zone.id is not null then 'zone_matched_territory_unavailable'
      else 'no_active_dataset_match'
    end,
    territory.utility_name,
    territory.tsp_name,
    territory.confidence_level,
    zone.zone_name,
    zone.confidence_level,
    territory_dataset.dataset_key,
    territory_dataset.name,
    territory_dataset.version,
    territory_dataset.source_url,
    territory_dataset.limitations,
    case when territory.id is null then null else st_asgeojson(territory.boundary)::jsonb end,
    zone_dataset.dataset_key,
    zone_dataset.name,
    zone_dataset.version,
    zone_dataset.source_url,
    zone_dataset.limitations,
    case when zone.id is null then null else st_asgeojson(zone.boundary)::jsonb end
  from point
  left join lateral (
    select t.*
    from public.utility_service_territories t
    join public.geospatial_datasets d on d.id = t.dataset_id and d.status = 'active'
    where (market is null or t.market_region = market)
      and (t.valid_from is null or t.valid_from <= current_date)
      and (t.valid_to is null or t.valid_to >= current_date)
      and st_covers(t.boundary, point.geometry)
    order by t.priority asc, st_area(t.boundary::geography) asc
    limit 1
  ) territory on true
  left join public.geospatial_datasets territory_dataset on territory_dataset.id = territory.dataset_id
  left join lateral (
    select z.*
    from public.market_zones z
    join public.geospatial_datasets d on d.id = z.dataset_id and d.status = 'active'
    where (market is null or z.market_region = market)
      and (z.valid_from is null or z.valid_from <= current_date)
      and (z.valid_to is null or z.valid_to >= current_date)
      and st_covers(z.boundary, point.geometry)
    order by case z.zone_type when 'pricing_zone' then 1 when 'load_zone' then 2 else 3 end,
      st_area(z.boundary::geography) asc
    limit 1
  ) zone on true
  left join public.geospatial_datasets zone_dataset on zone_dataset.id = zone.dataset_id;
end;
$$;

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
set search_path = public, extensions
as $$
  select
    context.utility_name,
    context.tsp_name,
    context.utility_confidence,
    context.territory_dataset_name,
    context.territory_source_url
  from public.resolve_site_geospatial_context(latitude, longitude, market) context
  where context.utility_name is not null;
$$;

alter table public.geospatial_datasets enable row level security;
alter table public.market_zones enable row level security;

drop policy if exists geospatial_datasets_read on public.geospatial_datasets;
create policy geospatial_datasets_read on public.geospatial_datasets
  for select to authenticated
  using (status = 'active' or public.is_internal_user());

drop policy if exists geospatial_datasets_admin_manage on public.geospatial_datasets;
create policy geospatial_datasets_admin_manage on public.geospatial_datasets
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

drop policy if exists market_zones_read on public.market_zones;
create policy market_zones_read on public.market_zones
  for select to authenticated
  using (
    exists (
      select 1 from public.geospatial_datasets d
      where d.id = dataset_id and (d.status = 'active' or public.is_internal_user())
    )
  );

drop policy if exists market_zones_admin_manage on public.market_zones;
create policy market_zones_admin_manage on public.market_zones
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

grant select on public.geospatial_datasets to authenticated;
grant select on public.market_zones to authenticated;
grant select, insert, update, delete on public.geospatial_datasets to service_role;
grant select, insert, update, delete on public.market_zones to service_role;

revoke all on function public.replace_utility_territory_dataset(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.resolve_site_geospatial_context(double precision, double precision, text) from public, anon;
revoke all on function public.find_nearest_assessment_assets(uuid, double precision) from public, anon;
grant execute on function public.replace_utility_territory_dataset(text, jsonb, text) to service_role;
grant execute on function public.resolve_site_geospatial_context(double precision, double precision, text) to authenticated;
grant execute on function public.find_nearest_assessment_assets(uuid, double precision) to authenticated;

revoke all on function public.set_geospatial_updated_at() from public, anon, authenticated;
revoke all on function public.calculate_grid_asset_distance() from public, anon, authenticated;

notify pgrst, 'reload schema';
