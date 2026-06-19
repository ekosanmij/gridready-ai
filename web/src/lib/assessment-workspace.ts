import {
  AssessmentFindingRecord,
  EvidenceGapRecord,
  EvidenceReadinessSummary,
  EvidenceSourceRecord,
  FindingEvidenceLinkRecord,
  calculateEvidenceReadiness,
} from "@/lib/evidence";
import { GridAssetRecord, hasValidCoordinatePair } from "@/lib/gis";
import { AssessmentStatus, assessmentStatuses, statusLabel } from "@/lib/intake";
import { single } from "@/lib/portal-assessments";
import {
  AssessmentReportExportRecord,
  AssessmentPreflightRunRecord,
  AssessmentReportSectionRecord,
  ReportClaimEvidenceLinkRecord,
  ReportClaimRecord,
  ReportSectionFindingLinkRecord,
  reportExportStatusLabel,
  reportSectionStatusLabel,
} from "@/lib/report-builder";
import {
  AssessmentScoreCalculationRecord,
  AssessmentScoreRecord,
  AssessmentVerdictRecord,
  ExpertReviewChecklistItemRecord,
  ExpertReviewRecord,
  calculateDeliveryGates,
  calculateScorecardSummary,
  countCriticalFindings,
  countEvidenceGaps,
  deliveryGatesAreComplete,
  detectExpertReviewTriggers,
  reviewStatusLabel,
  scoreModuleLabel,
  verdictLabel,
} from "@/lib/scorecard";
import type { StatusTone } from "@/components/ui-primitives";

export type OrganisationRecord = {
  id: string;
  name: string;
  organisation_type: string;
};

export type ContactRecord = {
  email: string | null;
  id: string;
  name: string;
  phone: string | null;
  role_title: string | null;
};

export type ProjectRecord = {
  deadline: string | null;
  description: string | null;
  id: string;
  lead_contact_id: string | null;
  name: string;
  organisation_id: string;
  organisations?: OrganisationRecord | OrganisationRecord[] | null;
  project_type: string;
  status: string;
};

export type SiteRecord = {
  address: string | null;
  city: string | null;
  country: string | null;
  county: string | null;
  id: string;
  latitude: number | null;
  longitude: number | null;
  parcel_id: string | null;
  site_name: string;
  state: string | null;
};

export type AssessmentRecord = {
  assignment_note: string | null;
  assessment_name: string;
  backup_generation_assumptions: string | null;
  battery_storage_assumptions: string | null;
  confidentiality_status: string;
  created_at: string;
  curtailment_willingness: string | null;
  desired_energization_date: string | null;
  existing_power_quote_summary: string | null;
  existing_studies_summary: string | null;
  full_buildout_load_mw: number | null;
  id: string;
  initial_load_mw: number | null;
  intake_completeness_score: number;
  known_substation_or_poi: string | null;
  known_tsp: string | null;
  known_utility: string | null;
  land_control_status: string | null;
  market_region: string;
  owner_id: string | null;
  project_id: string;
  project_stage: string | null;
  site_id: string;
  sla_days: number | null;
  sla_due_at: string | null;
  status: AssessmentStatus;
  target_load_mw: number | null;
  updated_at: string;
  water_cooling_notes: string | null;
  workload_flexibility_assumptions: string | null;
};

export type AssessmentDetailRecord = AssessmentRecord & {
  contact?: ContactRecord | null;
  projects?: ProjectRecord | ProjectRecord[] | null;
  sites?: SiteRecord | SiteRecord[] | null;
};

export type NoteRecord = {
  body: string;
  created_at: string;
  id: string;
  is_internal: boolean;
  note_type: string;
};

export type FileRecord = {
  created_at: string;
  description: string | null;
  document_category: string | null;
  file_name: string;
  id: string;
  storage_path: string | null;
};

export type StatusHistoryRecord = {
  changed_at?: string | null;
  created_at?: string | null;
  from_status: AssessmentStatus | null;
  id: string;
  reason: string | null;
  to_status: AssessmentStatus;
};

export type AssessmentEventRecord = {
  actor_role: "admin" | "analyst" | "reviewer" | "customer" | null;
  created_at: string;
  event_type: string;
  from_state: string | null;
  id: string;
  metadata: Record<string, unknown>;
  reason: string | null;
  source_record_id: string | null;
  source_table: string | null;
  to_state: string | null;
  visibility: "customer" | "internal" | "shared";
};

export type DuplicateAssessmentSignal = {
  id: string;
  label: string;
  reason: string;
  status: AssessmentStatus;
};

