export const evidenceSourceTypes = [
  { value: "official_iso_rto", label: "Official ISO/RTO" },
  { value: "utility_tsp_dsp", label: "Utility/TSP/DSP" },
  { value: "government_regulator", label: "Government/regulator" },
  { value: "customer_provided", label: "Customer-provided" },
  { value: "commercial_dataset", label: "Commercial dataset" },
  { value: "public_gis_dataset", label: "Public GIS dataset" },
  { value: "analyst_assumption", label: "Analyst assumption" },
  { value: "analyst_derived", label: "Analyst-derived" },
  { value: "expert_judgement", label: "Expert judgement" },
  { value: "unverified_web", label: "Unverified web" },
  { value: "other", label: "Other" },
] as const;

export const findingModules = [
  { value: "power_feasibility", label: "Power feasibility" },
  { value: "interconnection_readiness", label: "Interconnection readiness" },
  { value: "reliability_risk", label: "Reliability risk" },
  { value: "energy_economics", label: "Energy economics" },
  { value: "flexibility", label: "Flexibility" },
  { value: "site_non_power_risks", label: "Site/non-power risks" },
  { value: "evidence", label: "Evidence and assumptions" },
  { value: "expert_review", label: "Expert review" },
] as const;

export const findingTypes = [
  { value: "finding", label: "Finding" },
  { value: "risk", label: "Risk" },
  { value: "gap", label: "Diligence gap" },
  { value: "assumption", label: "Assumption" },
  { value: "recommendation", label: "Recommendation" },
] as const;

