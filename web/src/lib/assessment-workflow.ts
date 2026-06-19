import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/components/auth/auth-provider";
import type { AssessmentStatus } from "@/lib/intake";

type TransitionRule = {
  from: AssessmentStatus;
  roles: AppRole[];
  to: AssessmentStatus;
};

const internalRoles: AppRole[] = ["admin", "analyst"];
const reviewRoles: AppRole[] = ["admin", "analyst", "reviewer"];

export const assessmentTransitionRules: TransitionRule[] = [
  { from: "draft", to: "intake_incomplete", roles: internalRoles },
  { from: "draft", to: "intake_complete", roles: internalRoles },
  { from: "draft", to: "archived", roles: internalRoles },
  { from: "intake_incomplete", to: "draft", roles: internalRoles },
  { from: "intake_incomplete", to: "intake_complete", roles: internalRoles },
  { from: "intake_incomplete", to: "archived", roles: internalRoles },
  { from: "intake_complete", to: "intake_incomplete", roles: internalRoles },
  { from: "intake_complete", to: "in_analyst_review", roles: internalRoles },
  { from: "intake_complete", to: "archived", roles: internalRoles },
  { from: "in_analyst_review", to: "intake_incomplete", roles: internalRoles },
  { from: "in_analyst_review", to: "in_expert_review", roles: internalRoles },
  { from: "in_analyst_review", to: "report_drafting", roles: internalRoles },
  { from: "in_analyst_review", to: "archived", roles: internalRoles },
  { from: "in_expert_review", to: "in_analyst_review", roles: reviewRoles },
  { from: "in_expert_review", to: "report_drafting", roles: reviewRoles },
  { from: "in_expert_review", to: "final_review", roles: reviewRoles },
  { from: "in_expert_review", to: "archived", roles: internalRoles },
  { from: "report_drafting", to: "in_analyst_review", roles: internalRoles },
  { from: "report_drafting", to: "in_expert_review", roles: internalRoles },
  { from: "report_drafting", to: "final_review", roles: internalRoles },
  { from: "report_drafting", to: "archived", roles: internalRoles },
  { from: "final_review", to: "report_drafting", roles: reviewRoles },
  { from: "final_review", to: "in_expert_review", roles: reviewRoles },
  { from: "final_review", to: "delivered", roles: internalRoles },
  { from: "final_review", to: "archived", roles: internalRoles },
  { from: "delivered", to: "archived", roles: internalRoles },
  { from: "delivered", to: "in_analyst_review", roles: ["admin"] },
  { from: "archived", to: "in_analyst_review", roles: ["admin"] },
];

export function allowedAssessmentTransitions(current: AssessmentStatus, role: AppRole) {
  return assessmentTransitionRules
    .filter((rule) => rule.from === current && rule.roles.includes(role))
    .map((rule) => rule.to);
}

export async function transitionAssessmentStatus(
  client: SupabaseClient,
  input: {
    assessmentId: string;
    reason?: string;
    source?: string;
    toStatus: AssessmentStatus;
  },
) {
  const { data, error } = await client
    .rpc("transition_assessment_status", {
      p_assessment_id: input.assessmentId,
      p_reason: input.reason ?? null,
      p_source: input.source ?? "application",
      p_to_status: input.toStatus,
    })
    .single();

  if (error) {
    throw error;
  }

  return data as { assessment_id: string; status: AssessmentStatus; updated_at: string };
}
