"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  FilePlus2,
  Link2,
  Loader2,
  MapPin,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Moon,
  Sun,
  UserRound,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AddressAutocompleteField } from "@/components/address-autocomplete-field";
import { type AppRole, useAuth } from "@/components/auth/auth-provider";
import { AddressSuggestion } from "@/lib/address-autocomplete";
import { SiteMapPanel } from "@/components/site-map-panel";
import {
  FieldControl,
  StatusPill,
  cx,
  inputClass,
  mutedPanelClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  successButtonClass,
  textareaClass,
  warningButtonClass,
} from "@/components/ui-primitives";
import {
  ChecklistDraft,
  ChecklistModuleGroup,
  ChecklistResponseRecord,
  ChecklistResponseStatus,
  ChecklistTemplateItemRecord,
  ChecklistTemplateRecord,
  buildChecklistDrafts,
  calculateChecklistProgress,
  checklistResponseStatuses,
  checklistStatusLabel,
  checklistStatusTone,
  createChecklistDraft,
  groupChecklistItems,
} from "@/lib/checklists";
import { buildAutomatedChecklistDrafts } from "@/lib/checklist-automation";
import {
  AssessmentFindingDraft,
  AssessmentFindingRecord,
  EvidenceSourceType,
  EvidenceReadinessSummary,
  EvidenceSourceDraft,
  EvidenceSourceRecord,
  FindingEvidenceLinkRecord,
  FindingType,
  RiskLevel,
  blankAssessmentFindingDraft,
  blankEvidenceSourceDraft,
  calculateEvidenceReadiness,
  createAssessmentFindingDraft,
  createEvidenceSourceDraft,
  evidenceConfidenceLabel,
  evidenceConfidenceLevels,
  evidenceConfidenceTone,
  evidenceForFinding,
  evidenceSourceTypeLabel,
  evidenceSourceTypes,
  findingModules,
  findingStatusLabel,
  findingStatusTone,
  findingStatuses,
  findingTypeLabel,
  findingTypes,
  hasFindingRecommendation,
  isAssumptionOnlyFinding,
  isHighRiskFinding,
  linksForFinding,
  riskLevelLabel,
  riskLevelTone,
  riskLevels,
  supportStatuses,
  validateEvidenceSourceDraft,
} from "@/lib/evidence";
import {
  GridAssetDraft,
  GridAssetRecord,
  blankGridAssetDraft,
  calculateDistanceMiles,
  externalMapUrl,
  formatDistanceMiles,
  hasValidCoordinatePair,
  parseNumericInput,
  validateCoordinateInputs,
} from "@/lib/gis";
import {
  AssessmentFormState,
  AssessmentStatus,
  assessmentStatuses,
  blankAssessmentForm,
  calculateCompletenessScore,
  curtailmentOptions,
  formatDate,
  parseOptionalNumber,
  projectTypes,
  statusLabel,
  suggestedIntakeStatus,
  organisationTypes,
  validateAssessmentForm,
} from "@/lib/intake";
import {
  FieldValidationMap,
  IntakeBlocker,
  IntakeStepId,
  IntakeStepStatus,
  IntakeWarning,
  calculateIntakeStepCompletion,
  getAllIntakeBlockers,
  getFieldValidationState,
  getIntakeWarnings,
  intakeWizardSteps,
} from "@/lib/intake-steps";
import { allowedAssessmentTransitions, transitionAssessmentStatus } from "@/lib/assessment-workflow";
import {
  AssessmentReportExportRecord,
  AssessmentPreflightRunRecord,
  AssessmentReportSectionRecord,
  ReportExportStatus,
  ReportGenerationContext,
  ReportSectionDraft,
  ReportSectionStatus,
  ReportTemplateRecord,
  ReportTemplateSectionRecord,
  buildReportSectionDrafts,
  createReportSectionDraft,
  generateReportSections,
  hasEvidenceGap,
  reportExportStatusLabel,
  reportSectionStatusLabel,
  reportSectionStatuses,
  reportStatusTone,
} from "@/lib/report-builder";
import {
  AssessmentScoreDraft,
  AssessmentScoreRecord,
  AssessmentVerdictDraft,
  AssessmentVerdictRecord,
  DeliveryGate,
  ExpertReviewDraft,
  ExpertReviewRecord,
  ExpertReviewTriggerSummary,
  ReviewStatus,
  ScoreModuleKey,
  ScorecardSummary,
  blankExpertReviewDraft,
  blankScoreDraft,
  blankVerdictDraft,
  buildScoreDrafts,
  calculateDeliveryGates,
  calculateScorecardSummary,
  countCriticalFindings,
  countEvidenceGaps,
  createExpertReviewDraft,
  createVerdictDraft,
  deliveryGateTone,
  deliveryGatesAreComplete,
  detectExpertReviewTriggers,
  parseScoreInput,
  reviewStatusLabel,
  reviewStatusTone,
  reviewStatuses,
  scoreComponents,
  scoreTone,
  validateScoreDraft,
  verdictLabel,
  verdictOptions,
} from "@/lib/scorecard";
import { saveAssessmentScores, saveAssessmentVerdict } from "@/lib/scorecard-service";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  ThemePreference,
  applyThemePreference,
  getThemePreferenceServerSnapshot,
  getThemePreferenceSnapshot,
  getStoredAssessmentPanels,
  saveAssessmentPanels,
  setThemePreference,
  subscribeThemePreference,
} from "@/lib/ui-preferences";
import { trackWorkflowEvent } from "@/lib/workflow-analytics";

type OrganisationRecord = {
  id: string;
  name: string;
  organisation_type: string;
};

type ContactRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
};

type ProjectRecord = {
  id: string;
  organisation_id: string;
  name: string;
  project_type: string;
  status: string;
  lead_contact_id: string | null;
  deadline: string | null;
  description: string | null;
  organisations?: OrganisationRecord | OrganisationRecord[] | null;
};

type SiteRecord = {
  id: string;
  site_name: string;
  address: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  parcel_id: string | null;
};

type AssessmentRecord = {
  id: string;
  project_id: string;
  site_id: string;
  assessment_name: string;
  market_region: string;
  status: AssessmentStatus;
  target_load_mw: number | null;
  initial_load_mw: number | null;
  full_buildout_load_mw: number | null;
  desired_energization_date: string | null;
  project_stage: string | null;
  land_control_status: string | null;
  known_utility: string | null;
  known_tsp: string | null;
  known_substation_or_poi: string | null;
  existing_studies_summary: string | null;
  existing_power_quote_summary: string | null;
  backup_generation_assumptions: string | null;
  battery_storage_assumptions: string | null;
  curtailment_willingness: string | null;
  workload_flexibility_assumptions: string | null;
  water_cooling_notes: string | null;
  confidentiality_status: string;
  intake_completeness_score: number;
  created_at: string;
  updated_at: string;
};

type AssessmentListRow = AssessmentRecord & {
  sites?: SiteRecord | SiteRecord[] | null;
  projects?: ProjectRecord | ProjectRecord[] | null;
};

type AssessmentDetail = AssessmentRecord & {
  sites?: SiteRecord | SiteRecord[] | null;
  projects?: ProjectRecord | ProjectRecord[] | null;
  contact?: ContactRecord | null;
};

type NoteRecord = {
  id: string;
  note_type: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};

type FileRecord = {
  id: string;
  file_name: string;
  document_category: string | null;
  storage_path: string | null;
  description: string | null;
  created_at: string;
};

type Mode = "dashboard" | "form" | "detail";
type FormMode = "create" | "edit";
type ToastTone = "success" | "warning" | "error" | "info";
type AssessmentSectionId =
  | "map"
  | "checklist"
  | "evidence"
  | "findings"
  | "scorecard"
  | "verdict"
  | "delivery_gates"
  | "report_builder"
  | "notes_files";

type AssessmentMetric = {
  label: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
  value: string;
};

type AssessmentNextAction = {
  label: string;
  sectionId: AssessmentSectionId;
  tone: "neutral" | "ok" | "warn" | "danger";
};

type DashboardSortOption = "completeness_asc" | "energization_asc" | "target_load_desc" | "updated_desc";

type DashboardStats = {
  evidenceGaps: number;
  inReview: number;
  needsIntake: number;
  reportsDrafting: number;
  total: number;
};

type ReportSectionFilterId = ReportSectionStatus | "evidence_gaps";

type ToastMessage = {
  body?: string;
  id: string;
  title: string;
  tone: ToastTone;
};

const assessmentQuickLinks: Array<{ id: "overview" | AssessmentSectionId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "map", label: "Map" },
  { id: "checklist", label: "Checklist" },
  { id: "evidence", label: "Evidence" },
  { id: "findings", label: "Findings" },
  { id: "scorecard", label: "Scorecard" },
  { id: "verdict", label: "Verdict" },
  { id: "delivery_gates", label: "Delivery Gates" },
  { id: "report_builder", label: "Report Builder" },
  { id: "notes_files", label: "Notes & Files" },
];

const assessmentPanelSectionIds: AssessmentSectionId[] = [
  "map",
  "checklist",
  "evidence",
  "findings",
  "scorecard",
  "verdict",
  "delivery_gates",
  "report_builder",
  "notes_files",
];

const dashboardStatusOptions = assessmentStatuses.filter((status) => status.value !== "archived");

const dashboardSortOptions: Array<{ label: string; value: DashboardSortOption }> = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "completeness_asc", label: "Completeness low to high" },
  { value: "target_load_desc", label: "Target load high to low" },
  { value: "energization_asc", label: "Energization date soonest" },
];