export type AssessmentWorkspaceData = {
  assessment: AssessmentDetailRecord;
  assessmentEvents: AssessmentEventRecord[];
  duplicateSignals: DuplicateAssessmentSignal[];
  evidenceLinks: FindingEvidenceLinkRecord[];
  evidenceGaps: EvidenceGapRecord[];
  evidenceReadiness: EvidenceReadinessSummary;
  evidenceSources: EvidenceSourceRecord[];
  expertReview: ExpertReviewRecord | null;
  expertReviewChecklist: ExpertReviewChecklistItemRecord[];
  files: FileRecord[];
  findings: AssessmentFindingRecord[];
  gridAssets: GridAssetRecord[];
  notes: NoteRecord[];
  reportExport: AssessmentReportExportRecord | null;
  reportClaimEvidenceLinks: ReportClaimEvidenceLinkRecord[];
  reportClaims: ReportClaimRecord[];
  reportSectionFindingLinks: ReportSectionFindingLinkRecord[];
  latestPreflight: AssessmentPreflightRunRecord | null;
  reportSections: AssessmentReportSectionRecord[];
  scoreCalculation: AssessmentScoreCalculationRecord | null;
  scoreSummary: ReturnType<typeof calculateScorecardSummary>;
  scores: AssessmentScoreRecord[];
  statusHistory: StatusHistoryRecord[];
  verdict: AssessmentVerdictRecord | null;
};

export type WorkspaceModuleId =
  | "overview"
  | "intake"
  | "site-grid"
  | "evidence"
  | "findings"
  | "scorecard"
  | "report"
  | "activity";

export const workspaceModules: Array<{ id: WorkspaceModuleId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "intake", label: "Intake" },
  { id: "site-grid", label: "Site & Grid" },
  { id: "evidence", label: "Evidence" },
  { id: "findings", label: "Findings" },
  { id: "scorecard", label: "Scorecard" },
  { id: "report", label: "Report" },
  { id: "activity", label: "Activity" },
];

export const lifecycleStates: Array<{
  customerLabel: string;
  description: string;
  owner: "Analyst" | "Customer" | "Expert reviewer" | "Report reviewer" | "System";
  slaDays: number;
  status: AssessmentStatus;
}> = [
  {
    customerLabel: "Draft request",
    description: "Request has been started but is not ready for analyst triage.",
    owner: "Customer",
    slaDays: 2,
    status: "draft",
  },
  {
    customerLabel: "Needs customer input",
    description: "Minimum intake facts or evidence are still missing.",
    owner: "Customer",
    slaDays: 3,
    status: "intake_incomplete",
  },
  {
    customerLabel: "Submitted",
    description: "Minimum intake is complete and ready for analyst review.",
    owner: "Analyst",
    slaDays: 2,
    status: "intake_complete",
  },
  {
    customerLabel: "Analyst review",
    description: "GridReady is reviewing site, grid, evidence, and risk signals.",
    owner: "Analyst",
    slaDays: 5,
    status: "in_analyst_review",
  },
  {
    customerLabel: "Expert review",
    description: "Specialist review is required before report delivery.",
    owner: "Expert reviewer",
    slaDays: 4,
    status: "in_expert_review",
  },
  {
    customerLabel: "Report drafting",
    description: "Structured findings are being converted into a report package.",
    owner: "Analyst",
    slaDays: 3,
    status: "report_drafting",
  },
  {
    customerLabel: "Final review",
    description: "Report package is being checked for delivery readiness.",
    owner: "Report reviewer",
    slaDays: 2,
    status: "final_review",
  },
  {
    customerLabel: "Delivered",
    description: "Report package has been delivered.",
    owner: "System",
    slaDays: 0,
    status: "delivered",
  },
  {
    customerLabel: "Archived",
    description: "Request is closed or archived.",
    owner: "System",
    slaDays: 0,
    status: "archived",
  },
];

export function getProject(assessment: AssessmentDetailRecord) {
  return single(assessment.projects);
}

export function getSite(assessment: AssessmentDetailRecord) {
  return single(assessment.sites);
}

export function getOrganisation(assessment: AssessmentDetailRecord) {
  return single(getProject(assessment)?.organisations);
}

export function formatWorkspaceDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

export function formatWorkspaceDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function getLifecycleState(status: AssessmentStatus) {
  return lifecycleStates.find((state) => state.status === status) ?? lifecycleStates[0];
}

export function getLifecycleIndex(status: AssessmentStatus) {
  return Math.max(0, lifecycleStates.findIndex((state) => state.status === status));
}

