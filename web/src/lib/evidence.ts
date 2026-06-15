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

export type EvidenceSourceType = (typeof evidenceSourceTypes)[number]["value"];
export type FindingModuleKey = (typeof findingModules)[number]["value"];
export type FindingType = (typeof findingTypes)[number]["value"];
export type RiskLevel = (typeof riskLevels)[number]["value"];
export type EvidenceConfidenceLevel = (typeof evidenceConfidenceLevels)[number]["value"];
export type FindingStatus = (typeof findingStatuses)[number]["value"];

export type EvidenceSourceRecord = {
  accessed_at: string | null;
  confidence_level: EvidenceConfidenceLevel;
  created_at: string;
  file_reference: string | null;
  id: string;
  license_notes: string | null;
  limitation_notes: string | null;
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
  title: string;
  updated_at: string;
};

export type FindingEvidenceLinkRecord = {
  created_at: string;
  evidence_source_id: string;
  finding_id: string;
  id: string;
  link_note: string | null;
};

export type EvidenceSourceDraft = {
  accessedAt: string;
  confidenceLevel: EvidenceConfidenceLevel;
  fileReference: string;
  licenseNotes: string;
  limitationNotes: string;
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
        title: finding.title,
      }
    : { ...blankAssessmentFindingDraft, linkedEvidenceSourceIds: [] };
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
  const findingIdsWithEvidence = new Set(links.map((link) => link.finding_id));
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