const reportSectionFilterOptions: Array<{ label: string; value: ReportSectionFilterId }> = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready for review" },
  { value: "needs_review", label: "Needs edits" },
  { value: "final", label: "Approved" },
  { value: "evidence_gaps", label: "Evidence gaps" },
];

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function valueOrEmpty(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

const cardClass = panelClass;
const subtleCardClass = mutedPanelClass;

function getErrorMessage(error: unknown, fallback = "Could not save assessment.") {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const supabaseError = error as {
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      message?: unknown;
    };
    const parts = [supabaseError.message, supabaseError.details, supabaseError.hint, supabaseError.code]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return fallback;
}

function normaliseOptionValue(
  value: string,
  options: ReadonlyArray<{ value: string; label: string }>,
  fallback: string,
) {
  const trimmed = value.trim();

  if (options.some((option) => option.value === trimmed)) {
    return trimmed;
  }

  const matchingLabel = options.find((option) => option.label.toLowerCase() === trimmed.toLowerCase());

  return matchingLabel?.value ?? fallback;
}

function noteTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

function noteEvidenceSourceType(noteType: string): EvidenceSourceType {
  return noteType === "customer_claim" ? "customer_provided" : "analyst_assumption";
}

function noteFindingType(noteType: string): FindingType {
  if (noteType === "risk_flag") {
    return "risk";
  }

  if (noteType === "assumption") {
    return "assumption";
  }

  return "finding";
}

function noteRiskLevel(noteType: string): RiskLevel {
  return noteType === "risk_flag" ? "medium" : "unknown";
}

function noteEvidenceTitle(note: NoteRecord) {
  return `${noteTypeLabel(note.note_type)} - ${new Date(note.created_at).toLocaleDateString()}`;
}

function noteFindingTitle(note: NoteRecord) {
  const firstSentence = note.body.trim().split(/[.!?]\s/)[0]?.trim() || note.body.trim();
  const fallback = noteEvidenceTitle(note);
  const title = firstSentence || fallback;

  return title.length > 72 ? `${title.slice(0, 69).trim()}...` : title;
}

function isBlankEvidenceSourceDraft(draft: EvidenceSourceDraft) {
  return (
    !draft.title.trim() &&
    !draft.summary.trim() &&
    !draft.fileReference.trim() &&
    !draft.url.trim() &&
    !draft.publisher.trim() &&
    !draft.licenseNotes.trim() &&
    !draft.limitationNotes.trim() &&
    !draft.notes.trim()
  );
}

function isBlankFindingDraft(draft: AssessmentFindingDraft) {
  return (
    !draft.title.trim() &&
    !draft.statement.trim() &&
    !draft.assumptionNote.trim() &&
    !draft.recommendation.trim() &&
    draft.linkedEvidenceSourceIds.length === 0
  );
}

function reportExportDisplayStatus(reportExport: AssessmentReportExportRecord | null) {
  return reportExport?.status ?? "not_started";
}

function getAssessmentNextAction({
  assessment,
  checklistProgress,
  deliveryGates,
  evidenceReadiness,
  reportExport,
  scoreSummary,
  verdict,
}: {
  assessment: AssessmentDetail;
  checklistProgress: ReturnType<typeof calculateChecklistProgress>;
  deliveryGates: DeliveryGate[];
  evidenceReadiness: EvidenceReadinessSummary;
  reportExport: AssessmentReportExportRecord | null;
  scoreSummary: ScorecardSummary;
  verdict: AssessmentVerdictRecord | null;
}): AssessmentNextAction {
  if (assessment.intake_completeness_score < 100) {
    return {
      label: "Complete intake details",
      sectionId: "map",
      tone: "warn",
    };
  }

  if (
    checklistProgress.requiredItems > 0 &&
    checklistProgress.requiredAnsweredItems < checklistProgress.requiredItems
  ) {
    return {
      label: "Finish required checklist",
      sectionId: "checklist",
      tone: "warn",
    };
  }

  if (evidenceReadiness.highRiskFindingsWithoutEvidence > 0) {
    return {
      label: "Resolve high-risk evidence gaps",
      sectionId: "findings",
      tone: "danger",
    };
  }

  if (scoreSummary.completedModules < scoreSummary.totalModules) {
    return {
      label: "Complete scorecard",
      sectionId: "scorecard",
      tone: "warn",
    };
  }

  if (!verdict) {
    return {
      label: "Save final verdict",
      sectionId: "verdict",
      tone: "warn",
    };
  }

  if (!deliveryGatesAreComplete(deliveryGates)) {
    return {
      label: "Clear delivery gates",
      sectionId: "delivery_gates",
      tone: "warn",
    };
  }

  if (reportExportDisplayStatus(reportExport) !== "ready_for_review" && reportExportDisplayStatus(reportExport) !== "exported") {
    return {
      label: "Prepare report package",
      sectionId: "report_builder",
      tone: "neutral",
    };
  }

  return {
    label: "Ready for review or delivery",
    sectionId: "report_builder",
    tone: "ok",
  };
}

function getInitialExpandedPanels({
  assessment,
  checklistProgress,
  deliveryGates,
  evidenceReadiness,
  reportExport,
  scoreSummary,
}: {
  assessment: AssessmentDetail;
  checklistProgress: ReturnType<typeof calculateChecklistProgress>;
  deliveryGates: DeliveryGate[];
  evidenceReadiness: EvidenceReadinessSummary;
  reportExport: AssessmentReportExportRecord | null;
  scoreSummary: ScorecardSummary;
}) {
  const site = single(assessment.sites);
  const expanded = new Set<AssessmentSectionId>();

  if (!hasValidCoordinatePair(site?.latitude, site?.longitude)) {
    expanded.add("map");
  }

  if (
    checklistProgress.requiredItems > 0 &&
    checklistProgress.requiredAnsweredItems < checklistProgress.requiredItems
  ) {
    expanded.add("checklist");
  }

  if (evidenceReadiness.highRiskFindingsWithoutEvidence > 0) {
    expanded.add("evidence");
    expanded.add("findings");
  }

  if (scoreSummary.completedModules < scoreSummary.totalModules) {
    expanded.add("scorecard");
  }

  if (!deliveryGatesAreComplete(deliveryGates)) {
    expanded.add("delivery_gates");
  }

  if (["draft_generated", "analyst_edited", "ready_for_review"].includes(reportExportDisplayStatus(reportExport))) {
    expanded.add("report_builder");
  }

  return expanded;
}

function isChecklistGroupComplete(group: ChecklistModuleGroup) {
  if (group.requiredItems > 0) {
    return group.requiredAnsweredItems >= group.requiredItems;
  }

  return group.answeredItems >= group.totalItems;
}

function getChecklistStatusCounts(group: ChecklistModuleGroup) {
  return group.items.reduce<Record<ChecklistResponseStatus, number>>(
    (counts, item) => ({
      ...counts,
      [item.draft.status]: counts[item.draft.status] + 1,
    }),
    {
      blocked: 0,
      not_applicable: 0,
      not_started: 0,
      pass: 0,
      risk: 0,
    },
  );
}

function metricToneClass(tone: AssessmentMetric["tone"]) {
  const styles = {
    danger: "border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    neutral: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]",
    ok: "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
    warn: "border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  };

  return styles[tone ?? "neutral"];
}

function dashboardAssessmentSearchText(assessment: AssessmentListRow) {
  const site = single(assessment.sites);
  const project = single(assessment.projects);
  const organisation = single(project?.organisations);

  return [
    assessment.assessment_name,
    assessment.market_region,
    assessment.status,
    assessment.known_utility,
    assessment.known_tsp,
    site?.site_name,
    site?.address,
    site?.city,
    site?.county,
    site?.state,
    project?.name,
    organisation?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortDateValue(value: string | null | undefined, missingValue: number) {
  if (!value) {
    return missingValue;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? missingValue : timestamp;
}

function getDashboardNextAction(assessment: AssessmentListRow, evidenceGapAssessmentIds: Set<string>) {
  if (assessment.intake_completeness_score < 100 || assessment.status === "draft" || assessment.status === "intake_incomplete") {
    return { label: "Complete intake", tone: "warning" as const };
  }

  if (evidenceGapAssessmentIds.has(assessment.id)) {
    return { label: "Resolve evidence gaps", tone: "danger" as const };
  }

  if (assessment.status === "intake_complete" || assessment.status === "in_analyst_review") {
    return { label: "Analyst review", tone: "info" as const };
  }

  if (assessment.status === "in_expert_review") {
    return { label: "Expert review", tone: "warning" as const };
  }

  if (assessment.status === "report_drafting") {
    return { label: "Draft report", tone: "brand" as const };
  }

  if (assessment.status === "final_review") {
    return { label: "Final review", tone: "info" as const };
  }

  if (assessment.status === "delivered") {
    return { label: "Delivered", tone: "success" as const };
  }

  return { label: "Open assessment", tone: "neutral" as const };
}

export function IntakeWorkspace() {
  const { role: appRole } = useAuth();
  const [mode, setMode] = useState<Mode>("dashboard");
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [assessments, setAssessments] = useState<AssessmentListRow[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentDetail | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [gridAssets, setGridAssets] = useState<GridAssetRecord[]>([]);
  const [evidenceSources, setEvidenceSources] = useState<EvidenceSourceRecord[]>([]);
  const [assessmentFindings, setAssessmentFindings] = useState<AssessmentFindingRecord[]>([]);
  const [findingEvidenceLinks, setFindingEvidenceLinks] = useState<FindingEvidenceLinkRecord[]>([]);
  const [assessmentScores, setAssessmentScores] = useState<AssessmentScoreRecord[]>([]);
  const [scoreDrafts, setScoreDrafts] = useState<Record<ScoreModuleKey, AssessmentScoreDraft>>(
    buildScoreDrafts([]),
  );
  const [assessmentVerdict, setAssessmentVerdict] = useState<AssessmentVerdictRecord | null>(null);
  const [verdictDraft, setVerdictDraft] = useState<AssessmentVerdictDraft>(blankVerdictDraft);
  const [expertReview, setExpertReview] = useState<ExpertReviewRecord | null>(null);
  const [expertReviewDraft, setExpertReviewDraft] = useState<ExpertReviewDraft>(blankExpertReviewDraft);
  const [reportTemplate, setReportTemplate] = useState<ReportTemplateRecord | null>(null);
  const [reportTemplateSections, setReportTemplateSections] = useState<ReportTemplateSectionRecord[]>([]);
  const [assessmentReportSections, setAssessmentReportSections] = useState<AssessmentReportSectionRecord[]>([]);
  const [reportSectionDrafts, setReportSectionDrafts] = useState<Record<string, ReportSectionDraft>>({});
  const [reportExport, setReportExport] = useState<AssessmentReportExportRecord | null>(null);
  const [checklistTemplate, setChecklistTemplate] = useState<ChecklistTemplateRecord | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistTemplateItemRecord[]>([]);
  const [checklistDrafts, setChecklistDrafts] = useState<Record<string, ChecklistDraft>>({});
  const [form, setForm] = useState<AssessmentFormState>(blankAssessmentForm);
  const [newGridAsset, setNewGridAsset] = useState<GridAssetDraft>(blankGridAssetDraft);
  const [recentlySavedGridAssetId, setRecentlySavedGridAssetId] = useState("");
  const [newEvidenceSource, setNewEvidenceSource] = useState<EvidenceSourceDraft>(blankEvidenceSourceDraft);
  const [newFinding, setNewFinding] = useState<AssessmentFindingDraft>(blankAssessmentFindingDraft);
  const [editingEvidenceSourceId, setEditingEvidenceSourceId] = useState("");
  const [editingFindingId, setEditingFindingId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dashboardSort, setDashboardSort] = useState<DashboardSortOption>("updated_desc");
  const [dashboardStatusFilters, setDashboardStatusFilters] = useState<Set<AssessmentStatus>>(new Set());
  const [dashboardEvidenceGapAssessmentIds, setDashboardEvidenceGapAssessmentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [savingGridAsset, setSavingGridAsset] = useState(false);
  const [savingEvidenceSource, setSavingEvidenceSource] = useState(false);
  const [savingFinding, setSavingFinding] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [reportBuilderLoading, setReportBuilderLoading] = useState(false);
  const [savingScorecard, setSavingScorecard] = useState(false);
  const [savingVerdict, setSavingVerdict] = useState(false);
  const [savingExpertReview, setSavingExpertReview] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [savingReportExport, setSavingReportExport] = useState(false);
  const [savingReportSectionId, setSavingReportSectionId] = useState("");
  const [savingChecklistItemId, setSavingChecklistItemId] = useState("");
  const [error, setError] = useState("");
  const [gridAssetError, setGridAssetError] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const [scorecardError, setScorecardError] = useState("");
  const [reportBuilderError, setReportBuilderError] = useState("");
  const [checklistError, setChecklistError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newNoteType, setNewNoteType] = useState("analyst_note");
  const [newFile, setNewFile] = useState({
    fileName: "",
    documentCategory: "other",
    storagePath: "",
    description: "",
  });
  const [pendingStatus, setPendingStatus] = useState<AssessmentStatus>("draft");
  const theme = useSyncExternalStore(
    subscribeThemePreference,
    getThemePreferenceSnapshot,
    getThemePreferenceServerSnapshot,
  );

  const completenessScore = useMemo(() => calculateCompletenessScore(form), [form]);
  const recommendedStatus = useMemo(() => suggestedIntakeStatus(form), [form]);
  const checklistGroups = useMemo(() => groupChecklistItems(checklistItems, checklistDrafts), [checklistItems, checklistDrafts]);
  const checklistProgress = useMemo(() => calculateChecklistProgress(checklistGroups), [checklistGroups]);
  const checklistReportSummary = useMemo(
    () => ({
      answeredItems: checklistProgress.answeredItems,
      blockedItems: checklistGroups.reduce(
        (count, group) => count + group.items.filter((item) => item.draft.status === "blocked").length,
        0,
      ),
      riskItems: checklistGroups.reduce(
        (count, group) => count + group.items.filter((item) => item.draft.status === "risk").length,
        0,
      ),
      totalItems: checklistProgress.totalItems,
    }),
    [checklistGroups, checklistProgress],
  );
  const evidenceReadiness = useMemo(
    () => calculateEvidenceReadiness(evidenceSources, assessmentFindings, findingEvidenceLinks),
    [assessmentFindings, evidenceSources, findingEvidenceLinks],
  );
  const scoreSummary = useMemo(() => calculateScorecardSummary(assessmentScores), [assessmentScores]);
  const criticalFindingCount = useMemo(() => countCriticalFindings(assessmentFindings), [assessmentFindings]);
  const evidenceGapCount = useMemo(() => countEvidenceGaps(evidenceReadiness), [evidenceReadiness]);
  const rideThroughUnknown = useMemo(() => {
    const rideThroughItem = checklistItems.find((item) => item.item_key === "ride_through_assumptions");

    if (!rideThroughItem) {
      return false;
    }

    const draft = checklistDrafts[rideThroughItem.id];

    return !draft || draft.status === "not_started" || draft.status === "risk" || draft.status === "blocked";
  }, [checklistDrafts, checklistItems]);
  const expertReviewTriggers = useMemo<ExpertReviewTriggerSummary>(() => {
    if (!selectedAssessment) {
      return { activeTriggers: [], reasonText: "", required: false };
    }

    const project = single(selectedAssessment.projects);

    return detectExpertReviewTriggers({
      assessment: selectedAssessment,
      findings: assessmentFindings,
      projectType: project?.project_type,
      rideThroughUnknown,
      scores: assessmentScores,
    });
  }, [assessmentFindings, assessmentScores, rideThroughUnknown, selectedAssessment]);

  function showToast(toast: Omit<ToastMessage, "id">) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { ...toast, id }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4800);
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((item) => item.id !== id));
  }

  useEffect(() => {
    applyThemePreference(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme: ThemePreference = theme === "dark" ? "light" : "dark";
    setThemePreference(nextTheme);
  }

  const deliveryGates = useMemo(
    () =>
      calculateDeliveryGates({
        criticalFindingCount,
        evidenceReadiness,
        expertReview,
        expertReviewRequired: expertReviewTriggers.required,
        scoreSummary,
        verdict: assessmentVerdict,
      }),
    [assessmentVerdict, criticalFindingCount, evidenceReadiness, expertReview, expertReviewTriggers.required, scoreSummary],
  );

  const filteredAssessments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = assessments.filter((assessment) => {
      const matchesStatus = dashboardStatusFilters.size === 0 || dashboardStatusFilters.has(assessment.status);
      const matchesSearch = !query || dashboardAssessmentSearchText(assessment).includes(query);

      return matchesStatus && matchesSearch;
    });

    return [...filtered].sort((first, second) => {
      if (dashboardSort === "completeness_asc") {
        return first.intake_completeness_score - second.intake_completeness_score;
      }

      if (dashboardSort === "target_load_desc") {
        return Number(second.target_load_mw ?? 0) - Number(first.target_load_mw ?? 0);
      }

      if (dashboardSort === "energization_asc") {
        return (
          sortDateValue(first.desired_energization_date, Number.POSITIVE_INFINITY) -
          sortDateValue(second.desired_energization_date, Number.POSITIVE_INFINITY)
        );
      }

      return sortDateValue(second.updated_at, 0) - sortDateValue(first.updated_at, 0);
    });
  }, [assessments, dashboardSort, dashboardStatusFilters, searchTerm]);

  const stats = useMemo(() => {
    const total = assessments.length;
    const needsIntake = assessments.filter(
      (assessment) =>
        assessment.intake_completeness_score < 100 ||
        assessment.status === "draft" ||
        assessment.status === "intake_incomplete",
    ).length;
    const inReview = assessments.filter((assessment) =>
      ["in_analyst_review", "in_expert_review", "final_review"].includes(assessment.status),
    ).length;
    const reportsDrafting = assessments.filter((assessment) => assessment.status === "report_drafting").length;

    return {
      evidenceGaps: dashboardEvidenceGapAssessmentIds.size,
      inReview,
      needsIntake,
      reportsDrafting,
      total,
    };
  }, [assessments, dashboardEvidenceGapAssessmentIds]);

  function toggleDashboardStatusFilter(status: AssessmentStatus) {
    setDashboardStatusFilters((current) => {
      const next = new Set(current);

      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }

      return next;
    });
  }

  const loadDashboardEvidenceGaps = useCallback(async (rows: AssessmentListRow[]) => {
    if (!supabase || rows.length === 0) {
      setDashboardEvidenceGapAssessmentIds(new Set());
      return;
    }

    try {
      const assessmentIds = rows.map((assessment) => assessment.id);
      const { data: findingData, error: findingError } = await supabase
        .from("assessment_findings")
        .select("id, site_assessment_id, risk_level")
        .in("site_assessment_id", assessmentIds)
        .in("risk_level", ["critical", "high"]);

      if (findingError) {
        throw findingError;
      }

      const findings = (findingData ?? []) as Array<{ id: string; site_assessment_id: string; risk_level: RiskLevel }>;
      const findingIds = findings.map((finding) => finding.id);

      if (findingIds.length === 0) {
        setDashboardEvidenceGapAssessmentIds(new Set());
        return;
      }

      const { data: linkData, error: linkError } = await supabase
        .from("finding_evidence_links")
        .select("finding_id")
        .in("finding_id", findingIds);

      if (linkError) {
        throw linkError;
      }

      const linkedFindingIds = new Set((linkData ?? []).map((link) => link.finding_id as string));
      setDashboardEvidenceGapAssessmentIds(
        new Set(findings.filter((finding) => !linkedFindingIds.has(finding.id)).map((finding) => finding.site_assessment_id)),
      );
    } catch {
      setDashboardEvidenceGapAssessmentIds(new Set());
    }
  }, []);

  const loadAssessments = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("site_assessments")
      .select(
        `
        *,
        sites (*),
        projects (
          id,
          organisation_id,
          name,
          project_type,
          status,
          lead_contact_id,
          deadline,
          description,
          organisations (*)
        )
      `,
      )
      .order("created_at", { ascending: false });

    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    const loadedAssessments = (data ?? []) as AssessmentListRow[];
    setAssessments(loadedAssessments);
    void loadDashboardEvidenceGaps(loadedAssessments);
  }, [loadDashboardEvidenceGaps]);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadAssessments();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAssessments]);

  async function loadDetail(assessmentId: string) {
    if (!supabase) {
      return;
    }

    setLoading(true);
    setError("");
    resetChecklistState();
    resetGisState();
    resetEvidenceState();
    resetScorecardState();
    resetReportBuilderState();

    const { data, error: detailError } = await supabase
      .from("site_assessments")
      .select(
        `
        *,
        sites (*),
        projects (
          *,
          organisations (*)
        )
      `,
      )
      .eq("id", assessmentId)
      .single();

    if (detailError) {
      setLoading(false);
      setError(detailError.message);
      return;
    }

    const assessment = data as AssessmentDetail;
    const project = single(assessment.projects);
    let contact: ContactRecord | null = null;

    if (project?.lead_contact_id) {
      const { data: contactData } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", project.lead_contact_id)
        .single();

      contact = (contactData as ContactRecord | null) ?? null;
    }

    const [
      { data: noteData, error: noteError },
      { data: fileData, error: fileError },
      { data: gridAssetData, error: gridAssetLoadError },
    ] = await Promise.all([
      supabase
        .from("assessment_notes")
        .select("id, note_type, body, is_internal, created_at")
        .eq("site_assessment_id", assessmentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("uploaded_files")
        .select("id, file_name, document_category, storage_path, description, created_at")
        .eq("site_assessment_id", assessmentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("assessment_grid_assets")
        .select(
          "id, site_assessment_id, site_id, asset_name, asset_type, latitude, longitude, voltage_kv, owner_operator, source, confidence_level, is_candidate_poi, rationale, analyst_notes, distance_miles, created_at, updated_at",
        )
        .eq("site_assessment_id", assessmentId)
        .order("distance_miles", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);

    setLoading(false);

    if (noteError || fileError) {
      setError(noteError?.message ?? fileError?.message ?? "");
      return;
    }

    setSelectedAssessment({ ...assessment, contact });
    setNotes((noteData ?? []) as NoteRecord[]);
    setFiles((fileData ?? []) as FileRecord[]);
    if (gridAssetLoadError) {
      setGridAssets([]);
      setGridAssetError(
        `${getErrorMessage(
          gridAssetLoadError,
          "Could not load GIS assets.",
        )} Apply the GIS assets SQL, then refresh.`,
      );
    } else {
      setGridAssets((gridAssetData ?? []) as GridAssetRecord[]);
    }
    setPendingStatus(assessment.status);
    setMode("detail");
    await loadEvidenceForAssessment(assessment.id);
    await loadScorecardForAssessment(assessment.id);
    await loadChecklistForAssessment(assessment.id, assessment.market_region);
    await loadReportBuilderForAssessment(assessment.id, assessment.market_region);
  }

  function resetChecklistState() {
    setChecklistTemplate(null);
    setChecklistItems([]);
    setChecklistDrafts({});
    setChecklistError("");
    setChecklistLoading(false);
    setSavingChecklistItemId("");
  }

  function resetGisState() {
    setGridAssets([]);
    setNewGridAsset(blankGridAssetDraft);
    setGridAssetError("");
    setSavingGridAsset(false);
  }

  function resetEvidenceState() {
    setEvidenceSources([]);
    setAssessmentFindings([]);
    setFindingEvidenceLinks([]);
    setNewEvidenceSource({ ...blankEvidenceSourceDraft });
    setNewFinding({ ...blankAssessmentFindingDraft, linkedEvidenceSourceIds: [] });
    setEditingEvidenceSourceId("");
    setEditingFindingId("");
    setEvidenceError("");
    setEvidenceLoading(false);
    setSavingEvidenceSource(false);
    setSavingFinding(false);
  }

  function resetScorecardState() {
    setAssessmentScores([]);
    setScoreDrafts(buildScoreDrafts([]));
    setAssessmentVerdict(null);
    setVerdictDraft({ ...blankVerdictDraft });
    setExpertReview(null);
    setExpertReviewDraft({ ...blankExpertReviewDraft });
    setScorecardError("");
    setScorecardLoading(false);
    setSavingScorecard(false);
    setSavingVerdict(false);
    setSavingExpertReview(false);
  }

  function resetReportBuilderState() {
    setReportTemplate(null);
    setReportTemplateSections([]);
    setAssessmentReportSections([]);
    setReportSectionDrafts({});
    setReportExport(null);
    setReportBuilderError("");
    setReportBuilderLoading(false);
    setGeneratingReport(false);
    setSavingReportExport(false);
    setSavingReportSectionId("");
  }

  async function loadReportBuilderForAssessment(assessmentId: string, marketRegion: string) {
    if (!supabase) {
      return;
    }

    setReportBuilderLoading(true);
    setReportBuilderError("");

    try {
      const { data: marketTemplateData, error: marketTemplateError } = await supabase
        .from("report_templates")
        .select("id, name, market_region, version, report_type, is_active")
        .eq("is_active", true)
        .eq("report_type", "single_site")
        .eq("market_region", marketRegion || "ERCOT")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (marketTemplateError) {
        throw marketTemplateError;
      }

      let template = marketTemplateData as ReportTemplateRecord | null;

      if (!template && marketRegion !== "ERCOT") {
        const { data: fallbackTemplateData, error: fallbackTemplateError } = await supabase
          .from("report_templates")
          .select("id, name, market_region, version, report_type, is_active")
          .eq("is_active", true)
          .eq("report_type", "single_site")
          .eq("market_region", "ERCOT")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackTemplateError) {
          throw fallbackTemplateError;
        }

        template = fallbackTemplateData as ReportTemplateRecord | null;
      }

      if (!template) {
        setReportTemplate(null);
        setReportTemplateSections([]);
        setAssessmentReportSections([]);
        setReportSectionDrafts({});
        setReportExport(null);
        setReportBuilderError("No active report template found. Apply the report builder SQL, then refresh.");
        return;
      }

      const [
        { data: sectionTemplateData, error: sectionTemplateError },
        { data: savedSectionData, error: savedSectionError },
        { data: exportData, error: exportError },
      ] = await Promise.all([
        supabase
          .from("report_template_sections")
          .select("id, template_id, section_key, title, sort_order, is_required, default_guidance")
          .eq("template_id", template.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("assessment_report_sections")
          .select("id, site_assessment_id, template_section_id, section_key, title, content, status, is_edited, generated_at, generation_notes, updated_at")
          .eq("site_assessment_id", assessmentId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("assessment_report_exports")
          .select("id, site_assessment_id, template_id, export_type, status, notes, ready_for_review_at, updated_at")
          .eq("site_assessment_id", assessmentId)
          .eq("template_id", template.id)
          .eq("export_type", "print_preview")
          .maybeSingle(),
      ]);

      if (sectionTemplateError || savedSectionError || exportError) {
        throw sectionTemplateError ?? savedSectionError ?? exportError;
      }

      const templateSections = (sectionTemplateData ?? []) as ReportTemplateSectionRecord[];
      const savedSections = (savedSectionData ?? []) as AssessmentReportSectionRecord[];
      const savedExport = (exportData as AssessmentReportExportRecord | null) ?? null;

      setReportTemplate(template);
      setReportTemplateSections(templateSections);
      setAssessmentReportSections(savedSections);
      setReportSectionDrafts(buildReportSectionDrafts(templateSections, savedSections));
      setReportExport(savedExport);
    } catch (reportLoadError) {
      setReportTemplate(null);
      setReportTemplateSections([]);
      setAssessmentReportSections([]);
      setReportSectionDrafts({});
      setReportExport(null);
      setReportBuilderError(
        `${getErrorMessage(
          reportLoadError,
          "Could not load report builder data.",
        )} Apply the report builder SQL, then refresh.`,
      );
    } finally {
      setReportBuilderLoading(false);
    }
  }

  async function loadScorecardForAssessment(assessmentId: string) {
    if (!supabase) {
      return;
    }

    setScorecardLoading(true);
    setScorecardError("");

    try {
      const [
        { data: scoreData, error: scoreError },
        { data: verdictData, error: verdictError },
        { data: reviewData, error: reviewError },
      ] = await Promise.all([
        supabase
          .from("assessment_scores")
          .select("id, site_assessment_id, module_key, score, risk_level, confidence_level, rationale, override_note, calculation_origin, is_derived, methodology_version_id, weight, weighted_contribution, created_at, updated_at")
          .eq("site_assessment_id", assessmentId)
          .order("module_key", { ascending: true }),
        supabase
          .from("assessment_verdicts")
          .select("id, site_assessment_id, verdict, confidence_level, conditions, summary, key_strengths, key_risks, recommended_next_steps, limitations_note, approved_by_analyst, approved_at, authored_by, methodology_version_id, current_event_id, created_at, updated_at")
          .eq("site_assessment_id", assessmentId)
          .maybeSingle(),
        supabase
          .from("expert_reviews")
          .select("id, site_assessment_id, review_type, reviewer_name, status, trigger_reason, comments, required_changes, approved_at, created_at, updated_at")
          .eq("site_assessment_id", assessmentId)
          .eq("review_type", "final_report")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (scoreError || verdictError || reviewError) {
        throw scoreError ?? verdictError ?? reviewError;
      }

      const loadedScores = (scoreData ?? []) as AssessmentScoreRecord[];
      const loadedVerdict = (verdictData as AssessmentVerdictRecord | null) ?? null;
      const loadedReview = (reviewData as ExpertReviewRecord | null) ?? null;

      setAssessmentScores(loadedScores);
      setScoreDrafts(buildScoreDrafts(loadedScores));
      setAssessmentVerdict(loadedVerdict);
      setVerdictDraft(createVerdictDraft(loadedVerdict));
      setExpertReview(loadedReview);
      setExpertReviewDraft(createExpertReviewDraft(loadedReview));
    } catch (scorecardLoadError) {
      setAssessmentScores([]);
      setScoreDrafts(buildScoreDrafts([]));
      setAssessmentVerdict(null);
      setVerdictDraft({ ...blankVerdictDraft });
      setExpertReview(null);
      setExpertReviewDraft({ ...blankExpertReviewDraft });
      setScorecardError(
        `${getErrorMessage(
          scorecardLoadError,
          "Could not load scorecard, verdict, and delivery gates.",
        )} Apply the scorecard SQL, then refresh.`,
      );
    } finally {
      setScorecardLoading(false);
    }
  }

  async function loadEvidenceForAssessment(assessmentId: string) {
    if (!supabase) {
      return;
    }

    setEvidenceLoading(true);
    setEvidenceError("");

    try {
      const [
        { data: sourceData, error: sourceError },
        { data: findingData, error: findingError },
      ] = await Promise.all([
        supabase
          .from("evidence_sources")
          .select(
            "id, site_assessment_id, title, source_type, publisher, url, file_reference, accessed_at, published_at, confidence_level, license_notes, limitation_notes, notes, authored_by, metadata_version, summary, created_at, updated_at",
          )
          .eq("site_assessment_id", assessmentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("assessment_findings")
          .select(
            "id, site_assessment_id, module_key, title, finding_type, risk_level, confidence_level, statement, assumption_note, recommendation, status, support_status, created_at, updated_at",
          )
          .eq("site_assessment_id", assessmentId)
          .order("created_at", { ascending: false }),
      ]);

      if (sourceError || findingError) {
        throw sourceError ?? findingError;
      }

      const loadedSources = (sourceData ?? []) as EvidenceSourceRecord[];
      const loadedFindings = (findingData ?? []) as AssessmentFindingRecord[];
      const findingIds = loadedFindings.map((finding) => finding.id);
      let loadedLinks: FindingEvidenceLinkRecord[] = [];

      if (findingIds.length > 0) {
        const { data: linkData, error: linkError } = await supabase
          .from("finding_evidence_links")
          .select("id, finding_id, evidence_source_id, relationship, link_note, linked_by, created_at")
          .in("finding_id", findingIds)
          .order("created_at", { ascending: false });

        if (linkError) {
          throw linkError;
        }

        loadedLinks = (linkData ?? []) as FindingEvidenceLinkRecord[];
      }

      setEvidenceSources(loadedSources);
      setAssessmentFindings(loadedFindings);
      setFindingEvidenceLinks(loadedLinks);
    } catch (evidenceLoadError) {
      setEvidenceSources([]);
      setAssessmentFindings([]);
      setFindingEvidenceLinks([]);
      setEvidenceError(
        `${getErrorMessage(
          evidenceLoadError,
          "Could not load evidence and findings.",
        )} Apply the evidence and findings SQL, then refresh.`,
      );
    } finally {
      setEvidenceLoading(false);
    }
  }

  async function loadChecklistForAssessment(assessmentId: string, marketRegion: string) {
    if (!supabase) {
      return;
    }

    setChecklistLoading(true);
    setChecklistError("");

    try {
      const { data: marketTemplateData, error: marketTemplateError } = await supabase
        .from("checklist_templates")
        .select("id, name, market_region, version")
        .eq("is_active", true)
        .eq("market_region", marketRegion || "ERCOT")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (marketTemplateError) {
        throw marketTemplateError;
      }

      let template = marketTemplateData as ChecklistTemplateRecord | null;

      if (!template && marketRegion !== "ERCOT") {
        const { data: fallbackTemplateData, error: fallbackTemplateError } = await supabase
          .from("checklist_templates")
          .select("id, name, market_region, version")
          .eq("is_active", true)
          .eq("market_region", "ERCOT")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackTemplateError) {
          throw fallbackTemplateError;
        }

        template = fallbackTemplateData as ChecklistTemplateRecord | null;
      }

      if (!template) {
        setChecklistTemplate(null);
        setChecklistItems([]);
        setChecklistDrafts({});
        setChecklistError("No active checklist template found. Apply the analysis checklist migration, then refresh.");
        return;
      }

      const { data: itemData, error: itemError } = await supabase
        .from("checklist_template_items")
        .select("id, template_id, module_key, module_name, module_sort_order, item_key, prompt, guidance, is_required, item_sort_order")
        .eq("template_id", template.id)
        .order("module_sort_order", { ascending: true })
        .order("item_sort_order", { ascending: true });

      if (itemError) {
        throw itemError;
      }

      const items = (itemData ?? []) as ChecklistTemplateItemRecord[];
      const itemIds = items.map((item) => item.id);
      let responses: ChecklistResponseRecord[] = [];

      if (itemIds.length > 0) {
        const { data: responseData, error: responseError } = await supabase
          .from("assessment_checklist_responses")
          .select("id, template_item_id, status, analyst_note, evidence_note, updated_at")
          .eq("site_assessment_id", assessmentId)
          .in("template_item_id", itemIds);

        if (responseError) {
          throw responseError;
        }

        responses = (responseData ?? []) as ChecklistResponseRecord[];
      }

      setChecklistTemplate(template);
      setChecklistItems(items);
      setChecklistDrafts(buildChecklistDrafts(items, responses));
    } catch (checklistLoadError) {
      setChecklistTemplate(null);
      setChecklistItems([]);
      setChecklistDrafts({});
      setChecklistError(
        `${getErrorMessage(
          checklistLoadError,
          "Could not load the analysis checklist.",
        )} Apply the analysis checklist migration, then refresh.`,
      );
    } finally {
      setChecklistLoading(false);
    }
  }

  function updateChecklistDraft(itemId: string, updates: Partial<Pick<ChecklistDraft, "status" | "analystNote" | "evidenceNote">>) {
    setChecklistDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? createChecklistDraft()),
        ...updates,
      },
    }));
    setChecklistError("");
    setSuccessMessage("");
  }

  async function saveChecklistResponse(itemId: string) {
    if (!supabase || !selectedAssessment) {
      return;
    }

    const draft = checklistDrafts[itemId] ?? createChecklistDraft();

    setSavingChecklistItemId(itemId);
    setChecklistError("");
    setSuccessMessage("");

    const { data, error: saveError } = await supabase
      .from("assessment_checklist_responses")
      .upsert(
        {
          site_assessment_id: selectedAssessment.id,
          template_item_id: itemId,
          status: draft.status,
          analyst_note: draft.analystNote.trim() || null,
          evidence_note: draft.evidenceNote.trim() || null,
        },
        { onConflict: "site_assessment_id,template_item_id" },
      )
      .select("id, template_item_id, status, analyst_note, evidence_note, updated_at")
      .single();

    setSavingChecklistItemId("");

    if (saveError) {
      setChecklistError(saveError.message);
      return;
    }

    setChecklistDrafts((current) => ({
      ...current,
      [itemId]: createChecklistDraft(data as ChecklistResponseRecord),
    }));
    setSuccessMessage("Checklist response saved.");
    trackWorkflowEvent("checklist_item_saved", {
      assessmentId: selectedAssessment.id,
      itemId,
      status: draft.status,
    });
  }

  function autoFillChecklistFromIntake() {
    if (!selectedAssessment || checklistItems.length === 0) {
      setChecklistError("Load an assessment checklist before running intake automation.");
      return;
    }

    const project = single(selectedAssessment.projects);
    const automationResult = buildAutomatedChecklistDrafts(checklistItems, checklistDrafts, {
      assessment: selectedAssessment,
      contact: selectedAssessment.contact ?? null,
      files,
      notes,
      organisation: single(project?.organisations),
      project,
      site: single(selectedAssessment.sites),
    });

    if (automationResult.appliedCount === 0) {
      setChecklistError("No blank checklist items were available to auto-fill. Existing analyst entries were preserved.");
      setSuccessMessage("");
      return;
    }

    setChecklistDrafts(automationResult.drafts);
    setChecklistError("");
    setSuccessMessage(
      `Auto-filled ${automationResult.appliedCount} checklist item${
        automationResult.appliedCount === 1 ? "" : "s"
      } from intake data. Review the drafts, then save all checklist responses.`,
    );
  }

  async function saveAllChecklistResponses() {
    if (!supabase || !selectedAssessment) {
      return;
    }

    const payloads = checklistItems
      .map((item) => {
        const draft = checklistDrafts[item.id] ?? createChecklistDraft();

        if (
          draft.status === "not_started" &&
          !draft.analystNote.trim() &&
          !draft.evidenceNote.trim()
        ) {
          return null;
        }

        return {
          site_assessment_id: selectedAssessment.id,
          template_item_id: item.id,
          status: draft.status,
          analyst_note: draft.analystNote.trim() || null,
          evidence_note: draft.evidenceNote.trim() || null,
        };
      })
      .filter((payload): payload is NonNullable<typeof payload> => Boolean(payload));

    if (payloads.length === 0) {
      setChecklistError("There are no drafted checklist responses to save yet.");
      return;
    }

    setSavingChecklistItemId("all");
    setChecklistError("");
    setSuccessMessage("");

    const { data, error: saveError } = await supabase
      .from("assessment_checklist_responses")
      .upsert(payloads, { onConflict: "site_assessment_id,template_item_id" })
      .select("id, template_item_id, status, analyst_note, evidence_note, updated_at");

    setSavingChecklistItemId("");

    if (saveError) {
      setChecklistError(saveError.message);
      return;
    }

    const savedResponses = (data ?? []) as ChecklistResponseRecord[];
    const savedByItemId = new Map(savedResponses.map((response) => [response.template_item_id, response]));

    setChecklistDrafts((current) =>
      checklistItems.reduce<Record<string, ChecklistDraft>>((nextDrafts, item) => {
        const saved = savedByItemId.get(item.id);
        nextDrafts[item.id] = saved ? createChecklistDraft(saved) : (current[item.id] ?? createChecklistDraft());
        return nextDrafts;
      }, {}),
    );
    setSuccessMessage(`Saved ${savedResponses.length} checklist response${savedResponses.length === 1 ? "" : "s"}.`);
  }

  function updateForm<K extends keyof AssessmentFormState>(key: K, value: AssessmentFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetCreateForm() {
    trackWorkflowEvent("assessment_create_started");
    setForm(blankAssessmentForm);
    setFormMode("create");
    setSelectedAssessment(null);
    setError("");
    setSuccessMessage("");
    setMode("form");
  }

  function populateEditForm(assessment: AssessmentDetail) {
    const site = single(assessment.sites);
    const project = single(assessment.projects);
    const organisation = single(project?.organisations);
    const contact = assessment.contact;

    setForm({
      organisationId: organisation?.id ?? "",
      organisationName: organisation?.name ?? "",
      organisationType: organisation?.organisation_type ?? "developer",
      contactId: contact?.id ?? "",
      contactName: contact?.name ?? "",
      contactEmail: contact?.email ?? "",
      contactPhone: contact?.phone ?? "",
      contactRoleTitle: contact?.role_title ?? "",
      projectId: project?.id ?? "",
      projectName: project?.name ?? "",
      projectType: project?.project_type ?? "single_site",
      projectDeadline: project?.deadline ?? "",
      projectDescription: project?.description ?? "",
      siteId: site?.id ?? "",
      siteName: site?.site_name ?? "",
      address: site?.address ?? "",
      city: site?.city ?? "",
      county: site?.county ?? "",
      state: site?.state ?? "TX",
      latitude: valueOrEmpty(site?.latitude),
      longitude: valueOrEmpty(site?.longitude),
      parcelId: site?.parcel_id ?? "",
      assessmentId: assessment.id,
      assessmentName: assessment.assessment_name,
      marketRegion: assessment.market_region,
      targetLoadMw: valueOrEmpty(assessment.target_load_mw),
      initialLoadMw: valueOrEmpty(assessment.initial_load_mw),
      fullBuildoutLoadMw: valueOrEmpty(assessment.full_buildout_load_mw),
      desiredEnergizationDate: assessment.desired_energization_date ?? "",
      projectStage: assessment.project_stage ?? "",
      landControlStatus: assessment.land_control_status ?? "",
      knownUtility: assessment.known_utility ?? "",
      knownTsp: assessment.known_tsp ?? "",
      knownSubstationOrPoi: assessment.known_substation_or_poi ?? "",
      existingStudiesSummary: assessment.existing_studies_summary ?? "",
      existingPowerQuoteSummary: assessment.existing_power_quote_summary ?? "",
      backupGenerationAssumptions: assessment.backup_generation_assumptions ?? "",
      batteryStorageAssumptions: assessment.battery_storage_assumptions ?? "",
      curtailmentWillingness: assessment.curtailment_willingness ?? "",
      workloadFlexibilityAssumptions: assessment.workload_flexibility_assumptions ?? "",
      waterCoolingNotes: assessment.water_cooling_notes ?? "",
      confidentialityStatus: assessment.confidentiality_status,
    });
    setFormMode("edit");
    setMode("form");
    setError("");
    setSuccessMessage("");
  }

  async function handleSaveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    const intakeBlockers = getAllIntakeBlockers(form);

    if (intakeBlockers.length > 0) {
      const blockerMessage = `Resolve ${intakeBlockers.length} required intake blocker${intakeBlockers.length === 1 ? "" : "s"} before saving.`;
      setError(blockerMessage);
      showToast({
        title: "Intake is not ready",
        body: blockerMessage,
        tone: "warning",
      });
      return;
    }

    const validationErrors = validateAssessmentForm(form);

    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    const nextStatus = recommendedStatus;
    const organisationType = normaliseOptionValue(
      form.organisationType,
      organisationTypes,
      blankAssessmentForm.organisationType,
    );
    const projectType = normaliseOptionValue(form.projectType, projectTypes, blankAssessmentForm.projectType);
    const assessmentPayload = {
      assessment_name: form.assessmentName.trim() || `${form.siteName.trim()} assessment`,
      market_region: form.marketRegion.trim() || "ERCOT",
      target_load_mw: parseOptionalNumber(form.targetLoadMw),
      initial_load_mw: parseOptionalNumber(form.initialLoadMw),
      full_buildout_load_mw: parseOptionalNumber(form.fullBuildoutLoadMw),
      desired_energization_date: form.desiredEnergizationDate || null,
      project_stage: form.projectStage || null,
      land_control_status: form.landControlStatus || null,
      known_utility: form.knownUtility || null,
      known_tsp: form.knownTsp || null,
      known_substation_or_poi: form.knownSubstationOrPoi || null,
      existing_studies_summary: form.existingStudiesSummary || null,
      existing_power_quote_summary: form.existingPowerQuoteSummary || null,
      backup_generation_assumptions: form.backupGenerationAssumptions || null,
      battery_storage_assumptions: form.batteryStorageAssumptions || null,
      curtailment_willingness: form.curtailmentWillingness || null,
      workload_flexibility_assumptions: form.workloadFlexibilityAssumptions || null,
      water_cooling_notes: form.waterCoolingNotes || null,
      confidentiality_status: form.confidentialityStatus,
      intake_completeness_score: completenessScore,
    };

    try {
      if (formMode === "create") {
        const { data: organisation, error: organisationError } = await supabase
          .from("organisations")
              .insert({
                name: form.organisationName.trim(),
                organisation_type: organisationType,
              })
          .select("id")
          .single();

        if (organisationError) {
          throw organisationError;
        }

        const organisationId = organisation.id as string;
        let contactId: string | null = null;

        if (form.contactName.trim() || form.contactEmail.trim()) {
          const { data: contact, error: contactError } = await supabase
            .from("contacts")
            .insert({
              organisation_id: organisationId,
              name: form.contactName.trim() || form.contactEmail.trim(),
              email: form.contactEmail.trim() || null,
              phone: form.contactPhone.trim() || null,
              role_title: form.contactRoleTitle.trim() || null,
              is_primary: true,
            })
            .select("id")
            .single();

          if (contactError) {
            throw contactError;
          }

          contactId = contact.id as string;
        }

        const { data: project, error: projectError } = await supabase
          .from("projects")
          .insert({
            organisation_id: organisationId,
            name: form.projectName.trim(),
            project_type: projectType,
            status: "active",
            lead_contact_id: contactId,
            deadline: form.projectDeadline || null,
            description: form.projectDescription.trim() || null,
          })
          .select("id")
          .single();

        if (projectError) {
          throw projectError;
        }

        const { data: site, error: siteError } = await supabase
          .from("sites")
          .insert({
            site_name: form.siteName.trim(),
            address: form.address.trim() || null,
            city: form.city.trim() || null,
            county: form.county.trim() || null,
            state: form.state.trim() || "TX",
            country: "USA",
            latitude: parseOptionalNumber(form.latitude),
            longitude: parseOptionalNumber(form.longitude),
            parcel_id: form.parcelId.trim() || null,
          })
          .select("id")
          .single();

        if (siteError) {
          throw siteError;
        }

        const { data: assessment, error: assessmentError } = await supabase
          .from("site_assessments")
          .insert({
            project_id: project.id,
            site_id: site.id,
            status: nextStatus,
            ...assessmentPayload,
          })
          .select("id")
          .single();

        if (assessmentError) {
          throw assessmentError;
        }

        setSuccessMessage("Assessment created.");
        trackWorkflowEvent("assessment_created", {
          assessmentId: assessment.id as string,
          completenessScore,
          status: nextStatus,
        });
        showToast({
          title: "Assessment created",
          body: "The guided intake was saved and the assessment workspace is ready.",
          tone: "success",
        });
        await loadAssessments();
        await loadDetail(assessment.id as string);
      } else {
        const projectId = form.projectId;
        const siteId = form.siteId;
        const assessmentId = form.assessmentId;
        if (!projectId || !siteId || !assessmentId || !form.organisationId) {
          throw new Error("Cannot edit assessment because one or more record IDs are missing.");
        }

        const { error: organisationError } = await supabase
          .from("organisations")
            .update({
              name: form.organisationName.trim(),
              organisation_type: organisationType,
            })
          .eq("id", form.organisationId);

        if (organisationError) {
          throw organisationError;
        }

        let leadContactId: string | null = form.contactId || null;

        if (form.contactName.trim() || form.contactEmail.trim()) {
          if (form.contactId) {
            const { error: contactError } = await supabase
              .from("contacts")
              .update({
                name: form.contactName.trim() || form.contactEmail.trim(),
                email: form.contactEmail.trim() || null,
                phone: form.contactPhone.trim() || null,
                role_title: form.contactRoleTitle.trim() || null,
              })
              .eq("id", form.contactId);

            if (contactError) {
              throw contactError;
            }
          } else {
            const { data: contact, error: contactError } = await supabase
              .from("contacts")
              .insert({
                organisation_id: form.organisationId,
                name: form.contactName.trim() || form.contactEmail.trim(),
                email: form.contactEmail.trim() || null,
                phone: form.contactPhone.trim() || null,
                role_title: form.contactRoleTitle.trim() || null,
                is_primary: true,
              })
              .select("id")
              .single();

            if (contactError) {
              throw contactError;
            }

            leadContactId = contact.id as string;
          }
        }

        const { error: projectError } = await supabase
          .from("projects")
            .update({
              name: form.projectName.trim(),
              project_type: projectType,
              lead_contact_id: leadContactId,
            deadline: form.projectDeadline || null,
            description: form.projectDescription.trim() || null,
          })
          .eq("id", projectId);

        if (projectError) {
          throw projectError;
        }

        const { error: siteError } = await supabase
          .from("sites")
          .update({
            site_name: form.siteName.trim(),
            address: form.address.trim() || null,
            city: form.city.trim() || null,
            county: form.county.trim() || null,
            state: form.state.trim() || "TX",
            latitude: parseOptionalNumber(form.latitude),
            longitude: parseOptionalNumber(form.longitude),
            parcel_id: form.parcelId.trim() || null,
          })
          .eq("id", siteId);

        if (siteError) {
          throw siteError;
        }

        const { error: assessmentError } = await supabase
          .from("site_assessments")
          .update(assessmentPayload)
          .eq("id", assessmentId);

        if (assessmentError) {
          throw assessmentError;
        }

        setSuccessMessage("Assessment updated.");
        trackWorkflowEvent("assessment_intake_updated", {
          assessmentId,
          completenessScore,
          status: selectedAssessment?.status ?? nextStatus,
        });
        showToast({
          title: "Assessment updated",
          body: "Your intake changes were saved.",
          tone: "success",
        });
        await loadAssessments();
        await loadDetail(assessmentId);
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus() {
    if (!supabase || !selectedAssessment) {
      return;
    }

    if (pendingStatus === "delivered" && !deliveryGatesAreComplete(deliveryGates)) {
      const incompleteGates = deliveryGates
        .filter((gate) => gate.status !== "pass")
        .map((gate) => gate.label)
        .join(", ");

      setError(`Cannot mark assessment delivered yet. Complete delivery gates first: ${incompleteGates}.`);
      setSuccessMessage("");
      return;
    }

    if (pendingStatus === selectedAssessment.status) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await transitionAssessmentStatus(supabase, {
        assessmentId: selectedAssessment.id,
        reason: "Workflow status changed in analyst console",
        source: "analyst_console",
        toStatus: pendingStatus,
      });

      setSuccessMessage("Status updated.");
      await loadAssessments();
      await loadDetail(selectedAssessment.id);
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !selectedAssessment || !newNote.trim()) {
      return;
    }

    setSaving(true);
    setError("");

    const { error: noteError } = await supabase.from("assessment_notes").insert({
      site_assessment_id: selectedAssessment.id,
      note_type: newNoteType,
      body: newNote.trim(),
      is_internal: true,
    });

    setSaving(false);

    if (noteError) {
      setError(noteError.message);
      return;
    }

    setNewNote("");
    await loadDetail(selectedAssessment.id);
  }

  async function addFileReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !selectedAssessment || !newFile.fileName.trim()) {
      return;
    }

    setSaving(true);
    setError("");

    const { error: fileError } = await supabase.from("uploaded_files").insert({
      site_assessment_id: selectedAssessment.id,
      file_name: newFile.fileName.trim(),
      document_category: newFile.documentCategory,
      storage_path: newFile.storagePath.trim() || null,
      description: newFile.description.trim() || null,
    });

    setSaving(false);

    if (fileError) {
      setError(fileError.message);
      return;
    }

    setNewFile({ fileName: "", documentCategory: "other", storagePath: "", description: "" });
    await loadDetail(selectedAssessment.id);
  }

  async function addGridAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !selectedAssessment) {
      return;
    }

    const site = single(selectedAssessment.sites);

    if (!site) {
      setGridAssetError("Cannot save GIS asset because this assessment is missing its site record.");
      return;
    }

    if (!newGridAsset.assetName.trim()) {
      setGridAssetError("Asset name is required.");
      return;
    }

    const coordinateResult = validateCoordinateInputs(newGridAsset.latitude, newGridAsset.longitude);

    if (coordinateResult.error) {
      setGridAssetError(coordinateResult.error);
      return;
    }

    const assetLatitude = coordinateResult.latitude;
    const assetLongitude = coordinateResult.longitude;

    if (assetLatitude === undefined || assetLongitude === undefined) {
      setGridAssetError("Latitude and longitude are required numeric values.");
      return;
    }

    const voltageKv = parseNumericInput(newGridAsset.voltageKv);

    if (newGridAsset.voltageKv.trim() && voltageKv === null) {
      setGridAssetError("Voltage kV must be numeric.");
      return;
    }

    const distanceMiles = hasValidCoordinatePair(site.latitude, site.longitude)
      ? calculateDistanceMiles(
          Number(site.latitude),
          Number(site.longitude),
          assetLatitude,
          assetLongitude,
        )
      : null;

    setSavingGridAsset(true);
    setGridAssetError("");
    setSuccessMessage("");

    const { data: savedAsset, error: saveError } = await supabase
      .from("assessment_grid_assets")
      .insert({
        site_assessment_id: selectedAssessment.id,
        site_id: site.id,
        asset_name: newGridAsset.assetName.trim(),
        asset_type: newGridAsset.assetType,
        latitude: assetLatitude,
        longitude: assetLongitude,
        voltage_kv: voltageKv,
        owner_operator: newGridAsset.ownerOperator.trim() || null,
        source: newGridAsset.source.trim() || null,
        confidence_level: newGridAsset.confidenceLevel,
        is_candidate_poi: newGridAsset.isCandidatePoi,
        rationale: newGridAsset.rationale.trim() || null,
        analyst_notes: newGridAsset.analystNotes.trim() || null,
        distance_miles: distanceMiles,
      })
      .select("id")
      .single();

    if (saveError) {
      setSavingGridAsset(false);
      setGridAssetError(getErrorMessage(saveError, "Could not save GIS asset."));
      return;
    }

    setNewGridAsset(blankGridAssetDraft);
    setRecentlySavedGridAssetId((savedAsset?.id as string | undefined) ?? "");
    setSuccessMessage("GIS asset added.");
    trackWorkflowEvent("grid_asset_added", {
      assessmentId: selectedAssessment.id,
      assetId: (savedAsset?.id as string | undefined) ?? null,
      assetType: newGridAsset.assetType,
      isCandidatePoi: newGridAsset.isCandidatePoi,
    });
    await loadDetail(selectedAssessment.id);
    window.setTimeout(() => setRecentlySavedGridAssetId(""), 5200);
    setSavingGridAsset(false);
  }

  function editEvidenceSource(source: EvidenceSourceRecord) {
    setEditingEvidenceSourceId(source.id);
    setNewEvidenceSource(createEvidenceSourceDraft(source));
    setEvidenceError("");
    setSuccessMessage("");
  }

  function cancelEvidenceSourceEdit() {
    setEditingEvidenceSourceId("");
    setNewEvidenceSource({ ...blankEvidenceSourceDraft });
    setEvidenceError("");
  }

  async function saveEvidenceSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !selectedAssessment) {
      return;
    }

    const validationErrors = validateEvidenceSourceDraft(newEvidenceSource, false);
    if (validationErrors.length > 0) {
      setEvidenceError(validationErrors.join(" "));
      return;
    }

    setSavingEvidenceSource(true);
    setEvidenceError("");
    setSuccessMessage("");

    const payload = {
      site_assessment_id: selectedAssessment.id,
      title: newEvidenceSource.title.trim(),
      source_type: newEvidenceSource.sourceType,
      publisher: newEvidenceSource.publisher.trim() || null,
      url: newEvidenceSource.url.trim() || null,
      file_reference: newEvidenceSource.fileReference.trim() || null,
      accessed_at: newEvidenceSource.accessedAt || null,
      published_at: newEvidenceSource.publishedAt || null,
      confidence_level: newEvidenceSource.confidenceLevel,
      license_notes: newEvidenceSource.licenseNotes.trim() || null,
      limitation_notes: newEvidenceSource.limitationNotes.trim() || null,
      notes: newEvidenceSource.notes.trim() || null,
      summary: newEvidenceSource.summary.trim() || null,
    };
    const isCreatingEvidenceSource = !editingEvidenceSourceId;

    const { error: saveError } = editingEvidenceSourceId
      ? await supabase.from("evidence_sources").update(payload).eq("id", editingEvidenceSourceId)
      : await supabase.from("evidence_sources").insert(payload);

    if (saveError) {
      setSavingEvidenceSource(false);
      setEvidenceError(getErrorMessage(saveError, "Could not save evidence source."));
      return;
    }

    setNewEvidenceSource({ ...blankEvidenceSourceDraft });
    setEditingEvidenceSourceId("");
    setSuccessMessage(editingEvidenceSourceId ? "Evidence source updated." : "Evidence source added.");
    if (isCreatingEvidenceSource) {
      trackWorkflowEvent("evidence_source_created", {
        assessmentId: selectedAssessment.id,
        sourceType: newEvidenceSource.sourceType,
      });
    }
    await loadEvidenceForAssessment(selectedAssessment.id);
    setSavingEvidenceSource(false);
  }

  function editFinding(finding: AssessmentFindingRecord) {
    const linkedEvidenceSourceIds = linksForFinding(finding.id, findingEvidenceLinks).map(
      (link) => link.evidence_source_id,
    );

    setEditingFindingId(finding.id);
    setNewFinding(createAssessmentFindingDraft(finding, linkedEvidenceSourceIds));
    setEvidenceError("");
    setSuccessMessage("");
  }

  function cancelFindingEdit() {
    setEditingFindingId("");
    setNewFinding({ ...blankAssessmentFindingDraft, linkedEvidenceSourceIds: [] });
    setEvidenceError("");
  }

  async function saveFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !selectedAssessment) {
      return;
    }

    if (!newFinding.title.trim()) {
      setEvidenceError("Finding title is required.");
      return;
    }

    const linkedEvidenceSourceIds = Array.from(new Set(newFinding.linkedEvidenceSourceIds));
    const isCreatingFinding = !editingFindingId;

    setSavingFinding(true);
    setEvidenceError("");
    setSuccessMessage("");

    try {
      const payload = {
        module_key: newFinding.moduleKey,
        title: newFinding.title.trim(),
        finding_type: newFinding.findingType,
        risk_level: newFinding.riskLevel,
        confidence_level: newFinding.confidenceLevel,
        statement: newFinding.statement.trim() || null,
        assumption_note: newFinding.assumptionNote.trim() || null,
        recommendation: newFinding.recommendation.trim() || null,
        status: newFinding.status,
        support_status: newFinding.supportStatus,
      };
      const { data: savedFinding, error: findingRpcError } = await supabase.rpc("save_assessment_finding", {
        p_assessment_id: selectedAssessment.id,
        p_finding: { ...payload, id: editingFindingId || null },
        p_links: linkedEvidenceSourceIds.map((evidenceSourceId) => ({ evidence_source_id: evidenceSourceId, relationship: "supporting" })),
      }).single();
      if (findingRpcError) throw findingRpcError;
      const findingId = (savedFinding as { id: string }).id;

      setNewFinding({ ...blankAssessmentFindingDraft, linkedEvidenceSourceIds: [] });
      setEditingFindingId("");
      setSuccessMessage(editingFindingId ? "Finding updated." : "Finding added.");
      if (isCreatingFinding) {
        trackWorkflowEvent("finding_created", {
          assessmentId: selectedAssessment.id,
          findingId,
          findingType: newFinding.findingType,
          riskLevel: newFinding.riskLevel,
        });
      }
      await loadEvidenceForAssessment(selectedAssessment.id);
    } catch (findingSaveError) {
      setEvidenceError(getErrorMessage(findingSaveError, "Could not save finding."));
    } finally {
      setSavingFinding(false);
    }
  }

  function updateScoreDraft(moduleKey: ScoreModuleKey, updates: Partial<AssessmentScoreDraft>) {
    setScoreDrafts((current) => ({
      ...current,
      [moduleKey]: {
        ...(current[moduleKey] ?? { ...blankScoreDraft }),
        ...updates,
      },
    }));
    setScorecardError("");
    setSuccessMessage("");
  }

  async function saveScorecard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !selectedAssessment) {
      return;
    }

    const validationErrors: string[] = [];
    const payloads = scoreComponents
      .map((module) => {
        const draft = scoreDrafts[module.value] ?? { ...blankScoreDraft };

        if (!draft.score.trim()) {
          return null;
        }

        const validationError = validateScoreDraft(module.label, draft);

        if (validationError) {
          validationErrors.push(validationError);
          return null;
        }

        const parsedScore = parseScoreInput(draft.score);

        if (parsedScore === null) {
          validationErrors.push(`${module.label} score is required.`);
          return null;
        }

        return {
          module_key: module.value,
          score: parsedScore,
          risk_level: draft.riskLevel,
          confidence_level: draft.confidenceLevel,
          rationale: draft.rationale.trim() || null,
          override_note: draft.overrideNote.trim() || null,
        };
      })
      .filter((payload): payload is NonNullable<typeof payload> => Boolean(payload));

    if (validationErrors.length > 0) {
      setScorecardError(validationErrors.join(" "));
      return;
    }

    if (payloads.length === 0) {
      setScorecardError("Enter at least one module score before saving the scorecard.");
      return;
    }

    setSavingScorecard(true);
    setScorecardError("");
    setSuccessMessage("");

    try {
      await saveAssessmentScores(supabase, {
        assessmentId: selectedAssessment.id,
        scores: payloads,
      });
    } catch (saveError) {
      setSavingScorecard(false);
      setScorecardError(getErrorMessage(saveError, "Could not save scorecard."));
      return;
    }

    setSuccessMessage(`Saved ${payloads.length} score${payloads.length === 1 ? "" : "s"}.`);
    trackWorkflowEvent("scorecard_saved", {
      assessmentId: selectedAssessment.id,
      savedModuleCount: payloads.length,
    });
    await loadScorecardForAssessment(selectedAssessment.id);
    setSavingScorecard(false);
  }

  async function saveVerdict(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !selectedAssessment) {
      return;
    }

    setSavingVerdict(true);
    setScorecardError("");
    setSuccessMessage("");

    if (!verdictDraft.summary.trim()) {
      setSavingVerdict(false);
      setScorecardError("A verdict rationale is required.");
      return;
    }

    if (verdictDraft.confidenceLevel === "unknown") {
      setSavingVerdict(false);
      setScorecardError("Select high, medium or low verdict confidence.");
      return;
    }

    if (!verdictDraft.conditions.trim()) {
      setSavingVerdict(false);
      setScorecardError("Verdict conditions are required; state explicitly when none apply.");
      return;
    }

    let data;
    try {
      data = await saveAssessmentVerdict(supabase, {
        assessmentId: selectedAssessment.id,
        draft: verdictDraft,
      });
    } catch (saveError) {
      setSavingVerdict(false);
      setScorecardError(getErrorMessage(saveError, "Could not save final verdict."));
      return;
    }

    const savedVerdict = data as AssessmentVerdictRecord;
    setAssessmentVerdict(savedVerdict);
    setVerdictDraft(createVerdictDraft(savedVerdict));
    setSuccessMessage("Final verdict saved.");
    setSavingVerdict(false);
  }

  async function saveExpertReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !selectedAssessment) {
      return;
    }

    setSavingExpertReview(true);
    setScorecardError("");
    setSuccessMessage("");

    const payload = {
      site_assessment_id: selectedAssessment.id,
      review_type: "final_report",
      reviewer_name: expertReviewDraft.reviewerName.trim() || null,
      status: expertReviewDraft.status,
      trigger_reason: expertReviewDraft.triggerReason.trim() || expertReviewTriggers.reasonText || null,
      comments: expertReviewDraft.comments.trim() || null,
      required_changes: expertReviewDraft.requiredChanges.trim() || null,
      approved_at:
        expertReviewDraft.status === "approved"
          ? expertReview?.approved_at ?? new Date().toISOString()
          : null,
    };

    const { error: saveError } = expertReview
      ? await supabase.from("expert_reviews").update(payload).eq("id", expertReview.id)
      : await supabase.from("expert_reviews").insert(payload);

    if (saveError) {
      setSavingExpertReview(false);
      setScorecardError(getErrorMessage(saveError, "Could not save expert review."));
      return;
    }

    setSuccessMessage("Expert review saved.");
    await loadScorecardForAssessment(selectedAssessment.id);
    setSavingExpertReview(false);
  }

  function buildReportGenerationContext(): ReportGenerationContext | null {
    if (!selectedAssessment) {
      return null;
    }

    const site = single(selectedAssessment.sites);
    const project = single(selectedAssessment.projects);
    const organisation = single(project?.organisations);

    return {
      assessment: {
        assessment_name: selectedAssessment.assessment_name,
        backup_generation_assumptions: selectedAssessment.backup_generation_assumptions,
        battery_storage_assumptions: selectedAssessment.battery_storage_assumptions,
        curtailment_willingness: selectedAssessment.curtailment_willingness,
        desired_energization_date: selectedAssessment.desired_energization_date,
        existing_power_quote_summary: selectedAssessment.existing_power_quote_summary,
        existing_studies_summary: selectedAssessment.existing_studies_summary,
        full_buildout_load_mw: selectedAssessment.full_buildout_load_mw,
        initial_load_mw: selectedAssessment.initial_load_mw,
        known_substation_or_poi: selectedAssessment.known_substation_or_poi,
        known_tsp: selectedAssessment.known_tsp,
        known_utility: selectedAssessment.known_utility,
        land_control_status: selectedAssessment.land_control_status,
        market_region: selectedAssessment.market_region,
        project_stage: selectedAssessment.project_stage,
        target_load_mw: selectedAssessment.target_load_mw,
        water_cooling_notes: selectedAssessment.water_cooling_notes,
        workload_flexibility_assumptions: selectedAssessment.workload_flexibility_assumptions,
      },
      checklist: checklistReportSummary,
      evidenceLinks: findingEvidenceLinks,
      evidenceReadiness,
      evidenceSources,
      expertReview,
      findings: assessmentFindings,
      gridAssets,
      organisationName: organisation?.name ?? "",
      projectName: project?.name ?? "",
      projectType: project?.project_type ?? "",
      scores: assessmentScores,
      site: site
        ? {
            address: site.address,
            city: site.city,
            county: site.county,
            latitude: site.latitude,
            longitude: site.longitude,
            parcel_id: site.parcel_id,
            site_name: site.site_name,
            state: site.state,
          }
        : null,
      templateSections: reportTemplateSections,
      verdict: assessmentVerdict,
    };
  }

  function updateReportSectionDraft(templateSectionId: string, updates: Partial<ReportSectionDraft>) {
    setReportSectionDrafts((current) => ({
      ...current,
      [templateSectionId]: {
        ...(current[templateSectionId] ?? { content: "", status: "draft" }),
        ...updates,
      },
    }));
    setReportBuilderError("");
    setSuccessMessage("");
  }

  async function upsertReportExportStatus(status: ReportExportStatus, message: string) {
    if (!supabase || !selectedAssessment || !reportTemplate) {
      return;
    }

    setSavingReportExport(true);
    setReportBuilderError("");
    setSuccessMessage("");

    if (status === "ready_for_review") {
      let exportId = reportExport?.id ?? "";
      if (!exportId) {
        const { data: initializedExport, error: initializeError } = await supabase
          .from("assessment_report_exports")
          .upsert({
            export_type: "print_preview",
            site_assessment_id: selectedAssessment.id,
            status: "draft_generated",
            template_id: reportTemplate.id,
          }, { onConflict: "site_assessment_id,template_id,export_type" })
          .select("id")
          .single();
        if (initializeError) {
          setSavingReportExport(false);
          setReportBuilderError(getErrorMessage(initializeError, "Could not initialize the report package."));
          return;
        }
        exportId = initializedExport.id as string;
      }

      const { data: finalizationData, error: finalizationError } = await supabase.rpc("finalize_assessment_report", {
        p_assessment_id: selectedAssessment.id,
        p_export_id: exportId,
      });
      setSavingReportExport(false);
      if (finalizationError) {
        setReportBuilderError(getErrorMessage(finalizationError, "Could not run report preflight."));
        return;
      }
      const result = finalizationData as { export: AssessmentReportExportRecord; finalized: boolean; preflight: AssessmentPreflightRunRecord };
      if (!result.finalized) {
        setReportBuilderError(result.preflight.blockers.map((blocker) => `${blocker.label}${blocker.remediation ? ` — ${blocker.remediation}` : ""}`).join(" "));
        return;
      }
      setReportExport(result.export);
      setSuccessMessage(message);
      trackWorkflowEvent("report_marked_ready", { assessmentId: selectedAssessment.id, reportExportId: result.export.id });
      await loadReportBuilderForAssessment(selectedAssessment.id, selectedAssessment.market_region);
      return;
    }

    const { data, error: saveError } = await supabase
      .from("assessment_report_exports")
      .upsert(
        {
          export_type: "print_preview",
          ready_for_review_at: null,
          site_assessment_id: selectedAssessment.id,
          status,
          template_id: reportTemplate.id,
        },
        { onConflict: "site_assessment_id,template_id,export_type" },
      )
      .select("id, site_assessment_id, template_id, export_type, status, notes, ready_for_review_at, updated_at")
      .single();

    setSavingReportExport(false);

    if (saveError) {
      setReportBuilderError(getErrorMessage(saveError, "Could not save report package status."));
      return;
    }

    setReportExport(data as AssessmentReportExportRecord);
    setSuccessMessage(message);
  }

  async function saveReportSection(templateSectionId: string) {
    if (!supabase || !selectedAssessment) {
      return;
    }

    const templateSection = reportTemplateSections.find((section) => section.id === templateSectionId);
    const draft = reportSectionDrafts[templateSectionId];

    if (!templateSection || !draft) {
      setReportBuilderError("Generate or load report sections before saving.");
      return;
    }

    setSavingReportSectionId(templateSectionId);
    setReportBuilderError("");
    setSuccessMessage("");

    const { data, error: saveError } = await supabase
      .from("assessment_report_sections")
      .upsert(
        {
          content: draft.content,
          generation_notes: "Analyst edited in report builder.",
          is_edited: true,
          section_key: templateSection.section_key,
          site_assessment_id: selectedAssessment.id,
          status: draft.status,
          template_section_id: templateSection.id,
          title: templateSection.title,
        },
        { onConflict: "site_assessment_id,template_section_id" },
      )
      .select("id, site_assessment_id, template_section_id, section_key, title, content, status, is_edited, generated_at, generation_notes, updated_at")
      .single();

    setSavingReportSectionId("");

    if (saveError) {
      setReportBuilderError(getErrorMessage(saveError, "Could not save report section."));
      return;
    }

    const savedSection = data as AssessmentReportSectionRecord;

    setAssessmentReportSections((current) => {
      const others = current.filter((section) => section.id !== savedSection.id);
      return [savedSection, ...others];
    });
    setReportSectionDrafts((current) => ({
      ...current,
      [templateSectionId]: createReportSectionDraft(savedSection),
    }));
    await upsertReportExportStatus("analyst_edited", "Report section saved.");
  }

  async function generateReportDraft(overwriteEdited: boolean) {
    if (!supabase || !selectedAssessment || !reportTemplate) {
      setReportBuilderError("Load a report template before generating a draft.");
      return;
    }

    if (reportTemplateSections.length === 0) {
      setReportBuilderError("Report template has no sections. Apply the report builder SQL, then refresh.");
      return;
    }

    const editedSections = assessmentReportSections.filter((section) => section.is_edited);

    if (
      overwriteEdited &&
      editedSections.length > 0 &&
      !window.confirm(`Regenerate all ${reportTemplateSections.length} sections and overwrite ${editedSections.length} edited section(s)?`)
    ) {
      return;
    }

    const context = buildReportGenerationContext();

    if (!context) {
      setReportBuilderError("Load an assessment before generating a report.");
      return;
    }

    setGeneratingReport(true);
    setReportBuilderError("");
    setSuccessMessage("");

    try {
      const generatedSections = generateReportSections(context);
      const existingByTemplateId = new Map(
        assessmentReportSections.map((section) => [section.template_section_id, section]),
      );
      const now = new Date().toISOString();
      const payloads = generatedSections
        .filter((section) => overwriteEdited || !existingByTemplateId.get(section.templateSectionId)?.is_edited)
        .map((section) => ({
          content: section.content,
          generated_at: now,
          generation_notes: section.generationNotes,
          is_edited: false,
          section_key: section.sectionKey,
          site_assessment_id: selectedAssessment.id,
          status: "draft" satisfies ReportSectionStatus,
          template_section_id: section.templateSectionId,
          title: section.title,
        }));

      if (payloads.length > 0) {
        const { error: saveError } = await supabase
          .from("assessment_report_sections")
          .upsert(payloads, { onConflict: "site_assessment_id,template_section_id" });

        if (saveError) {
          throw saveError;
        }
      }

      const hasPreservedEdits = !overwriteEdited && editedSections.length > 0;
      const { error: exportError } = await supabase
        .from("assessment_report_exports")
        .upsert(
          {
            export_type: "print_preview",
            ready_for_review_at: null,
            site_assessment_id: selectedAssessment.id,
            status: hasPreservedEdits ? "analyst_edited" : "draft_generated",
            template_id: reportTemplate.id,
          },
          { onConflict: "site_assessment_id,template_id,export_type" },
        );

      if (exportError) {
        throw exportError;
      }

      await loadReportBuilderForAssessment(selectedAssessment.id, selectedAssessment.market_region);
      setSuccessMessage(
        hasPreservedEdits
          ? `Generated ${payloads.length} section${payloads.length === 1 ? "" : "s"} and preserved ${editedSections.length} edited section${editedSections.length === 1 ? "" : "s"}.`
          : `Generated ${generatedSections.length} report section${generatedSections.length === 1 ? "" : "s"}.`,
      );
      trackWorkflowEvent("report_generated", {
        assessmentId: selectedAssessment.id,
        generatedSectionCount: generatedSections.length,
        savedSectionCount: payloads.length,
        overwriteEdited,
      });
    } catch (reportGenerateError) {
      setReportBuilderError(getErrorMessage(reportGenerateError, "Could not generate report draft."));
    } finally {
      setGeneratingReport(false);
    }
  }

  function saveReportDraftPackage() {
    const status: ReportExportStatus = assessmentReportSections.some((section) => section.is_edited)
      ? "analyst_edited"
      : "draft_generated";

    void upsertReportExportStatus(status, "Draft package status saved.");
  }

  if (!hasSupabaseConfig) {
    return <MissingConfig />;
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--background)]/90 backdrop-blur-xl">
        <nav className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm shadow-[var(--color-shadow)]">
              <Image src="/gridready-logo.svg" alt="GridReady AI" width={25} height={25} priority />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-primary)]">GridReady AI</p>
              <h1 className="truncate text-lg font-semibold text-[var(--color-text-primary)] sm:text-xl">
                {mode === "form" ? (formMode === "create" ? "New Assessment" : "Edit Intake") : "Intake Console"}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={secondaryButtonClass}>
              <ArrowLeft size={16} />
              Site
            </Link>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button
              type="button"
              onClick={() => void loadAssessments()}
              className={secondaryButtonClass}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            {mode !== "form" ? (
              <button
                type="button"
                onClick={resetCreateForm}
                className={primaryButtonClass}
              >
                <Plus size={16} />
                New assessment
              </button>
            ) : null}
          </div>
        </nav>
      </header>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-brand-primary)_12%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_srgb,var(--color-brand-primary)_12%,transparent)_1px,transparent_1px)] bg-[size:52px_52px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_26%,transparent),var(--background)_90%)]" />

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)] shadow-sm shadow-[var(--color-shadow)]">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p>{error}</p>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--color-success)] bg-[var(--color-success-soft)] px-4 py-3 text-sm text-[var(--color-success)] shadow-sm shadow-[var(--color-shadow)]">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <p>{successMessage}</p>
          </div>
        ) : null}

        {mode === "dashboard" ? (
          <Dashboard
            assessments={filteredAssessments}
            dashboardSort={dashboardSort}
            evidenceGapAssessmentIds={dashboardEvidenceGapAssessmentIds}
            selectedStatusFilters={dashboardStatusFilters}
            loading={loading}
            searchTerm={searchTerm}
            setDashboardSort={setDashboardSort}
            setSearchTerm={setSearchTerm}
            stats={stats}
            onClearStatusFilters={() => setDashboardStatusFilters(new Set())}
            onOpen={(assessmentId) => void loadDetail(assessmentId)}
            onToggleStatusFilter={toggleDashboardStatusFilter}
          />
        ) : null}

        {mode === "form" ? (
          <AssessmentForm
            key={`${formMode}-${form.assessmentId || "new"}`}
            completenessScore={completenessScore}
            form={form}
            formMode={formMode}
            recommendedStatus={recommendedStatus}
            saving={saving}
            updateForm={updateForm}
            onBack={() => {
              setMode(selectedAssessment ? "detail" : "dashboard");
              setSuccessMessage("");
              setError("");
            }}
            onAddressSelected={() => {
              showToast({
                title: "Address selected",
                body: "Location fields and coordinates were filled from the lookup result.",
                tone: "success",
              });
            }}
            onSubmitBlocked={(blockerCount) => {
              const blockerMessage = `Resolve ${blockerCount} required intake blocker${blockerCount === 1 ? "" : "s"} before saving.`;
              setError(blockerMessage);
              showToast({
                title: "Review required fields",
                body: blockerMessage,
                tone: "warning",
              });
            }}
            onStepCompleted={(stepId, status, nextStepId) => {
              if (formMode !== "create") {
                return;
              }

              trackWorkflowEvent("assessment_create_step_completed", {
                stepId,
                status,
                nextStepId,
                completenessScore,
              });
            }}
            onSubmit={(event) => void handleSaveAssessment(event)}
          />
        ) : null}

        {mode === "detail" && selectedAssessment ? (
          <AssessmentDetailPanel
            appRole={appRole}
            assessment={selectedAssessment}
            assessmentFindings={assessmentFindings}
            assessmentScores={assessmentScores}
            assessmentVerdict={assessmentVerdict}
            checklistError={checklistError}
            checklistGroups={checklistGroups}
            checklistLoading={checklistLoading}
            checklistProgress={checklistProgress}
            checklistTemplate={checklistTemplate}
            criticalFindingCount={criticalFindingCount}
            deliveryGates={deliveryGates}
            editingEvidenceSourceId={editingEvidenceSourceId}
            editingFindingId={editingFindingId}
            evidenceError={evidenceError}
            evidenceGapCount={evidenceGapCount}
            evidenceLoading={evidenceLoading}
            evidenceReadiness={evidenceReadiness}
            evidenceSourceDraft={newEvidenceSource}
            evidenceSources={evidenceSources}
            expertReview={expertReview}
            expertReviewDraft={expertReviewDraft}
            expertReviewTriggers={expertReviewTriggers}
            files={files}
            findingDraft={newFinding}
            findingEvidenceLinks={findingEvidenceLinks}
            gridAssetDraft={newGridAsset}
            gridAssetError={gridAssetError}
            gridAssets={gridAssets}
            generatingReport={generatingReport}
            newFile={newFile}
            newNote={newNote}
            newNoteType={newNoteType}
            notes={notes}
            pendingStatus={pendingStatus}
            reportBuilderError={reportBuilderError}
            reportBuilderLoading={reportBuilderLoading}
            reportExport={reportExport}
            reportSectionDrafts={reportSectionDrafts}
            reportTemplate={reportTemplate}
            reportTemplateSections={reportTemplateSections}
            reportSections={assessmentReportSections}
            recentlySavedGridAssetId={recentlySavedGridAssetId}
            saving={saving}
            savingChecklistItemId={savingChecklistItemId}
            savingEvidenceSource={savingEvidenceSource}
            savingExpertReview={savingExpertReview}
            savingFinding={savingFinding}
            savingGridAsset={savingGridAsset}
            savingReportExport={savingReportExport}
            savingReportSectionId={savingReportSectionId}
            savingScorecard={savingScorecard}
            savingVerdict={savingVerdict}
            scoreDrafts={scoreDrafts}
            scoreSummary={scoreSummary}
            scorecardError={scorecardError}
            scorecardLoading={scorecardLoading}
            verdictDraft={verdictDraft}
            onAddFileReference={(event) => void addFileReference(event)}
            onAddGridAsset={(event) => void addGridAsset(event)}
            onAddNote={(event) => void addNote(event)}
            onBack={() => {
              setMode("dashboard");
              setSelectedAssessment(null);
              resetChecklistState();
              resetGisState();
              resetEvidenceState();
              resetScorecardState();
              resetReportBuilderState();
              setSuccessMessage("");
              setError("");
            }}
            onChecklistAutoFill={autoFillChecklistFromIntake}
            onChecklistChange={updateChecklistDraft}
            onChecklistSave={(itemId) => void saveChecklistResponse(itemId)}
            onChecklistSaveAll={() => void saveAllChecklistResponses()}
            onEvidenceSourceCancelEdit={cancelEvidenceSourceEdit}
            onEvidenceSourceChange={setNewEvidenceSource}
            onEvidenceSourceEdit={editEvidenceSource}
            onEvidenceSourceSubmit={(event) => void saveEvidenceSource(event)}
            onEdit={() => populateEditForm(selectedAssessment)}
            onExpertReviewChange={setExpertReviewDraft}
            onExpertReviewSubmit={(event) => void saveExpertReview(event)}
            onFileChange={setNewFile}
            onFindingCancelEdit={cancelFindingEdit}
            onFindingChange={setNewFinding}
            onFindingEdit={editFinding}
            onFindingSubmit={(event) => void saveFinding(event)}
            onGridAssetChange={setNewGridAsset}
            onNoteChange={setNewNote}
            onNoteTypeChange={setNewNoteType}
            onPendingStatusChange={setPendingStatus}
            onRegenerateReportAll={() => void generateReportDraft(true)}
            onReportDraftPackageSave={saveReportDraftPackage}
            onReportGenerate={() => void generateReportDraft(false)}
            onReportReadyForReview={() => void upsertReportExportStatus("ready_for_review", "Report marked ready for review.")}
            onReportSectionChange={updateReportSectionDraft}
            onReportSectionSave={(templateSectionId) => void saveReportSection(templateSectionId)}
            onScoreDraftChange={updateScoreDraft}
            onScorecardSubmit={(event) => void saveScorecard(event)}
            onStatusSave={() => void updateStatus()}
            onVerdictChange={setVerdictDraft}
            onVerdictSubmit={(event) => void saveVerdict(event)}
            onWorkflowToast={showToast}
          />
        ) : null}
        </div>
      </div>
    </main>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: ThemePreference; onToggle: () => void }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isDark}
      className={secondaryButtonClass}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {isDark ? "Light" : "Dark"}
    </button>
  );
}

