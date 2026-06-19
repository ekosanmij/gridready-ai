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
    expect(migration).toContain("add column if not exists organisation_id");
    expect(migration).toContain("select p.role::text");
    expect(migration).not.toContain("select coalesce((select p.role from public.profiles");
    expect(migration).toContain("create or replace function public.can_access_assessment");
    expect(migration).toContain("assessment-evidence");
    expect(migration).toContain("using gist (boundary)");
    expect(migration).toContain("set search_path = public, extensions");
    expect(migration).toContain("using gin (search_vector)");
    expect(migration).toContain("create or replace function public.search_portal");
    expect(migration).not.toContain("to anon, authenticated");
  });

  it("adds explicit customer membership and same-organisation creation policies", () => {
    const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/20260619100000_customer_tenancy_foundation.sql"), "utf8");
    expect(migration).toContain("create table if not exists public.organisation_memberships");
    expect(migration).toContain("add column if not exists is_active");
    expect(migration).toContain("add column if not exists is_default");
    expect(migration).toContain("create or replace function public.provision_customer_account");
    expect(migration).toContain("create or replace function public.set_active_organisation");
    expect(migration).toContain("create policy projects_customer_create");
    expect(migration).toContain("create policy sites_customer_create");
    expect(migration).toContain("create policy assessments_customer_create");
    expect(migration).toContain("public.is_organisation_member");
  });

  it("adds server drafts, private draft uploads, and durable file metadata", () => {
    const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/20260619120000_customer_intake_drafts_and_uploads.sql"), "utf8");
    expect(migration).toContain("create table if not exists public.customer_intake_drafts");
    expect(migration).toContain("create table if not exists public.customer_intake_files");
    expect(migration).toContain("checksum_sha256");
    expect(migration).toContain("malware_scan_status");
    expect(migration).toContain("create policy customer_intake_storage_insert");
    expect(migration).toContain("create policy customer_assessment_storage_insert");
    expect(migration).toContain("create policy files_customer_create");
    expect(migration).toContain("create policy files_customer_followup_create");
  });

  it("adds controlled lifecycle transitions, append-only events, and leased background jobs", () => {
    const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/20260619140000_workflow_audit_background_jobs.sql"), "utf8");
    expect(migration).toContain("create table if not exists public.assessment_status_transitions");
    expect(migration).toContain("create or replace function public.transition_assessment_status");
    expect(migration).toContain("create table if not exists public.assessment_events");
    expect(migration).toContain("create table if not exists public.background_jobs");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("j.locked_at < now() - interval '15 minutes'");
    expect(migration).toContain("if v_scan_status = 'clean' then");
    expect(migration).toContain("grant execute on function public.claim_background_jobs");
  });
});
