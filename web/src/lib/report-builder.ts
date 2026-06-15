import {
  AssessmentFindingRecord,
  EvidenceReadinessSummary,
  EvidenceSourceRecord,
  FindingEvidenceLinkRecord,
  evidenceConfidenceLabel,
  evidenceForFinding,
  evidenceSourceTypeLabel,
  findingModuleLabel,
  riskLevelLabel,
} from "@/lib/evidence";
import { GridAssetRecord, formatDistanceMiles, gridAssetTypeLabel } from "@/lib/gis";
import {
  AssessmentScoreRecord,
  AssessmentVerdictRecord,
  ExpertReviewRecord,
  calculateScorecardSummary,
  reviewStatusLabel,
  verdictLabel,
} from "@/lib/scorecard";

export const reportSectionDefinitions = [
  { key: "executive_verdict", title: "Executive Verdict" },
  { key: "site_overview", title: "Site Overview" },
  { key: "project_assumptions", title: "Project Assumptions" },
  { key: "power_feasibility_score", title: "Power Feasibility Score" },
  { key: "nearby_grid_infrastructure", title: "Nearby Grid Infrastructure" },
  { key: "utility_market_context", title: "Utility / TSP / DSP / Market Context" },
  { key: "interconnection_pathway", title: "Likely Interconnection Pathway" },
  { key: "required_information_missing_diligence", title: "Required Information and Missing Diligence" },
  { key: "grid_reliability_risk_assessment", title: "Grid Reliability Risk Assessment" },
  { key: "energy_economics_congestion_view", title: "Energy Economics and Congestion View" },
  { key: "nearby_generation_procurement_options", title: "Nearby Generation and Power Procurement Options" },
  { key: "flexibility_demand_response_potential", title: "Flexibility and Demand-Response Potential" },
  { key: "permitting_water_cooling_community_risks", title: "Permitting, Water, Cooling, and Community Risk Flags" },
  { key: "key_risks_mitigants", title: "Key Risks and Mitigants" },
  { key: "recommended_next_steps", title: "Recommended Next Steps" },
  { key: "investor_utility_ready_memo", title: "Investor/Utility-Ready Memo" },
  { key: "evidence_appendix", title: "Evidence Appendix" },
  { key: "assumptions_limitations", title: "Assumptions and Limitations" },
] as const;

export const reportSectionStatuses = [
  { value: "draft", label: "Draft" },
  { value: "needs_review", label: "Needs review" },
  { value: "ready", label: "Ready" },
  { value: "final", label: "Final" },
] as const;

export const reportExportStatuses = [
  { value: "not_started", label: "Not started" },
  { value: "draft_generated", label: "Draft generated" },
  { value: "analyst_edited", label: "Analyst edited" },
  { value: "ready_for_review", label: "Ready for review" },
  { value: "exported", label: "Exported" },
] as const;

export type ReportSectionKey = (typeof reportSectionDefinitions)[number]["key"];
export type ReportSectionStatus = (typeof reportSectionStatuses)[number]["value"];
export type ReportExportStatus = (typeof reportExportStatuses)[number]["value"];

export type ReportTemplateRecord = {
  id: string;
  is_active: boolean;
  market_region: string;
  name: string;
  report_type: string;
  version: string;
};

export type ReportTemplateSectionRecord = {
  default_guidance: string | null;
  id: string;
  is_required: boolean;
  section_key: ReportSectionKey;
  sort_order: number;
  template_id: string;
  title: string;
};

export type AssessmentReportSectionRecord = {
  content: string;
  generated_at: string | null;
  generation_notes: string | null;
  id: string;
  is_edited: boolean;
  section_key: ReportSectionKey;
  site_assessment_id: string;
  status: ReportSectionStatus;
  template_section_id: string;
  title: string;
  updated_at: string;
};

export type AssessmentReportExportRecord = {
  export_type: string;
  id: string;
  notes: string | null;
  ready_for_review_at: string | null;
  site_assessment_id: string;
  status: ReportExportStatus;
  template_id: string;
  updated_at: string;
};

export type ReportSectionDraft = {
  content: string;
  status: ReportSectionStatus;
};

export type GeneratedReportSection = {
  content: string;
  generationNotes: string;
  hasEvidenceGap: boolean;
  sectionKey: ReportSectionKey;
  templateSectionId: string;
  title: string;
};