function MissingConfig() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--foreground)]">
      <section className="mx-auto max-w-2xl rounded-lg border border-[var(--color-warning)] bg-[var(--color-surface)] p-6 shadow-sm shadow-[var(--color-shadow)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
            <AlertCircle size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Supabase connection needed</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">Create `web/.env.local` and restart the dev server.</p>
          </div>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-50">
          <code>{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}</code>
        </pre>
      </section>
    </main>
  );
}

function Dashboard({
  assessments,
  dashboardSort,
  evidenceGapAssessmentIds,
  loading,
  searchTerm,
  selectedStatusFilters,
  setDashboardSort,
  setSearchTerm,
  stats,
  onClearStatusFilters,
  onOpen,
  onToggleStatusFilter,
}: {
  assessments: AssessmentListRow[];
  dashboardSort: DashboardSortOption;
  evidenceGapAssessmentIds: Set<string>;
  loading: boolean;
  searchTerm: string;
  selectedStatusFilters: Set<AssessmentStatus>;
  setDashboardSort: (value: DashboardSortOption) => void;
  setSearchTerm: (value: string) => void;
  stats: DashboardStats;
  onClearStatusFilters: () => void;
  onOpen: (assessmentId: string) => void;
  onToggleStatusFilter: (status: AssessmentStatus) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm shadow-[var(--color-shadow)]">
        <div className="grid gap-4 border-b border-[var(--color-border)] px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
                <ClipboardList size={17} />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">
                ERCOT / Texas intake
              </p>
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Assessment portal</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              {assessments.length} visible record{assessments.length === 1 ? "" : "s"} across customer, site, grid, and delivery readiness.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:w-[520px] xl:grid-cols-5">
            <PortalStat icon={<ClipboardList size={15} />} label="Total" value={stats.total.toString()} />
            <PortalStat icon={<NotebookPen size={15} />} label="Intake" tone={stats.needsIntake > 0 ? "warning" : "success"} value={stats.needsIntake.toString()} />
            <PortalStat icon={<ShieldCheck size={15} />} label="Review" tone={stats.inReview > 0 ? "info" : "neutral"} value={stats.inReview.toString()} />
            <PortalStat icon={<AlertTriangle size={15} />} label="Gaps" tone={stats.evidenceGaps > 0 ? "danger" : "success"} value={stats.evidenceGaps.toString()} />
            <PortalStat icon={<FileText size={15} />} label="Drafts" tone={stats.reportsDrafting > 0 ? "brand" : "neutral"} value={stats.reportsDrafting.toString()} />
          </div>
        </div>

        <div className="space-y-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/65 px-4 py-4 sm:px-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
            <label className="relative block min-w-0">
              <span className="sr-only">Search assessments</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search assessments, customer, site, utility, TSP"
                className={cx(inputClass, "pl-9")}
              />
            </label>
            <label className="block min-w-0">
              <span className="sr-only">Sort assessments</span>
              <select
                value={dashboardSort}
                onChange={(event) => setDashboardSort(event.target.value as DashboardSortOption)}
                className={inputClass}
              >
                {dashboardSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={onClearStatusFilters}
              className={dashboardFilterClass(selectedStatusFilters.size === 0)}
            >
              All
            </button>
            {dashboardStatusOptions.map((status) => {
              const selected = selectedStatusFilters.has(status.value);

              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => onToggleStatusFilter(status.value)}
                  aria-pressed={selected}
                  className={dashboardFilterClass(selected)}
                >
                  {status.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-5 py-3 font-semibold">Assessment</th>
                <th className="px-5 py-3 font-semibold">Customer / site</th>
                <th className="px-5 py-3 font-semibold">Grid context</th>
                <th className="px-5 py-3 font-semibold">Schedule</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr>
                  <td className="px-5 py-10 text-center text-[var(--color-text-secondary)]" colSpan={6}>
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      Loading assessments
                    </span>
                  </td>
                </tr>
              ) : null}

              {!loading && assessments.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-[var(--color-text-secondary)]" colSpan={6}>
                    No assessments match the current filters
                  </td>
                </tr>
              ) : null}

              {!loading
                ? assessments.map((assessment) => {
                    const site = single(assessment.sites);
                    const project = single(assessment.projects);
                    const organisation = single(project?.organisations);
                    const nextAction = getDashboardNextAction(assessment, evidenceGapAssessmentIds);

                    return (
                      <tr key={assessment.id} className="group transition hover:bg-[var(--color-surface-muted)]/70">
                        <td className="max-w-[260px] px-5 py-4 align-top">
                          <p className="truncate font-semibold text-[var(--color-text-primary)]">{assessment.assessment_name}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <StatusPill tone="brand">{assessment.market_region || "Market pending"}</StatusPill>
                            <StatusPill tone={nextAction.tone}>{nextAction.label}</StatusPill>
                          </div>
                        </td>
                        <td className="max-w-[280px] px-5 py-4 align-top">
                          <p className="truncate font-medium text-[var(--color-text-primary)]">{organisation?.name ?? "Unassigned"}</p>
                          <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">{site?.site_name ?? project?.name ?? "Site pending"}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {[site?.county, site?.state].filter(Boolean).join(", ") || "Location pending"}
                          </p>
                        </td>
                        <td className="max-w-[220px] px-5 py-4 align-top">
                          <p className="truncate font-medium text-[var(--color-text-primary)]">{assessment.known_utility || "Utility pending"}</p>
                          <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">{assessment.known_tsp || "TSP pending"}</p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold text-[var(--color-text-primary)]">
                            {assessment.target_load_mw ? `${assessment.target_load_mw} MW` : "Load pending"}
                          </p>
                          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatDate(assessment.desired_energization_date)}</p>
                        </td>
                        <td className="min-w-[210px] px-5 py-4 align-top">
                          <div className="mb-3 flex flex-wrap gap-2">
                            <StatusBadge status={assessment.status} />
                          </div>
                          <CompletenessBar value={assessment.intake_completeness_score} />
                        </td>
                        <td className="px-5 py-4 align-top">
                          <button
                            type="button"
                            onClick={() => onOpen(assessment.id)}
                            className={secondaryButtonClass}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-[var(--color-border)] lg:hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-[var(--color-text-secondary)]">
              <Loader2 className="animate-spin" size={16} />
              Loading assessments
            </div>
          ) : null}

          {!loading && assessments.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--color-text-secondary)]">
              No assessments match the current filters
            </div>
          ) : null}

          {!loading
            ? assessments.map((assessment) => {
                const site = single(assessment.sites);
                const project = single(assessment.projects);
                const organisation = single(project?.organisations);
                const nextAction = getDashboardNextAction(assessment, evidenceGapAssessmentIds);

                return (
                  <article key={assessment.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--color-text-primary)]">{assessment.assessment_name}</p>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{organisation?.name ?? "Unassigned"}</p>
                      </div>
                      <button type="button" onClick={() => onOpen(assessment.id)} className={secondaryButtonClass}>
                        Open
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                      <DashboardSignal label="Site" value={site?.site_name ?? project?.name ?? "Site pending"} />
                      <DashboardSignal label="Grid" value={[assessment.known_utility, assessment.known_tsp].filter(Boolean).join(" / ") || "Grid pending"} />
                      <DashboardSignal label="Load" value={assessment.target_load_mw ? `${assessment.target_load_mw} MW` : "Load pending"} />
                      <DashboardSignal label="Target" value={formatDate(assessment.desired_energization_date)} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge status={assessment.status} />
                      <StatusPill tone={nextAction.tone}>{nextAction.label}</StatusPill>
                    </div>
                    <div className="mt-3">
                      <CompletenessBar value={assessment.intake_completeness_score} />
                    </div>
                  </article>
                );
              })
            : null}
        </div>
      </section>
    </div>
  );
}