export function getLifecycleProgress(status: AssessmentStatus) {
  const activeIndex = getLifecycleIndex(status);
  const deliveredIndex = lifecycleStates.findIndex((state) => state.status === "delivered");
  return Math.round((Math.min(activeIndex, deliveredIndex) / deliveredIndex) * 100);
}

export function getLifecycleDueDate(assessment: AssessmentDetailRecord) {
  if (assessment.sla_due_at) {
    return assessment.sla_due_at;
  }

  const lifecycle = getLifecycleState(assessment.status);

  if (lifecycle.slaDays === 0) {
    return null;
  }

  const anchor = new Date(assessment.updated_at || assessment.created_at);
  anchor.setDate(anchor.getDate() + lifecycle.slaDays);
  return anchor.toISOString();
}

export function lifecycleTone(status: AssessmentStatus): StatusTone {
  if (status === "delivered") {
    return "success";
  }

  if (status === "intake_incomplete" || status === "in_expert_review") {
    return "warning";
  }

  if (status === "archived") {
    return "neutral";
  }

  return "info";
}

export function getLifecycleFacts(assessment: AssessmentDetailRecord) {
  const lifecycle = getLifecycleState(assessment.status);
  const dueDate = getLifecycleDueDate(assessment);

  return {
    customerLabel: lifecycle.customerLabel,
    description: lifecycle.description,
    dueDate,
    owner: assessment.owner_id ? "Assigned team member" : lifecycle.owner,
    progress: getLifecycleProgress(assessment.status),
    slaLabel: dueDate ? formatWorkspaceDate(dueDate) : "No active SLA",
  };
}

export function buildDuplicateSignals(
  assessment: AssessmentDetailRecord,
  candidates: AssessmentDetailRecord[],
): DuplicateAssessmentSignal[] {
  const site = getSite(assessment);
  const organisation = getOrganisation(assessment);
  const siteName = site?.site_name.trim().toLowerCase();
  const address = site?.address?.trim().toLowerCase();
  const organisationName = organisation?.name.trim().toLowerCase();

  return candidates
    .filter((candidate) => candidate.id !== assessment.id)
    .map((candidate) => {
      const candidateSite = getSite(candidate);
      const candidateOrganisation = getOrganisation(candidate);
      const reasons = [
        siteName && candidateSite?.site_name.trim().toLowerCase() === siteName ? "same site name" : "",
        address && candidateSite?.address?.trim().toLowerCase() === address ? "same address" : "",
        organisationName && candidateOrganisation?.name.trim().toLowerCase() === organisationName ? "same customer" : "",
        assessment.target_load_mw &&
        candidate.target_load_mw &&
        Math.abs(Number(assessment.target_load_mw) - Number(candidate.target_load_mw)) <= 5
          ? "similar load"
          : "",
      ].filter(Boolean);

      if (reasons.length === 0) {
        return null;
      }

      return {
        id: candidate.id,
        label: candidate.assessment_name,
        reason: reasons.join(", "),
        status: candidate.status,
      };
    })
    .filter((signal): signal is DuplicateAssessmentSignal => Boolean(signal))
    .slice(0, 5);
}

export function buildWorkspaceData(
  data: Omit<AssessmentWorkspaceData, "evidenceReadiness" | "scoreSummary" | "duplicateSignals"> & {
    duplicateSignals?: DuplicateAssessmentSignal[];
  },
): AssessmentWorkspaceData {
  return {
    ...data,
    duplicateSignals: data.duplicateSignals ?? [],
    evidenceReadiness: calculateEvidenceReadiness(data.evidenceSources, data.findings, data.evidenceLinks),
    scoreSummary: calculateScorecardSummary(data.scores),
  };
}

export type SmartSignal = {
  body: string;
  confidence: "High" | "Medium" | "Low";
  label: string;
  tone: StatusTone;
};

