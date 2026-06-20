import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { workspaceModulesForRole } from "@/lib/assessment-workspace";

const repositoryRoot = resolve(process.cwd(), "..");
const migration = readFileSync(resolve(repositoryRoot, "supabase/migrations/20260620100000_customer_internal_visibility.sql"), "utf8");

describe("customer and internal visibility boundaries", () => {
  it("keeps analyst workstreams out of customer navigation", () => {
    expect(workspaceModulesForRole("customer").map((module) => module.id)).toEqual([
      "overview",
      "intake",
      "evidence",
      "activity",
    ]);
    expect(workspaceModulesForRole("internal").map((module) => module.id)).toContain("report");
  });

  it("requires an internal role for analyst work-product reads", () => {
    for (const policy of [
      "grid_assets_internal_read",
      "evidence_internal_read",
      "findings_internal_read",
      "scores_internal_read",
      "verdicts_internal_read",
      "reviews_internal_read",
      "report_sections_internal_read",
      "report_exports_internal_read",
      "report_claims_internal_read",
    ]) {
      expect(migration).toContain(`create policy ${policy}`);
    }
    expect(migration).toContain("public.is_internal_user() and public.can_access_assessment(site_assessment_id)");
  });

  it("limits customer file reads to the uploading user", () => {
    expect(migration).toContain("uploaded_by = auth.uid() and public.can_access_assessment(site_assessment_id)");
    expect(migration).toContain("public.storage_customer_uploader_id(name) = auth.uid()");
    expect(migration).toContain("create policy assessment_evidence_internal_read");
  });
});