function dashboardFilterClass(selected: boolean) {
  return cx(
    "inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]",
    selected
      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]"
      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]",
  );
}

function PortalStat({
  icon,
  label,
  tone = "neutral",
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "brand" | "danger" | "info" | "neutral" | "success" | "warning";
  value: string;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[var(--color-text-secondary)]">
        <span className={cx("text-[var(--color-text-secondary)]", tone === "brand" && "text-[var(--color-brand-primary)]", tone === "danger" && "text-[var(--color-danger)]", tone === "info" && "text-[var(--color-info)]", tone === "success" && "text-[var(--color-success)]", tone === "warning" && "text-[var(--color-warning)]")}>
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className="text-lg font-semibold leading-none text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function DashboardSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</span>
      <span className="truncate font-medium text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function AssessmentForm({
  completenessScore,
  form,
  formMode,
  recommendedStatus,
  saving,
  updateForm,
  onAddressSelected,
  onBack,
  onSubmitBlocked,
  onStepCompleted,
  onSubmit,
}: {
  completenessScore: number;
  form: AssessmentFormState;
  formMode: FormMode;
  recommendedStatus: AssessmentStatus;
  saving: boolean;
  updateForm: <K extends keyof AssessmentFormState>(key: K, value: AssessmentFormState[K]) => void;
  onAddressSelected: () => void;
  onBack: () => void;
  onSubmitBlocked: (blockerCount: number) => void;
  onStepCompleted: (stepId: IntakeStepId, status: IntakeStepStatus, nextStepId: IntakeStepId) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [currentStepId, setCurrentStepId] = useState<IntakeStepId>("customer_project");
  const [visitedStepIds, setVisitedStepIds] = useState<Set<IntakeStepId>>(new Set(["customer_project"]));
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [autofilledFields, setAutofilledFields] = useState<Set<keyof AssessmentFormState>>(new Set());
  const [addressConfirmation, setAddressConfirmation] = useState("");
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const validationSummaryRef = useRef<HTMLDivElement | null>(null);

  const currentStepIndex = intakeWizardSteps.findIndex((step) => step.id === currentStepId);
  const currentStep = intakeWizardSteps[currentStepIndex] ?? intakeWizardSteps[0];
  const fieldErrors = useMemo(() => getFieldValidationState(form), [form]);
  const allBlockers = useMemo(() => getAllIntakeBlockers(form), [form]);
  const allWarnings = useMemo(() => getIntakeWarnings(form), [form]);
  const stepCompletions = useMemo(
    () => intakeWizardSteps.map((step) => calculateIntakeStepCompletion(form, step.id)),
    [form],
  );
  const currentCompletion = stepCompletions.find((step) => step.stepId === currentStepId) ?? stepCompletions[0];
  const currentWarnings = allWarnings.filter((warning) => warning.stepId === currentStepId);
  const isReviewStep = currentStepId === "review";
  const isFirstStep = currentStepIndex <= 0;
  const isLastStep = currentStepIndex >= intakeWizardSteps.length - 1;

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [currentStepId]);

  function trackCurrentStepCompleted(nextStepId: IntakeStepId) {
    if (nextStepId === currentStepId) {
      return;
    }

    onStepCompleted(currentStepId, currentCompletion.status, nextStepId);
  }

  function goToStep(stepId: IntakeStepId, trackCompletion = false) {
    if (trackCompletion) {
      trackCurrentStepCompleted(stepId);
    }

    setCurrentStepId(stepId);
    setVisitedStepIds((current) => new Set([...current, stepId]));
  }

  function goToNextStep() {
    const nextStep = intakeWizardSteps[Math.min(currentStepIndex + 1, intakeWizardSteps.length - 1)];

    if (nextStep) {
      trackCurrentStepCompleted(nextStep.id);
      goToStep(nextStep.id);
    }
  }

  function goToPreviousStep() {
    const previousStep = intakeWizardSteps[Math.max(currentStepIndex - 1, 0)];

    if (previousStep) {
      goToStep(previousStep.id);
    }
  }

  function getFieldError(field: keyof AssessmentFormState) {
    if (attemptedSubmit || form[field].trim()) {
      return fieldErrors[field];
    }

    return undefined;
  }

  function getFieldBadge(field: keyof AssessmentFormState) {
    return autofilledFields.has(field) ? "Autofilled" : undefined;
  }

  function handleAddressSelect(suggestion: AddressSuggestion) {
    updateForm("address", suggestion.addressLine1 || suggestion.formattedAddress);
    updateForm("city", suggestion.city);
    updateForm("county", suggestion.county);
    updateForm("state", suggestion.stateCode || suggestion.state || form.state);
    updateForm("latitude", suggestion.latitude.toFixed(6));
    updateForm("longitude", suggestion.longitude.toFixed(6));
    setAutofilledFields(
      new Set<keyof AssessmentFormState>(["address", "city", "county", "state", "latitude", "longitude"]),
    );
    setAddressConfirmation("Address selected. Location fields and coordinates were filled from lookup.");
    onAddressSelected();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttemptedSubmit(true);

    if (allBlockers.length > 0) {
      goToStep("review");
      onSubmitBlocked(allBlockers.length);
      window.setTimeout(() => validationSummaryRef.current?.focus(), 0);
      return;
    }

    onSubmit(event);
  }

  const visibleStepBlockers = isReviewStep ? allBlockers : currentCompletion.blockers;
  const formStatusTone = allBlockers.length > 0 ? "warning" : completenessScore >= 75 ? "success" : completenessScore >= 45 ? "info" : "neutral";
  const submitDisabled = saving || allBlockers.length > 0;
  const submitTitle = allBlockers.length > 0 ? "Resolve required fields before saving" : undefined;

  return (
    <form onSubmit={handleSubmit}>
      <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm shadow-[var(--color-shadow)]">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={onBack} className={secondaryButtonClass}>
                  <ArrowLeft size={16} />
                  Back
                </button>
                <StatusPill tone={formStatusTone}>{statusLabel(recommendedStatus)}</StatusPill>
                <StatusPill tone="neutral">
                  Step {currentStepIndex + 1} / {intakeWizardSteps.length}
                </StatusPill>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">
                {formMode === "create" ? "New diligence record" : "Assessment intake"}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
                {formMode === "create" ? "New site assessment" : "Edit intake"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                {currentStep.label} · {currentStep.description}
              </p>
            </div>
            <div className="grid gap-3 xl:w-[460px]">
              <CompletenessBar value={completenessScore} />
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {isReviewStep ? (
                  <button type="submit" disabled={submitDisabled} title={submitTitle} className={primaryButtonClass}>
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    {formMode === "create" ? "Create assessment" : "Save intake"}
                  </button>
                ) : (
                  <button type="button" onClick={goToNextStep} className={primaryButtonClass}>
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/70 px-4 py-3 sm:px-5">
          <WizardStepper
            activeStepId={currentStepId}
            completions={stepCompletions}
            visitedStepIds={visitedStepIds}
            onStepChange={(stepId) => goToStep(stepId, visitedStepIds.has(stepId))}
          />
        </div>

        <div className="grid gap-5 bg-[var(--color-surface-muted)]/60 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[var(--color-brand-primary)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-brand-primary-soft)]">
                    {stepIcon(currentStep.id)}
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em]">{currentStep.label}</p>
                </div>
                <h3
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="rounded-md text-xl font-semibold text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  {currentStep.description}
                </h3>
              </div>
              <StepCompletionBadge status={currentCompletion.status} />
            </div>

            <div className="mt-5">
            <StepAlerts
              blockers={visibleStepBlockers}
              warnings={currentWarnings}
              attemptedSubmit={attemptedSubmit}
              validationSummaryRef={validationSummaryRef}
              onBlockerClick={(blocker) => goToStep(blocker.stepId)}
            />

            {currentStepId === "customer_project" ? (
              <FieldGroup icon={<Building2 size={18} />} title="Customer and project">
                <TextField
                  id="organisationName"
                  label="Organisation"
                  value={form.organisationName}
                  required
                  error={getFieldError("organisationName")}
                  onChange={(value) => updateForm("organisationName", value)}
                />
                <SelectField
                  id="organisationType"
                  label="Organisation type"
                  value={form.organisationType}
                  options={organisationTypes}
                  onChange={(value) => updateForm("organisationType", value)}
                />
                <TextField
                  id="contactName"
                  label="Contact name"
                  value={form.contactName}
                  onChange={(value) => updateForm("contactName", value)}
                />
                <TextField
                  id="contactEmail"
                  label="Contact email"
                  type="email"
                  value={form.contactEmail}
                  required
                  error={getFieldError("contactEmail")}
                  onChange={(value) => updateForm("contactEmail", value)}
                />
                <TextField
                  id="contactPhone"
                  label="Contact phone"
                  value={form.contactPhone}
                  onChange={(value) => updateForm("contactPhone", value)}
                />
                <TextField
                  id="contactRoleTitle"
                  label="Contact role"
                  value={form.contactRoleTitle}
                  onChange={(value) => updateForm("contactRoleTitle", value)}
                />
                <TextField
                  id="projectName"
                  label="Project name"
                  value={form.projectName}
                  required
                  error={getFieldError("projectName")}
                  onChange={(value) => updateForm("projectName", value)}
                />
                <SelectField
                  id="projectType"
                  label="Project type"
                  value={form.projectType}
                  options={projectTypes}
                  onChange={(value) => updateForm("projectType", value)}
                />
                <TextField
                  id="projectDeadline"
                  label="Project deadline"
                  type="date"
                  value={form.projectDeadline}
                  onChange={(value) => updateForm("projectDeadline", value)}
                />
                <SelectField
                  id="confidentialityStatus"
                  label="Confidentiality"
                  value={form.confidentialityStatus}
                  options={[
                    { value: "confidential", label: "Confidential" },
                    { value: "nda_required", label: "NDA required" },
                    { value: "public", label: "Public" },
                    { value: "internal_only", label: "Internal only" },
                  ]}
                  onChange={(value) => updateForm("confidentialityStatus", value)}
                />
                <TextAreaField
                  id="projectDescription"
                  label="Project description"
                  value={form.projectDescription}
                  onChange={(value) => updateForm("projectDescription", value)}
                />
              </FieldGroup>
            ) : null}

            {currentStepId === "site_location" ? (
              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <FieldGroup icon={<MapPin size={18} />} title="Site location">
                  <TextField
                    id="siteName"
                    label="Site name"
                    value={form.siteName}
                    required
                    error={getFieldError("siteName")}
                    onChange={(value) => {
                      updateForm("siteName", value);
                      if (!form.assessmentName.trim()) {
                        updateForm("assessmentName", value ? `${value} assessment` : "");
                      }
                    }}
                  />
                  <AddressAutocompleteField
                    id="address"
                    label="Address"
                    value={form.address}
                    badge={getFieldBadge("address")}
                    error={getFieldError("address")}
                    helpText="Use lookup when possible so coordinates and county are populated consistently."
                    onChange={(value) => {
                      updateForm("address", value);
                      setAddressConfirmation("");
                    }}
                    onSelect={handleAddressSelect}
                  />
                  <TextField
                    id="city"
                    label="City"
                    value={form.city}
                    badge={getFieldBadge("city")}
                    onChange={(value) => updateForm("city", value)}
                  />
                  <TextField
                    id="county"
                    label="County"
                    value={form.county}
                    badge={getFieldBadge("county")}
                    onChange={(value) => updateForm("county", value)}
                  />
                  <TextField
                    id="state"
                    label="State"
                    value={form.state}
                    badge={getFieldBadge("state")}
                    onChange={(value) => updateForm("state", value)}
                  />
                  <TextField
                    id="latitude"
                    label="Latitude"
                    inputMode="decimal"
                    value={form.latitude}
                    badge={getFieldBadge("latitude")}
                    error={getFieldError("latitude")}
                    onChange={(value) => updateForm("latitude", value)}
                  />
                  <TextField
                    id="longitude"
                    label="Longitude"
                    inputMode="decimal"
                    value={form.longitude}
                    badge={getFieldBadge("longitude")}
                    error={getFieldError("longitude")}
                    onChange={(value) => updateForm("longitude", value)}
                  />
                  <TextField id="parcelId" label="Parcel ID" value={form.parcelId} onChange={(value) => updateForm("parcelId", value)} />
                  {addressConfirmation ? (
                    <div className="sm:col-span-2">
                      <InlineNotice tone="success" message={addressConfirmation} />
                    </div>
                  ) : null}
                </FieldGroup>
                <LocationPreview form={form} />
              </div>
            ) : null}

            {currentStepId === "load_timing" ? (
              <FieldGroup icon={<Zap size={18} />} title="Load and timing">
                <TextField
                  id="assessmentName"
                  label="Assessment name"
                  value={form.assessmentName}
                  onChange={(value) => updateForm("assessmentName", value)}
                />
                <TextField
                  id="marketRegion"
                  label="Market region"
                  value={form.marketRegion}
                  onChange={(value) => updateForm("marketRegion", value)}
                />
                <TextField
                  id="targetLoadMw"
                  label="Target load MW"
                  inputMode="decimal"
                  value={form.targetLoadMw}
                  required
                  error={getFieldError("targetLoadMw")}
                  onChange={(value) => updateForm("targetLoadMw", value)}
                />
                <TextField
                  id="initialLoadMw"
                  label="Initial phase MW"
                  inputMode="decimal"
                  value={form.initialLoadMw}
                  error={getFieldError("initialLoadMw")}
                  onChange={(value) => updateForm("initialLoadMw", value)}
                />
                <TextField
                  id="fullBuildoutLoadMw"
                  label="Full buildout MW"
                  inputMode="decimal"
                  value={form.fullBuildoutLoadMw}
                  error={getFieldError("fullBuildoutLoadMw")}
                  onChange={(value) => updateForm("fullBuildoutLoadMw", value)}
                />
                <TextField
                  id="desiredEnergizationDate"
                  label="Desired energization"
                  type="date"
                  value={form.desiredEnergizationDate}
                  required
                  error={getFieldError("desiredEnergizationDate")}
                  onChange={(value) => updateForm("desiredEnergizationDate", value)}
                />
                <TextField
                  id="projectStage"
                  label="Project stage"
                  value={form.projectStage}
                  onChange={(value) => updateForm("projectStage", value)}
                />
                <TextField
                  id="landControlStatus"
                  label="Land control"
                  value={form.landControlStatus}
                  onChange={(value) => updateForm("landControlStatus", value)}
                />
              </FieldGroup>
            ) : null}

            {currentStepId === "grid_context" ? (
              <FieldGroup icon={<BarChart3 size={18} />} title="Grid context">
                <TextField label="Known utility" id="knownUtility" value={form.knownUtility} onChange={(value) => updateForm("knownUtility", value)} />
                <TextField label="Known TSP" id="knownTsp" value={form.knownTsp} onChange={(value) => updateForm("knownTsp", value)} />
                <TextField
                  id="knownSubstationOrPoi"
                  label="Known substation or POI"
                  value={form.knownSubstationOrPoi}
                  onChange={(value) => updateForm("knownSubstationOrPoi", value)}
                />
                <TextAreaField
                  id="existingStudiesSummary"
                  label="Existing studies"
                  value={form.existingStudiesSummary}
                  onChange={(value) => updateForm("existingStudiesSummary", value)}
                />
                <TextAreaField
                  id="existingPowerQuoteSummary"
                  label="Existing power quote"
                  value={form.existingPowerQuoteSummary}
                  onChange={(value) => updateForm("existingPowerQuoteSummary", value)}
                />
              </FieldGroup>
            ) : null}

            {currentStepId === "risk_flexibility" ? (
              <FieldGroup icon={<ShieldCheck size={18} />} title="Risk and flexibility">
                <TextAreaField
                  id="backupGenerationAssumptions"
                  label="Backup generation"
                  value={form.backupGenerationAssumptions}
                  onChange={(value) => updateForm("backupGenerationAssumptions", value)}
                />
                <TextAreaField
                  id="batteryStorageAssumptions"
                  label="Battery/storage"
                  value={form.batteryStorageAssumptions}
                  onChange={(value) => updateForm("batteryStorageAssumptions", value)}
                />
                <SelectField
                  id="curtailmentWillingness"
                  label="Curtailment willingness"
                  value={form.curtailmentWillingness}
                  options={curtailmentOptions}
                  onChange={(value) => updateForm("curtailmentWillingness", value)}
                />
                <TextAreaField
                  id="workloadFlexibilityAssumptions"
                  label="Workload flexibility"
                  value={form.workloadFlexibilityAssumptions}
                  onChange={(value) => updateForm("workloadFlexibilityAssumptions", value)}
                />
                <TextAreaField
                  id="waterCoolingNotes"
                  label="Water/cooling"
                  value={form.waterCoolingNotes}
                  onChange={(value) => updateForm("waterCoolingNotes", value)}
                />
              </FieldGroup>
            ) : null}

            {currentStepId === "evidence_references" ? (
              <EvidenceReferencesStep form={form} />
            ) : null}

            {currentStepId === "review" ? (
              <WizardReviewPanel
                blockers={allBlockers}
                completenessScore={completenessScore}
                fieldErrors={fieldErrors}
                form={form}
                recommendedStatus={recommendedStatus}
                warnings={allWarnings}
                validationSummaryRef={validationSummaryRef}
                onStepSelect={(stepId) => goToStep(stepId)}
              />
            ) : null}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={goToPreviousStep} disabled={isFirstStep} className={secondaryButtonClass}>
              <ArrowLeft size={16} />
              Previous
            </button>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {!isReviewStep ? (
                <button type="button" onClick={() => goToStep("review", true)} className={secondaryButtonClass}>
                  <ClipboardList size={16} />
                  Review
                </button>
              ) : null}
              {isLastStep ? (
                <button type="submit" disabled={submitDisabled} title={submitTitle} className={primaryButtonClass}>
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  {formMode === "create" ? "Create assessment" : "Save intake"}
                </button>
              ) : (
                <button type="button" onClick={goToNextStep} className={primaryButtonClass}>
                  Next
                </button>
              )}
            </div>
          </div>
          </section>

          <IntakeSmartRail
            blockers={allBlockers}
            completenessScore={completenessScore}
            currentCompletion={currentCompletion}
            currentStep={currentStep}
            form={form}
            recommendedStatus={recommendedStatus}
            warnings={allWarnings}
            onStepSelect={(stepId) => goToStep(stepId)}
          />
        </div>
      </section>
    </form>
  );
}

function WizardStepper({
  activeStepId,
  completions,
  visitedStepIds,
  onStepChange,
}: {
  activeStepId: IntakeStepId;
  completions: Array<ReturnType<typeof calculateIntakeStepCompletion>>;
  visitedStepIds: Set<IntakeStepId>;
  onStepChange: (stepId: IntakeStepId) => void;
}) {
  const completionsByStep = new Map(completions.map((completion) => [completion.stepId, completion]));

  return (
    <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Intake steps">
      {intakeWizardSteps.map((step, index) => {
        const completion = completionsByStep.get(step.id);
        const isActive = activeStepId === step.id;
        const wasVisited = visitedStepIds.has(step.id);

        return (
          <li key={step.id} className="min-w-[148px] flex-1 xl:min-w-0">
            <button
              type="button"
              onClick={() => onStepChange(step.id)}
              aria-current={isActive ? "step" : undefined}
              className={cx(
                "flex h-12 w-full items-center gap-2 rounded-md border px-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]",
                isActive
                  ? "border-[var(--color-brand-primary)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm shadow-[var(--color-shadow)]"
                  : "border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface)]",
              )}
            >
              <span
                className={cx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                  isActive ? "bg-[var(--color-brand-primary)] text-[var(--color-brand-primary-contrast)]" : "bg-[var(--color-surface-strong)] text-[var(--color-text-secondary)]",
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold leading-5">{step.shortLabel}</span>
                <span className="block truncate text-[11px] font-medium text-[var(--color-text-secondary)]">
                  {completionStatusLabel(completion?.status ?? "not_started", wasVisited)}
                </span>
              </span>
              <span
                className={cx(
                  "ml-auto h-2.5 w-2.5 shrink-0 rounded-full",
                  stepStatusDotClass(completion?.status ?? "not_started", wasVisited),
                )}
                aria-hidden="true"
              />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function stepIcon(stepId: IntakeStepId) {
  const icons: Record<IntakeStepId, React.ReactNode> = {
    customer_project: <Building2 size={16} />,
    evidence_references: <FileText size={16} />,
    grid_context: <BarChart3 size={16} />,
    load_timing: <Zap size={16} />,
    review: <ClipboardList size={16} />,
    risk_flexibility: <ShieldCheck size={16} />,
    site_location: <MapPin size={16} />,
  };

  return icons[stepId];
}

function completionStatusLabel(status: IntakeStepStatus, visited?: boolean) {
  const labels: Record<IntakeStepStatus, string> = {
    blocked: "Needs attention",
    complete: "Complete",
    not_started: visited ? "Visited" : "Not started",
    partial: "In progress",
  };

  return labels[status];
}

function stepStatusDotClass(status: IntakeStepStatus, visited?: boolean) {
  if (status === "complete") {
    return "bg-[var(--color-success)]";
  }

  if (status === "blocked") {
    return "bg-[var(--color-warning)]";
  }

  if (status === "partial" || visited) {
    return "bg-[var(--color-info)]";
  }

  return "bg-[var(--color-border)]";
}

function IntakeSmartRail({
  blockers,
  completenessScore,
  currentCompletion,
  currentStep,
  form,
  recommendedStatus,
  warnings,
  onStepSelect,
}: {
  blockers: IntakeBlocker[];
  completenessScore: number;
  currentCompletion: ReturnType<typeof calculateIntakeStepCompletion>;
  currentStep: (typeof intakeWizardSteps)[number];
  form: AssessmentFormState;
  recommendedStatus: AssessmentStatus;
  warnings: IntakeWarning[];
  onStepSelect: (stepId: IntakeStepId) => void;
}) {
  const blockerPreview = blockers.slice(0, 4);
  const warningPreview = warnings.slice(0, 2);
  const stepProgressLabel = currentCompletion.requiredFields > 0
    ? `${currentCompletion.completedFields}/${currentCompletion.requiredFields}`
    : currentCompletion.completedFields > 0
      ? `${currentCompletion.completedFields} captured`
      : "Optional";
  const stepProgressPercent = currentCompletion.requiredFields > 0
    ? Math.min(100, Math.round((currentCompletion.completedFields / currentCompletion.requiredFields) * 100))
    : currentCompletion.completedFields > 0
      ? 100
      : 0;

  return (
    <aside className="space-y-3 xl:sticky xl:top-24 xl:self-start">
      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[var(--color-brand-primary)]">
              <Sparkles size={16} />
              <p className="text-xs font-semibold uppercase tracking-[0.12em]">Intake brief</p>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{currentStep.shortLabel}</h3>
          </div>
          <StatusPill tone={blockers.length > 0 ? "warning" : completenessScore >= 75 ? "success" : "neutral"}>
            {statusLabel(recommendedStatus)}
          </StatusPill>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <IntakeRailMetric label="Complete" value={`${completenessScore}%`} />
          <IntakeRailMetric label="Required" tone={blockers.length > 0 ? "warning" : "success"} value={blockers.length.toString()} />
          <IntakeRailMetric label="Warnings" tone={warnings.length > 0 ? "info" : "neutral"} value={warnings.length.toString()} />
        </div>

        <div className="mt-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
            <span>Current step</span>
            <span>{stepProgressLabel}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-strong)]">
            <div
              className="h-full rounded-full bg-[var(--color-brand-primary)]"
              style={{ width: `${stepProgressPercent}%` }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Captured signals</h3>
        <div className="space-y-2 text-sm">
          <DashboardSignal label="Customer" value={form.organisationName || "Not set"} />
          <DashboardSignal label="Site" value={form.siteName || "Not set"} />
          <DashboardSignal label="Load" value={form.targetLoadMw ? `${form.targetLoadMw} MW` : "Not set"} />
          <DashboardSignal label="Target" value={form.desiredEnergizationDate ? formatDate(form.desiredEnergizationDate) : "Not set"} />
          <DashboardSignal label="Utility" value={form.knownUtility || "Not set"} />
        </div>
      </section>

      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Needs attention</h3>
          <StatusPill tone={blockers.length > 0 ? "warning" : "success"}>{blockers.length}</StatusPill>
        </div>

        {blockerPreview.length > 0 ? (
          <div className="space-y-2">
            {blockerPreview.map((blocker) => (
              <button
                key={blocker.id}
                type="button"
                onClick={() => onStepSelect(blocker.stepId)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-left text-sm transition hover:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              >
                <span className="min-w-0 truncate font-medium text-[var(--color-text-primary)]">{blocker.label}</span>
                <ChevronRight className="shrink-0 text-[var(--color-text-secondary)]" size={15} />
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-[var(--color-success)] bg-[var(--color-success-soft)] px-3 py-2 text-sm font-medium text-[var(--color-success)]">
            Required intake is clear.
          </p>
        )}

        {warningPreview.length > 0 ? (
          <div className="mt-3 space-y-2">
            {warningPreview.map((warning) => (
              <p key={warning.id} className="rounded-md border border-[var(--color-info)] bg-[var(--color-info-soft)] px-3 py-2 text-sm text-[var(--color-info)]">
                {warning.message}
              </p>
            ))}
          </div>
        ) : null}
      </section>
    </aside>
  );
}

function IntakeRailMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "info" | "neutral" | "success" | "warning";
  value: string;
}) {
  const toneClass = {
    info: "text-[var(--color-info)]",
    neutral: "text-[var(--color-text-primary)]",
    success: "text-[var(--color-success)]",
    warning: "text-[var(--color-warning)]",
  };

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-2 text-center">
      <p className={cx("text-lg font-semibold leading-none", toneClass[tone])}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
    </div>
  );
}

function StepCompletionBadge({
  compact,
  status,
  visited,
}: {
  compact?: boolean;
  status: ReturnType<typeof calculateIntakeStepCompletion>["status"];
  visited?: boolean;
}) {
  const labels = {
    blocked: "Needs attention",
    complete: "Complete",
    not_started: visited ? "Visited" : "Not started",
    partial: "In progress",
  };
  const styles = {
    blocked: "border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    complete: "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
    not_started: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]",
    partial: "border-[var(--color-info)] bg-[var(--color-info-soft)] text-[var(--color-info)]",
  };

  return (
    <span className={cx("inline-flex rounded-md border font-semibold", compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs", styles[status])}>
      {labels[status]}
    </span>
  );
}

function StepAlerts({
  attemptedSubmit,
  blockers,
  validationSummaryRef,
  warnings,
  onBlockerClick,
}: {
  attemptedSubmit: boolean;
  blockers: IntakeBlocker[];
  validationSummaryRef: React.RefObject<HTMLDivElement | null>;
  warnings: IntakeWarning[];
  onBlockerClick: (blocker: IntakeBlocker) => void;
}) {
  const showBlockers = attemptedSubmit && blockers.length > 0;

  if (!showBlockers && warnings.length === 0) {
    return null;
  }

  return (
    <div className="mb-5 space-y-3">
      {showBlockers ? (
        <div
          ref={validationSummaryRef}
          tabIndex={-1}
          className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning)] outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <div className="min-w-0">
              <p className="font-semibold">Required fields need attention</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {blockers.map((blocker) => (
                  <button
                    key={blocker.id}
                    type="button"
                    onClick={() => onBlockerClick(blocker)}
                    className="rounded-md border border-[var(--color-warning)] bg-[var(--color-surface)] px-2 py-1 text-xs font-semibold text-[var(--color-warning)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                  >
                    {blocker.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="rounded-lg border border-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-3 text-sm text-[var(--color-info)]">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-semibold">Review notes</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {warnings.map((warning) => (
                  <li key={warning.id}>{warning.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InlineNotice({ message, tone }: { message: string; tone: "success" | "warning" | "info" }) {
  const styles = {
    info: "border-[var(--color-info)] bg-[var(--color-info-soft)] text-[var(--color-info)]",
    success: "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
    warning: "border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  };
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : AlertCircle;

  return (
    <div className={cx("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", styles[tone])}>
      <Icon className="mt-0.5 shrink-0" size={16} />
      <span>{message}</span>
    </div>
  );
}

function LocationPreview({ form }: { form: AssessmentFormState }) {
  const latitude = parseOptionalNumber(form.latitude);
  const longitude = parseOptionalNumber(form.longitude);
  const coordinatesReady = hasValidCoordinatePair(latitude, longitude);
  const addressOnly = !coordinatesReady && form.address.trim().length > 0;
  const stateLabel = coordinatesReady ? "Map ready" : addressOnly ? "Address only" : "Location incomplete";
  const tone = coordinatesReady ? "success" : addressOnly ? "info" : "warning";
  const mapLink = coordinatesReady ? externalMapUrl(Number(latitude), Number(longitude)) : "";

  return (
    <aside className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
          <MapPin size={18} />
        </span>
        <div>
          <h4 className="text-base font-semibold text-[var(--color-text-primary)]">Location preview</h4>
          <p className="text-sm text-[var(--color-text-secondary)]">{form.siteName || "Site pending"}</p>
        </div>
      </div>
      <InlineNotice tone={tone} message={stateLabel} />
      {coordinatesReady ? (
        <div className="mt-4 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
          <div className="flex min-h-[140px] items-center justify-center bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-brand-primary)_15%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_srgb,var(--color-brand-primary)_15%,transparent)_1px,transparent_1px)] bg-[size:28px_28px] p-4 text-center">
            <div>
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-surface)] text-[var(--color-brand-primary)] shadow-sm shadow-[var(--color-shadow)]">
                <MapPin size={18} />
              </div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Coordinates ready for map layers</p>
              <p className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">
                {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
              </p>
            </div>
          </div>
          <a
            href={mapLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-brand-primary)] transition hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          >
            <ExternalLink size={15} />
            Open external map
          </a>
        </div>
      ) : null}
      <div className="mt-4 space-y-3 text-sm">
        <PreviewLine label="Address" value={form.address || "Not set"} />
        <PreviewLine label="County / state" value={[form.county, form.state].filter(Boolean).join(", ") || "Not set"} />
        <PreviewLine
          label="Coordinates"
          value={coordinatesReady ? `${latitude?.toFixed(6)}, ${longitude?.toFixed(6)}` : "Not set"}
        />
        <PreviewLine label="Parcel" value={form.parcelId || "Not set"} />
      </div>
    </aside>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 break-words font-medium text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function EvidenceReferencesStep({ form }: { form: AssessmentFormState }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
            <FileText size={18} />
          </span>
          <div>
            <h4 className="text-base font-semibold text-[var(--color-text-primary)]">Evidence readiness</h4>
            <p className="text-sm text-[var(--color-text-secondary)]">Formal evidence is linked after the assessment is created.</p>
          </div>
        </div>
        <div className="space-y-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          <p>
            Use this step to confirm whether early source material exists. After saving, add file references, evidence sources,
            and linked findings in the assessment workspace.
          </p>
          <InlineNotice
            tone="info"
            message="This release does not add new evidence persistence during intake; it keeps evidence work in the assessment workspace."
          />
        </div>
      </section>
      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
        <h4 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">Captured source context</h4>
        <div className="space-y-3">
          <PreviewLine label="Existing studies" value={form.existingStudiesSummary || "Not captured yet"} />
          <PreviewLine label="Existing power quote" value={form.existingPowerQuoteSummary || "Not captured yet"} />
          <PreviewLine label="Known utility" value={form.knownUtility || "Not set"} />
          <PreviewLine label="Known TSP" value={form.knownTsp || "Not set"} />
        </div>
      </section>
    </div>
  );
}

function WizardReviewPanel({
  blockers,
  completenessScore,
  fieldErrors,
  form,
  recommendedStatus,
  validationSummaryRef,
  warnings,
  onStepSelect,
}: {
  blockers: IntakeBlocker[];
  completenessScore: number;
  fieldErrors: FieldValidationMap;
  form: AssessmentFormState;
  recommendedStatus: AssessmentStatus;
  validationSummaryRef: React.RefObject<HTMLDivElement | null>;
  warnings: IntakeWarning[];
  onStepSelect: (stepId: IntakeStepId) => void;
}) {
  const errorsCount = Object.keys(fieldErrors).length;
  const validationValue = blockers.length > 0 ? `${blockers.length} blockers` : errorsCount > 0 ? `${errorsCount} errors` : "Clear";
  const validationTone = blockers.length > 0 || errorsCount > 0 ? "warn" : "ok";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <ReviewMetric label="Completeness" value={`${completenessScore}%`} />
        <ReviewMetric label="Suggested status" value={statusLabel(recommendedStatus)} />
        <ReviewMetric label="Validation" value={validationValue} tone={validationTone} />
      </div>

      <div
        ref={validationSummaryRef}
        tabIndex={-1}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
      >
        <h4 className="text-base font-semibold text-[var(--color-text-primary)]">Required blockers</h4>
        {blockers.length === 0 ? (
          <p className="mt-2 rounded-md border border-[var(--color-success)] bg-[var(--color-success-soft)] px-3 py-2 text-sm font-medium text-[var(--color-success)]">
            No required blockers. This intake is ready to save.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {blockers.map((blocker) => (
              <button
                key={blocker.id}
                type="button"
                onClick={() => onStepSelect(blocker.stepId)}
                className="flex w-full items-start gap-3 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-3 py-2 text-left text-sm text-[var(--color-warning)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              >
                <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                <span>
                  <span className="block font-semibold">{blocker.label}</span>
                  <span className="block">{blocker.message}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {warnings.length > 0 ? (
        <section className="rounded-md border border-[var(--color-info)] bg-[var(--color-info-soft)] p-4 text-sm text-[var(--color-info)]">
          <h4 className="font-semibold">Warnings to review</h4>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {warnings.map((warning) => (
              <li key={warning.id}>{warning.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewSection
          title="Customer & Project"
          stepId="customer_project"
          onStepSelect={onStepSelect}
          rows={[
            ["Organisation", form.organisationName],
            ["Contact", form.contactEmail || form.contactName],
            ["Project", form.projectName],
            ["Confidentiality", form.confidentialityStatus],
          ]}
        />
        <ReviewSection
          title="Site & Location"
          stepId="site_location"
          onStepSelect={onStepSelect}
          rows={[
            ["Site", form.siteName],
            ["Address", form.address],
            ["County / state", [form.county, form.state].filter(Boolean).join(", ")],
            ["Coordinates", [form.latitude, form.longitude].filter(Boolean).join(", ")],
          ]}
        />
        <ReviewSection
          title="Load & Timing"
          stepId="load_timing"
          onStepSelect={onStepSelect}
          rows={[
            ["Target load", form.targetLoadMw ? `${form.targetLoadMw} MW` : ""],
            ["Initial phase", form.initialLoadMw ? `${form.initialLoadMw} MW` : ""],
            ["Full buildout", form.fullBuildoutLoadMw ? `${form.fullBuildoutLoadMw} MW` : ""],
            ["Energization", form.desiredEnergizationDate ? formatDate(form.desiredEnergizationDate) : ""],
          ]}
        />
        <ReviewSection
          title="Grid Context"
          stepId="grid_context"
          onStepSelect={onStepSelect}
          rows={[
            ["Utility", form.knownUtility],
            ["TSP", form.knownTsp],
            ["Known POI", form.knownSubstationOrPoi],
            ["Studies", form.existingStudiesSummary],
          ]}
        />
        <ReviewSection
          title="Risk & Flexibility"
          stepId="risk_flexibility"
          onStepSelect={onStepSelect}
          rows={[
            ["Curtailment", form.curtailmentWillingness || "Unknown"],
            ["Backup generation", form.backupGenerationAssumptions],
            ["Battery/storage", form.batteryStorageAssumptions],
            ["Water/cooling", form.waterCoolingNotes],
          ]}
        />
        <ReviewSection
          title="Evidence & References"
          stepId="evidence_references"
          onStepSelect={onStepSelect}
          rows={[
            ["Existing studies", form.existingStudiesSummary],
            ["Existing quote", form.existingPowerQuoteSummary],
            ["Next step", "Add formal evidence after saving"],
          ]}
        />
      </div>
    </div>
  );
}

function ReviewMetric({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "ok" | "warn"; value: string }) {
  const toneClass = tone === "ok" ? "text-[var(--color-success)]" : tone === "warn" ? "text-[var(--color-warning)]" : "text-[var(--color-text-primary)]";

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className={cx("mt-1 text-lg font-semibold", toneClass)}>{value}</p>
    </div>
  );
}

function ReviewSection({
  onStepSelect,
  rows,
  stepId,
  title,
}: {
  onStepSelect: (stepId: IntakeStepId) => void;
  rows: Array<[string, string]>;
  stepId: IntakeStepId;
  title: string;
}) {
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h4>
        <button type="button" onClick={() => onStepSelect(stepId)} className="text-sm font-semibold text-[var(--color-brand-primary)] hover:underline">
          Edit
        </button>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 text-sm sm:grid-cols-[150px_1fr]">
            <span className="font-semibold text-[var(--color-text-secondary)]">{label}</span>
            <span className="break-words text-[var(--color-text-primary)]">{value || "Not set"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ToastStack({
  onDismiss,
  toasts,
}: {
  onDismiss: (id: string) => void;
  toasts: ToastMessage[];
}) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed right-4 top-20 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => {
        const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "warning" ? AlertTriangle : AlertCircle;
        const toneClass = {
          error: "border-rose-200 bg-rose-50 text-rose-800",
          info: "border-sky-200 bg-sky-50 text-[var(--color-brand-primary)]",
          success: "border-emerald-200 bg-emerald-50 text-emerald-800",
          warning: "border-amber-200 bg-amber-50 text-amber-900",
        }[toast.tone];

        return (
          <div key={toast.id} className={cx("rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur", toneClass)}>
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 shrink-0" size={18} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{toast.title}</p>
                {toast.body ? <p className="mt-1 leading-5">{toast.body}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="rounded-md px-1.5 py-0.5 font-semibold opacity-70 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/30"
                aria-label={`Dismiss ${toast.title}`}
              >
                x
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssessmentCommandHeader({
  appRole,
  assessment,
  metrics,
  nextAction,
  organisationName,
  pendingStatus,
  projectName,
  saving,
  siteName,
  onNextAction,
  onPendingStatusChange,
  onStatusSave,
}: {
  appRole: AppRole;
  assessment: AssessmentDetail;
  metrics: AssessmentMetric[];
  nextAction: AssessmentNextAction;
  organisationName: string;
  pendingStatus: AssessmentStatus;
  projectName: string;
  saving: boolean;
  siteName: string;
  onNextAction: () => void;
  onPendingStatusChange: (value: AssessmentStatus) => void;
  onStatusSave: () => void;
}) {
  const allowedTransitions = new Set(allowedAssessmentTransitions(assessment.status, appRole));
  const workflowStatusOptions = assessmentStatuses.filter(
    (status) => status.value === assessment.status || allowedTransitions.has(status.value),
  );

  return (
    <div className="grid gap-5 p-5 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={assessment.status} />
          <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-[var(--color-brand-primary)]">
            {assessment.market_region}
          </span>
        </div>
        <h2 className="text-2xl font-semibold leading-tight text-[var(--color-text-primary)]">{assessment.assessment_name}</h2>
        <div className="mt-3 grid gap-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
          <InfoLine icon={<Building2 size={16} />} label="Customer" value={organisationName} />
          <InfoLine icon={<ClipboardList size={16} />} label="Project" value={projectName} />
          <InfoLine icon={<MapPin size={16} />} label="Site" value={siteName} />
          <InfoLine icon={<CalendarDays size={16} />} label="Energization" value={formatDate(assessment.desired_energization_date)} />
          <InfoLine icon={<Zap size={16} />} label="Target load" value={assessment.target_load_mw ? `${assessment.target_load_mw} MW` : "Not set"} />
          <InfoLine icon={<UserRound size={16} />} label="Contact" value={assessment.contact?.email ?? assessment.contact?.name ?? "Not set"} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {metrics.map((metric) => (
            <AssessmentMetricTile key={metric.label} metric={metric} />
          ))}
        </div>
        <div className={cx("rounded-lg border px-3 py-3", metricToneClass(nextAction.tone))}>
          <p className="text-xs font-semibold uppercase opacity-80">Next action</p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold">{nextAction.label}</p>
            <button
              type="button"
              onClick={onNextAction}
              className="inline-flex h-9 items-center justify-center rounded-md border border-current/20 bg-[var(--color-surface)]/75 px-3 text-sm font-semibold transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-current/30"
            >
              Open
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]">Workflow status</label>
          <div className="flex gap-2">
            <select
              value={pendingStatus}
              onChange={(event) => onPendingStatusChange(event.target.value as AssessmentStatus)}
              className={cx(inputClass, "min-w-0 flex-1")}
            >
              {workflowStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={onStatusSave} disabled={saving} className={secondaryButtonClass}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssessmentMetricTile({ metric }: { metric: AssessmentMetric }) {
  return (
    <div className={cx("rounded-lg border px-3 py-2", metricToneClass(metric.tone))}>
      <p className="text-[11px] font-semibold uppercase opacity-75">{metric.label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{metric.value}</p>
    </div>
  );
}

function WorkspaceQuickLinks({ onOpen }: { onOpen: (sectionId: "overview" | AssessmentSectionId) => void }) {
  return (
    <nav className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-3" aria-label="Assessment sections">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {assessmentQuickLinks.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => onOpen(link.id)}
            className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          >
            {link.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function AssessmentOverviewCards({
  assessment,
  evidenceReadiness,
  gridAssets,
  nearestAsset,
  reportSavedCount,
  reportStatus,
  reportTemplateSections,
  scoreSummary,
  site,
  onEdit,
  onOpen,
}: {
  assessment: AssessmentDetail;
  evidenceReadiness: EvidenceReadinessSummary;
  gridAssets: GridAssetRecord[];
  nearestAsset: GridAssetRecord | null;
  reportSavedCount: number;
  reportStatus: ReportExportStatus;
  reportTemplateSections: ReportTemplateSectionRecord[];
  scoreSummary: ScorecardSummary;
  site: SiteRecord | null;
  onEdit: () => void;
  onOpen: (sectionId: AssessmentSectionId) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <OverviewCard
        title="Site"
        icon={<MapPin size={18} />}
        actionLabel="Edit intake"
        onAction={onEdit}
        rows={[
          ["Name", site?.site_name ?? "Not set"],
          ["Address", site?.address ?? "Not set"],
          ["County / state", [site?.county, site?.state].filter(Boolean).join(", ") || "Not set"],
          ["Coordinates", hasValidCoordinatePair(site?.latitude, site?.longitude) ? `${site?.latitude}, ${site?.longitude}` : "Not set"],
        ]}
      />
      <OverviewCard
        title="Load & Timing"
        icon={<Zap size={18} />}
        actionLabel="Edit intake"
        onAction={onEdit}
        rows={[
          ["Target load", assessment.target_load_mw ? `${assessment.target_load_mw} MW` : "Not set"],
          ["Initial phase", assessment.initial_load_mw ? `${assessment.initial_load_mw} MW` : "Not set"],
          ["Full buildout", assessment.full_buildout_load_mw ? `${assessment.full_buildout_load_mw} MW` : "Not set"],
          ["Energization", formatDate(assessment.desired_energization_date)],
        ]}
      />
      <OverviewCard
        title="Grid Context"
        icon={<BarChart3 size={18} />}
        actionLabel="Open map"
        onAction={() => onOpen("map")}
        rows={[
          ["Market", assessment.market_region],
          ["Utility", assessment.known_utility ?? "Not set"],
          ["TSP", assessment.known_tsp ?? "Not set"],
          ["Assets", gridAssets.length > 0 ? `${gridAssets.length} saved` : "No data yet"],
          ["Nearest", nearestAsset ? `${nearestAsset.asset_name} - ${formatDistanceMiles(nearestAsset.distance_miles)}` : "Not set"],
        ]}
      />
      <OverviewCard
        title="Evidence & Findings"
        icon={<FileText size={18} />}
        actionLabel="Open findings"
        onAction={() => onOpen("findings")}
        rows={[
          ["Sources", evidenceReadiness.totalSources.toString()],
          ["Findings", evidenceReadiness.totalFindings.toString()],
          ["Readiness", `${evidenceReadiness.readinessPercent}%`],
          ["High-risk gaps", evidenceReadiness.highRiskFindingsWithoutEvidence.toString()],
        ]}
      />
      <OverviewCard
        title="Score & Gates"
        icon={<CheckCircle2 size={18} />}
        actionLabel="Open scorecard"
        onAction={() => onOpen("scorecard")}
        rows={[
          ["Scorecard", `${scoreSummary.completedModules}/${scoreSummary.totalModules}`],
          ["Average", scoreSummary.averageScore === null ? "Not set" : `${scoreSummary.averageScore}/100`],
          ["Lowest", scoreSummary.lowestScore ? `${scoreSummary.lowestScore.label}: ${scoreSummary.lowestScore.score}` : "Not set"],
        ]}
      />
      <OverviewCard
        title="Report"
        icon={<ExternalLink size={18} />}
        actionLabel="Open report"
        onAction={() => onOpen("report_builder")}
        rows={[
          ["Template sections", reportTemplateSections.length ? reportTemplateSections.length.toString() : "No data yet"],
          ["Saved sections", `${reportSavedCount}/${reportTemplateSections.length || 18}`],
          ["Package", reportExportStatusLabel(reportStatus)],
        ]}
      />
    </div>
  );
}

function OverviewCard({
  actionLabel,
  icon,
  rows,
  title,
  onAction,
}: {
  actionLabel: string;
  icon: React.ReactNode;
  rows: Array<[string, string]>;
  title: string;
  onAction: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
            {icon}
          </span>
          <h4 className="truncate text-base font-semibold text-[var(--color-text-primary)]">{title}</h4>
        </div>
        <button type="button" onClick={onAction} className="shrink-0 text-sm font-semibold text-[var(--color-brand-primary)] hover:underline">
          {actionLabel}
        </button>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 text-sm sm:grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-500">{label}</span>
            <span className="min-w-0 break-words text-slate-800">{value || "Not set"}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function PanelShell({
  action,
  children,
  expanded,
  icon,
  sectionId,
  statusLabel,
  statusTone = "neutral",
  summary,
  title,
  warningLabel,
  onToggle,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  expanded: boolean;
  icon: React.ReactNode;
  sectionId: AssessmentSectionId;
  statusLabel: string;
  statusTone?: AssessmentMetric["tone"];
  summary: string;
  title: string;
  warningLabel?: string;
  onToggle: () => void;
}) {
  return (
    <section id={sectionId} className="scroll-mt-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm shadow-[var(--color-shadow)]">
      <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
            {icon}
          </span>
          <span className="min-w-0">
            <h3
              id={`${sectionId}-heading`}
              tabIndex={-1}
              className="text-base font-semibold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            >
              {title}
            </h3>
            <span id={`${sectionId}-summary`} className="mt-1 block text-sm text-[var(--color-text-secondary)]">
              {summary}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className={cx("rounded-md border px-2 py-1 text-xs font-semibold", metricToneClass(statusTone))}>
            {statusLabel}
          </span>
          {warningLabel ? (
            <span className="max-w-[260px] truncate rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-2 py-1 text-xs font-semibold text-[var(--color-warning)]">
              {warningLabel}
            </span>
          ) : null}
          {action}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={`${sectionId}-content`}
            aria-labelledby={`${sectionId}-heading`}
            aria-describedby={`${sectionId}-summary`}
            className={secondaryButtonClass}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {expanded ? (
        <div id={`${sectionId}-content`} className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function AssessmentDetailPanel({
  appRole,
  assessment,
  assessmentFindings,
  assessmentScores,
  assessmentVerdict,
  checklistError,
  checklistGroups,
  checklistLoading,
  checklistProgress,
  checklistTemplate,
  criticalFindingCount,
  deliveryGates,
  editingEvidenceSourceId,
  editingFindingId,
  evidenceError,
  evidenceGapCount,
  evidenceLoading,
  evidenceReadiness,
  evidenceSourceDraft,
  evidenceSources,
  expertReview,
  expertReviewDraft,
  expertReviewTriggers,
  files,
  findingDraft,
  findingEvidenceLinks,
  gridAssetDraft,
  gridAssetError,
  gridAssets,
  generatingReport,
  newFile,
  newNote,
  newNoteType,
  notes,
  pendingStatus,
  reportBuilderError,
  reportBuilderLoading,
  reportExport,
  reportSectionDrafts,
  reportSections,
  reportTemplate,
  reportTemplateSections,
  recentlySavedGridAssetId,
  saving,
  savingChecklistItemId,
  savingEvidenceSource,
  savingExpertReview,
  savingFinding,
  savingGridAsset,
  savingReportExport,
  savingReportSectionId,
  savingScorecard,
  savingVerdict,
  scoreDrafts,
  scoreSummary,
  scorecardError,
  scorecardLoading,
  verdictDraft,
  onAddFileReference,
  onAddGridAsset,
  onAddNote,
  onBack,
  onChecklistAutoFill,
  onChecklistChange,
  onChecklistSave,
  onChecklistSaveAll,
  onEvidenceSourceCancelEdit,
  onEvidenceSourceChange,
  onEvidenceSourceEdit,
  onEvidenceSourceSubmit,
  onEdit,
  onExpertReviewChange,
  onExpertReviewSubmit,
  onFileChange,
  onFindingCancelEdit,
  onFindingChange,
  onFindingEdit,
  onFindingSubmit,
  onGridAssetChange,
  onNoteChange,
  onNoteTypeChange,
  onPendingStatusChange,
  onRegenerateReportAll,
  onReportDraftPackageSave,
  onReportGenerate,
  onReportReadyForReview,
  onReportSectionChange,
  onReportSectionSave,
  onScoreDraftChange,
  onScorecardSubmit,
  onStatusSave,
  onVerdictChange,
  onVerdictSubmit,
  onWorkflowToast,
}: {
  appRole: AppRole;
  assessment: AssessmentDetail;
  assessmentFindings: AssessmentFindingRecord[];
  assessmentScores: AssessmentScoreRecord[];
  assessmentVerdict: AssessmentVerdictRecord | null;
  checklistError: string;
  checklistGroups: ChecklistModuleGroup[];
  checklistLoading: boolean;
  checklistProgress: ReturnType<typeof calculateChecklistProgress>;
  checklistTemplate: ChecklistTemplateRecord | null;
  criticalFindingCount: number;
  deliveryGates: DeliveryGate[];
  editingEvidenceSourceId: string;
  editingFindingId: string;
  evidenceError: string;
  evidenceGapCount: number;
  evidenceLoading: boolean;
  evidenceReadiness: EvidenceReadinessSummary;
  evidenceSourceDraft: EvidenceSourceDraft;
  evidenceSources: EvidenceSourceRecord[];
  expertReview: ExpertReviewRecord | null;
  expertReviewDraft: ExpertReviewDraft;
  expertReviewTriggers: ExpertReviewTriggerSummary;
  files: FileRecord[];
  findingDraft: AssessmentFindingDraft;
  findingEvidenceLinks: FindingEvidenceLinkRecord[];
  gridAssetDraft: GridAssetDraft;
  gridAssetError: string;
  gridAssets: GridAssetRecord[];
  generatingReport: boolean;
  newFile: { fileName: string; documentCategory: string; storagePath: string; description: string };
  newNote: string;
  newNoteType: string;
  notes: NoteRecord[];
  pendingStatus: AssessmentStatus;
  reportBuilderError: string;
  reportBuilderLoading: boolean;
  reportExport: AssessmentReportExportRecord | null;
  reportSectionDrafts: Record<string, ReportSectionDraft>;
  reportSections: AssessmentReportSectionRecord[];
  reportTemplate: ReportTemplateRecord | null;
  reportTemplateSections: ReportTemplateSectionRecord[];
  recentlySavedGridAssetId: string;
  saving: boolean;
  savingChecklistItemId: string;
  savingEvidenceSource: boolean;
  savingExpertReview: boolean;
  savingFinding: boolean;
  savingGridAsset: boolean;
  savingReportExport: boolean;
  savingReportSectionId: string;
  savingScorecard: boolean;
  savingVerdict: boolean;
  scoreDrafts: Record<ScoreModuleKey, AssessmentScoreDraft>;
  scoreSummary: ScorecardSummary;
  scorecardError: string;
  scorecardLoading: boolean;
  verdictDraft: AssessmentVerdictDraft;
  onAddFileReference: (event: FormEvent<HTMLFormElement>) => void;
  onAddGridAsset: (event: FormEvent<HTMLFormElement>) => void;
  onAddNote: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onChecklistAutoFill: () => void;
  onChecklistChange: (itemId: string, updates: Partial<Pick<ChecklistDraft, "status" | "analystNote" | "evidenceNote">>) => void;
  onChecklistSave: (itemId: string) => void;
  onChecklistSaveAll: () => void;
  onEvidenceSourceCancelEdit: () => void;
  onEvidenceSourceChange: (value: EvidenceSourceDraft) => void;
  onEvidenceSourceEdit: (source: EvidenceSourceRecord) => void;
  onEvidenceSourceSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: () => void;
  onExpertReviewChange: (value: ExpertReviewDraft) => void;
  onExpertReviewSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFileChange: (value: { fileName: string; documentCategory: string; storagePath: string; description: string }) => void;
  onFindingCancelEdit: () => void;
  onFindingChange: (value: AssessmentFindingDraft) => void;
  onFindingEdit: (finding: AssessmentFindingRecord) => void;
  onFindingSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onGridAssetChange: (value: GridAssetDraft) => void;
  onNoteChange: (value: string) => void;
  onNoteTypeChange: (value: string) => void;
  onPendingStatusChange: (value: AssessmentStatus) => void;
  onRegenerateReportAll: () => void;
  onReportDraftPackageSave: () => void;
  onReportGenerate: () => void;
  onReportReadyForReview: () => void;
  onReportSectionChange: (templateSectionId: string, updates: Partial<ReportSectionDraft>) => void;
  onReportSectionSave: (templateSectionId: string) => void;
  onScoreDraftChange: (moduleKey: ScoreModuleKey, updates: Partial<AssessmentScoreDraft>) => void;
  onScorecardSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStatusSave: () => void;
  onVerdictChange: (value: AssessmentVerdictDraft) => void;
  onVerdictSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onWorkflowToast: (toast: Omit<ToastMessage, "id">) => void;
}) {
  const site = single(assessment.sites);
  const project = single(assessment.projects);
  const organisation = single(project?.organisations);
  const [expandedSections, setExpandedSections] = useState<Set<AssessmentSectionId>>(new Set());
  const panelPreferenceStateRef = useRef({ assessmentId: "", userControlled: false });
  const expandedPanelSignature = [
    assessment.id,
    site?.latitude ?? "no-lat",
    site?.longitude ?? "no-lon",
    checklistProgress.requiredAnsweredItems,
    checklistProgress.requiredItems,
    evidenceReadiness.highRiskFindingsWithoutEvidence,
    scoreSummary.completedModules,
    scoreSummary.totalModules,
    deliveryGates.map((gate) => `${gate.key}:${gate.status}`).join(","),
    reportExportDisplayStatus(reportExport),
  ].join("|");
  const gatesComplete = deliveryGatesAreComplete(deliveryGates);
  const reportStatus = reportExportDisplayStatus(reportExport);
  const reportSavedCount = reportTemplateSections.filter((section) =>
    reportSections.some((reportSection) => reportSection.template_section_id === section.id),
  ).length;
  const reportDraftGapCount = reportTemplateSections.filter((section) => {
    const draft = reportSectionDrafts[section.id];
    return draft ? hasEvidenceGap(draft.content) : false;
  }).length;
  const nearestAsset = useMemo(
    () =>
      gridAssets
        .filter((asset) => typeof asset.distance_miles === "number")
        .sort((first, second) => Number(first.distance_miles) - Number(second.distance_miles))[0] ?? null,
    [gridAssets],
  );
  const nextAction = getAssessmentNextAction({
    assessment,
    checklistProgress,
    deliveryGates,
    evidenceReadiness,
    reportExport,
    scoreSummary,
    verdict: assessmentVerdict,
  });
  const metrics: AssessmentMetric[] = [
    {
      label: "Intake",
      tone: assessment.intake_completeness_score >= 75 ? "ok" : assessment.intake_completeness_score >= 45 ? "warn" : "danger",
      value: `${assessment.intake_completeness_score}%`,
    },
    {
      label: "Checklist",
      tone: checklistProgress.progressPercent >= 75 ? "ok" : checklistProgress.progressPercent >= 45 ? "warn" : "danger",
      value: `${checklistProgress.progressPercent}%`,
    },
    {
      label: "Required",
      tone:
        checklistProgress.requiredItems === 0 || checklistProgress.requiredAnsweredItems >= checklistProgress.requiredItems
          ? "ok"
          : "warn",
      value: `${checklistProgress.requiredAnsweredItems}/${checklistProgress.requiredItems}`,
    },
    {
      label: "Evidence",
      tone: evidenceReadiness.readinessPercent >= 75 ? "ok" : evidenceReadiness.readinessPercent >= 45 ? "warn" : "danger",
      value: `${evidenceReadiness.readinessPercent}%`,
    },
    {
      label: "High-risk gaps",
      tone: evidenceReadiness.highRiskFindingsWithoutEvidence > 0 ? "danger" : "ok",
      value: evidenceReadiness.highRiskFindingsWithoutEvidence.toString(),
    },
    {
      label: "Scorecard",
      tone: scoreSummary.completionPercent >= 100 ? "ok" : scoreSummary.completionPercent >= 50 ? "warn" : "danger",
      value: `${scoreSummary.completionPercent}%`,
    },
    {
      label: "Average score",
      tone: scoreSummary.averageScore === null ? "neutral" : scoreSummary.averageScore >= 75 ? "ok" : scoreSummary.averageScore >= 50 ? "warn" : "danger",
      value: scoreSummary.averageScore === null ? "Not set" : `${scoreSummary.averageScore}/100`,
    },
    {
      label: "Expert review",
      tone: expertReviewTriggers.required ? "warn" : "ok",
      value: expertReviewTriggers.required ? "Required" : "Clear",
    },
    {
      label: "Gates",
      tone: gatesComplete ? "ok" : "warn",
      value: gatesComplete ? "Pass" : "Open",
    },
    {
      label: "Report",
      tone: reportStatus === "ready_for_review" || reportStatus === "exported" ? "ok" : reportStatus === "not_started" ? "neutral" : "warn",
      value: reportExportStatusLabel(reportStatus),
    },
  ];

  useEffect(() => {
    const storedSections = getStoredAssessmentPanels(assessment.id, assessmentPanelSectionIds);
    const assessmentChanged = panelPreferenceStateRef.current.assessmentId !== assessment.id;
    const initialSections = storedSections
      ? new Set(storedSections)
      : getInitialExpandedPanels({
          assessment,
          checklistProgress,
          deliveryGates,
          evidenceReadiness,
          reportExport,
          scoreSummary,
        });

    if (assessmentChanged) {
      panelPreferenceStateRef.current = {
        assessmentId: assessment.id,
        userControlled: Boolean(storedSections),
      };

      setExpandedSections(initialSections);
      return undefined;
    }

    if (panelPreferenceStateRef.current.userControlled || storedSections) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setExpandedSections(initialSections);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [assessment, checklistProgress, deliveryGates, evidenceReadiness, expandedPanelSignature, reportExport, scoreSummary]);

  function saveExpandedSectionPreference(next: Set<AssessmentSectionId>) {
    panelPreferenceStateRef.current = {
      assessmentId: assessment.id,
      userControlled: true,
    };
    saveAssessmentPanels(
      assessment.id,
      assessmentPanelSectionIds.filter((sectionId) => next.has(sectionId)),
    );
  }

  function toggleSection(sectionId: AssessmentSectionId) {
    setExpandedSections((current) => {
      const next = new Set(current);

      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
          next.add(sectionId);
      }

      saveExpandedSectionPreference(next);
      return next;
    });
  }

  function openSection(
    sectionId: "overview" | AssessmentSectionId,
    source: "next_action" | "quick_link" | "workflow_action" = "workflow_action",
  ) {
    if (source === "quick_link") {
      trackWorkflowEvent("assessment_quick_link_clicked", {
        assessmentId: assessment.id,
        sectionId,
      });
    }

    if (sectionId !== "overview") {
      setExpandedSections((current) => {
        const next = new Set([...current, sectionId]);
        saveExpandedSectionPreference(next);
        return next;
      });
    }

    window.setTimeout(() => {
      const target = document.getElementById(sectionId);
      const heading = document.getElementById(`${sectionId}-heading`);

      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      heading?.focus();
    }, 0);
  }

  function canReplaceEvidenceDraft(sourceLabel: string) {
    if (!editingEvidenceSourceId && isBlankEvidenceSourceDraft(evidenceSourceDraft)) {
      return true;
    }

    return window.confirm(`Replace the current evidence source draft with ${sourceLabel}? Unsaved draft text will be overwritten.`);
  }

  function canReplaceFindingDraft(sourceLabel: string) {
    if (!editingFindingId && isBlankFindingDraft(findingDraft)) {
      return true;
    }

    return window.confirm(`Replace the current finding draft with ${sourceLabel}? Unsaved draft text will be overwritten.`);
  }

  function createEvidenceFromFile(file: FileRecord) {
    if (!canReplaceEvidenceDraft(`"${file.file_name}"`)) {
      return;
    }

    onEvidenceSourceCancelEdit();
    onEvidenceSourceChange({
      ...blankEvidenceSourceDraft,
      confidenceLevel: "unknown",
      fileReference: file.storage_path || file.file_name,
      sourceType: "customer_provided",
      summary: file.description ?? "",
      title: file.file_name,
    });
    openSection("evidence");
    onWorkflowToast({
      title: "Evidence draft prepared",
      body: "Review the prefilled source and save it when ready.",
      tone: "info",
    });
  }

  function createEvidenceFromNote(note: NoteRecord) {
    if (!canReplaceEvidenceDraft(noteTypeLabel(note.note_type))) {
      return;
    }

    onEvidenceSourceCancelEdit();
    onEvidenceSourceChange({
      ...blankEvidenceSourceDraft,
      confidenceLevel: "unknown",
      sourceType: noteEvidenceSourceType(note.note_type),
      summary: note.body,
      title: noteEvidenceTitle(note),
    });
    openSection("evidence");
    onWorkflowToast({
      title: "Evidence draft prepared",
      body: "The note was copied into an evidence source draft. The original note is unchanged.",
      tone: "info",
    });
  }

  function createFindingFromNote(note: NoteRecord) {
    if (!canReplaceFindingDraft(noteTypeLabel(note.note_type))) {
      return;
    }

    onFindingCancelEdit();
    onFindingChange({
      ...blankAssessmentFindingDraft,
      confidenceLevel: "unknown",
      findingType: noteFindingType(note.note_type),
      moduleKey: "evidence",
      riskLevel: noteRiskLevel(note.note_type),
      statement: note.body,
      status: "open",
      title: noteFindingTitle(note),
    });
    openSection("findings");
    onWorkflowToast({
      title: "Finding draft prepared",
      body: "The note was copied into a finding draft. The original note is unchanged.",
      tone: "info",
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className={secondaryButtonClass}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={primaryButtonClass}
        >
          <Pencil size={16} />
          Edit intake
        </button>
      </div>

      <section className={cx(cardClass, "overflow-hidden")}>
        <AssessmentCommandHeader
          appRole={appRole}
          assessment={assessment}
          metrics={metrics}
          nextAction={nextAction}
          organisationName={organisation?.name ?? "Unassigned"}
          pendingStatus={pendingStatus}
          projectName={project?.name ?? "No project"}
          saving={saving}
          siteName={site?.site_name ?? "No site"}
          onNextAction={() => openSection(nextAction.sectionId, "next_action")}
          onPendingStatusChange={onPendingStatusChange}
          onStatusSave={onStatusSave}
        />
        <WorkspaceQuickLinks onOpen={(sectionId) => openSection(sectionId, "quick_link")} />
      </section>

      <section id="overview" className="scroll-mt-24">
        <h3 id="overview-heading" tabIndex={-1} className="sr-only">
          Assessment overview
        </h3>
        <AssessmentOverviewCards
          assessment={assessment}
          evidenceReadiness={evidenceReadiness}
          gridAssets={gridAssets}
          nearestAsset={nearestAsset}
          reportSavedCount={reportSavedCount}
          reportStatus={reportStatus}
          reportTemplateSections={reportTemplateSections}
          scoreSummary={scoreSummary}
          site={site}
          onEdit={onEdit}
          onOpen={openSection}
        />
      </section>

      <PanelShell
        sectionId="map"
        icon={<MapPin size={18} />}
        title="GIS site context"
        summary={hasValidCoordinatePair(site?.latitude, site?.longitude) ? "Coordinates and grid assets are ready for review." : "Coordinates are missing or incomplete."}
        statusLabel={hasValidCoordinatePair(site?.latitude, site?.longitude) ? "Map ready" : "Needs coordinates"}
        statusTone={hasValidCoordinatePair(site?.latitude, site?.longitude) ? "ok" : "warn"}
        expanded={expandedSections.has("map")}
        onToggle={() => toggleSection("map")}
      >
        <SiteMapPanel
          assessmentId={assessment.id}
          assetDraft={gridAssetDraft}
          assets={gridAssets}
          error={gridAssetError}
          knownSubstationOrPoi={assessment.known_substation_or_poi}
          knownTsp={assessment.known_tsp}
          knownUtility={assessment.known_utility}
          marketRegion={assessment.market_region}
          recentlySavedAssetId={recentlySavedGridAssetId}
          saving={savingGridAsset}
          site={
            site
              ? {
                  address: site.address,
                  city: site.city,
                  county: site.county,
                  latitude: site.latitude,
                  longitude: site.longitude,
                  parcelId: site.parcel_id,
                  siteName: site.site_name,
                  state: site.state,
                }
              : null
          }
          onAssetDraftChange={onGridAssetChange}
          onAssetSubmit={onAddGridAsset}
        />
      </PanelShell>

      <PanelShell
        sectionId="checklist"
        icon={<ClipboardList size={18} />}
        title="Analysis checklist"
        summary={`${checklistProgress.answeredItems}/${checklistProgress.totalItems} answered and ${checklistProgress.requiredAnsweredItems}/${checklistProgress.requiredItems} required complete.`}
        statusLabel={`${checklistProgress.progressPercent}% complete`}
        statusTone={checklistProgress.requiredItems === 0 || checklistProgress.requiredAnsweredItems >= checklistProgress.requiredItems ? "ok" : "warn"}
        warningLabel={checklistError || undefined}
        expanded={expandedSections.has("checklist")}
        onToggle={() => toggleSection("checklist")}
      >
        <ChecklistPanel
          assessmentId={assessment.id}
          error={checklistError}
          groups={checklistGroups}
          loading={checklistLoading}
          progress={checklistProgress}
          savingItemId={savingChecklistItemId}
          template={checklistTemplate}
          onAutoFill={onChecklistAutoFill}
          onChange={onChecklistChange}
          onSave={onChecklistSave}
          onSaveAll={onChecklistSaveAll}
        />
      </PanelShell>

      <PanelShell
        sectionId="evidence"
        icon={<FileText size={18} />}
        title="Evidence Library"
        summary={`${evidenceReadiness.totalSources} sources supporting ${evidenceReadiness.findingsWithEvidence}/${evidenceReadiness.totalFindings} findings.`}
        statusLabel={`${evidenceReadiness.readinessPercent}% ready`}
        statusTone={evidenceReadiness.readinessPercent >= 75 ? "ok" : evidenceReadiness.readinessPercent >= 45 ? "warn" : "danger"}
        warningLabel={evidenceError || undefined}
        expanded={expandedSections.has("evidence")}
        onToggle={() => toggleSection("evidence")}
      >
        <EvidenceLibraryPanel
          draft={evidenceSourceDraft}
          editingSourceId={editingEvidenceSourceId}
          error={evidenceError}
          loading={evidenceLoading}
          readiness={evidenceReadiness}
          saving={savingEvidenceSource}
          sources={evidenceSources}
          onCancelEdit={onEvidenceSourceCancelEdit}
          onChange={onEvidenceSourceChange}
          onEdit={onEvidenceSourceEdit}
          onSubmit={onEvidenceSourceSubmit}
        />
      </PanelShell>

      <PanelShell
        sectionId="findings"
        icon={<AlertTriangle size={18} />}
        title="Findings"
        summary={`${evidenceReadiness.totalFindings} findings with ${evidenceReadiness.highRiskFindingsWithoutEvidence} high-risk evidence gaps.`}
        statusLabel={`${evidenceReadiness.findingsWithEvidence}/${evidenceReadiness.totalFindings} linked`}
        statusTone={evidenceReadiness.highRiskFindingsWithoutEvidence > 0 ? "danger" : "ok"}
        expanded={expandedSections.has("findings")}
        onToggle={() => toggleSection("findings")}
      >
        <FindingsPanel
          draft={findingDraft}
          editingFindingId={editingFindingId}
          findings={assessmentFindings}
          links={findingEvidenceLinks}
          loading={evidenceLoading}
          readiness={evidenceReadiness}
          saving={savingFinding}
          sources={evidenceSources}
          onCancelEdit={onFindingCancelEdit}
          onChange={onFindingChange}
          onEdit={onFindingEdit}
          onSubmit={onFindingSubmit}
        />
      </PanelShell>

      <PanelShell
        sectionId="scorecard"
        icon={<BarChart3 size={18} />}
        title="Scorecard"
        summary={`${scoreSummary.completedModules}/${scoreSummary.totalModules} modules scored.`}
        statusLabel={`${scoreSummary.completionPercent}% complete`}
        statusTone={scoreSummary.completionPercent >= 100 ? "ok" : scoreSummary.completionPercent >= 50 ? "warn" : "danger"}
        warningLabel={scorecardError || undefined}
        expanded={expandedSections.has("scorecard")}
        onToggle={() => toggleSection("scorecard")}
      >
        <ScorecardPanel
          criticalFindingCount={criticalFindingCount}
          error={scorecardError}
          evidenceGapCount={evidenceGapCount}
          expertReviewRequired={expertReviewTriggers.required}
          loading={scorecardLoading}
          scoreDrafts={scoreDrafts}
          scoreSummary={scoreSummary}
          scores={assessmentScores}
          saving={savingScorecard}
          onChange={onScoreDraftChange}
          onSubmit={onScorecardSubmit}
        />
      </PanelShell>

      <PanelShell
        sectionId="verdict"
        icon={<ShieldCheck size={18} />}
        title="Final Verdict"
        summary={assessmentVerdict ? `${verdictLabel(assessmentVerdict.verdict)} saved.` : "Final verdict has not been saved."}
        statusLabel={assessmentVerdict ? "Saved" : "Missing"}
        statusTone={assessmentVerdict ? "ok" : "warn"}
        expanded={expandedSections.has("verdict")}
        onToggle={() => toggleSection("verdict")}
      >
        <FinalVerdictPanel
          draft={verdictDraft}
          saving={savingVerdict}
          verdict={assessmentVerdict}
          onChange={onVerdictChange}
          onSubmit={onVerdictSubmit}
        />
      </PanelShell>

      <PanelShell
        sectionId="delivery_gates"
        icon={<CheckCircle2 size={18} />}
        title="Delivery Gates"
        summary={gatesComplete ? "All delivery gates pass." : "One or more delivery gates are still open."}
        statusLabel={gatesComplete ? "Pass" : "Open"}
        statusTone={gatesComplete ? "ok" : "warn"}
        warningLabel={scorecardError || undefined}
        expanded={expandedSections.has("delivery_gates")}
        onToggle={() => toggleSection("delivery_gates")}
      >
        <DeliveryGatesPanel
          deliveryGates={deliveryGates}
          error={scorecardError}
          expertReview={expertReview}
          expertReviewDraft={expertReviewDraft}
          expertReviewTriggers={expertReviewTriggers}
          loading={scorecardLoading}
          savingExpertReview={savingExpertReview}
          onExpertReviewChange={onExpertReviewChange}
          onExpertReviewSubmit={onExpertReviewSubmit}
        />
      </PanelShell>

      <PanelShell
        sectionId="report_builder"
        icon={<FileText size={18} />}
        title="Report Builder"
        summary={`${reportSavedCount}/${reportTemplateSections.length || 18} sections saved with ${reportDraftGapCount} evidence gaps.`}
        statusLabel={reportExportStatusLabel(reportStatus)}
        statusTone={reportStatus === "ready_for_review" || reportStatus === "exported" ? "ok" : reportStatus === "not_started" ? "neutral" : "warn"}
        warningLabel={reportBuilderError || undefined}
        expanded={expandedSections.has("report_builder")}
        onToggle={() => toggleSection("report_builder")}
      >
        <ReportBuilderPanel
          assessmentId={assessment.id}
          error={reportBuilderError}
          exportRecord={reportExport}
          loading={reportBuilderLoading}
          reportSectionDrafts={reportSectionDrafts}
          reportSections={reportSections}
          savingExport={savingReportExport}
          savingSectionId={savingReportSectionId}
          template={reportTemplate}
          templateSections={reportTemplateSections}
          generating={generatingReport}
          onDraftPackageSave={onReportDraftPackageSave}
          onGenerate={onReportGenerate}
          onMarkReady={onReportReadyForReview}
          onRegenerateAll={onRegenerateReportAll}
          onSectionChange={onReportSectionChange}
          onSectionSave={onReportSectionSave}
        />
      </PanelShell>

      <PanelShell
        sectionId="notes_files"
        icon={<NotebookPen size={18} />}
        title="Notes & Files"
        summary={`${notes.length} notes and ${files.length} document references.`}
        statusLabel={`${notes.length + files.length} items`}
        statusTone={notes.length + files.length > 0 ? "ok" : "neutral"}
        expanded={expandedSections.has("notes_files")}
        onToggle={() => toggleSection("notes_files")}
      >
        <section className="grid gap-5 lg:grid-cols-2">
        <div className={cx(cardClass, "p-4")}>
          <h3 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">Assessment notes</h3>
          <form onSubmit={onAddNote} className="mb-4 space-y-3">
            <select
              value={newNoteType}
              onChange={(event) => onNoteTypeChange(event.target.value)}
              className={inputClass}
            >
              <option value="analyst_note">Analyst note</option>
              <option value="assumption">Assumption</option>
              <option value="customer_claim">Customer claim</option>
              <option value="risk_flag">Risk flag</option>
              <option value="reviewer_note">Reviewer note</option>
            </select>
            <textarea
              value={newNote}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={4}
              placeholder="Add note"
              className={textareaClass}
            />
            <button
              type="submit"
              disabled={saving || !newNote.trim()}
              className={primaryButtonClass}
            >
              <NotebookPen size={16} />
              Add note
            </button>
          </form>

          <div className="space-y-3">
            {notes.length === 0 ? <p className="text-sm text-slate-500">No notes yet</p> : null}
            {notes.map((note) => (
              <article key={note.id} className="rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                    {note.note_type.replaceAll("_", " ")}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(note.created_at).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => createEvidenceFromNote(note)}
                    className={secondaryButtonClass}
                  >
                    <FileText size={15} />
                    Create evidence
                  </button>
                  <button
                    type="button"
                    onClick={() => createFindingFromNote(note)}
                    className={secondaryButtonClass}
                  >
                    <AlertTriangle size={15} />
                    Create finding
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className={cx(cardClass, "p-4")}>
          <h3 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">Document references</h3>
          <form onSubmit={onAddFileReference} className="mb-4 space-y-3">
            <TextField
              label="File name"
              value={newFile.fileName}
              onChange={(value) => onFileChange({ ...newFile, fileName: value })}
            />
            <SelectField
              label="Category"
              value={newFile.documentCategory}
              options={[
                { value: "study", label: "Study" },
                { value: "utility_correspondence", label: "Utility correspondence" },
                { value: "parcel", label: "Parcel" },
                { value: "map", label: "Map" },
                { value: "power_quote", label: "Power quote" },
                { value: "kml", label: "KML" },
                { value: "geojson", label: "GeoJSON" },
                { value: "screenshot", label: "Screenshot" },
                { value: "other", label: "Other" },
              ]}
              onChange={(value) => onFileChange({ ...newFile, documentCategory: value })}
            />
            <TextField
              label="Storage path"
              value={newFile.storagePath}
              onChange={(value) => onFileChange({ ...newFile, storagePath: value })}
            />
            <TextAreaField
              label="Description"
              value={newFile.description}
              onChange={(value) => onFileChange({ ...newFile, description: value })}
            />
            <button
              type="submit"
              disabled={saving || !newFile.fileName.trim()}
              className={primaryButtonClass}
            >
              <FilePlus2 size={16} />
              Add reference
            </button>
          </form>

          <div className="space-y-3">
            {files.length === 0 ? <p className="text-sm text-slate-500">No document references yet</p> : null}
            {files.map((file) => (
              <article key={file.id} className="rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">{file.file_name}</p>
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                    {(file.document_category ?? "other").replaceAll("_", " ")}
                  </span>
                </div>
                {file.storage_path ? <p className="break-all text-xs text-slate-500">{file.storage_path}</p> : null}
                {file.description ? <p className="mt-2 text-sm text-slate-700">{file.description}</p> : null}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => createEvidenceFromFile(file)}
                    className={secondaryButtonClass}
                  >
                    <FileText size={15} />
                    Create evidence source
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
        </section>
      </PanelShell>
    </div>
  );
}

function ScorecardPanel({
  criticalFindingCount,
  error,
  evidenceGapCount,
  expertReviewRequired,
  loading,
  scoreDrafts,
  scoreSummary,
  scores,
  saving,
  onChange,
  onSubmit,
}: {
  criticalFindingCount: number;
  error: string;
  evidenceGapCount: number;
  expertReviewRequired: boolean;
  loading: boolean;
  scoreDrafts: Record<ScoreModuleKey, AssessmentScoreDraft>;
  scoreSummary: ScorecardSummary;
  scores: AssessmentScoreRecord[];
  saving: boolean;
  onChange: (moduleKey: ScoreModuleKey, updates: Partial<AssessmentScoreDraft>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const scoresByModule = new Map(scores.map((score) => [score.module_key, score]));

  return (
    <section className={cx(cardClass, "p-4")}>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
              <BarChart3 size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Scorecard</h3>
              <p className="text-sm text-slate-600">Manual readiness scores by diligence module</p>
            </div>
          </div>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-[760px] xl:grid-cols-5">
          <EvidenceMetric label="Complete" value={`${scoreSummary.completionPercent}%`} />
          <EvidenceMetric label="Average" value={scoreSummary.averageScore === null ? "Not set" : `${scoreSummary.averageScore}/100`} />
          <EvidenceMetric label="Lowest" value={scoreSummary.lowestScore ? `${scoreSummary.lowestScore.score}` : "Not set"} />
          <EvidenceMetric
            label="Critical"
            tone={criticalFindingCount > 0 ? "danger" : "ok"}
            value={criticalFindingCount.toString()}
          />
          <EvidenceMetric
            label="Review"
            tone={expertReviewRequired ? "warn" : "ok"}
            value={expertReviewRequired ? "Required" : "Clear"}
          />
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
        <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1">
          {scoreSummary.completedModules}/{scoreSummary.totalModules} modules scored
        </span>
        <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1">
          Lowest: {scoreSummary.lowestScore ? scoreSummary.lowestScore.label : "Not set"}
        </span>
        <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1">
          Evidence gaps: {evidenceGapCount}
        </span>
      </div>

      {loading ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading scorecard
        </div>
      ) : null}

      <form onSubmit={onSubmit}>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {scoreComponents.map((module) => {
            const draft = scoreDrafts[module.value] ?? { ...blankScoreDraft };
            const savedScore = scoresByModule.get(module.value);
            const parsedScore = parseScoreInput(draft.score);

            return (
              <article key={module.value} className="bg-white p-4 first:rounded-t-lg last:rounded-b-lg">
                <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={cx("rounded-md border px-2 py-1 text-xs font-semibold", scoreTone(parsedScore))}>
                        {parsedScore === null ? "Unscored" : `${parsedScore}/100`}
                      </span>
                      {savedScore?.updated_at ? (
                        <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-semibold text-slate-600">
                          Saved {new Date(savedScore.updated_at).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    <h4 className="text-sm font-semibold uppercase text-[var(--color-brand-primary)]">{module.label}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{module.guidance}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-slate-700">Score</span>
                      <input
                        value={draft.score}
                        min={0}
                        max={100}
                        inputMode="numeric"
                        onChange={(event) => onChange(module.value, { score: event.target.value })}
                        className={inputClass}
                      />
                    </label>
                    <SelectField
                      label="Risk"
                      value={draft.riskLevel}
                      options={riskLevels}
                      onChange={(value) => onChange(module.value, { riskLevel: value as AssessmentScoreDraft["riskLevel"] })}
                    />
                    <SelectField
                      label="Confidence"
                      value={draft.confidenceLevel}
                      options={evidenceConfidenceLevels}
                      onChange={(value) => onChange(module.value, { confidenceLevel: value as AssessmentScoreDraft["confidenceLevel"] })}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">Rationale</span>
                    <textarea
                      value={draft.rationale}
                      onChange={(event) => onChange(module.value, { rationale: event.target.value })}
                      rows={3}
                      className={textareaClass}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">Override note</span>
                    <textarea
                      value={draft.overrideNote}
                      onChange={(event) => onChange(module.value, { overrideNote: event.target.value })}
                      rows={3}
                      className={textareaClass}
                    />
                  </label>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save scorecard
          </button>
        </div>
      </form>
    </section>
  );
}

function FinalVerdictPanel({
  draft,
  saving,
  verdict,
  onChange,
  onSubmit,
}: {
  draft: AssessmentVerdictDraft;
  saving: boolean;
  verdict: AssessmentVerdictRecord | null;
  onChange: (value: AssessmentVerdictDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className={cx(cardClass, "p-4")}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Final Verdict</h3>
            <p className="text-sm text-slate-600">
              {verdict ? `${verdictLabel(verdict.verdict)} saved` : "Verdict not saved"}
            </p>
          </div>
        </div>
        {verdict?.approved_at ? (
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
            Approved {new Date(verdict.approved_at).toLocaleString()}
          </span>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 lg:grid-cols-4">
        <SelectField
          label="Verdict"
          value={draft.verdict}
          options={verdictOptions}
          onChange={(value) => onChange({ ...draft, verdict: value as AssessmentVerdictDraft["verdict"] })}
        />
        <SelectField
          label="Verdict confidence"
          value={draft.confidenceLevel}
          options={evidenceConfidenceLevels}
          onChange={(value) => onChange({ ...draft, confidenceLevel: value as AssessmentVerdictDraft["confidenceLevel"] })}
        />
        <label className="flex items-end lg:col-span-2">
          <span className="inline-flex h-11 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
            <input
              checked={draft.approvedByAnalyst}
              onChange={(event) => onChange({ ...draft, approvedByAnalyst: event.target.checked })}
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-brand-primary)]"
            />
            Analyst approved
          </span>
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Conditions</span>
          <textarea
            value={draft.conditions}
            onChange={(event) => onChange({ ...draft, conditions: event.target.value })}
            required
            rows={3}
            placeholder="State the conditions, or explicitly record that none apply"
            className={textareaClass}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Change reason</span>
          <textarea
            value={draft.changeReason}
            onChange={(event) => onChange({ ...draft, changeReason: event.target.value })}
            rows={3}
            placeholder="Required when changing verdict, confidence or approval"
            className={textareaClass}
          />
        </label>
        <label className="block lg:col-span-4">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Executive summary</span>
          <textarea
            value={draft.summary}
            onChange={(event) => onChange({ ...draft, summary: event.target.value })}
            rows={4}
            className={textareaClass}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Key strengths</span>
          <textarea
            value={draft.keyStrengths}
            onChange={(event) => onChange({ ...draft, keyStrengths: event.target.value })}
            rows={4}
            className={textareaClass}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Key risks</span>
          <textarea
            value={draft.keyRisks}
            onChange={(event) => onChange({ ...draft, keyRisks: event.target.value })}
            rows={4}
            className={textareaClass}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Recommended next steps</span>
          <textarea
            value={draft.recommendedNextSteps}
            onChange={(event) => onChange({ ...draft, recommendedNextSteps: event.target.value })}
            rows={4}
            className={textareaClass}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Limitations note</span>
          <textarea
            value={draft.limitationsNote}
            onChange={(event) => onChange({ ...draft, limitationsNote: event.target.value })}
            rows={4}
            className={textareaClass}
          />
        </label>
        <div className="lg:col-span-4">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save verdict
          </button>
        </div>
      </form>
    </section>
  );
}

function DeliveryGatesPanel({
  deliveryGates,
  error,
  expertReview,
  expertReviewDraft,
  expertReviewTriggers,
  loading,
  savingExpertReview,
  onExpertReviewChange,
  onExpertReviewSubmit,
}: {
  deliveryGates: DeliveryGate[];
  error: string;
  expertReview: ExpertReviewRecord | null;
  expertReviewDraft: ExpertReviewDraft;
  expertReviewTriggers: ExpertReviewTriggerSummary;
  loading: boolean;
  savingExpertReview: boolean;
  onExpertReviewChange: (value: ExpertReviewDraft) => void;
  onExpertReviewSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const gatesComplete = deliveryGatesAreComplete(deliveryGates);

  return (
    <section className={cx(cardClass, "p-4")}>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
            <CheckCircle2 size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Delivery Gates</h3>
            <p className="text-sm text-slate-600">
              {gatesComplete ? "Ready for delivered status" : "Delivery requirements still open"}
            </p>
          </div>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-[460px]">
          <EvidenceMetric label="Gate status" tone={gatesComplete ? "ok" : "warn"} value={gatesComplete ? "Pass" : "Open"} />
          <EvidenceMetric label="Review" tone={expertReviewTriggers.required ? "warn" : "ok"} value={expertReviewTriggers.required ? "Required" : "Clear"} />
          <EvidenceMetric label="Triggers" value={expertReviewTriggers.activeTriggers.length.toString()} />
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <p>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading delivery gates
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        {deliveryGates.map((gate) => (
          <article key={gate.key} className={cx("rounded-lg border p-3", deliveryGateTone(gate.status))}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">{gate.label}</h4>
              <span className="rounded-md border border-current/20 px-2 py-0.5 text-xs font-semibold uppercase">
                {gate.status}
              </span>
            </div>
            <p className="text-sm leading-6">{gate.detail}</p>
          </article>
        ))}
      </div>

      <div className="mb-5 rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Expert review triggers</h4>
          <span
            className={cx(
              "rounded-md border px-2 py-1 text-xs font-semibold",
              expertReviewTriggers.required
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800",
            )}
          >
            {expertReviewTriggers.required ? "Required" : "Not required"}
          </span>
        </div>
        {expertReviewTriggers.activeTriggers.length === 0 ? (
          <p className="text-sm text-slate-600">No active expert-review triggers.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {expertReviewTriggers.activeTriggers.map((trigger) => (
              <span key={trigger.key} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                {trigger.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onExpertReviewSubmit} className="grid gap-3 lg:grid-cols-4">
        <div className="lg:col-span-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Final report expert review</h4>
            <span className={cx("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", reviewStatusTone(expertReviewDraft.status))}>
              {reviewStatusLabel(expertReviewDraft.status)}
            </span>
            {expertReview?.approved_at ? (
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                Approved {new Date(expertReview.approved_at).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>
        <TextField
          label="Reviewer"
          value={expertReviewDraft.reviewerName}
          onChange={(value) => onExpertReviewChange({ ...expertReviewDraft, reviewerName: value })}
        />
        <SelectField
          label="Status"
          value={expertReviewDraft.status}
          options={reviewStatuses}
          onChange={(value) => onExpertReviewChange({ ...expertReviewDraft, status: value as ReviewStatus })}
        />
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Trigger reason</span>
          <input
            value={expertReviewDraft.triggerReason}
            onChange={(event) => onExpertReviewChange({ ...expertReviewDraft, triggerReason: event.target.value })}
            placeholder={expertReviewTriggers.reasonText}
            className={inputClass}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Comments</span>
          <textarea
            value={expertReviewDraft.comments}
            onChange={(event) => onExpertReviewChange({ ...expertReviewDraft, comments: event.target.value })}
            rows={4}
            className={textareaClass}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Required changes</span>
          <textarea
            value={expertReviewDraft.requiredChanges}
            onChange={(event) => onExpertReviewChange({ ...expertReviewDraft, requiredChanges: event.target.value })}
            rows={4}
            className={textareaClass}
          />
        </label>
        <div className="lg:col-span-4">
          <button type="submit" disabled={savingExpertReview} className={primaryButtonClass}>
            {savingExpertReview ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save expert review
          </button>
        </div>
      </form>
    </section>
  );
}

function ReportBuilderPanel({
  assessmentId,
  error,
  exportRecord,
  generating,
  loading,
  reportSectionDrafts,
  reportSections,
  savingExport,
  savingSectionId,
  template,
  templateSections,
  onDraftPackageSave,
  onGenerate,
  onMarkReady,
  onRegenerateAll,
  onSectionChange,
  onSectionSave,
}: {
  assessmentId: string;
  error: string;
  exportRecord: AssessmentReportExportRecord | null;
  generating: boolean;
  loading: boolean;
  reportSectionDrafts: Record<string, ReportSectionDraft>;
  reportSections: AssessmentReportSectionRecord[];
  savingExport: boolean;
  savingSectionId: string;
  template: ReportTemplateRecord | null;
  templateSections: ReportTemplateSectionRecord[];
  onDraftPackageSave: () => void;
  onGenerate: () => void;
  onMarkReady: () => void;
  onRegenerateAll: () => void;
  onSectionChange: (templateSectionId: string, updates: Partial<ReportSectionDraft>) => void;
  onSectionSave: (templateSectionId: string) => void;
}) {
  const [activeReportFilters, setActiveReportFilters] = useState<Set<ReportSectionFilterId>>(new Set());
  const [expandedReportSectionIds, setExpandedReportSectionIds] = useState<Set<string>>(new Set());
  const sectionsByTemplateId = new Map(reportSections.map((section) => [section.template_section_id, section]));
  const savedCount = templateSections.filter((section) => sectionsByTemplateId.has(section.id)).length;
  const editedCount = reportSections.filter((section) => section.is_edited).length;
  const evidenceGapCount = templateSections.filter((section) => {
    const draft = reportSectionDrafts[section.id];
    return draft ? hasEvidenceGap(draft.content) : false;
  }).length;
  const exportStatus = exportRecord?.status ?? "not_started";
  const statusFilters = new Set(
    [...activeReportFilters].filter((value): value is ReportSectionStatus => value !== "evidence_gaps"),
  );
  const showEvidenceGapsOnly = activeReportFilters.has("evidence_gaps");
  const visibleTemplateSections = templateSections.filter((templateSection) => {
    const draft = reportSectionDrafts[templateSection.id] ?? { content: "", status: "draft" as ReportSectionStatus };
    const matchesStatus = statusFilters.size === 0 || statusFilters.has(draft.status);
    const matchesEvidenceGap = !showEvidenceGapsOnly || hasEvidenceGap(draft.content);

    return matchesStatus && matchesEvidenceGap;
  });
  const visibleEvidenceGapSections = visibleTemplateSections.filter((templateSection) => {
    const draft = reportSectionDrafts[templateSection.id];
    return draft ? hasEvidenceGap(draft.content) : false;
  });

  function toggleReportFilter(filter: ReportSectionFilterId) {
    setActiveReportFilters((current) => {
      const next = new Set(current);

      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }

      return next;
    });
  }

  function toggleReportSection(sectionId: string) {
    setExpandedReportSectionIds((current) => {
      const next = new Set(current);

      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }

      return next;
    });
  }

  function expandEvidenceGapSections() {
    setExpandedReportSectionIds((current) => new Set([...current, ...visibleEvidenceGapSections.map((section) => section.id)]));
  }

  return (
    <section className={cx(cardClass, "p-4")}>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
            <FileText size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Report Builder</h3>
            <p className="text-sm text-slate-600">
              {template ? `${template.name} · ${template.version}` : "Report template not loaded"}
            </p>
          </div>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-[700px] xl:grid-cols-4">
          <EvidenceMetric label="Sections" value={`${savedCount}/${templateSections.length || 18}`} />
          <EvidenceMetric label="Edited" tone={editedCount > 0 ? "warn" : "neutral"} value={editedCount.toString()} />
          <EvidenceMetric label="Evidence gaps" tone={evidenceGapCount > 0 ? "warn" : "ok"} value={evidenceGapCount.toString()} />
          <EvidenceMetric
            label="Package"
            tone={exportStatus === "ready_for_review" ? "ok" : exportStatus === "not_started" ? "neutral" : "warn"}
            value={reportExportStatusLabel(exportStatus)}
          />
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <p>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading report builder
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!template || loading || generating}
          onClick={onGenerate}
          className={primaryButtonClass}
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          Generate missing sections
        </button>
        <button
          type="button"
          disabled={!template || loading || generating}
          onClick={onRegenerateAll}
          className={warningButtonClass}
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Regenerate all
        </button>
        <button
          type="button"
          disabled={!template || loading || savingExport}
          onClick={onDraftPackageSave}
          className={secondaryButtonClass}
        >
          {savingExport ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save draft package
        </button>
        <button
          type="button"
          disabled={!template || loading || savingExport || savedCount === 0}
          onClick={onMarkReady}
          className={successButtonClass}
        >
          {savingExport ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          Mark ready for review
        </button>
        <Link href={`/intake/reports/${assessmentId}`} target="_blank" className={secondaryButtonClass}>
          <ExternalLink size={16} />
          Print preview
        </Link>
      </div>

      <div className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveReportFilters(new Set())}
              className={cx(
                "inline-flex h-9 items-center rounded-md border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]",
                activeReportFilters.size === 0
                  ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-slate-700 hover:border-[var(--color-brand-primary)]",
              )}
            >
              All sections
            </button>
            {reportSectionFilterOptions.map((filter) => {
              const selected = activeReportFilters.has(filter.value);

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => toggleReportFilter(filter.value)}
                  aria-pressed={selected}
                  className={cx(
                    "inline-flex h-9 items-center rounded-md border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]",
                    selected
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-slate-700 hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]",
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={expandEvidenceGapSections}
            disabled={visibleEvidenceGapSections.length === 0}
            className={secondaryButtonClass}
          >
            <AlertTriangle size={16} />
            Expand sections with evidence gaps
          </button>
        </div>
      </div>

      {exportRecord?.ready_for_review_at ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          Ready for review since {new Date(exportRecord.ready_for_review_at).toLocaleString()}
        </div>
      ) : null}

      {templateSections.length === 0 && !loading ? (
        <div className="rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
          Apply the report builder SQL to load the ERCOT v1 report template.
        </div>
      ) : null}

      <div className="space-y-3">
        {visibleTemplateSections.length === 0 && templateSections.length > 0 ? (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
            No report sections match the current filters.
          </div>
        ) : null}

        {visibleTemplateSections.map((templateSection) => {
          const savedSection = sectionsByTemplateId.get(templateSection.id);
          const draft = reportSectionDrafts[templateSection.id] ?? { content: "", status: "draft" as ReportSectionStatus };
          const hasGap = hasEvidenceGap(draft.content);
          const isSaving = savingSectionId === templateSection.id;
          const isExpanded = expandedReportSectionIds.has(templateSection.id);
          const allowedSectionStatuses = savedSection?.status === "final"
            ? reportSectionStatuses
            : reportSectionStatuses.filter((status) => status.value !== "final");
          const hasUnsavedChanges = savedSection
            ? savedSection.content !== draft.content || savedSection.status !== draft.status
            : draft.content.trim().length > 0;
          const saveState = hasUnsavedChanges
            ? { label: "Unsaved changes", tone: "warning" as const }
            : savedSection
              ? { label: "Saved", tone: "success" as const }
              : { label: "Not generated", tone: "neutral" as const };

          return (
            <article key={templateSection.id} className={cx(subtleCardClass, "overflow-hidden")}>
              <div className="flex flex-col gap-3 bg-[var(--color-surface)] px-3 py-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusPill tone="neutral">
                      {templateSection.sort_order}
                    </StatusPill>
                    <span className={cx("rounded-md border px-2 py-1 text-xs font-semibold", reportStatusTone(draft.status))}>
                      {reportSectionStatusLabel(draft.status)}
                    </span>
                    {savedSection?.is_edited ? (
                      <StatusPill tone="info">Edited</StatusPill>
                    ) : null}
                    {hasGap ? (
                      <StatusPill tone="warning">Evidence pending</StatusPill>
                    ) : null}
                    <StatusPill tone={saveState.tone}>{saveState.label}</StatusPill>
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{templateSection.title}</h4>
                  {templateSection.default_guidance && !isExpanded ? (
                    <p className="mt-1 text-sm leading-6 text-slate-600">{templateSection.default_guidance}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {savedSection?.updated_at ? (
                    <span className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-semibold text-slate-500">
                      Saved {new Date(savedSection.updated_at).toLocaleString()}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleReportSection(templateSection.id)}
                    aria-expanded={isExpanded}
                    className={secondaryButtonClass}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <Pencil size={16} />}
                    {isExpanded ? "Collapse" : "Edit"}
                  </button>
                </div>
              </div>

              {isExpanded ? (
                <div className="border-t border-[var(--color-border)] p-3">
                  <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
                    <SelectField
                      label="Section status"
                      value={draft.status}
                      options={allowedSectionStatuses}
                      onChange={(value) => onSectionChange(templateSection.id, { status: value as ReportSectionStatus })}
                    />
                    <label className="block min-w-0">
                      <span className="mb-1.5 block text-sm font-semibold text-slate-700">Section content</span>
                      <textarea
                        value={draft.content}
                        onChange={(event) => onSectionChange(templateSection.id, { content: event.target.value })}
                        rows={8}
                        className={cx(textareaClass, "font-mono text-xs leading-5")}
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      {savedSection?.generation_notes ?? "No generated draft saved yet."}
                    </p>
                    <button
                      type="button"
                      disabled={isSaving || loading}
                      onClick={() => onSectionSave(templateSection.id)}
                      className={secondaryButtonClass}
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                      Save section
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EvidenceLibraryPanel({
  draft,
  editingSourceId,
  error,
  loading,
  readiness,
  saving,
  sources,
  onCancelEdit,
  onChange,
  onEdit,
  onSubmit,
}: {
  draft: EvidenceSourceDraft;
  editingSourceId: string;
  error: string;
  loading: boolean;
  readiness: EvidenceReadinessSummary;
  saving: boolean;
  sources: EvidenceSourceRecord[];
  onCancelEdit: () => void;
  onChange: (value: EvidenceSourceDraft) => void;
  onEdit: (source: EvidenceSourceRecord) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const groupedSources = evidenceSourceTypes
    .map((type) => ({
      ...type,
      sources: sources.filter((source) => source.source_type === type.value),
    }))
    .filter((group) => group.sources.length > 0);

  return (
    <section className={cx(cardClass, "p-4")}>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
              <FileText size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Evidence Library</h3>
              <p className="text-sm text-slate-600">Sources, claims, assumptions, and judgement supporting this assessment</p>
            </div>
          </div>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-[520px] xl:grid-cols-4">
          <EvidenceMetric label="Sources" value={readiness.totalSources.toString()} />
          <EvidenceMetric label="Findings" value={readiness.totalFindings.toString()} />
          <EvidenceMetric label="Supported" value={`${readiness.readinessPercent}%`} />
          <EvidenceMetric
            label="Weak sources"
            tone={readiness.lowConfidenceSources > 0 ? "warn" : "ok"}
            value={readiness.lowConfidenceSources.toString()}
          />
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <p>{error}</p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mb-5 grid gap-3 lg:grid-cols-4">
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Source title *</span>
          <input
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            className={inputClass}
            required
          />
        </label>
        <SelectField
          label="Source type"
          value={draft.sourceType}
          options={evidenceSourceTypes}
          onChange={(value) => onChange({ ...draft, sourceType: value as EvidenceSourceDraft["sourceType"] })}
        />
        <SelectField
          label="Confidence"
          value={draft.confidenceLevel}
          options={evidenceConfidenceLevels}
          onChange={(value) => onChange({ ...draft, confidenceLevel: value as EvidenceSourceDraft["confidenceLevel"] })}
        />
        <TextField
          label="Publisher"
          value={draft.publisher}
          onChange={(value) => onChange({ ...draft, publisher: value })}
        />
        <TextField
          label="URL"
          type="url"
          value={draft.url}
          onChange={(value) => onChange({ ...draft, url: value })}
        />
        <TextField
          label="File reference"
          value={draft.fileReference}
          onChange={(value) => onChange({ ...draft, fileReference: value })}
        />
        <TextField
          label="Accessed"
          type="date"
          value={draft.accessedAt}
          onChange={(value) => onChange({ ...draft, accessedAt: value })}
        />
        <TextField
          label="Published"
          type="date"
          value={draft.publishedAt}
          onChange={(value) => onChange({ ...draft, publishedAt: value })}
        />
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Summary</span>
          <textarea
            value={draft.summary}
            onChange={(event) => onChange({ ...draft, summary: event.target.value })}
            rows={3}
            className={textareaClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">License notes</span>
          <textarea
            value={draft.licenseNotes}
            onChange={(event) => onChange({ ...draft, licenseNotes: event.target.value })}
            rows={3}
            className={textareaClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Limitations</span>
          <textarea
            value={draft.limitationNotes}
            onChange={(event) => onChange({ ...draft, limitationNotes: event.target.value })}
            rows={3}
            className={textareaClass}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Analyst notes</span>
          <textarea
            value={draft.notes}
            onChange={(event) => onChange({ ...draft, notes: event.target.value })}
            rows={3}
            className={textareaClass}
          />
        </label>
        <div className="flex flex-wrap gap-2 lg:col-span-4">
          <button type="submit" disabled={saving || !draft.title.trim()} className={primaryButtonClass}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {editingSourceId ? "Save source" : "Add source"}
          </button>
          {editingSourceId ? (
            <button type="button" onClick={onCancelEdit} disabled={saving} className={secondaryButtonClass}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading evidence
        </div>
      ) : null}

      {!loading && groupedSources.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
          No evidence sources yet
        </div>
      ) : null}

      {!loading && groupedSources.length > 0 ? (
        <div className="space-y-5">
          {groupedSources.map((group) => (
            <section key={group.value} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase text-[var(--color-brand-primary)]">{group.label}</h4>
                <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-semibold text-slate-600">
                  {group.sources.length}
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {group.sources.map((source) => (
                  <article key={source.id} className="rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] p-3">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-slate-900">{source.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {source.publisher || "Publisher not set"}
                          {source.accessed_at ? ` · accessed ${source.accessed_at}` : ""}
                        </p>
                      </div>
                      <button type="button" onClick={() => onEdit(source)} className={secondaryButtonClass}>
                        <Pencil size={16} />
                        Edit
                      </button>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className={cx("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", evidenceConfidenceTone(source.confidence_level))}>
                        {evidenceConfidenceLabel(source.confidence_level)}
                      </span>
                      {(source.confidence_level === "low" || source.confidence_level === "unknown") ? (
                        <FlagBadge tone="warn" label="Low confidence" />
                      ) : null}
                    </div>
                    {source.summary ? <p className="mb-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{source.summary}</p> : null}
                    <div className="space-y-1 text-xs text-slate-600">
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 font-semibold text-[var(--color-brand-primary)] underline-offset-2 hover:underline"
                        >
                          <Link2 size={14} />
                          <span className="truncate">{source.url}</span>
                        </a>
                      ) : null}
                      {source.file_reference ? <p className="break-all">File: {source.file_reference}</p> : null}
                      {source.limitation_notes ? <p className="text-amber-800">Limitations: {source.limitation_notes}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FindingsPanel({
  draft,
  editingFindingId,
  findings,
  links,
  loading,
  readiness,
  saving,
  sources,
  onCancelEdit,
  onChange,
  onEdit,
  onSubmit,
}: {
  draft: AssessmentFindingDraft;
  editingFindingId: string;
  findings: AssessmentFindingRecord[];
  links: FindingEvidenceLinkRecord[];
  loading: boolean;
  readiness: EvidenceReadinessSummary;
  saving: boolean;
  sources: EvidenceSourceRecord[];
  onCancelEdit: () => void;
  onChange: (value: AssessmentFindingDraft) => void;
  onEdit: (finding: AssessmentFindingRecord) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const groupedFindings = findingModules.map((module) => ({
    ...module,
    findings: findings.filter((finding) => finding.module_key === module.value),
  }));
  const selectedEvidenceIds = new Set(draft.linkedEvidenceSourceIds);

  function toggleEvidenceSource(sourceId: string, checked: boolean) {
    onChange({
      ...draft,
      linkedEvidenceSourceIds: checked
        ? [...draft.linkedEvidenceSourceIds, sourceId]
        : draft.linkedEvidenceSourceIds.filter((id) => id !== sourceId),
    });
  }

  return (
    <section className={cx(cardClass, "p-4")}>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
              <AlertTriangle size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Findings</h3>
              <p className="text-sm text-slate-600">Traceable conclusions by MVP diligence module</p>
            </div>
          </div>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-[660px] xl:grid-cols-5">
          <EvidenceMetric
            label="No evidence"
            tone={readiness.highRiskFindingsWithoutEvidence > 0 ? "danger" : "ok"}
            value={readiness.highRiskFindingsWithoutEvidence.toString()}
          />
          <EvidenceMetric
            label="No rec."
            tone={readiness.findingsWithoutRecommendation > 0 ? "warn" : "ok"}
            value={readiness.findingsWithoutRecommendation.toString()}
          />
          <EvidenceMetric
            label="High no rec."
            tone={readiness.highRiskFindingsWithoutRecommendation > 0 ? "danger" : "ok"}
            value={readiness.highRiskFindingsWithoutRecommendation.toString()}
          />
          <EvidenceMetric
            label="Assumption only"
            tone={readiness.assumptionOnlyFindings > 0 ? "warn" : "ok"}
            value={readiness.assumptionOnlyFindings.toString()}
          />
          <EvidenceMetric label="Linked" value={`${readiness.findingsWithEvidence}/${readiness.totalFindings}`} />
        </div>
      </div>

      <form onSubmit={onSubmit} className="mb-5 grid gap-3 lg:grid-cols-4">
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Finding title *</span>
          <input
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            className={inputClass}
            required
          />
        </label>
        <SelectField
          label="Module"
          value={draft.moduleKey}
          options={findingModules}
          onChange={(value) => onChange({ ...draft, moduleKey: value as AssessmentFindingDraft["moduleKey"] })}
        />
        <SelectField
          label="Type"
          value={draft.findingType}
          options={findingTypes}
          onChange={(value) => onChange({ ...draft, findingType: value as AssessmentFindingDraft["findingType"] })}
        />
        <SelectField
          label="Risk"
          value={draft.riskLevel}
          options={riskLevels}
          onChange={(value) => onChange({ ...draft, riskLevel: value as AssessmentFindingDraft["riskLevel"] })}
        />
        <SelectField
          label="Confidence"
          value={draft.confidenceLevel}
          options={evidenceConfidenceLevels}
          onChange={(value) => onChange({ ...draft, confidenceLevel: value as AssessmentFindingDraft["confidenceLevel"] })}
        />
        <SelectField
          label="Status"
          value={draft.status}
          options={findingStatuses}
          onChange={(value) => onChange({ ...draft, status: value as AssessmentFindingDraft["status"] })}
        />
        <SelectField
          label="Support"
          value={draft.supportStatus}
          options={supportStatuses.filter((status) => status.value !== "contradicted" && status.value !== "mixed")}
          onChange={(value) => onChange({ ...draft, supportStatus: value as AssessmentFindingDraft["supportStatus"] })}
        />
        <label className="block lg:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Statement</span>
          <textarea
            value={draft.statement}
            onChange={(event) => onChange({ ...draft, statement: event.target.value })}
            rows={4}
            className={textareaClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Assumption note</span>
          <textarea
            value={draft.assumptionNote}
            onChange={(event) => onChange({ ...draft, assumptionNote: event.target.value })}
            rows={4}
            className={textareaClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Recommendation</span>
          <textarea
            value={draft.recommendation}
            onChange={(event) => onChange({ ...draft, recommendation: event.target.value })}
            rows={4}
            className={textareaClass}
          />
        </label>

        <div className="rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] p-3 lg:col-span-4">
          <div className="mb-3 flex items-center gap-2">
            <Link2 size={16} className="text-[var(--color-brand-primary)]" />
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Linked evidence</h4>
          </div>
          {sources.length === 0 ? (
            <p className="text-sm text-slate-500">Add evidence sources before linking findings.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {sources.map((source) => (
                <label
                  key={source.id}
                  className="flex min-w-0 items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvidenceIds.has(source.id)}
                    onChange={(event) => toggleEvidenceSource(source.id, event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand-primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-900">{source.title}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {evidenceSourceTypeLabel(source.source_type)} · {evidenceConfidenceLabel(source.confidence_level)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:col-span-4">
          <button type="submit" disabled={saving || !draft.title.trim()} className={primaryButtonClass}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {editingFindingId ? "Save finding" : "Add finding"}
          </button>
          {editingFindingId ? (
            <button type="button" onClick={onCancelEdit} disabled={saving} className={secondaryButtonClass}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading findings
        </div>
      ) : null}

      {!loading ? (
        <div className="space-y-5">
          {findings.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
              No findings yet
            </div>
          ) : null}
          {groupedFindings.map((group) => (
            <section key={group.value} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase text-[var(--color-brand-primary)]">{group.label}</h4>
                <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-semibold text-slate-600">
                  {group.findings.length}
                </span>
              </div>
              {group.findings.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-3 py-3 text-sm text-slate-500">
                  No findings in this module
                </p>
              ) : (
                <div className="space-y-3">
                  {group.findings.map((finding) => {
                    const linkedSources = evidenceForFinding(finding.id, sources, links);
                    const highRiskWithoutEvidence = isHighRiskFinding(finding) && linkedSources.length === 0;
                    const withoutRecommendation = !hasFindingRecommendation(finding);
                    const assumptionOnly = isAssumptionOnlyFinding(finding, linkedSources);

                    return (
                      <article key={finding.id} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="grid gap-3 xl:grid-cols-[1fr_180px]">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className={cx("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", riskLevelTone(finding.risk_level))}>
                                {riskLevelLabel(finding.risk_level)}
                              </span>
                              <span className={cx("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", evidenceConfidenceTone(finding.confidence_level))}>
                                {evidenceConfidenceLabel(finding.confidence_level)}
                              </span>
                              <span className={cx("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", findingStatusTone(finding.status))}>
                                {findingStatusLabel(finding.status)}
                              </span>
                              <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-semibold text-slate-600">
                                {findingTypeLabel(finding.finding_type)}
                              </span>
                            </div>
                            <h5 className="text-sm font-semibold leading-6 text-slate-900">{finding.title}</h5>
                            {finding.statement ? (
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{finding.statement}</p>
                            ) : null}
                          </div>
                          <button type="button" onClick={() => onEdit(finding)} className={secondaryButtonClass}>
                            <Pencil size={16} />
                            Edit
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {linkedSources.length === 0 ? (
                            <FlagBadge tone={highRiskWithoutEvidence ? "danger" : "warn"} label={highRiskWithoutEvidence ? "High risk: no evidence" : "No evidence"} />
                          ) : null}
                          {withoutRecommendation ? <FlagBadge tone="warn" label="No recommendation" /> : null}
                          {assumptionOnly ? <FlagBadge tone="warn" label="Assumption only" /> : null}
                        </div>

                        {finding.assumption_note || finding.recommendation ? (
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {finding.assumption_note ? (
                              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                                <p className="text-xs font-semibold uppercase text-amber-800">Assumption</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-900">{finding.assumption_note}</p>
                              </div>
                            ) : null}
                            {finding.recommendation ? (
                              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                                <p className="text-xs font-semibold uppercase text-emerald-800">Recommendation</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-emerald-900">{finding.recommendation}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Linked evidence</p>
                          {linkedSources.length === 0 ? (
                            <p className="text-sm text-slate-500">None linked</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {linkedSources.map((source) => (
                                <span
                                  key={source.id}
                                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-semibold text-slate-700"
                                >
                                  <FileText size={13} className="shrink-0 text-[var(--color-brand-primary)]" />
                                  <span className="truncate">{source.title}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EvidenceMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "danger" | "neutral" | "ok" | "warn";
  value: string;
}) {
  const styles = {
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    neutral: "border-slate-200 bg-[var(--color-surface-muted)] text-slate-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return (
    <div className={cx("rounded-lg border px-3 py-2", styles[tone])}>
      <p className="text-[11px] font-semibold uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function FlagBadge({ label, tone }: { label: string; tone: "danger" | "warn" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold",
        tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      <AlertCircle size={13} />
      {label}
    </span>
  );
}

function ChecklistPanel({
  assessmentId,
  error,
  groups,
  loading,
  progress,
  savingItemId,
  template,
  onAutoFill,
  onChange,
  onSave,
  onSaveAll,
}: {
  assessmentId: string;
  error: string;
  groups: ChecklistModuleGroup[];
  loading: boolean;
  progress: ReturnType<typeof calculateChecklistProgress>;
  savingItemId: string;
  template: ChecklistTemplateRecord | null;
  onAutoFill: () => void;
  onChange: (itemId: string, updates: Partial<Pick<ChecklistDraft, "status" | "analystNote" | "evidenceNote">>) => void;
  onSave: (itemId: string) => void;
  onSaveAll: () => void;
}) {
  const savingAll = savingItemId === "all";
  const moduleSignature = groups
    .map((group) => `${group.moduleKey}:${group.answeredItems}:${group.totalItems}:${group.requiredAnsweredItems}:${group.requiredItems}`)
    .join("|");
  const [expandedModuleKeys, setExpandedModuleKeys] = useState<Set<string>>(new Set());
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [requiredOnly, setRequiredOnly] = useState(false);
  const [recentlySavedItemId, setRecentlySavedItemId] = useState("");
  const previousSavingItemIdRef = useRef(savingItemId);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const firstIncompleteRequiredGroup =
        groups.find((group) => group.requiredItems > 0 && group.requiredAnsweredItems < group.requiredItems) ??
        groups.find((group) => !isChecklistGroupComplete(group)) ??
        groups[0];

      setExpandedModuleKeys(firstIncompleteRequiredGroup ? new Set([firstIncompleteRequiredGroup.moduleKey]) : new Set());
      setExpandedItemIds(new Set());
    }, 0);

    return () => window.clearTimeout(timer);
  }, [moduleSignature, groups]);

  useEffect(() => {
    const previousSavingItemId = previousSavingItemIdRef.current;

    if (previousSavingItemId && previousSavingItemId !== "all" && savingItemId === "") {
      setRecentlySavedItemId(previousSavingItemId);
      window.setTimeout(() => {
        setRecentlySavedItemId((current) => (current === previousSavingItemId ? "" : current));
      }, 2400);
    }

    previousSavingItemIdRef.current = savingItemId;
  }, [savingItemId]);

  function toggleModule(moduleKey: string) {
    setExpandedModuleKeys((current) => {
      const next = new Set(current);

      if (next.has(moduleKey)) {
        next.delete(moduleKey);
      } else {
        next.add(moduleKey);
        trackWorkflowEvent("checklist_module_expanded", {
          assessmentId,
          moduleKey,
        });
      }

      return next;
    });
  }

  function toggleItem(itemId: string) {
    setExpandedItemIds((current) => {
      const next = new Set(current);

      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }

      return next;
    });
  }

  function expandIncompleteModules() {
    setExpandedModuleKeys(new Set(groups.filter((group) => !isChecklistGroupComplete(group)).map((group) => group.moduleKey)));
  }

  function collapseCompletedModules() {
    setExpandedModuleKeys(new Set(groups.filter((group) => !isChecklistGroupComplete(group)).map((group) => group.moduleKey)));
  }

  return (
    <section className={cx(cardClass, "p-4")}>
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
              <ClipboardList size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Analysis checklist</h3>
              <p className="truncate text-sm text-slate-600">
                {template ? `${template.name} - ${template.market_region} ${template.version}` : "Checklist template pending"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAutoFill}
              disabled={loading || groups.length === 0 || savingAll}
              className={secondaryButtonClass}
            >
              <Sparkles size={16} />
              Auto-fill blanks
            </button>
            <button
              type="button"
              onClick={onSaveAll}
              disabled={loading || groups.length === 0 || progress.answeredItems === 0 || savingAll}
              className={primaryButtonClass}
            >
              {savingAll ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save all
            </button>
            <button
              type="button"
              onClick={expandIncompleteModules}
              disabled={loading || groups.length === 0}
              className={secondaryButtonClass}
            >
              <ChevronDown size={16} />
              Expand incomplete
            </button>
            <button
              type="button"
              onClick={collapseCompletedModules}
              disabled={loading || groups.length === 0}
              className={secondaryButtonClass}
            >
              <ChevronRight size={16} />
              Collapse completed
            </button>
            <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm">
              <input
                checked={requiredOnly}
                onChange={(event) => setRequiredOnly(event.target.checked)}
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-brand-primary)]"
              />
              Required only
            </label>
          </div>
        </div>

        <div className="w-full shrink-0 lg:w-80">
          <ProgressMeter label="Overall progress" value={progress.progressPercent} />
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1">
              {progress.answeredItems}/{progress.totalItems} answered
            </span>
            <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1">
              {progress.requiredAnsweredItems}/{progress.requiredItems} required
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <p>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading checklist
        </div>
      ) : null}

      {!loading && !error && groups.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-slate-600">
          No checklist items found for the active template.
        </div>
      ) : null}

      {!loading && groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expandedModuleKeys.has(group.moduleKey);
            const visibleItems = requiredOnly ? group.items.filter((item) => item.is_required) : group.items;
            const counts = getChecklistStatusCounts(group);

            return (
              <section key={group.moduleKey} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleModule(group.moduleKey)}
                  aria-expanded={isExpanded}
                  aria-controls={`checklist-module-${group.moduleKey}`}
                  className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] lg:grid-cols-[1fr_280px]"
                >
                  <span className="min-w-0">
                    <span className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold uppercase text-[var(--color-brand-primary)]">{group.moduleName}</span>
                      <span className={cx("rounded-md border px-2 py-1 text-xs font-semibold", isChecklistGroupComplete(group) ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
                        {isChecklistGroupComplete(group) ? "Complete" : "Open"}
                      </span>
                    </span>
                    <span className="block text-sm text-slate-600">
                      {group.answeredItems}/{group.totalItems} answered - {group.requiredAnsweredItems}/{group.requiredItems} required
                    </span>
                    <span className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1">Not started {counts.not_started}</span>
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">Pass {counts.pass}</span>
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">Risk {counts.risk}</span>
                      <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-800">Blocked {counts.blocked}</span>
                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1">N/A {counts.not_applicable}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <ProgressMeter label={`${group.moduleName} progress`} value={group.progressPercent} compact />
                    </span>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </span>
                </button>

                {isExpanded ? (
                  <div id={`checklist-module-${group.moduleKey}`} className="border-t border-slate-200 bg-[var(--color-surface-muted)] p-3">
                    {visibleItems.length === 0 ? (
                      <p className="rounded-md border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                        No required items in this module.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                        {visibleItems.map((item) => {
                          const itemExpanded = expandedItemIds.has(item.id);

                          return (
                            <ChecklistItemRow
                              key={item.id}
                              expanded={itemExpanded}
                              item={item}
                              recentlySaved={recentlySavedItemId === item.id}
                              saving={savingItemId === item.id}
                              savingAll={savingAll}
                              onChange={onChange}
                              onSave={onSave}
                              onToggle={() => toggleItem(item.id)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function ChecklistItemRow({
  expanded,
  item,
  recentlySaved,
  saving,
  savingAll,
  onChange,
  onSave,
  onToggle,
}: {
  expanded: boolean;
  item: ChecklistModuleGroup["items"][number];
  recentlySaved: boolean;
  saving: boolean;
  savingAll: boolean;
  onChange: (itemId: string, updates: Partial<Pick<ChecklistDraft, "status" | "analystNote" | "evidenceNote">>) => void;
  onSave: (itemId: string) => void;
  onToggle: () => void;
}) {
  return (
    <article className="bg-white first:rounded-t-lg last:rounded-b-lg">
      <div className="grid gap-3 p-4 xl:grid-cols-[1fr_auto] xl:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ChecklistStatusBadge status={item.draft.status} />
            {item.is_required ? (
              <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-semibold text-slate-600">
                Required
              </span>
            ) : null}
            {recentlySaved ? (
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                Saved
              </span>
            ) : item.draft.updatedAt ? (
              <span className="rounded-md border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-semibold text-slate-600">
                Saved {new Date(item.draft.updatedAt).toLocaleString()}
              </span>
            ) : (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                Unsaved
              </span>
            )}
          </div>
          <h5 className="text-sm font-semibold leading-6 text-slate-900">{item.prompt}</h5>
          {expanded && item.guidance ? <p className="mt-1 text-sm leading-6 text-slate-600">{item.guidance}</p> : null}
        </div>
        <button type="button" onClick={onToggle} className={secondaryButtonClass} aria-expanded={expanded}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {expanded ? "Close" : "Edit"}
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-slate-100 bg-[var(--color-surface-muted)] p-4">
          <div className="grid gap-4 xl:grid-cols-[1fr_220px]">
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Analyst note</span>
                <textarea
                  value={item.draft.analystNote}
                  onChange={(event) => onChange(item.id, { analystNote: event.target.value })}
                  rows={3}
                  className={textareaClass}
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Evidence / assumption note</span>
                <textarea
                  value={item.draft.evidenceNote}
                  onChange={(event) => onChange(item.id, { evidenceNote: event.target.value })}
                  rows={3}
                  className={textareaClass}
                />
              </label>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Status</span>
                <select
                  value={item.draft.status}
                  onChange={(event) => onChange(item.id, { status: event.target.value as ChecklistResponseStatus })}
                  className={inputClass}
                >
                  {checklistResponseStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => onSave(item.id)}
                disabled={saving || savingAll}
                className={secondaryButtonClass}
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save item
              </button>
              {item.draft.updatedAt ? (
                <p className="text-xs text-slate-500">Last saved {new Date(item.draft.updatedAt).toLocaleString()}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ChecklistStatusBadge({ status }: { status: ChecklistResponseStatus }) {
  return (
    <span className={cx("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", checklistStatusTone(status))}>
      {checklistStatusLabel(status)}
    </span>
  );
}

function ProgressMeter({ compact, label, value }: { compact?: boolean; label: string; value: number }) {
  const color = value >= 75 ? "bg-emerald-500" : value >= 45 ? "bg-amber-400" : "bg-rose-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className={cx("font-medium uppercase text-slate-500", compact ? "text-[11px]" : "text-xs")}>{label}</span>
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{value}%</span>
      </div>
      <div className={cx("overflow-hidden rounded-md bg-slate-200", compact ? "h-1.5" : "h-2")}>
        <div className={cx("h-full rounded-md", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function fieldDescriptionIds(id: string, error?: string, helpText?: string) {
  return [
    error ? `${id}-error` : "",
    helpText ? `${id}-help` : "",
  ].filter(Boolean).join(" ") || undefined;
}

function FieldGroup({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3 border-b border-[var(--color-border)] pb-3 text-[var(--color-text-primary)]">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
          {icon}
        </span>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function TextField({
  badge,
  error,
  helpText,
  id,
  inputMode,
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  badge?: string;
  error?: string;
  helpText?: string;
  id?: string;
  inputMode?: "decimal" | "numeric";
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <FieldControl badge={badge} error={error} helpText={helpText} id={inputId} label={label} required={required}>
      <input
        id={inputId}
        type={type}
        inputMode={inputMode}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescriptionIds(inputId, error, helpText)}
        onChange={(event) => onChange(event.target.value)}
        className={cx(inputClass, error && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20")}
      />
    </FieldControl>
  );
}

function TextAreaField({
  badge,
  error,
  helpText,
  id,
  label,
  onChange,
  value,
}: {
  badge?: string;
  error?: string;
  helpText?: string;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const textareaId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <FieldControl badge={badge} error={error} helpText={helpText} id={textareaId} label={label} wide>
      <textarea
        id={textareaId}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescriptionIds(textareaId, error, helpText)}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className={cx(textareaClass, error && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20")}
      />
    </FieldControl>
  );
}

function SelectField({
  badge,
  error,
  helpText,
  id,
  label,
  onChange,
  options,
  value,
}: {
  badge?: string;
  error?: string;
  helpText?: string;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
}) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <FieldControl badge={badge} error={error} helpText={helpText} id={selectId} label={label}>
      <select
        id={selectId}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescriptionIds(selectId, error, helpText)}
        onChange={(event) => onChange(event.target.value)}
        className={cx(inputClass, error && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldControl>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
    intake_incomplete: "border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    intake_complete: "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
    in_analyst_review: "border-[var(--color-info)] bg-[var(--color-info-soft)] text-[var(--color-info)]",
    in_expert_review: "border-violet-200 bg-violet-50 text-violet-800",
    report_drafting: "border-blue-200 bg-blue-50 text-blue-800",
    final_review: "border-indigo-200 bg-indigo-50 text-indigo-800",
    delivered: "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
    archived: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]",
  };

  return (
    <span className={cx("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", styles[status] ?? styles.draft)}>
      {statusLabel(status)}
    </span>
  );
}

function CompletenessBar({ value }: { value: number }) {
  const color = value >= 75 ? "bg-[var(--color-success)]" : value >= 45 ? "bg-[var(--color-warning)]" : "bg-[var(--color-danger)]";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase text-[var(--color-text-secondary)]">Completeness</span>
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-md bg-[var(--color-surface-strong)]">
        <div className={cx("h-full rounded-md", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-[var(--color-text-secondary)]">{label}</p>
        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
      </div>
    </div>
  );
}