export function buildSmartSignals(data: AssessmentWorkspaceData): SmartSignal[] {
  const { assessment, duplicateSignals, evidenceReadiness, findings, gridAssets, reportExport, reportSections, scores, verdict } = data;
  const site = getSite(assessment);
  const project = getProject(assessment);
  const scoreSummary = calculateScorecardSummary(scores);
  const criticalFindings = countCriticalFindings(findings);
  const evidenceGaps = countEvidenceGaps(evidenceReadiness);
  const gates = calculateDeliveryGates({
    criticalFindingCount: criticalFindings,
    evidenceReadiness,
    expertReview: data.expertReview,
    expertReviewRequired: detectExpertReviewTriggers({
      assessment,
      findings,
      projectType: project?.project_type,
      rideThroughUnknown: false,
      scores,
    }).required,
    scoreSummary,
    verdict,
  });

  const signals: Array<SmartSignal | null> = [
    duplicateSignals.length > 0
      ? {
          body: `${duplicateSignals.length} similar assessment${duplicateSignals.length === 1 ? "" : "s"} found. Review before creating new work.`,
          confidence: "High" as const,
          label: "Possible duplicate",
          tone: "warning" as const,
        }
      : null,
    !hasValidCoordinatePair(site?.latitude, site?.longitude)
      ? {
          body: "Coordinates are missing. Use address lookup or add latitude/longitude before relying on map/grid proximity.",
          confidence: "High" as const,
          label: "Location confidence gap",
          tone: "warning" as const,
        }
      : null,
    !assessment.known_utility || !assessment.known_tsp
      ? {
          body: `State/county context suggests utility and TSP can be inferred from address or service-territory evidence. Current market is ${assessment.market_region || "unknown"}.`,
          confidence: assessment.market_region === "ERCOT" || site?.state === "TX" ? "Medium" as const : "Low" as const,
          label: "Utility/TSP suggestion",
          tone: "info" as const,
        }
      : null,
    gridAssets.some((asset) => asset.is_candidate_poi)
      ? {
          body: "Candidate POI assets are already marked. Promote the strongest POI into findings or report evidence.",
          confidence: "Medium" as const,
          label: "Candidate POI available",
          tone: "success" as const,
        }
      : null,
    evidenceGaps > 0
      ? {
          body: `${evidenceGaps} evidence or assumption gap${evidenceGaps === 1 ? "" : "s"} should be resolved before final review.`,
          confidence: "High" as const,
          label: "Evidence gap",
          tone: "danger" as const,
        }
      : null,
    scoreSummary.completedModules < scoreSummary.totalModules
      ? {
          body: `${scoreSummary.totalModules - scoreSummary.completedModules} score module${scoreSummary.totalModules - scoreSummary.completedModules === 1 ? "" : "s"} still need analyst scoring.`,
          confidence: "High" as const,
          label: "Scorecard incomplete",
          tone: "warning" as const,
        }
      : null,
    verdict && deliveryGatesAreComplete(gates) && reportSections.length > 0 && reportExport?.status !== "ready_for_review"
      ? {
          body: "Verdict and delivery gates look ready. Mark the report package ready for final review when sections are complete.",
          confidence: "Medium" as const,
          label: "Report readiness",
          tone: "success" as const,
        }
      : null,
  ];

  return signals.filter((signal): signal is SmartSignal => Boolean(signal));
}

export type ActivityItem = {
  body?: string;
  id: string;
  timestamp: string;
  title: string;
  tone: StatusTone;
};

