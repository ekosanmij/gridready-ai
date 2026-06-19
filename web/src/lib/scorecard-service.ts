import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ExpertReviewChecklistDraft,
  ExpertReviewDraft,
  ExpertReviewRecord,
  AssessmentScoreDraft,
  AssessmentVerdictDraft,
  ScoreModuleKey,
} from "@/lib/scorecard";

export type ScoreSavePayload = {
  confidence_level: AssessmentScoreDraft["confidenceLevel"];
  module_key: Exclude<ScoreModuleKey, "overall_readiness">;
  override_note: string | null;
  rationale: string | null;
  risk_level: AssessmentScoreDraft["riskLevel"];
  score: number;
};

export async function saveAssessmentScores(
  client: SupabaseClient,
  input: {
    assessmentId: string;
    reason?: string;
    scores: ScoreSavePayload[];
  },
) {
  const { data, error } = await client.rpc("save_assessment_scores", {
    p_assessment_id: input.assessmentId,
    p_reason: input.reason?.trim() || null,
    p_scores: input.scores,
  });

  if (error) {
    throw error;
  }

  return data as {
    blockers: Array<{ key: string; message: string; remediation: string }>;
    calculation_id: string;
    overall_confidence: "high" | "low" | "medium";
    overall_score: number | null;
    readiness_band: string;
    saved_component_count: number;
  };
}

export async function saveAssessmentVerdict(
  client: SupabaseClient,
  input: {
    assessmentId: string;
    draft: AssessmentVerdictDraft;
  },
) {
  const { data, error } = await client
    .rpc("save_assessment_verdict", {
      p_approved_by_analyst: input.draft.approvedByAnalyst,
      p_assessment_id: input.assessmentId,
      p_conditions: input.draft.conditions.trim() || null,
      p_confidence_level: input.draft.confidenceLevel,
      p_key_risks: input.draft.keyRisks.trim() || null,
      p_key_strengths: input.draft.keyStrengths.trim() || null,
      p_limitations_note: input.draft.limitationsNote.trim() || null,
      p_reason: input.draft.changeReason.trim() || null,
      p_recommended_next_steps: input.draft.recommendedNextSteps.trim() || null,
      p_summary: input.draft.summary.trim(),
      p_verdict: input.draft.verdict,
    })
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveExpertReview(
  client: SupabaseClient,
  input: {
    assessmentId: string;
    checklist: ExpertReviewChecklistDraft[];
    draft: ExpertReviewDraft;
    reportExportId: string | null;
    review: ExpertReviewRecord | null;
  },
) {
  const { data, error } = await client
    .rpc("save_expert_review_packet", {
      p_assessment_id: input.assessmentId,
      p_checklist: input.checklist.map((item) => ({
        item_key: item.itemKey,
        label: item.label,
        reviewer_comment: item.comments.trim() || null,
        required_change: item.requiredChange.trim() || null,
        status: item.status,
      })),
      p_review: {
        comments: input.draft.comments.trim() || null,
        decision_reason: input.draft.decisionReason.trim() || null,
        id: input.review?.id ?? null,
        report_export_id: input.reportExportId,
        required_changes: input.draft.requiredChanges.trim() || null,
        review_type: input.review?.review_type ?? "final_report",
        reviewer_id: input.review?.reviewer_id ?? null,
        reviewer_name: input.draft.reviewerName.trim() || null,
        status: input.draft.status,
        trigger_reason: input.draft.triggerReason.trim() || null,
      },
    })
    .single();

  if (error) {
    throw error;
  }

  return data as ExpertReviewRecord;
}
