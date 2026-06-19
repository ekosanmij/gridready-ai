import {
  AssessmentFindingRecord,
  EvidenceConfidenceLevel,
  EvidenceReadinessSummary,
  RiskLevel,
  evidenceConfidenceLevels,
  evidenceConfidenceTone,
  riskLevelTone,
} from "@/lib/evidence";

export const scoreComponents = [
  {
    value: "power_feasibility",
    label: "Power feasibility",
    weight: 0.3,
    guidance: "Grid proximity, utility/TSP context, POI plausibility, and time-to-power signals.",
  },
  {
    value: "interconnection_readiness",
    label: "Interconnection readiness",
    weight: 0.2,
    guidance: "Process fit, required inputs, entity/control readiness, studies, and utility/TSP communication maturity.",
  },
  {
    value: "reliability_risk",
    label: "Grid reliability readiness",
    weight: 0.15,
    guidance: "Ride-through, protection, UPS/backup/storage behavior, observability, and disturbance response gaps.",
  },
  {
    value: "energy_economics",
    label: "Energy economics and congestion",
    weight: 0.1,
    guidance: "Pricing-zone context, congestion exposure, procurement optionality, and commercial uncertainty.",
  },
  {
    value: "flexibility",
    label: "Flexibility potential",
    weight: 0.1,
    guidance: "Curtailment, workload shifting, staged energization, storage, and demand-response posture.",
  },
  {
    value: "site_non_power_risks",
    label: "Site, permitting and water risk",
    weight: 0.1,
    guidance: "Land, zoning, water/cooling, permitting, community, access, and backup-generation permitting risk.",
  },
  {
    value: "evidence_quality",
    label: "Evidence confidence",
    weight: 0.05,
    guidance: "Official-source coverage, source confidence, recency, assumption separation, and evidence gaps.",
  },
] as const;

export const scoreModules = [
  ...scoreComponents,
  {
    value: "overall_readiness",
    label: "Overall readiness",
    weight: 1,
    guidance: "Server-derived weighted readiness. This value cannot be entered or overridden directly.",
  },
] as const;

export const verdictOptions = [
  { value: "reject", label: "Reject" },
  { value: "pause", label: "Pause" },
  { value: "proceed_targeted_diligence", label: "Proceed with targeted diligence" },
  { value: "proceed_with_caution", label: "Proceed with caution" },
  { value: "strong_candidate", label: "Strong candidate" },
  { value: "strong_candidate_subject_to_utility_confirmation", label: "Strong candidate subject to utility/TSP confirmation" },
] as const;

export const readinessBands = [
  { key: "reject_not_currently_viable", label: "Reject / not currently viable", minimum: 0, maximum: 24 },
  { key: "high_risk_major_blockers", label: "High risk / major blockers", minimum: 25, maximum: 44 },
  { key: "targeted_diligence_only", label: "Targeted diligence only", minimum: 45, maximum: 59 },
  { key: "plausible_unresolved_risks", label: "Plausible with unresolved risks", minimum: 60, maximum: 74 },
  { key: "strong_candidate", label: "Strong candidate", minimum: 75, maximum: 84 },
  { key: "highly_attractive_candidate", label: "Highly attractive candidate", minimum: 85, maximum: 100 },
] as const;

