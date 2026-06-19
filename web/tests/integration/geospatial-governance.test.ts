import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGeospatialContextFeatureCollection,
  geospatialCoverageLabel,
  type SiteGeospatialContext,
} from "@/lib/gis";

describe("geospatial dataset governance", () => {
  it("builds separate governed map features for territory and market-zone geometry", () => {
    const polygon = {
      type: "Polygon" as const,
      coordinates: [[[-97, 30], [-96, 30], [-96, 31], [-97, 30]]],
    };
    const context = {
      coverage_status: "territory_and_zone_matched",
      pricing_zone: "North",
      territory_geojson: polygon,
      utility_name: "Example Utility",
      zone_geojson: polygon,
    } as SiteGeospatialContext;

    expect(createGeospatialContextFeatureCollection(context)).toMatchObject({
      type: "FeatureCollection",
      features: [
        { properties: { kind: "utility_territory", label: "Example Utility" } },
        { properties: { kind: "market_zone", label: "North" } },
      ],
    });
    expect(geospatialCoverageLabel(context.coverage_status)).toBe("Territory and zone matched");
  });

  it("ships an atomic, service-role-only territory import and provenance-aware resolver", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "../supabase/migrations/20260619160000_geospatial_dataset_governance.sql"),
      "utf8",
    );
    expect(migration).toContain("create table if not exists public.geospatial_datasets");
    expect(migration).toContain("create table if not exists public.market_zones");
    expect(migration).toContain("create or replace function public.replace_utility_territory_dataset");
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toContain("st_makevalid");
    expect(migration).toContain("create or replace function public.resolve_site_geospatial_context");
    expect(migration).toContain("create or replace function public.find_nearest_assessment_assets");
    expect(migration).toContain("assessment_grid_assets_calculate_distance");
    expect(migration).toContain("st_dwithin");
    expect(migration).toContain("d.status = 'active'");
    expect(migration).toContain("screening only");
  });

  it("provides a repeatable PUCT ArcGIS importer with a dry-run mode and checksum", () => {
    const importer = readFileSync(resolve(process.cwd(), "scripts/import-puct-territories.mjs"), "utf8");
    expect(importer).toContain("FeatureServer/300");
    expect(importer).toContain("--dry-run");
    expect(importer).toContain("createHash(\"sha256\")");
    expect(importer).toContain("replace_utility_territory_dataset");
    expect(importer).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