export type ReportGenerationContext = {
  assessment: {
    assessment_name: string;
    backup_generation_assumptions: string | null;
    battery_storage_assumptions: string | null;
    curtailment_willingness: string | null;
    desired_energization_date: string | null;
    existing_power_quote_summary: string | null;
    existing_studies_summary: string | null;
    full_buildout_load_mw: number | null;
    initial_load_mw: number | null;
    known_substation_or_poi: string | null;
    known_tsp: string | null;
    known_utility: string | null;
    land_control_status: string | null;
    market_region: string;
    project_stage: string | null;
    target_load_mw: number | null;
    water_cooling_notes: string | null;
    workload_flexibility_assumptions: string | null;
  };
  checklist: {
    answeredItems: number;
    blockedItems: number;
    riskItems: number;
    totalItems: number;
  };
  evidenceLinks: FindingEvidenceLinkRecord[];
  evidenceReadiness: EvidenceReadinessSummary;
  evidenceSources: EvidenceSourceRecord[];
  expertReview: ExpertReviewRecord | null;
  findings: AssessmentFindingRecord[];
  gridAssets: GridAssetRecord[];
  organisationName: string;
  projectName: string;
  projectType: string;
  scores: AssessmentScoreRecord[];
  site: {
    address: string | null;
    city: string | null;
    county: string | null;
    latitude: number | null;
    longitude: number | null;
    parcel_id: string | null;
    site_name: string;
    state: string | null;
  } | null;
  templateSections: ReportTemplateSectionRecord[];
  verdict: AssessmentVerdictRecord | null;
};

export const defaultLimitationsText = [
  "This draft is an early-stage power feasibility and interconnection-readiness assessment, not an official utility, TSP, DSP, ERCOT, ISO/RTO, or engineering study.",
  "The assessment does not guarantee power availability, interconnection approval, energization timing, upgrade cost, or commercial terms.",
  "Public and customer-provided data may be incomplete, outdated, confidential, or subject to interpretation. Final decisions require direct engagement with the relevant utility/TSP/DSP/ISO/RTO and qualified technical, legal, and engineering advisors.",
].join("\n");

const evidencePending = "Evidence pending";

export function createReportSectionDraft(section?: AssessmentReportSectionRecord | null): ReportSectionDraft {
  return {
    content: section?.content ?? "",
    status: section?.status ?? "draft",
  };
}

export function buildReportSectionDrafts(
  templateSections: ReportTemplateSectionRecord[],
  sections: AssessmentReportSectionRecord[],
) {
  const sectionsByTemplateId = new Map(sections.map((section) => [section.template_section_id, section]));

  return templateSections.reduce<Record<string, ReportSectionDraft>>((drafts, templateSection) => {
    drafts[templateSection.id] = createReportSectionDraft(sectionsByTemplateId.get(templateSection.id));
    return drafts;
  }, {});
}

export function reportSectionTitle(value: string) {
  return reportSectionDefinitions.find((section) => section.key === value)?.title ?? value.replaceAll("_", " ");
}

export function reportSectionStatusLabel(value: string) {
  return reportSectionStatuses.find((status) => status.value === value)?.label ?? value.replaceAll("_", " ");
}

export function reportExportStatusLabel(value: string) {
  return reportExportStatuses.find((status) => status.value === value)?.label ?? value.replaceAll("_", " ");
}