export const riskLevels = [
  { value: "unknown", label: "Unknown" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const evidenceConfidenceLevels = [
  { value: "unknown", label: "Unknown" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export const findingStatuses = [
  { value: "open", label: "Open" },
  { value: "needs_review", label: "Needs review" },
  { value: "resolved", label: "Resolved" },
  { value: "superseded", label: "Superseded" },
] as const;

export const evidenceRelationships = [
  { value: "supporting", label: "Supporting" },
  { value: "contradicting", label: "Contradicting" },
  { value: "context", label: "Context" },
] as const;

export const supportStatuses = [
  { value: "unsupported", label: "Unsupported" },
  { value: "supported", label: "Supported" },
  { value: "contradicted", label: "Contradicted" },
  { value: "mixed", label: "Mixed evidence" },
  { value: "not_applicable", label: "Not applicable" },
] as const;

export const evidenceGapCategories = [
  { value: "grid", label: "Grid" },
  { value: "interconnection", label: "Interconnection" },
  { value: "reliability", label: "Reliability" },
  { value: "market", label: "Market" },
  { value: "site", label: "Site" },
  { value: "permitting", label: "Permitting" },
  { value: "water", label: "Water" },
  { value: "environmental", label: "Environmental" },
  { value: "commercial", label: "Commercial" },
  { value: "source_quality", label: "Source quality" },
  { value: "other", label: "Other" },
] as const;

export const evidenceGapStatuses = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved from source" },
  { value: "accepted_unknown", label: "Accepted unknown" },
  { value: "exception_approved", label: "Exception approved" },
] as const;

export type EvidenceSourceType = (typeof evidenceSourceTypes)[number]["value"];
export type FindingModuleKey = (typeof findingModules)[number]["value"];
export type FindingType = (typeof findingTypes)[number]["value"];
export type RiskLevel = (typeof riskLevels)[number]["value"];
export type EvidenceConfidenceLevel = (typeof evidenceConfidenceLevels)[number]["value"];
export type FindingStatus = (typeof findingStatuses)[number]["value"];
export type EvidenceRelationship = (typeof evidenceRelationships)[number]["value"];
export type SupportStatus = (typeof supportStatuses)[number]["value"];
export type EvidenceGapCategory = (typeof evidenceGapCategories)[number]["value"];
export type EvidenceGapStatus = (typeof evidenceGapStatuses)[number]["value"];

export type EvidenceSourceRecord = {
  accessed_at: string | null;
  authored_by: string | null;
  confidence_level: EvidenceConfidenceLevel;
  created_at: string;
  file_reference: string | null;
  id: string;
  license_notes: string | null;
  limitation_notes: string | null;
  metadata_version?: number;
  notes: string | null;
  published_at: string | null;
  publisher: string | null;
  site_assessment_id: string;
  source_type: EvidenceSourceType;
  summary: string | null;
  title: string;
  updated_at: string;
  url: string | null;
};

export type AssessmentFindingRecord = {
  assumption_note: string | null;
  confidence_level: EvidenceConfidenceLevel;
  created_at: string;
  finding_type: string;
  id: string;
  module_key: FindingModuleKey;
  recommendation: string | null;
  risk_level: RiskLevel;
  site_assessment_id: string;
  statement: string | null;
  status: FindingStatus;
  support_status: SupportStatus;
  title: string;
  updated_at: string;
};

export type FindingEvidenceLinkRecord = {
  created_at: string;
  evidence_source_id: string;
  finding_id: string;
  id: string;
  linked_by: string | null;
  link_note: string | null;
  relationship: EvidenceRelationship;
};

export type EvidenceSourceDraft = {
  accessedAt: string;
  confidenceLevel: EvidenceConfidenceLevel;
  fileReference: string;
  licenseNotes: string;
  limitationNotes: string;
  notes: string;
  publishedAt: string;
  publisher: string;
  sourceType: EvidenceSourceType;
  summary: string;
  title: string;
  url: string;
};

export type AssessmentFindingDraft = {
  assumptionNote: string;
  confidenceLevel: EvidenceConfidenceLevel;
  findingType: FindingType;
  linkedEvidenceSourceIds: string[];
  moduleKey: FindingModuleKey;
  recommendation: string;
  riskLevel: RiskLevel;
  statement: string;
  status: FindingStatus;
  supportStatus: SupportStatus;
  title: string;
};

export type EvidenceGapRecord = {
  approved_exception_id: string | null;
  blocks_confidence: boolean;
  blocks_delivery: boolean;
  blocks_review: boolean;
  category: EvidenceGapCategory;
  created_at: string;
  description: string | null;
  due_at: string | null;
  id: string;
  impact: string;
  owner_id: string | null;
  resolution_note: string | null;
  resolution_type: "accepted_unknown" | "approved_exception" | "source" | null;
  resolved_source_id: string | null;
  severity: Exclude<RiskLevel, "unknown">;
  site_assessment_id: string;
  status: EvidenceGapStatus;
  title: string;
  updated_at: string;
};

export type EvidenceGapDraft = {
  blocksConfidence: boolean;
  blocksDelivery: boolean;
  blocksReview: boolean;
  category: EvidenceGapCategory;
  description: string;
  dueAt: string;
  impact: string;
  ownerId: string;
  resolutionNote: string;
  resolvedSourceId: string;
  severity: EvidenceGapRecord["severity"];
  status: EvidenceGapStatus;
  title: string;
};

export type EvidenceReadinessSummary = {
  assumptionOnlyFindings: number;
  findingsWithEvidence: number;
  highRiskFindingsWithoutEvidence: number;
  highRiskFindingsWithoutRecommendation: number;
  lowConfidenceSources: number;
  readinessPercent: number;
  totalFindings: number;
  totalSources: number;
  findingsWithoutRecommendation: number;
};

export const blankEvidenceSourceDraft: EvidenceSourceDraft = {
  accessedAt: "",
  confidenceLevel: "unknown",
  fileReference: "",
  licenseNotes: "",
  limitationNotes: "",
  notes: "",
  publishedAt: "",
  publisher: "",
  sourceType: "official_iso_rto",
  summary: "",
  title: "",
  url: "",
};

export const blankAssessmentFindingDraft: AssessmentFindingDraft = {
  assumptionNote: "",
  confidenceLevel: "unknown",
  findingType: "finding",
  linkedEvidenceSourceIds: [],
  moduleKey: "power_feasibility",
  recommendation: "",
  riskLevel: "unknown",
  statement: "",
  status: "open",
  supportStatus: "unsupported",
  title: "",
};

export const blankEvidenceGapDraft: EvidenceGapDraft = {
  blocksConfidence: true,
  blocksDelivery: false,
  blocksReview: false,
  category: "other",
  description: "",
  dueAt: "",
  impact: "",
  ownerId: "",
  resolutionNote: "",
  resolvedSourceId: "",
  severity: "medium",
  status: "open",
  title: "",
};

export function createEvidenceSourceDraft(source?: EvidenceSourceRecord | null): EvidenceSourceDraft {
  return source
    ? {
        accessedAt: source.accessed_at ?? "",
        confidenceLevel: source.confidence_level,
        fileReference: source.file_reference ?? "",
        licenseNotes: source.license_notes ?? "",
        limitationNotes: source.limitation_notes ?? "",
        notes: source.notes ?? "",
        publishedAt: source.published_at ?? "",
        publisher: source.publisher ?? "",
        sourceType: source.source_type,
        summary: source.summary ?? "",
        title: source.title,
        url: source.url ?? "",
      }
    : { ...blankEvidenceSourceDraft };
}

export function createAssessmentFindingDraft(
  finding?: AssessmentFindingRecord | null,
  linkedEvidenceSourceIds: string[] = [],
): AssessmentFindingDraft {
  return finding
    ? {
        assumptionNote: finding.assumption_note ?? "",
        confidenceLevel: finding.confidence_level,
        findingType: normaliseFindingType(finding.finding_type),
        linkedEvidenceSourceIds,
        moduleKey: finding.module_key,
        recommendation: finding.recommendation ?? "",
        riskLevel: finding.risk_level,
        statement: finding.statement ?? "",
        status: finding.status,
        supportStatus: finding.support_status,
        title: finding.title,
      }
    : { ...blankAssessmentFindingDraft, linkedEvidenceSourceIds: [] };
}

export function createEvidenceGapDraft(gap?: EvidenceGapRecord | null): EvidenceGapDraft {
  return gap
    ? {
        blocksConfidence: gap.blocks_confidence,
        blocksDelivery: gap.blocks_delivery,
        blocksReview: gap.blocks_review,
        category: gap.category,
        description: gap.description ?? "",
        dueAt: gap.due_at?.slice(0, 16) ?? "",
        impact: gap.impact,
        ownerId: gap.owner_id ?? "",
        resolutionNote: gap.resolution_note ?? "",
        resolvedSourceId: gap.resolved_source_id ?? "",
        severity: gap.severity,
        status: gap.status,
        title: gap.title,
      }
    : { ...blankEvidenceGapDraft };
}

export function validateEvidenceSourceDraft(draft: EvidenceSourceDraft, hasFile: boolean) {
  const errors: string[] = [];
  if (!draft.title.trim()) errors.push("Title is required.");
  if (!draft.summary.trim()) errors.push("A source summary or excerpt is required.");
  if (!draft.notes.trim()) errors.push("Analyst notes are required.");
  if (draft.confidenceLevel === "unknown") errors.push("Select a supported confidence level.");
  if (!draft.url.trim() && !draft.fileReference.trim() && !hasFile) errors.push("Add a source URL or evidence file.");
  if (draft.url.trim() && !draft.accessedAt) errors.push("An access date is required for URL sources.");
  if (["commercial_dataset", "government_regulator", "official_iso_rto", "public_gis_dataset", "utility_tsp_dsp"].includes(draft.sourceType) && !draft.publisher.trim()) {
    errors.push("Publisher is required for this source type.");
  }
  if (["commercial_dataset", "unverified_web"].includes(draft.sourceType) && !draft.licenseNotes.trim() && !draft.limitationNotes.trim()) {
    errors.push("Licence or limitation details are required for this source type.");
  }
  return errors;
}

export function evidenceSourceTypeLabel(value: string) {
  return evidenceSourceTypes.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function findingModuleLabel(value: string) {
  return findingModules.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function findingTypeLabel(value: string) {
  return findingTypes.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function riskLevelLabel(value: string) {
  return riskLevels.find((item) => item.value === value)?.label ?? value;
}

export function evidenceConfidenceLabel(value: string) {
  return evidenceConfidenceLevels.find((item) => item.value === value)?.label ?? value;
}

export function findingStatusLabel(value: string) {
  return findingStatuses.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function riskLevelTone(value: RiskLevel) {
  const styles: Record<RiskLevel, string> = {
    critical: "border-rose-300 bg-rose-50 text-rose-900",
    high: "border-rose-200 bg-rose-50 text-rose-800",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
    low: "border-emerald-200 bg-emerald-50 text-emerald-800",
    unknown: "border-slate-200 bg-slate-100 text-slate-600",
  };

  return styles[value];
}

export function evidenceConfidenceTone(value: EvidenceConfidenceLevel) {
  const styles: Record<EvidenceConfidenceLevel, string> = {
    high: "border-emerald-200 bg-emerald-50 text-emerald-800",
    medium: "border-sky-200 bg-sky-50 text-[#1b365d]",
    low: "border-amber-200 bg-amber-50 text-amber-800",
    unknown: "border-slate-200 bg-slate-100 text-slate-600",
  };

  return styles[value];
}

export function findingStatusTone(value: FindingStatus) {
  const styles: Record<FindingStatus, string> = {
    open: "border-slate-200 bg-white text-slate-700",
    needs_review: "border-amber-200 bg-amber-50 text-amber-800",
    resolved: "border-emerald-200 bg-emerald-50 text-emerald-800",
    superseded: "border-slate-200 bg-slate-100 text-slate-600",
  };

  return styles[value];
}

export function isHighRiskFinding(finding: Pick<AssessmentFindingRecord, "risk_level">) {
  return finding.risk_level === "critical" || finding.risk_level === "high";
}

export function hasFindingRecommendation(finding: Pick<AssessmentFindingRecord, "recommendation">) {
  return Boolean(finding.recommendation?.trim());
}

export function linksForFinding(findingId: string, links: FindingEvidenceLinkRecord[]) {
  return links.filter((link) => link.finding_id === findingId);
}

export function evidenceForFinding(
  findingId: string,
  sources: EvidenceSourceRecord[],
  links: FindingEvidenceLinkRecord[],
) {
  const sourceIds = new Set(linksForFinding(findingId, links).map((link) => link.evidence_source_id));

  return sources.filter((source) => sourceIds.has(source.id));
}

export function isAssumptionOnlyFinding(
  finding: Pick<AssessmentFindingRecord, "assumption_note">,
  linkedSources: EvidenceSourceRecord[],
) {
  const hasAssumption = Boolean(finding.assumption_note?.trim());

  if (!hasAssumption) {
    return false;
  }

  return (
    linkedSources.length === 0 ||
    linkedSources.every((source) => source.source_type === "analyst_assumption")
  );
}

export function calculateEvidenceReadiness(
  sources: EvidenceSourceRecord[],
  findings: AssessmentFindingRecord[],
  links: FindingEvidenceLinkRecord[],
): EvidenceReadinessSummary {
  const findingIdsWithEvidence = new Set(
    links.filter((link) => link.relationship === "supporting").map((link) => link.finding_id),
  );
  const sourcesById = new Map(sources.map((source) => [source.id, source]));

  const findingsWithEvidence = findings.filter((finding) => findingIdsWithEvidence.has(finding.id)).length;
  const highRiskFindingsWithoutEvidence = findings.filter(
    (finding) => isHighRiskFinding(finding) && !findingIdsWithEvidence.has(finding.id),
  ).length;
  const highRiskFindingsWithoutRecommendation = findings.filter(
    (finding) => isHighRiskFinding(finding) && !hasFindingRecommendation(finding),
  ).length;
  const findingsWithoutRecommendation = findings.filter(
    (finding) => !hasFindingRecommendation(finding),
  ).length;
  const lowConfidenceSources = sources.filter(
    (source) => source.confidence_level === "low" || source.confidence_level === "unknown",
  ).length;
  const assumptionOnlyFindings = findings.filter((finding) => {
    const linkedSources = linksForFinding(finding.id, links)
      .map((link) => sourcesById.get(link.evidence_source_id))
      .filter((source): source is EvidenceSourceRecord => Boolean(source));

    return isAssumptionOnlyFinding(finding, linkedSources);
  }).length;

  return {
    assumptionOnlyFindings,
    findingsWithEvidence,
    findingsWithoutRecommendation,
    highRiskFindingsWithoutEvidence,
    highRiskFindingsWithoutRecommendation,
    lowConfidenceSources,
    readinessPercent: findings.length === 0 ? 0 : Math.round((findingsWithEvidence / findings.length) * 100),
    totalFindings: findings.length,
    totalSources: sources.length,
  };
}

function normaliseFindingType(value: string): FindingType {
  const match = findingTypes.find((item) => item.value === value);

  return match?.value ?? "finding";
}
