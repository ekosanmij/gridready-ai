import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { generateReportPdf, generateSiteMapPng } from "@/lib/report-artifact-generator";
import type { ReportVersionSnapshot } from "@/lib/report-artifacts";

const repositoryRoot = resolve(process.cwd(), "..");
const migration = readFileSync(resolve(repositoryRoot, "supabase/migrations/20260620000000_report_artifacts_secure_delivery.sql"), "utf8");
const generationRoute = readFileSync(resolve(repositoryRoot, "web/src/app/api/reports/[assessmentId]/artifacts/route.ts"), "utf8");
const downloadRoute = readFileSync(resolve(repositoryRoot, "web/src/app/api/report-artifacts/[artifactId]/download/route.ts"), "utf8");

const snapshot: ReportVersionSnapshot = {
  assessment: {
    assessment_name: "Northfield Data Campus",
    desired_energization_date: "2029-06-01",
    known_tsp: "Example TSP",
    known_utility: "Example Utility",
    market_region: "ERCOT",
    project_stage: "site_selection",
    target_load_mw: 125,
  },
  captured_at: "2026-06-19T20:00:00Z",
  claim_evidence_links: [],
  claim_lineage: [],
  evidence_gaps: [{ impact: "Confirm the final point of interconnection.", severity: "high", title: "POI confirmation" }],
  evidence_sources: [{
    accessed_at: "2026-06-19",
    confidence_level: "high",
    limitation_notes: "Screening source only.",
    published_at: "2026-05-01",
    publisher: "ERCOT",
    source_type: "official_iso_rto",
    title: "ERCOT planning source",
    url: "https://www.ercot.com/example",
  }],
  expert_review: { approved_at: "2026-06-19T19:30:00Z", reviewer_name: "A. Reviewer" },
  expert_review_checklist: [{ label: "Evidence and material claims", status: "pass" }],
  findings: [{
    confidence_level: "medium",
    recommendation: "Confirm the POI directly with the utility and TSP.",
    risk_level: "high",
    statement: "The likely interconnection point remains subject to utility confirmation.",
    title: "Point of interconnection",
  }],
  grid_assets: [
    { asset_name: "North substation", is_candidate_poi: true, latitude: 32.82, longitude: -96.91, source: "PUCT utility data" },
    { asset_name: "West switching station", is_candidate_poi: false, latitude: 32.77, longitude: -97.02, source: "Analyst verification" },
  ],
  organisation: { name: "Northfield Infrastructure" },
  project: { name: "Northfield Campus" },
  report_version: {
    export_id: "export-1",
    finalized_at: "2026-06-19T19:00:00Z",
    preflight_run_id: "preflight-1",
    template_id: "template-1",
    template_version: "v1",
    version_number: 3,
  },
  schema_version: 1,
  score_calculation: { overall_confidence: "medium", overall_score: 74, readiness_band: "plausible_unresolved_risks" },
  scores: [
    { confidence_level: "high", module_key: "power_feasibility", score: 78 },
    { confidence_level: "medium", module_key: "interconnection_readiness", score: 68 },
  ],
  sections: [
    { content: "The site is a plausible candidate subject to utility and TSP confirmation.", title: "Executive Verdict" },
    { content: "The target load is 125 MW with a desired energization date in 2029.", title: "Site Overview" },
    { content: "Customer inputs and public sources remain subject to direct confirmation.", title: "Assumptions and Limitations" },
  ],
  site: { address: "100 Grid Road", city: "Fort Worth", latitude: 32.79, longitude: -96.96, site_name: "Northfield Site", state: "TX" },
  template: { name: "ERCOT v1 single-site feasibility report", version: "v1" },
  verdict: {
    conditions: "Proceed only after POI confirmation.",
    confidence_level: "medium",
    limitations_note: "This screening assessment does not guarantee utility capacity or interconnection approval.",
    summary: "Plausible with unresolved interconnection risk.",
    verdict: "proceed_with_caution",
  },
};

describe("versioned report artifact and delivery contracts", () => {
  it("generates a real multi-page PDF containing the exact generated map", async () => {
    const map = await generateSiteMapPng(snapshot);
    const metadata = await sharp(map).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(760);

    const pdf = await generateReportPdf(snapshot, map);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBeGreaterThanOrEqual(9);

    if (process.env.WRITE_REPORT_ARTIFACT_FIXTURE === "1") {
      const outputDirectory = resolve(repositoryRoot, "tmp/pdfs");
      mkdirSync(outputDirectory, { recursive: true });
      writeFileSync(resolve(outputDirectory, "gridready-report-fixture.pdf"), pdf);
      writeFileSync(resolve(outputDirectory, "gridready-site-map-fixture.png"), map);
    }
  });

  it("persists immutable versions, checksums and retryable generation state", () => {
    expect(migration).toContain("create table if not exists public.assessment_report_versions");
    expect(migration).toContain("create table if not exists public.report_artifacts");
    expect(migration).toContain("snapshot_checksum text not null");
    expect(migration).toContain("generation_attempts integer not null default 1");
    expect(migration).toContain("Report versions, artifacts and deliveries must be changed through the controlled report artifact workflow.");
  });

  it("requires complete artifacts and a passing delivery preflight", () => {
    expect(migration).toContain("A report PDF and site map artifact are required.");
    expect(migration).toContain("select * into v_preflight from public.run_assessment_preflight(v_version.site_assessment_id, 'delivery')");
    expect(migration).toContain("Assessment must be in final review before report delivery.");
    expect(migration).toContain("The generated artifact is not present in private storage.");
  });

  it("limits customer access to active organisation deliveries and supports revocation", () => {
    expect(migration).toContain("d.revoked_at is null");
    expect(migration).toContain("d.recipient_user_id is null or d.recipient_user_id = auth.uid()");
    expect(migration).toContain("create or replace function public.revoke_report_delivery");
    expect(migration).toContain("create table if not exists public.report_artifact_download_events");
    expect(downloadRoute).toContain("createSignedUrl(artifact.storage_path, 60");
    expect(downloadRoute).toContain("record_report_artifact_download");
  });

  it("generates with the authenticated server client and never embeds a service key", () => {
    expect(generationRoute).toContain("createSupabaseServerClient");
    expect(generationRoute).toContain("request_report_artifact_generation");
    expect(generationRoute).toContain("complete_report_artifact_generation");
    expect(generationRoute).not.toContain("SERVICE_ROLE");
    expect(downloadRoute).not.toContain("SERVICE_ROLE");
  });
});