export function reportStatusTone(value: ReportSectionStatus | ReportExportStatus) {
  const styles: Record<string, string> = {
    analyst_edited: "border-sky-200 bg-sky-50 text-[#1b365d]",
    draft: "border-slate-200 bg-white text-slate-700",
    draft_generated: "border-sky-200 bg-sky-50 text-[#1b365d]",
    exported: "border-emerald-200 bg-emerald-50 text-emerald-800",
    final: "border-emerald-200 bg-emerald-50 text-emerald-800",
    needs_review: "border-amber-200 bg-amber-50 text-amber-800",
    not_started: "border-slate-200 bg-slate-100 text-slate-600",
    ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
    ready_for_review: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return styles[value] ?? styles.draft;
}

export function hasEvidenceGap(content: string) {
  return content.toLowerCase().includes(evidencePending.toLowerCase());
}

export function generateReportSections(context: ReportGenerationContext): GeneratedReportSection[] {
  return [...context.templateSections]
    .sort((first, second) => first.sort_order - second.sort_order)
    .map((templateSection) => {
      const content = generateContentForSection(templateSection.section_key, context);

      return {
        content,
        generationNotes: hasEvidenceGap(content)
          ? "Generated with explicit evidence gaps."
          : "Generated from structured assessment data.",
        hasEvidenceGap: hasEvidenceGap(content),
        sectionKey: templateSection.section_key,
        templateSectionId: templateSection.id,
        title: templateSection.title,
      };
    });
}

function generateContentForSection(sectionKey: ReportSectionKey, context: ReportGenerationContext) {
  switch (sectionKey) {
    case "executive_verdict":
      return sectionExecutiveVerdict(context);
    case "site_overview":
      return sectionSiteOverview(context);
    case "project_assumptions":
      return sectionProjectAssumptions(context);
    case "power_feasibility_score":
      return sectionModuleScore(context, "power_feasibility", "power feasibility");
    case "nearby_grid_infrastructure":
      return sectionGridInfrastructure(context);
    case "utility_market_context":
      return sectionUtilityMarketContext(context);
    case "interconnection_pathway":
      return sectionModuleScore(context, "interconnection_readiness", "interconnection pathway");
    case "required_information_missing_diligence":
      return sectionMissingDiligence(context);
    case "grid_reliability_risk_assessment":
      return sectionModuleScore(context, "reliability_risk", "grid reliability risk");
    case "energy_economics_congestion_view":
      return sectionModuleScore(context, "energy_economics", "energy economics and congestion");
    case "nearby_generation_procurement_options":
      return sectionGenerationProcurement(context);
    case "flexibility_demand_response_potential":
      return sectionModuleScore(context, "flexibility", "flexibility and demand response");
    case "permitting_water_cooling_community_risks":
      return sectionModuleScore(context, "site_non_power_risks", "site, permitting, water, cooling, and community risk");
    case "key_risks_mitigants":
      return sectionKeyRisks(context);
    case "recommended_next_steps":
      return sectionRecommendedNextSteps(context);
    case "investor_utility_ready_memo":
      return sectionInvestorUtilityMemo(context);
    case "evidence_appendix":
      return sectionEvidenceAppendix(context);
    case "assumptions_limitations":
      return sectionAssumptionsLimitations(context);
  }
}

function sectionExecutiveVerdict(context: ReportGenerationContext) {
  const summary = calculateScorecardSummary(context.scores);
  const overallScore = context.scores.find((score) => score.module_key === "overall_readiness");
  const verdict = context.verdict;
  const lines = [
    `Verdict: ${verdict ? verdictLabel(verdict.verdict) : evidencePending}.`,
    `Overall readiness score: ${overallScore ? `${overallScore.score}/100` : summary.averageScore === null ? evidencePending : `${summary.averageScore}/100 average across scored modules`}.`,
    `Confidence: ${overallScore ? overallScore.confidence_level : evidencePending}.`,
    verdict?.summary ? `Executive summary: ${verdict.summary}` : `Executive summary: ${evidencePending}.`,
    verdict?.recommended_next_steps ? `Recommended next action: ${verdict.recommended_next_steps}` : `Recommended next action: ${evidencePending}.`,
  ];

  return lines.join("\n");
}

function sectionSiteOverview(context: ReportGenerationContext) {
  const site = context.site;
  const assessment = context.assessment;

  return [
    `Assessment: ${assessment.assessment_name}.`,
    `Customer: ${context.organisationName || evidencePending}.`,
    `Project: ${context.projectName || evidencePending}.`,
    `Site: ${site?.site_name ?? evidencePending}.`,
    `Location: ${formatLocation(site)}.`,
    `Market: ${assessment.market_region || evidencePending}.`,
    `Target load: ${formatMw(assessment.target_load_mw)}.`,
    `Initial phase load: ${formatMw(assessment.initial_load_mw)}.`,
    `Full buildout load: ${formatMw(assessment.full_buildout_load_mw)}.`,
    `Desired energization: ${assessment.desired_energization_date ?? evidencePending}.`,
  ].join("\n");
}

function sectionProjectAssumptions(context: ReportGenerationContext) {
  const assessment = context.assessment;

  return [
    `Customer/project stage: ${assessment.project_stage || evidencePending}.`,
    `Land control: ${assessment.land_control_status || evidencePending}.`,
    `Customer-provided studies: ${assessment.existing_studies_summary || evidencePending}.`,
    `Customer-provided power quote: ${assessment.existing_power_quote_summary || evidencePending}.`,
    `Assumption - backup generation: ${assessment.backup_generation_assumptions || evidencePending}.`,
    `Assumption - battery/storage: ${assessment.battery_storage_assumptions || evidencePending}.`,
    `Assumption - workload flexibility: ${assessment.workload_flexibility_assumptions || evidencePending}.`,
    `Assumption - water/cooling: ${assessment.water_cooling_notes || evidencePending}.`,
  ].join("\n");
}

function sectionModuleScore(context: ReportGenerationContext, moduleKey: string, sectionLabel: string) {
  const score = context.scores.find((item) => item.module_key === moduleKey);
  const findings = findingsForModule(context, moduleKey);
  const evidenceBackedFindings = findings.filter(
    (finding) => evidenceForFinding(finding.id, context.evidenceSources, context.evidenceLinks).length > 0,
  ).length;

  return [
    `${sentenceCase(sectionLabel)} score: ${score ? `${score.score}/100` : evidencePending}.`,
    `Risk level: ${score ? riskLevelLabel(score.risk_level) : evidencePending}.`,
    `Confidence: ${score ? score.confidence_level : evidencePending}.`,
    `Rationale: ${score?.rationale || evidencePending}.`,
    `Override note: ${score?.override_note || "No override note recorded."}.`,
    `Findings: ${findings.length > 0 ? formatFindings(context, findings) : evidencePending}.`,
    `Evidence support: ${findings.length > 0 ? `${evidenceBackedFindings}/${findings.length} finding(s) have linked evidence.` : evidencePending}.`,
  ].join("\n");
}

function sectionGridInfrastructure(context: ReportGenerationContext) {
  if (context.gridAssets.length === 0) {
    return `Saved grid assets and candidate POIs: ${evidencePending}.`;
  }

  const assets = context.gridAssets
    .map((asset) => {
      const poi = asset.is_candidate_poi ? " Candidate POI." : "";
      return `- ${asset.asset_name}: ${gridAssetTypeLabel(asset.asset_type)}, ${formatDistanceMiles(asset.distance_miles)}, voltage ${asset.voltage_kv ?? evidencePending} kV, owner/operator ${asset.owner_operator || evidencePending}, confidence ${asset.confidence_level}.${poi} Source: ${asset.source || evidencePending}.`;
    })
    .join("\n");

  return `Saved grid assets and candidate POIs:\n${assets}`;
}

function sectionUtilityMarketContext(context: ReportGenerationContext) {
  const assessment = context.assessment;
  const findings = findingsForModule(context, "power_feasibility");

  return [
    `Market region: ${assessment.market_region || evidencePending}.`,
    `Known utility: ${assessment.known_utility || evidencePending}.`,
    `Known TSP: ${assessment.known_tsp || evidencePending}.`,
    `Known substation or POI: ${assessment.known_substation_or_poi || evidencePending}.`,
    `Supporting findings: ${findings.length > 0 ? formatFindings(context, findings) : evidencePending}.`,
  ].join("\n");
}

function sectionMissingDiligence(context: ReportGenerationContext) {
  const findings = context.findings.filter(
    (finding) => finding.finding_type === "gap" || finding.status === "needs_review" || finding.risk_level === "critical",
  );

  return [
    `Checklist completion: ${context.checklist.answeredItems}/${context.checklist.totalItems} answered; ${context.checklist.riskItems} risk item(s); ${context.checklist.blockedItems} blocked item(s).`,
    `Missing diligence and review items: ${findings.length > 0 ? formatFindings(context, findings) : evidencePending}.`,
  ].join("\n");
}

function sectionGenerationProcurement(context: ReportGenerationContext) {
  const generationAssets = context.gridAssets.filter((asset) => asset.asset_type === "generation_asset");

  return [
    `Nearby generation assets: ${
      generationAssets.length > 0
        ? generationAssets.map((asset) => `${asset.asset_name} (${formatDistanceMiles(asset.distance_miles)})`).join("; ")
        : evidencePending
    }.`,
    `Power procurement options: ${context.assessment.existing_power_quote_summary || evidencePending}.`,
    `Procurement-related findings: ${formatFindingsOrPending(context, "energy_economics")}.`,
  ].join("\n");
}

function sectionKeyRisks(context: ReportGenerationContext) {
  const findings = context.findings.filter(
    (finding) => finding.risk_level === "critical" || finding.risk_level === "high",
  );

  if (findings.length === 0) {
    return `Critical/high risk findings: ${evidencePending}.`;
  }

  return `Critical/high risk findings and mitigants:\n${formatFindings(context, findings)}`;
}

function sectionRecommendedNextSteps(context: ReportGenerationContext) {
  const recommendations = context.findings
    .map((finding) => finding.recommendation)
    .filter((recommendation): recommendation is string => Boolean(recommendation?.trim()));

  return [
    `Verdict next steps: ${context.verdict?.recommended_next_steps || evidencePending}.`,
    `Finding-level recommendations: ${recommendations.length > 0 ? recommendations.map((item) => `- ${item}`).join("\n") : evidencePending}.`,
  ].join("\n");
}

function sectionInvestorUtilityMemo(context: ReportGenerationContext) {
  return [
    `Site summary: ${context.site?.site_name ?? evidencePending} in ${formatLocation(context.site)} for ${formatMw(context.assessment.target_load_mw)} target load.`,
    `Power-readiness view: ${context.verdict ? verdictLabel(context.verdict.verdict) : evidencePending}.`,
    `Primary strengths: ${context.verdict?.key_strengths || evidencePending}.`,
    `Primary underwriting risks: ${context.verdict?.key_risks || evidencePending}.`,
    `Recommended actions: ${context.verdict?.recommended_next_steps || evidencePending}.`,
  ].join("\n");
}

function sectionEvidenceAppendix(context: ReportGenerationContext) {
  const sourceLines = context.evidenceSources.map(
    (source) =>
      `- ${source.title}: ${evidenceSourceTypeLabel(source.source_type)}, confidence ${evidenceConfidenceLabel(source.confidence_level)}, publisher ${source.publisher || evidencePending}, accessed ${source.accessed_at || evidencePending}. ${source.url || source.file_reference || evidencePending}.`,
  );

  return [
    `Evidence readiness: ${context.evidenceReadiness.findingsWithEvidence}/${context.evidenceReadiness.totalFindings} findings with evidence; ${context.evidenceReadiness.highRiskFindingsWithoutEvidence} high-risk finding(s) without evidence.`,
    `Sources:\n${sourceLines.length > 0 ? sourceLines.join("\n") : evidencePending}.`,
  ].join("\n");
}

function sectionAssumptionsLimitations(context: ReportGenerationContext) {
  const assumptionFindings = context.findings.filter((finding) => Boolean(finding.assumption_note?.trim()));
  const reviewStatus = context.expertReview ? reviewStatusLabel(context.expertReview.status) : evidencePending;

  return [
    `Recorded assumptions:\n${assumptionFindings.length > 0 ? assumptionFindings.map((finding) => `- ${finding.title}: ${finding.assumption_note}`).join("\n") : evidencePending}.`,
    `Expert review status: ${reviewStatus}.`,
    `Limitations:\n${context.verdict?.limitations_note || defaultLimitationsText}`,
  ].join("\n");
}

function formatFindingsOrPending(context: ReportGenerationContext, moduleKey: string) {
  const findings = findingsForModule(context, moduleKey);

  return findings.length > 0 ? formatFindings(context, findings) : evidencePending;
}

function formatFindings(context: ReportGenerationContext, findings: AssessmentFindingRecord[]) {
  return findings
    .map((finding) => {
      const linkedSources = evidenceForFinding(finding.id, context.evidenceSources, context.evidenceLinks);
      const evidence = linkedSources.length > 0 ? linkedSources.map((source) => source.title).join(", ") : evidencePending;
      const assumption = finding.assumption_note ? ` Assumption: ${finding.assumption_note}` : "";
      const recommendation = finding.recommendation ? ` Recommendation: ${finding.recommendation}` : "";

      return `- ${finding.title} (${findingModuleLabel(finding.module_key)}, ${riskLevelLabel(finding.risk_level)}, confidence ${finding.confidence_level}). ${finding.statement || evidencePending}. Evidence: ${evidence}.${assumption}${recommendation}`;
    })
    .join("\n");
}

function findingsForModule(context: ReportGenerationContext, moduleKey: string) {
  return context.findings.filter((finding) => finding.module_key === moduleKey);
}

function formatLocation(site: ReportGenerationContext["site"]) {
  if (!site) {
    return evidencePending;
  }

  const parts = [site.address, site.city, site.county, site.state].filter(Boolean);
  const coordinates =
    site.latitude !== null && site.longitude !== null && site.latitude !== undefined && site.longitude !== undefined
      ? `${site.latitude}, ${site.longitude}`
      : null;

  return [parts.join(", "), coordinates ? `Coordinates: ${coordinates}` : null, site.parcel_id ? `Parcel: ${site.parcel_id}` : null]
    .filter(Boolean)
    .join("; ") || evidencePending;
}

function formatMw(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value} MW` : evidencePending;
}

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
