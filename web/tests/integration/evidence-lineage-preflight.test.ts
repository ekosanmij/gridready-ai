import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AssessmentFindingRecord,
  type EvidenceSourceRecord,
  type FindingEvidenceLinkRecord,
  blankEvidenceSourceDraft,
  calculateEvidenceReadiness,
  validateEvidenceSourceDraft,
} from "@/lib/evidence";
import { formatEvidenceCitation } from "@/lib/report-builder";

const repositoryRoot = resolve(process.cwd(), "..");
const migration = readFileSync(resolve(repositoryRoot, "supabase/migrations/20260619200000_evidence_lineage_preflight.sql"), "utf8");

function source(overrides: Partial<EvidenceSourceRecord> = {}): EvidenceSourceRecord {
  return {
    accessed_at: "2026-06-19",
    authored_by: "user-1",
    confidence_level: "high",
    created_at: "2026-06-19T12:00:00Z",
    file_reference: null,
    id: "source-1",
    license_notes: "Public regulatory material.",
    limitation_notes: "Screening use only.",
    metadata_version: 1,
    notes: "Checked by the analyst.",
    published_at: "2026-05-01",
    publisher: "ERCOT",
    site_assessment_id: "assessment-1",
    source_type: "official_iso_rto",
    summary: "Official source excerpt.",
    title: "ERCOT source",
    updated_at: "2026-06-19T12:00:00Z",
    url: "https://www.ercot.com/example",
    ...overrides,
  };
}

function finding(): AssessmentFindingRecord {
  return {
    assumption_note: null,
    confidence_level: "high",
    created_at: "2026-06-19T12:00:00Z",
    finding_type: "finding",
    id: "finding-1",
    module_key: "power_feasibility",
    recommendation: "Confirm with the utility.",
    risk_level: "critical",
    site_assessment_id: "assessment-1",
    statement: "A material finding.",
    status: "open",
    support_status: "unsupported",
    title: "Critical finding",
    updated_at: "2026-06-19T12:00:00Z",
  };
}

function link(relationship: FindingEvidenceLinkRecord["relationship"]): FindingEvidenceLinkRecord {
  return {
    created_at: "2026-06-19T12:00:00Z",
    evidence_source_id: "source-1",
    finding_id: "finding-1",
    id: `link-${relationship}`,
    linked_by: "user-1",
    link_note: null,
    relationship,
  };
}

describe("evidence lineage and server preflight contracts", () => {
  it("requires source-type-aware metadata", () => {
    const errors = validateEvidenceSourceDraft({ ...blankEvidenceSourceDraft, title: "Official source" }, false);
    expect(errors).toContain("A source summary or excerpt is required.");
    expect(errors).toContain("Analyst notes are required.");
    expect(errors).toContain("Select a supported confidence level.");
    expect(errors).toContain("Add a source URL or evidence file.");
    expect(errors).toContain("Publisher is required for this source type.");

    expect(validateEvidenceSourceDraft({
      ...blankEvidenceSourceDraft,
      accessedAt: "2026-06-19",
      confidenceLevel: "high",
      notes: "Reviewed against the official publication.",
      publisher: "ERCOT",
      summary: "Official source excerpt.",
      title: "Official source",
      url: "https://www.ercot.com/example",
    }, false)).toEqual([]);
  });

  it("does not count contradictory evidence as supporting a finding", () => {
    const contradictory = calculateEvidenceReadiness([source()], [finding()], [link("contradicting")]);
    expect(contradictory.findingsWithEvidence).toBe(0);
    expect(contradictory.highRiskFindingsWithoutEvidence).toBe(1);

    const supporting = calculateEvidenceReadiness([source()], [finding()], [link("supporting")]);
    expect(supporting.findingsWithEvidence).toBe(1);
    expect(supporting.highRiskFindingsWithoutEvidence).toBe(0);
  });

  it("formats a stable evidence citation with identity, date and location", () => {
    expect(formatEvidenceCitation(source())).toBe(
      "ERCOT source — ERCOT (published 2026-05-01; accessed 2026-06-19). https://www.ercot.com/example",
    );
  });

  it("creates durable lineage, explicit gaps and immutable preflight history", () => {
    expect(migration).toContain("create table if not exists public.evidence_gaps");
    expect(migration).toContain("create table if not exists public.report_claims");
    expect(migration).toContain("create table if not exists public.report_claim_evidence_links");
    expect(migration).toContain("create table if not exists public.report_section_finding_links");
    expect(migration).toContain("create table if not exists public.assessment_preflight_runs");
    expect(migration).toContain("evidence_snapshot jsonb not null");
    expect(migration).toContain("create trigger assessment_preflight_runs_immutable");
  });

  it("enforces report finalization and approved-exception handling on the server", () => {
    expect(migration).toContain("create or replace function public.run_assessment_preflight");
    expect(migration).toContain("create or replace function public.finalize_assessment_report");
    expect(migration).toContain("create or replace function public.approve_delivery_exception");
    expect(migration).toContain("before insert or update or delete on public.assessment_report_sections");
    expect(migration).toContain("before insert or update or delete on public.assessment_report_exports");
    expect(migration).toContain("Final report sections must be changed through finalize_assessment_report().");
    expect(migration).toContain("'finalized', false");
  });

  it("does not mark a client-side draft download as an exported report", () => {
    const reportAuthor = readFileSync(resolve(repositoryRoot, "web/src/components/assessment-workspace/report-author.tsx"), "utf8");
    expect(reportAuthor).toContain("Download draft HTML");
    expect(reportAuthor).not.toContain('update({ status: "exported" })');
    expect(reportAuthor).toContain("ReportLineagePreflight");
  });
});
