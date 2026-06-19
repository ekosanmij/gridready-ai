import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AssessmentScoreRecord,
  calculateScorecardSummary,
  readinessBandForScore,
  scoreComponents,
  verdictOptions,
} from "@/lib/scorecard";

const repositoryRoot = resolve(process.cwd(), "..");
const migrationPath = resolve(repositoryRoot, "supabase/migrations/20260619180000_scoring_confidence_verdict_history.sql");

function scoreRecord(
  moduleKey: AssessmentScoreRecord["module_key"],
  score: number,
  confidence: AssessmentScoreRecord["confidence_level"] = "high",
  overrides: Partial<AssessmentScoreRecord> = {},
): AssessmentScoreRecord {
  return {
    confidence_level: confidence,
    created_at: "2026-06-19T12:00:00.000Z",
    id: `score-${moduleKey}`,
    module_key: moduleKey,
    override_note: null,
    rationale: null,
    risk_level: "medium",
    score,
    site_assessment_id: "assessment-1",
    updated_at: "2026-06-19T12:00:00.000Z",
    ...overrides,
  };
}

describe("versioned readiness scoring contracts", () => {
  it("uses the exact seven-factor weights and produces the expected weighted score", () => {
    expect(scoreComponents.map(({ value, weight }) => [value, weight])).toEqual([
      ["power_feasibility", 0.3],
      ["interconnection_readiness", 0.2],
      ["reliability_risk", 0.15],
      ["energy_economics", 0.1],
      ["flexibility", 0.1],
      ["site_non_power_risks", 0.1],
      ["evidence_quality", 0.05],
    ]);
    expect(scoreComponents.reduce((total, component) => total + component.weight, 0)).toBe(1);

    const summary = calculateScorecardSummary([
      scoreRecord("power_feasibility", 90),
      scoreRecord("interconnection_readiness", 80),
      scoreRecord("reliability_risk", 70),
      scoreRecord("energy_economics", 60),
      scoreRecord("flexibility", 50),
      scoreRecord("site_non_power_risks", 40),
      scoreRecord("evidence_quality", 30),
    ]);

    expect(summary.averageScore).toBe(70);
    expect(summary.readinessBand).toBe("plausible_unresolved_risks");
    expect(summary.overallConfidence).toBe("high");
    expect(summary.completedModules).toBe(7);
  });

  it("keeps confidence independent and ignores a manually entered overall score", () => {
    const scores = scoreComponents.map((component) => scoreRecord(component.value, 80, component.value === "evidence_quality" ? "unknown" : "high"));
    scores.push(scoreRecord("overall_readiness", 5, "high", { is_derived: false }));

    const summary = calculateScorecardSummary(scores);
    expect(summary.averageScore).toBe(80);
    expect(summary.overallConfidence).toBe("low");
  });

  it.each([
    [0, "reject_not_currently_viable"],
    [24, "reject_not_currently_viable"],
    [25, "high_risk_major_blockers"],
    [44, "high_risk_major_blockers"],
    [45, "targeted_diligence_only"],
    [59, "targeted_diligence_only"],
    [60, "plausible_unresolved_risks"],
    [74, "plausible_unresolved_risks"],
    [75, "strong_candidate"],
    [84, "strong_candidate"],
    [85, "highly_attractive_candidate"],
    [100, "highly_attractive_candidate"],
  ])("maps %i to the exact readiness band", (score, expectedBand) => {
    expect(readinessBandForScore(score).key).toBe(expectedBand);
  });

  it("exposes only canonical verdict values", () => {
    expect(verdictOptions.map((option) => option.value)).toEqual([
      "reject",
      "pause",
      "proceed_targeted_diligence",
      "proceed_with_caution",
      "strong_candidate",
      "strong_candidate_subject_to_utility_confirmation",
    ]);
  });

  it("enforces audited RPC writes and append-only history in SQL", () => {
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("create or replace function public.save_assessment_scores");
    expect(migration).toContain("create or replace function public.save_assessment_verdict");
    expect(migration).toContain("create table if not exists public.assessment_score_events");
    expect(migration).toContain("create table if not exists public.assessment_verdict_events");
    expect(migration).toContain("create trigger assessment_score_events_immutable");
    expect(migration).toContain("create trigger assessment_verdict_events_immutable");
    expect(migration).toContain('"evidence_recency_weight": 0.10');
    expect(migration).toContain("Verdict conditions are required");
    expect(migration).toContain("Scores must be changed through save_assessment_scores().");
    expect(migration).toContain("Verdicts must be changed through save_assessment_verdict().");
  });

  it("does not bypass the audited score or verdict mutation functions in either editor", () => {
    const legacyConsole = readFileSync(resolve(repositoryRoot, "web/src/components/intake-workspace.tsx"), "utf8");
    const workbenchEditor = readFileSync(resolve(repositoryRoot, "web/src/components/assessment-workspace/scorecard-editor.tsx"), "utf8");
    const service = readFileSync(resolve(repositoryRoot, "web/src/lib/scorecard-service.ts"), "utf8");

    expect(legacyConsole).not.toMatch(/from\("assessment_scores"\)[\s\S]{0,200}upsert/);
    expect(legacyConsole).not.toMatch(/from\("assessment_verdicts"\)[\s\S]{0,200}upsert/);
    expect(workbenchEditor).not.toContain('.from("assessment_scores")');
    expect(workbenchEditor).not.toContain('.from("assessment_verdicts")');
    expect(service).toContain('.rpc("save_assessment_scores"');
    expect(service).toContain('.rpc("save_assessment_verdict"');
  });
});