export const reviewStatuses = [
  { value: "not_started", label: "Not started" },
  { value: "requested", label: "Requested" },
  { value: "in_review", label: "In review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "not_required", label: "Not required" },
] as const;

export const expertReviewChecklistDefinitions = [
  { key: "scope_and_methodology", label: "Scope and methodology" },
  { key: "evidence_and_claims", label: "Evidence and material claims" },
  { key: "score_and_verdict", label: "Scorecard and verdict" },
  { key: "risks_and_mitigations", label: "Risks and mitigations" },
  { key: "assumptions_and_limitations", label: "Assumptions and limitations" },
  { key: "delivery_package", label: "Delivery package completeness" },
] as const;

export const expertReviewChecklistStatuses = [
  { value: "not_checked", label: "Not checked" },
  { value: "pass", label: "Pass" },
  { value: "warning", label: "Warning" },
  { value: "fail", label: "Fail" },
  { value: "not_applicable", label: "Not applicable" },
] as const;

export const reviewTypes = [
  { value: "final_report", label: "Final report" },
  { value: "power_systems", label: "Power systems" },
  { value: "interconnection", label: "Interconnection" },
  { value: "reliability", label: "Reliability" },
  { value: "energy_markets", label: "Energy markets" },
  { value: "legal_regulatory", label: "Legal/regulatory" },
  { value: "other", label: "Other" },
] as const;

export type ScoreModuleKey = (typeof scoreModules)[number]["value"];
export type VerdictOption = (typeof verdictOptions)[number]["value"];
export type ReviewStatus = (typeof reviewStatuses)[number]["value"];
export type ReviewType = (typeof reviewTypes)[number]["value"];
export type ExpertReviewChecklistStatus = (typeof expertReviewChecklistStatuses)[number]["value"];
export type DeliveryGateStatus = "blocked" | "pass" | "risk";

export type AssessmentScoreRecord = {
  calculation_origin?: "automated" | "initial_manual" | "legacy" | "manual_override";
  confidence_level: EvidenceConfidenceLevel;
  created_at: string;
  id: string;
  is_derived?: boolean;
  methodology_version_id?: string | null;
  module_key: ScoreModuleKey;
  override_note: string | null;
  rationale: string | null;
  risk_level: RiskLevel;
  score: number;
  site_assessment_id: string;
  updated_at: string;
  weight?: number | null;
  weighted_contribution?: number | null;
};

export type AssessmentVerdictRecord = {
  approved_at: string | null;
  approved_by_analyst: boolean;
  authored_by?: string | null;
  conditions?: string | null;
  confidence_level: EvidenceConfidenceLevel;
  created_at: string;
  id: string;
  key_risks: string | null;
  key_strengths: string | null;
  limitations_note: string | null;
  recommended_next_steps: string | null;
  site_assessment_id: string;
  summary: string | null;
  updated_at: string;
  verdict: VerdictOption;
};

export type AssessmentScoreCalculationRecord = {
  blockers: Array<{ key: string; message: string; remediation: string }>;
  calculated_by: string | null;
  calculation_reason: string | null;
  completed_component_count: number;
  confidence_points: number;
  created_at: string;
  id: string;
  methodology_version_id: string;
  overall_confidence: "high" | "low" | "medium";
  overall_score: number | null;
  readiness_band: string;
  site_assessment_id: string;
};

export type ExpertReviewRecord = {
  approved_at: string | null;
  assigned_at?: string | null;
  comments: string | null;
  created_at: string;
  decision_at?: string | null;
  decision_reason?: string | null;
  id: string;
  report_export_id?: string | null;
  report_export_version?: number | null;
  required_changes: string | null;
  review_type: ReviewType;
  reviewer_id?: string | null;
  reviewer_name: string | null;
  site_assessment_id: string;
  status: ReviewStatus;
  submitted_at?: string | null;
  trigger_reason: string | null;
  updated_at: string;
};

export type ExpertReviewChecklistItemRecord = {
  created_at: string;
  expert_review_id: string;
  id: string;
  item_key: string;
  label: string;
  reviewer_comment: string | null;
  required_change: string | null;
  site_assessment_id: string;
  status: ExpertReviewChecklistStatus;
  updated_at: string;
};

export type ExpertReviewChecklistDraft = {
  comments: string;
  itemKey: string;
  label: string;
  requiredChange: string;
  status: ExpertReviewChecklistStatus;
};

export type AssessmentScoreDraft = {
  confidenceLevel: EvidenceConfidenceLevel;
  overrideNote: string;
  rationale: string;
  riskLevel: RiskLevel;
  score: string;
};

export type AssessmentVerdictDraft = {
  approvedByAnalyst: boolean;
  changeReason: string;
  conditions: string;
  confidenceLevel: EvidenceConfidenceLevel;
  keyRisks: string;
  keyStrengths: string;
  limitationsNote: string;
  recommendedNextSteps: string;
  summary: string;
  verdict: VerdictOption;
};

export type ExpertReviewDraft = {
  comments: string;
  decisionReason: string;
  requiredChanges: string;
  reviewerName: string;
  status: ReviewStatus;
  triggerReason: string;
};

export type ScorecardSummary = {
  averageScore: number | null;
  completedModules: number;
  completionPercent: number;
  lowestScore: { label: string; moduleKey: ScoreModuleKey; score: number } | null;
  overallConfidence: EvidenceConfidenceLevel;
  readinessBand: string | null;
  totalModules: number;
};

export type ExpertReviewTrigger = {
  active: boolean;
  key: string;
  label: string;
};

export type ExpertReviewTriggerSummary = {
  activeTriggers: ExpertReviewTrigger[];
  reasonText: string;
  required: boolean;
};

export type DeliveryGate = {
  detail: string;
  key: string;
  label: string;
  status: DeliveryGateStatus;
};

export const blankScoreDraft: AssessmentScoreDraft = {
  confidenceLevel: "unknown",
  overrideNote: "",
  rationale: "",
  riskLevel: "unknown",
  score: "",
};

export const blankVerdictDraft: AssessmentVerdictDraft = {
  approvedByAnalyst: false,
  changeReason: "",
  conditions: "",
  confidenceLevel: "unknown",
  keyRisks: "",
  keyStrengths: "",
  limitationsNote: "",
  recommendedNextSteps: "",
  summary: "",
  verdict: "pause",
};

export const blankExpertReviewDraft: ExpertReviewDraft = {
  comments: "",
  decisionReason: "",
  requiredChanges: "",
  reviewerName: "",
  status: "not_started",
  triggerReason: "",
};

type ExpertReviewAssessmentContext = {
  backup_generation_assumptions: string | null;
  battery_storage_assumptions: string | null;
  target_load_mw: number | null;
};

type ExpertReviewTriggerInput = {
  assessment: ExpertReviewAssessmentContext;
  findings: AssessmentFindingRecord[];
  projectType: string | null | undefined;
  rideThroughUnknown: boolean;
  scores: AssessmentScoreRecord[];
};

type DeliveryGateInput = {
  criticalFindingCount: number;
  evidenceReadiness: EvidenceReadinessSummary;
  expertReview: ExpertReviewRecord | null;
  expertReviewRequired: boolean;
  scoreSummary: ScorecardSummary;
  verdict: AssessmentVerdictRecord | null;
};

export function createScoreDraft(record?: AssessmentScoreRecord | null): AssessmentScoreDraft {
  return record
    ? {
        confidenceLevel: record.confidence_level,
        overrideNote: record.override_note ?? "",
        rationale: record.rationale ?? "",
        riskLevel: record.risk_level,
        score: String(record.score),
      }
    : { ...blankScoreDraft };
}

export function buildScoreDrafts(records: AssessmentScoreRecord[]) {
  const recordsByModule = new Map(records.map((record) => [record.module_key, record]));

  return scoreModules.reduce<Record<ScoreModuleKey, AssessmentScoreDraft>>((drafts, module) => {
    drafts[module.value] = createScoreDraft(recordsByModule.get(module.value));
    return drafts;
  }, {} as Record<ScoreModuleKey, AssessmentScoreDraft>);
}

export function createVerdictDraft(record?: AssessmentVerdictRecord | null): AssessmentVerdictDraft {
  return record
    ? {
        approvedByAnalyst: record.approved_by_analyst,
        changeReason: "",
        conditions: record.conditions ?? "",
        confidenceLevel: record.confidence_level,
        keyRisks: record.key_risks ?? "",
        keyStrengths: record.key_strengths ?? "",
        limitationsNote: record.limitations_note ?? "",
        recommendedNextSteps: record.recommended_next_steps ?? "",
        summary: record.summary ?? "",
        verdict: record.verdict,
      }
    : { ...blankVerdictDraft };
}

export function createExpertReviewDraft(record?: ExpertReviewRecord | null): ExpertReviewDraft {
  return record
    ? {
        comments: record.comments ?? "",
        decisionReason: record.decision_reason ?? "",
        requiredChanges: record.required_changes ?? "",
        reviewerName: record.reviewer_name ?? "",
        status: record.status,
        triggerReason: record.trigger_reason ?? "",
      }
    : { ...blankExpertReviewDraft };
}

export function buildExpertReviewChecklistDrafts(records: ExpertReviewChecklistItemRecord[]) {
  const recordsByKey = new Map(records.map((record) => [record.item_key, record]));

  return expertReviewChecklistDefinitions.map<ExpertReviewChecklistDraft>((definition) => {
    const record = recordsByKey.get(definition.key);
    return {
      comments: record?.reviewer_comment ?? "",
      itemKey: definition.key,
      label: definition.label,
      requiredChange: record?.required_change ?? "",
      status: record?.status ?? "not_checked",
    };
  });
}

export function parseScoreInput(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
}

export function validateScoreDraft(moduleLabel: string, draft: AssessmentScoreDraft) {
  const score = parseScoreInput(draft.score);

  if (score === null) {
    return `${moduleLabel} score is required.`;
  }

  if (score < 0 || score > 100) {
    return `${moduleLabel} score must be between 0 and 100.`;
  }

  return null;
}

export function calculateScorecardSummary(scores: AssessmentScoreRecord[]): ScorecardSummary {
  const componentKeys = new Set(scoreComponents.map((module) => module.value));
  const componentScores = scores.filter((score) => componentKeys.has(score.module_key as typeof scoreComponents[number]["value"]));
  const completedModules = new Set(componentScores.map((score) => score.module_key)).size;
  const totalModules: number = scoreComponents.length;
  const derivedOverall = scores.find((score) => score.module_key === "overall_readiness" && score.is_derived !== false);
  const calculatedScore = completedModules === totalModules
    ? Math.round(scoreComponents.reduce((total, module) => {
        const record = componentScores.find((score) => score.module_key === module.value);
        return total + (record?.score ?? 0) * module.weight;
      }, 0))
    : null;
  const averageScore = derivedOverall?.score ?? calculatedScore;
  const lowestRecord =
    componentScores.length === 0
      ? null
      : [...componentScores].sort((first, second) => first.score - second.score)[0];

  return {
    averageScore,
    completedModules,
    completionPercent: totalModules === 0 ? 0 : Math.round((completedModules / totalModules) * 100),
    lowestScore: lowestRecord
      ? {
          label: scoreModuleLabel(lowestRecord.module_key),
          moduleKey: lowestRecord.module_key,
          score: lowestRecord.score,
        }
      : null,
    overallConfidence: derivedOverall?.confidence_level ?? calculateComponentConfidence(componentScores, completedModules),
    readinessBand: averageScore === null ? null : readinessBandForScore(averageScore).key,
    totalModules,
  };
}

export function readinessBandForScore(score: number) {
  const boundedScore = Math.min(100, Math.max(0, Math.round(score)));
  return readinessBands.find((band) => boundedScore >= band.minimum && boundedScore <= band.maximum) ?? readinessBands[0];
}

export function readinessBandLabel(value: string | null | undefined) {
  if (!value || value === "incomplete") {
    return "Incomplete";
  }
  return readinessBands.find((band) => band.key === value)?.label ?? value.replaceAll("_", " ");
}

function calculateComponentConfidence(scores: AssessmentScoreRecord[], completedModules: number): EvidenceConfidenceLevel {
  if (completedModules < scoreComponents.length || scores.some((score) => score.confidence_level === "unknown")) {
    return "low";
  }
  const points = scores.reduce((total, score) => total + ({ high: 100, medium: 70, low: 40, unknown: 0 }[score.confidence_level] ?? 0), 0) / scoreComponents.length;
  return points >= 80 ? "high" : points >= 55 ? "medium" : "low";
}

export function countCriticalFindings(findings: AssessmentFindingRecord[]) {
  return findings.filter(
    (finding) =>
      finding.risk_level === "critical" &&
      finding.status !== "resolved" &&
      finding.status !== "superseded",
  ).length;
}

export function countEvidenceGaps(readiness: EvidenceReadinessSummary) {
  return readiness.highRiskFindingsWithoutEvidence + readiness.assumptionOnlyFindings;
}

export function detectExpertReviewTriggers({
  assessment,
  findings,
  projectType,
  rideThroughUnknown,
  scores,
}: ExpertReviewTriggerInput): ExpertReviewTriggerSummary {
  const interconnectionScore = scores.find((score) => score.module_key === "interconnection_readiness");
  const reliabilityScore = scores.find((score) => score.module_key === "reliability_risk");
  const hasBackupOrStorage =
    Boolean(assessment.backup_generation_assumptions?.trim()) ||
    Boolean(assessment.battery_storage_assumptions?.trim());
  const hasCriticalFinding = countCriticalFindings(findings) > 0;
  const triggers: ExpertReviewTrigger[] = [
    {
      active: Number(assessment.target_load_mw ?? 0) >= 75,
      key: "large_load",
      label: "Target load is 75 MW or greater",
    },
    {
      active: typeof reliabilityScore?.score === "number" && reliabilityScore.score < 70,
      key: "reliability_score",
      label: "Reliability score is below 70",
    },
    {
      active: typeof interconnectionScore?.score === "number" && interconnectionScore.score < 70,
      key: "interconnection_score",
      label: "Interconnection readiness score is below 70",
    },
    {
      active: rideThroughUnknown,
      key: "ride_through_unknown",
      label: "Ride-through assumptions are unknown or unresolved",
    },
    {
      active: hasBackupOrStorage,
      key: "backup_or_storage",
      label: "Backup generation or storage strategy is present",
    },
    {
      active: projectType === "investor_underwriting",
      key: "investor_underwriting",
      label: "Project is for investor underwriting",
    },
    {
      active: hasCriticalFinding,
      key: "critical_finding",
      label: "Critical risk finding is present",
    },
  ];
  const activeTriggers = triggers.filter((trigger) => trigger.active);

  return {
    activeTriggers,
    reasonText: activeTriggers.map((trigger) => trigger.label).join("; "),
    required: activeTriggers.length > 0,
  };
}

export function calculateDeliveryGates({
  criticalFindingCount,
  evidenceReadiness,
  expertReview,
  expertReviewRequired,
  scoreSummary,
  verdict,
}: DeliveryGateInput): DeliveryGate[] {
  const expertReviewStatus = expertReview?.status ?? "not_started";
  const expertReviewGate = expertReviewGateStatus(expertReviewRequired, expertReviewStatus);
  const evidenceGapCount = countEvidenceGaps(evidenceReadiness);

  return [
    {
      detail:
        scoreSummary.completedModules === scoreSummary.totalModules
          ? "All score modules are complete."
          : `${scoreSummary.completedModules}/${scoreSummary.totalModules} score modules complete.`,
      key: "scorecard_complete",
      label: "Scorecard complete",
      status: scoreSummary.completedModules === scoreSummary.totalModules ? "pass" : "blocked",
    },
    {
      detail: verdict ? "Final verdict is saved." : "Final verdict has not been saved.",
      key: "final_verdict",
      label: "Final verdict",
      status: verdict ? "pass" : "blocked",
    },
    {
      detail:
        criticalFindingCount === 0
          ? "No unresolved critical findings."
          : `${criticalFindingCount} unresolved critical finding${criticalFindingCount === 1 ? "" : "s"}.`,
      key: "critical_findings",
      label: "Critical findings",
      status: criticalFindingCount === 0 ? "pass" : "blocked",
    },
    {
      detail:
        evidenceReadiness.highRiskFindingsWithoutEvidence > 0
          ? `${evidenceReadiness.highRiskFindingsWithoutEvidence} high-risk finding${evidenceReadiness.highRiskFindingsWithoutEvidence === 1 ? "" : "s"} without evidence.`
          : evidenceGapCount > 0
            ? `${evidenceGapCount} evidence or assumption gap${evidenceGapCount === 1 ? "" : "s"} still flagged.`
            : "No high-risk evidence gaps flagged.",
      key: "evidence_gaps",
      label: "Evidence gaps",
      status:
        evidenceReadiness.highRiskFindingsWithoutEvidence > 0
          ? "blocked"
          : evidenceGapCount > 0
            ? "risk"
            : "pass",
    },
    {
      detail: expertReviewGate.detail,
      key: "expert_review",
      label: "Expert review",
      status: expertReviewGate.status,
    },
    {
      detail: verdict?.limitations_note?.trim()
        ? "Limitations language is captured."
        : "Limitations language is missing.",
      key: "limitations",
      label: "Limitations",
      status: verdict?.limitations_note?.trim() ? "pass" : "blocked",
    },
    {
      detail: verdict?.approved_by_analyst
        ? "Analyst approval is recorded."
        : "Analyst approval is not recorded.",
      key: "analyst_approval",
      label: "Analyst approval",
      status: verdict?.approved_by_analyst ? "pass" : "blocked",
    },
  ];
}

export function deliveryGatesAreComplete(gates: DeliveryGate[]) {
  return gates.every((gate) => gate.status === "pass");
}

export function scoreModuleLabel(value: string) {
  return scoreModules.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function verdictLabel(value: string) {
  return verdictOptions.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function reviewStatusLabel(value: string) {
  return reviewStatuses.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function reviewStatusTone(value: ReviewStatus) {
  const styles: Record<ReviewStatus, string> = {
    approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
    changes_requested: "border-rose-200 bg-rose-50 text-rose-800",
    in_review: "border-sky-200 bg-sky-50 text-[#1b365d]",
    not_required: "border-slate-200 bg-slate-100 text-slate-600",
    not_started: "border-slate-200 bg-white text-slate-700",
    requested: "border-amber-200 bg-amber-50 text-amber-800",
    rejected: "border-rose-300 bg-rose-100 text-rose-900",
  };

  return styles[value];
}

export function deliveryGateTone(value: DeliveryGateStatus) {
  const styles: Record<DeliveryGateStatus, string> = {
    blocked: "border-rose-200 bg-rose-50 text-rose-900",
    pass: "border-emerald-200 bg-emerald-50 text-emerald-900",
    risk: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return styles[value];
}

export function scoreTone(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  if (value >= 75) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (value >= 60) {
    return "border-sky-200 bg-sky-50 text-[#1b365d]";
  }

  if (value >= 45) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-rose-200 bg-rose-50 text-rose-800";
}

export { evidenceConfidenceLevels, evidenceConfidenceTone, riskLevelTone };

function expertReviewGateStatus(expertReviewRequired: boolean, status: ReviewStatus) {
  if (status === "changes_requested") {
    return {
      detail: "Expert review has requested changes.",
      status: "blocked" as const,
    };
  }

  if (status === "approved") {
    return {
      detail: "Expert review is approved.",
      status: "pass" as const,
    };
  }

  if (!expertReviewRequired && status === "not_required") {
    return {
      detail: "Expert review marked not required.",
      status: "pass" as const,
    };
  }

  if (!expertReviewRequired && status === "not_started") {
    return {
      detail: "No expert review trigger is active.",
      status: "pass" as const,
    };
  }

  if (!expertReviewRequired) {
    return {
      detail: "Expert review is active but not complete.",
      status: "risk" as const,
    };
  }

  return {
    detail: "Expert review is required and must be approved before delivery.",
    status: "blocked" as const,
  };
}
