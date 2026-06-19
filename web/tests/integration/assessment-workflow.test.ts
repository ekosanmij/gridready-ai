import { describe, expect, it } from "vitest";
import { buildActivityItems, type AssessmentWorkspaceData } from "@/lib/assessment-workspace";
import { allowedAssessmentTransitions, assessmentTransitionRules } from "@/lib/assessment-workflow";

describe("assessment workflow contracts", () => {
  it("keeps customer lifecycle state read-only", () => {
    expect(allowedAssessmentTransitions("draft", "customer")).toEqual([]);
    expect(allowedAssessmentTransitions("final_review", "customer")).toEqual([]);
  });

  it("limits reviewers to review-stage handoffs", () => {
    expect(allowedAssessmentTransitions("in_expert_review", "reviewer")).toEqual([
      "in_analyst_review",
      "report_drafting",
      "final_review",
    ]);
    expect(allowedAssessmentTransitions("final_review", "reviewer")).toEqual([
      "report_drafting",
      "in_expert_review",
    ]);
    expect(allowedAssessmentTransitions("delivered", "reviewer")).toEqual([]);
  });

  it("reserves reopening delivered or archived work for administrators", () => {
    expect(allowedAssessmentTransitions("delivered", "analyst")).toEqual(["archived"]);
    expect(allowedAssessmentTransitions("delivered", "admin")).toEqual(["archived", "in_analyst_review"]);
    expect(allowedAssessmentTransitions("archived", "admin")).toEqual(["in_analyst_review"]);
  });

  it("defines each status pair once", () => {
    const pairs = assessmentTransitionRules.map((rule) => `${rule.from}:${rule.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("uses the audit stream without duplicating its legacy source record", () => {
    const data = {
      assessment: { updated_at: "2026-06-19T09:00:00Z" },
      assessmentEvents: [{
        actor_role: "analyst",
        created_at: "2026-06-19T10:00:00Z",
        event_type: "status_changed",
        from_state: "intake_complete",
        id: "event-1",
        metadata: {},
        reason: "Review started",
        source_record_id: "history-1",
        source_table: "status_history",
        to_state: "in_analyst_review",
        visibility: "shared",
      }],
      evidenceSources: [],
      expertReview: null,
      files: [],
      findings: [],
      notes: [],
      reportExport: null,
      reportSections: [],
      scores: [],
      statusHistory: [{
        created_at: "2026-06-19T10:00:00Z",
        from_status: "intake_complete",
        id: "history-1",
        reason: "Review started",
        to_status: "in_analyst_review",
      }],
      verdict: null,
    } as unknown as AssessmentWorkspaceData;

    expect(buildActivityItems(data)).toMatchObject([
      { id: "event-event-1", title: "Intake complete -> In analyst review" },
    ]);
  });
});
