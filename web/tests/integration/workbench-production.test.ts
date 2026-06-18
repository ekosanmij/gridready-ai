import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canAuthorReports, canManageAssessments } from "@/components/auth/auth-provider";
import { deriveUtilityTspSuggestions } from "@/lib/inference";
import type { GridAssetRecord } from "@/lib/gis";

describe("production workbench integration contracts", () => {
  it("keeps mutation permissions aligned with the database roles", () => {
    expect(canManageAssessments("admin")).toBe(true);
    expect(canManageAssessments("analyst")).toBe(true);
    expect(canManageAssessments("reviewer")).toBe(false);
    expect(canManageAssessments("customer")).toBe(false);
    expect(canAuthorReports("reviewer")).toBe(true);
    expect(canAuthorReports("customer")).toBe(false);
  });

  it("prefers an indexed service-territory match and falls back to nearby owned assets", () => {
    const territorySuggestions = deriveUtilityTspSuggestions({
      confidence_level: "high",
      source_name: "PUCT territory dataset",
      source_url: "https://example.test/territories",
      tsp_name: "Oncor",
      utility_name: "Example Electric",
    }, [], { known_tsp: null, known_utility: null });
    expect(territorySuggestions.map((item) => item.field)).toEqual(["known_utility", "known_tsp"]);

    const asset = {
      asset_name: "North substation",
      asset_type: "substation",
      confidence_level: "medium",
      distance_miles: 4.2,
      owner_operator: "CenterPoint Energy",
      source: "GIS inventory",
    } as GridAssetRecord;
    const fallback = deriveUtilityTspSuggestions(null, [asset], { known_tsp: null, known_utility: null });
    expect(fallback).toMatchObject([{ field: "known_tsp", value: "CenterPoint Energy", confidence: "medium" }]);
  });

  it("ships the security, storage, geospatial, and indexed-search schema together", () => {
    const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/20260618120000_workbench_production_readiness.sql"), "utf8");
    expect(migration).toContain("create type public.app_role");
    expect(migration).toContain("create or replace function public.can_access_assessment");
    expect(migration).toContain("assessment-evidence");
    expect(migration).toContain("using gist (boundary)");
    expect(migration).toContain("using gin (search_vector)");
    expect(migration).toContain("create or replace function public.search_portal");
    expect(migration).not.toContain("to anon, authenticated");
  });
});