export function buildActivityItems(data: AssessmentWorkspaceData): ActivityItem[] {
  const auditedSources = new Set(
    data.assessmentEvents.flatMap((event) =>
      event.source_table && event.source_record_id
        ? [`${event.source_table}:${event.source_record_id}`]
        : [],
    ),
  );
  const eventItems = data.assessmentEvents.map((event) => {
    const metadata = event.metadata ?? {};
    const fileName = typeof metadata.file_name === "string" ? metadata.file_name : null;
    const assessmentName = typeof metadata.assessment_name === "string" ? metadata.assessment_name : null;
    const title = event.event_type === "status_changed" && event.to_state
      ? `${event.from_state ? statusLabel(event.from_state as AssessmentStatus) : "Created"} -> ${statusLabel(event.to_state as AssessmentStatus)}`
      : event.event_type === "assessment_created"
        ? `Assessment created${assessmentName ? `: ${assessmentName}` : ""}`
        : event.event_type === "assignment_changed"
          ? "Assignment updated"
          : event.event_type === "note_added"
            ? `${event.visibility === "internal" ? "Internal" : "Shared"} note added`
            : event.event_type === "file_uploaded"
              ? `File uploaded${fileName ? `: ${fileName}` : ""}`
              : event.event_type.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());

    return {
      body: event.reason ?? undefined,
      id: `event-${event.id}`,
      timestamp: event.created_at,
      title,
      tone: event.event_type === "status_changed" && event.to_state
        ? lifecycleTone(event.to_state as AssessmentStatus)
        : event.event_type === "assessment_created"
          ? "success" as const
          : event.visibility === "internal"
            ? "neutral" as const
            : "info" as const,
    };
  });
  const statusItems = data.statusHistory
    .filter((item) => !auditedSources.has(`status_history:${item.id}`))
    .map((item) => ({
    body: item.reason ?? undefined,
    id: `status-${item.id}`,
    timestamp: item.changed_at ?? item.created_at ?? data.assessment.updated_at,
    title: `${item.from_status ? statusLabel(item.from_status) : "Created"} -> ${statusLabel(item.to_status)}`,
    tone: lifecycleTone(item.to_status),
  }));
  const noteItems = data.notes.filter((note) => !auditedSources.has(`assessment_notes:${note.id}`)).map((note) => ({
    body: note.body,
    id: `note-${note.id}`,
    timestamp: note.created_at,
    title: `${note.is_internal ? "Internal" : "Shared"} note added`,
    tone: note.is_internal ? "neutral" as const : "info" as const,
  }));
  const fileItems = data.files.filter((file) => !auditedSources.has(`uploaded_files:${file.id}`)).map((file) => ({
    body: file.description ?? file.storage_path ?? undefined,
    id: `file-${file.id}`,
    timestamp: file.created_at,
    title: `File referenced: ${file.file_name}`,
    tone: "neutral" as const,
  }));
  const evidenceItems = data.evidenceSources.map((source) => ({
    body: source.summary ?? undefined,
    id: `evidence-${source.id}`,
    timestamp: source.updated_at ?? source.created_at,
    title: `Evidence source: ${source.title}`,
    tone: source.confidence_level === "high" ? "success" as const : "info" as const,
  }));
  const findingItems = data.findings.map((finding) => ({
    body: finding.statement ?? undefined,
    id: `finding-${finding.id}`,
    timestamp: finding.updated_at ?? finding.created_at,
    title: `Finding: ${finding.title}`,
    tone: finding.risk_level === "critical" || finding.risk_level === "high" ? "danger" as const : "warning" as const,
  }));
  const scoreItems = data.scores.map((score) => ({
    body: score.rationale ?? undefined,
    id: `score-${score.id}`,
    timestamp: score.updated_at ?? score.created_at,
    title: `Score updated: ${scoreModuleLabel(score.module_key)} (${score.score})`,
    tone: score.score >= 75 ? "success" as const : score.score >= 60 ? "info" as const : "warning" as const,
  }));
  const verdictItems = data.verdict
    ? [
        {
          body: data.verdict.summary ?? undefined,
          id: `verdict-${data.verdict.id}`,
          timestamp: data.verdict.updated_at ?? data.verdict.created_at,
          title: `Verdict saved: ${verdictLabel(data.verdict.verdict)}`,
          tone: data.verdict.approved_by_analyst ? "success" as const : "warning" as const,
        },
      ]
    : [];
  const reviewItems = data.expertReview
    ? [
        {
          body: data.expertReview.comments ?? data.expertReview.trigger_reason ?? undefined,
          id: `review-${data.expertReview.id}`,
          timestamp: data.expertReview.updated_at ?? data.expertReview.created_at,
          title: `Expert review: ${reviewStatusLabel(data.expertReview.status)}`,
          tone: data.expertReview.status === "approved" ? "success" as const : "warning" as const,
        },
      ]
    : [];
  const reportItems = data.reportSections.map((section) => ({
    body: section.generation_notes ?? undefined,
    id: `report-${section.id}`,
    timestamp: section.updated_at,
    title: `Report section ${reportSectionStatusLabel(section.status)}: ${section.title}`,
    tone: section.status === "final" || section.status === "ready" ? "success" as const : "info" as const,
  }));
  const exportItems = data.reportExport
    ? [
        {
          body: data.reportExport.notes ?? undefined,
          id: `export-${data.reportExport.id}`,
          timestamp: data.reportExport.updated_at,
          title: `Report package: ${reportExportStatusLabel(data.reportExport.status)}`,
          tone: data.reportExport.status === "ready_for_review" || data.reportExport.status === "exported" ? "success" as const : "info" as const,
        },
      ]
    : [];

  return [
    ...eventItems,
    ...statusItems,
    ...noteItems,
    ...fileItems,
    ...evidenceItems,
    ...findingItems,
    ...scoreItems,
    ...verdictItems,
    ...reviewItems,
    ...reportItems,
    ...exportItems,
  ].sort((first, second) => new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime());
}

export function getCustomerVisibleStatus(status: AssessmentStatus) {
  return getLifecycleState(status).customerLabel;
}

export function assessmentStatusOptionsForLifecycle() {
  return assessmentStatuses.filter((status) => status.value !== "archived");
}
