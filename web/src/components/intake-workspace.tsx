"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
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
  UserRound,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AddressAutocompleteField } from "@/components/address-autocomplete-field";
import { SiteMapPanel } from "@/components/site-map-panel";
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
  EvidenceReadinessSummary,
  EvidenceSourceDraft,
  EvidenceSourceRecord,
  FindingEvidenceLinkRecord,
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
} from "@/lib/evidence";
import {
  GridAssetDraft,
  GridAssetRecord,
  blankGridAssetDraft,
  calculateDistanceMiles,
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
  AssessmentReportExportRecord,
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
  scoreModules,
  scoreTone,
  validateScoreDraft,
  verdictLabel,
  verdictOptions,
} from "@/lib/scorecard";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

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

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function valueOrEmpty(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const cardClass = "rounded-lg border border-slate-200 bg-white shadow-sm";
const subtleCardClass = "rounded-lg border border-slate-200 bg-[#f8faf7] shadow-sm";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1b365d] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#142844] focus:outline-none focus:ring-2 focus:ring-[#1b365d]/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400";
const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#1b365d]/40 hover:text-[#1b365d] focus:outline-none focus:ring-2 focus:ring-[#1b365d]/20 disabled:cursor-not-allowed disabled:bg-slate-100";
const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20";
const textareaClass =
  "w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20";

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

export function IntakeWorkspace() {
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
  const [newEvidenceSource, setNewEvidenceSource] = useState<EvidenceSourceDraft>(blankEvidenceSourceDraft);
  const [newFinding, setNewFinding] = useState<AssessmentFindingDraft>(blankAssessmentFindingDraft);
  const [editingEvidenceSourceId, setEditingEvidenceSourceId] = useState("");
  const [editingFindingId, setEditingFindingId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
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
  const [newNote, setNewNote] = useState("");
  const [newNoteType, setNewNoteType] = useState("analyst_note");
  const [newFile, setNewFile] = useState({
    fileName: "",
    documentCategory: "other",
    storagePath: "",
    description: "",
  });
  const [pendingStatus, setPendingStatus] = useState<AssessmentStatus>("draft");

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

    if (!query) {
      return assessments;
    }

    return assessments.filter((assessment) => {
      const site = single(assessment.sites);
      const project = single(assessment.projects);
      const organisation = single(project?.organisations);
      const searchable = [
        assessment.assessment_name,
        assessment.market_region,
        assessment.status,
        site?.site_name,
        site?.city,
        site?.county,
        project?.name,
        organisation?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [assessments, searchTerm]);

  const stats = useMemo(() => {
    const total = assessments.length;
    const intakeComplete = assessments.filter((assessment) => assessment.status === "intake_complete").length;
    const averageCompleteness =
      total === 0
        ? 0
        : Math.round(
            assessments.reduce((sum, assessment) => sum + assessment.intake_completeness_score, 0) / total,
          );
    const totalMw = Math.round(
      assessments.reduce((sum, assessment) => sum + Number(assessment.target_load_mw ?? 0), 0),
    );

    return { total, intakeComplete, averageCompleteness, totalMw };
  }, [assessments]);

  useEffect(() => {
    if (hasSupabaseConfig) {
      void loadAssessments();
    }
  }, []);

  async function loadAssessments() {
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

    setAssessments((data ?? []) as AssessmentListRow[]);
  }

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
          .select("id, site_assessment_id, module_key, score, risk_level, confidence_level, rationale, override_note, created_at, updated_at")
          .eq("site_assessment_id", assessmentId)
          .order("module_key", { ascending: true }),
        supabase
          .from("assessment_verdicts")
          .select("id, site_assessment_id, verdict, summary, key_strengths, key_risks, recommended_next_steps, limitations_note, approved_by_analyst, approved_at, created_at, updated_at")
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
            "id, site_assessment_id, title, source_type, publisher, url, file_reference, accessed_at, published_at, confidence_level, license_notes, limitation_notes, summary, created_at, updated_at",
          )
          .eq("site_assessment_id", assessmentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("assessment_findings")
          .select(
            "id, site_assessment_id, module_key, title, finding_type, risk_level, confidence_level, statement, assumption_note, recommendation, status, created_at, updated_at",
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
          .select("id, finding_id, evidence_source_id, link_note, created_at")
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

    if (!form.organisationName.trim() || !form.projectName.trim() || !form.siteName.trim()) {
      setError("Organisation, project, and site name are required.");
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
      status: nextStatus,
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
            ...assessmentPayload,
          })
          .select("id")
          .single();

        if (assessmentError) {
          throw assessmentError;
        }

        await supabase.from("status_history").insert({
          site_assessment_id: assessment.id,
          from_status: null,
          to_status: nextStatus,
          reason: "Assessment created from intake form",
        });

        setSuccessMessage("Assessment created.");
        await loadAssessments();
        await loadDetail(assessment.id as string);
      } else {
        const projectId = form.projectId;
        const siteId = form.siteId;
        const assessmentId = form.assessmentId;
        const previousStatus = selectedAssessment?.status ?? "draft";

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

        if (previousStatus !== nextStatus) {
          await supabase.from("status_history").insert({
            site_assessment_id: assessmentId,
            from_status: previousStatus,
            to_status: nextStatus,
            reason: "Intake form updated",
          });
        }

        setSuccessMessage("Assessment updated.");
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

    setSaving(true);
    setError("");

    const previousStatus = selectedAssessment.status;
    const { error: updateError } = await supabase
      .from("site_assessments")
      .update({ status: pendingStatus })
      .eq("id", selectedAssessment.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    if (previousStatus !== pendingStatus) {
      await supabase.from("status_history").insert({
        site_assessment_id: selectedAssessment.id,
        from_status: previousStatus,
        to_status: pendingStatus,
        reason: "Workflow status changed in analyst console",
      });
    }

    setSaving(false);
    setSuccessMessage("Status updated.");
    await loadAssessments();
    await loadDetail(selectedAssessment.id);
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

    const { error: saveError } = await supabase.from("assessment_grid_assets").insert({
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
    });

    if (saveError) {
      setSavingGridAsset(false);
      setGridAssetError(getErrorMessage(saveError, "Could not save GIS asset."));
      return;
    }

    setNewGridAsset(blankGridAssetDraft);
    setSuccessMessage("GIS asset added.");
    await loadDetail(selectedAssessment.id);
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

    if (!newEvidenceSource.title.trim()) {
      setEvidenceError("Evidence source title is required.");
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
      summary: newEvidenceSource.summary.trim() || null,
    };

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

    setSavingFinding(true);
    setEvidenceError("");
    setSuccessMessage("");

    try {
      const payload = {
        site_assessment_id: selectedAssessment.id,
        module_key: newFinding.moduleKey,
        title: newFinding.title.trim(),
        finding_type: newFinding.findingType,
        risk_level: newFinding.riskLevel,
        confidence_level: newFinding.confidenceLevel,
        statement: newFinding.statement.trim() || null,
        assumption_note: newFinding.assumptionNote.trim() || null,
        recommendation: newFinding.recommendation.trim() || null,
        status: newFinding.status,
      };

      let findingId = editingFindingId;

      if (editingFindingId) {
        const { error: updateError } = await supabase
          .from("assessment_findings")
          .update(payload)
          .eq("id", editingFindingId);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { data: createdFinding, error: insertError } = await supabase
          .from("assessment_findings")
          .insert(payload)
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        findingId = createdFinding.id as string;
      }

      if (!findingId) {
        throw new Error("Could not determine the saved finding ID.");
      }

      if (editingFindingId) {
        const { error: deleteLinkError } = await supabase
          .from("finding_evidence_links")
          .delete()
          .eq("finding_id", findingId);

        if (deleteLinkError) {
          throw deleteLinkError;
        }
      }

      if (linkedEvidenceSourceIds.length > 0) {
        const { error: linkError } = await supabase.from("finding_evidence_links").insert(
          linkedEvidenceSourceIds.map((evidenceSourceId) => ({
            finding_id: findingId,
            evidence_source_id: evidenceSourceId,
          })),
        );

        if (linkError) {
          throw linkError;
        }
      }

      setNewFinding({ ...blankAssessmentFindingDraft, linkedEvidenceSourceIds: [] });
      setEditingFindingId("");
      setSuccessMessage(editingFindingId ? "Finding updated." : "Finding added.");
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
    const payloads = scoreModules
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
          site_assessment_id: selectedAssessment.id,
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

    const { error: saveError } = await supabase
      .from("assessment_scores")
      .upsert(payloads, { onConflict: "site_assessment_id,module_key" });

    if (saveError) {
      setSavingScorecard(false);
      setScorecardError(getErrorMessage(saveError, "Could not save scorecard."));
      return;
    }

    setSuccessMessage(`Saved ${payloads.length} score${payloads.length === 1 ? "" : "s"}.`);
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

    const approvedAt = verdictDraft.approvedByAnalyst
      ? assessmentVerdict?.approved_at ?? new Date().toISOString()
      : null;

    const { data, error: saveError } = await supabase
      .from("assessment_verdicts")
      .upsert(
        {
          site_assessment_id: selectedAssessment.id,
          verdict: verdictDraft.verdict,
          summary: verdictDraft.summary.trim() || null,
          key_strengths: verdictDraft.keyStrengths.trim() || null,
          key_risks: verdictDraft.keyRisks.trim() || null,
          recommended_next_steps: verdictDraft.recommendedNextSteps.trim() || null,
          limitations_note: verdictDraft.limitationsNote.trim() || null,
          approved_by_analyst: verdictDraft.approvedByAnalyst,
          approved_at: approvedAt,
        },
        { onConflict: "site_assessment_id" },
      )
      .select("id, site_assessment_id, verdict, summary, key_strengths, key_risks, recommended_next_steps, limitations_note, approved_by_analyst, approved_at, created_at, updated_at")
      .single();

    if (saveError) {
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

    const { data, error: saveError } = await supabase
      .from("assessment_report_exports")
      .upsert(
        {
          export_type: "print_preview",
          ready_for_review_at: status === "ready_for_review" ? new Date().toISOString() : null,
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
    <main className="min-h-screen overflow-hidden bg-[#f5f7f2] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-[#f5f7f2]/88 backdrop-blur-xl">
        <nav className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
              <Image src="/gridready-logo.svg" alt="GridReady AI" width={25} height={25} priority />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1b365d]">GridReady AI</p>
              <h1 className="truncate text-lg font-semibold text-[#10243f] sm:text-xl">Intake Console</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={secondaryButtonClass}>
              <ArrowLeft size={16} />
              Site
            </Link>
            <button
              type="button"
              onClick={() => void loadAssessments()}
              className={secondaryButtonClass}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              type="button"
              onClick={resetCreateForm}
              className={primaryButtonClass}
            >
              <Plus size={16} />
              New assessment
            </button>
          </div>
        </nav>
      </header>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[linear-gradient(90deg,rgba(27,54,93,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(27,54,93,0.08)_1px,transparent_1px)] bg-[size:52px_52px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[linear-gradient(180deg,rgba(245,247,242,0.28),#f5f7f2_90%)]" />

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p>{error}</p>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <p>{successMessage}</p>
          </div>
        ) : null}

        {mode === "dashboard" ? (
          <Dashboard
            assessments={filteredAssessments}
            loading={loading}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            stats={stats}
            onOpen={(assessmentId) => void loadDetail(assessmentId)}
          />
        ) : null}

        {mode === "form" ? (
          <AssessmentForm
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
            onSubmit={(event) => void handleSaveAssessment(event)}
          />
        ) : null}

        {mode === "detail" && selectedAssessment ? (
          <AssessmentDetailPanel
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
          />
        ) : null}
        </div>
      </div>
    </main>
  );
}

function MissingConfig() {
  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <AlertCircle size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#10243f]">Supabase connection needed</h1>
            <p className="text-sm text-slate-600">Create `web/.env.local` and restart the dev server.</p>
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
  loading,
  searchTerm,
  setSearchTerm,
  stats,
  onOpen,
}: {
  assessments: AssessmentListRow[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  stats: { total: number; intakeComplete: number; averageCompleteness: number; totalMw: number };
  onOpen: (assessmentId: string) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white/86 p-5 shadow-sm backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1b365d]/15 bg-white px-3 py-1 text-xs font-semibold text-[#1b365d] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            ERCOT / Texas intake workflow
          </div>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold leading-tight text-[#10243f]">Site assessment queue</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Capture customer, site, load, timing, and readiness assumptions before grid screening starts.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-slate-200 bg-[#f8faf7] px-3 py-1 text-slate-700">75 MW+ focus</span>
              <span className="rounded-full border border-slate-200 bg-[#f8faf7] px-3 py-1 text-slate-700">5-10 day report cycle</span>
            </div>
          </div>
        </div>

        <div className="relative min-h-44 overflow-hidden rounded-lg border border-white/10 bg-[#10243f] p-4 text-white shadow-xl shadow-slate-900/10">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:28px_28px]" />
          <div className="relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-semibold text-slate-300">Diligence spine</span>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                Intake first
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {["Site data", "Load assumptions", "Evidence notes"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/7 px-3 py-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-xs font-semibold text-sky-100">
                    0{index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-100">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<ClipboardList size={18} />} label="Assessments" value={stats.total.toString()} />
        <MetricCard icon={<CheckCircle2 size={18} />} label="Intake complete" value={stats.intakeComplete.toString()} />
        <MetricCard icon={<NotebookPen size={18} />} label="Average completeness" value={`${stats.averageCompleteness}%`} />
        <MetricCard icon={<Zap size={18} />} label="Target load" value={`${stats.totalMw} MW`} />
      </section>

      <section className={cardClass}>
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#10243f]">Site assessments</h2>
            <p className="text-sm text-slate-600">Internal intake queue</p>
          </div>
          <label className="relative block w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search assessments"
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-[#f8faf7] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Assessment</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Site</th>
                <th className="px-4 py-3 font-semibold">Load</th>
                <th className="px-4 py-3 font-semibold">Energization</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Completeness</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      Loading
                    </span>
                  </td>
                </tr>
              ) : null}

              {!loading && assessments.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                    No assessments yet
                  </td>
                </tr>
              ) : null}

              {!loading
                ? assessments.map((assessment) => {
                    const site = single(assessment.sites);
                    const project = single(assessment.projects);
                    const organisation = single(project?.organisations);

                    return (
                      <tr key={assessment.id} className="transition hover:bg-[#f8faf7]">
                        <td className="max-w-[220px] px-4 py-3">
                          <p className="truncate font-medium text-slate-950">{assessment.assessment_name}</p>
                          <p className="text-xs text-slate-500">{assessment.market_region}</p>
                        </td>
                        <td className="max-w-[180px] px-4 py-3">
                          <p className="truncate text-slate-700">{organisation?.name ?? "Unassigned"}</p>
                          <p className="text-xs text-slate-500">{project?.name ?? "No project"}</p>
                        </td>
                        <td className="max-w-[180px] px-4 py-3">
                          <p className="truncate text-slate-700">{site?.site_name ?? "No site"}</p>
                          <p className="text-xs text-slate-500">
                            {[site?.county, site?.state].filter(Boolean).join(", ") || "Location pending"}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {assessment.target_load_mw ? `${assessment.target_load_mw} MW` : "Not set"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatDate(assessment.desired_energization_date)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={assessment.status} />
                        </td>
                        <td className="px-4 py-3">
                          <CompletenessBar value={assessment.intake_completeness_score} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onOpen(assessment.id)}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#1b365d]/40 hover:text-[#1b365d]"
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
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={cx(subtleCardClass, "p-4")}>
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-[#10243f]">{value}</p>
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
  onBack,
  onSubmit,
}: {
  completenessScore: number;
  form: AssessmentFormState;
  formMode: FormMode;
  recommendedStatus: AssessmentStatus;
  saving: boolean;
  updateForm: <K extends keyof AssessmentFormState>(key: K, value: AssessmentFormState[K]) => void;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
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
          type="submit"
          disabled={saving}
          className={primaryButtonClass}
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {formMode === "create" ? "Create assessment" : "Save intake"}
        </button>
      </div>

      <section className={cx(cardClass, "overflow-hidden")}>
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[#1b365d]">
              {formMode === "create" ? "New diligence record" : "Assessment intake"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[#10243f]">
              {formMode === "create" ? "New site assessment" : "Edit intake"}
            </h2>
            <p className="text-sm text-slate-600">Suggested status: {statusLabel(recommendedStatus)}</p>
          </div>
          <div className="w-full md:w-72">
            <CompletenessBar value={completenessScore} />
          </div>
          </div>
        </div>

        <div className="grid gap-5 bg-[#f8faf7] p-5 lg:grid-cols-2">
          <FieldGroup icon={<Building2 size={18} />} title="Customer and project">
            <TextField
              label="Organisation"
              value={form.organisationName}
              required
              onChange={(value) => updateForm("organisationName", value)}
            />
            <SelectField
              label="Organisation type"
              value={form.organisationType}
              options={organisationTypes}
              onChange={(value) => updateForm("organisationType", value)}
            />
            <TextField
              label="Contact name"
              value={form.contactName}
              onChange={(value) => updateForm("contactName", value)}
            />
            <TextField
              label="Contact email"
              type="email"
              value={form.contactEmail}
              required
              onChange={(value) => updateForm("contactEmail", value)}
            />
            <TextField
              label="Contact phone"
              value={form.contactPhone}
              onChange={(value) => updateForm("contactPhone", value)}
            />
            <TextField
              label="Contact role"
              value={form.contactRoleTitle}
              onChange={(value) => updateForm("contactRoleTitle", value)}
            />
            <TextField
              label="Project name"
              value={form.projectName}
              required
              onChange={(value) => updateForm("projectName", value)}
            />
            <SelectField
              label="Project type"
              value={form.projectType}
              options={projectTypes}
              onChange={(value) => updateForm("projectType", value)}
            />
            <TextField
              label="Project deadline"
              type="date"
              value={form.projectDeadline}
              onChange={(value) => updateForm("projectDeadline", value)}
            />
            <TextAreaField
              label="Project description"
              value={form.projectDescription}
              onChange={(value) => updateForm("projectDescription", value)}
            />
          </FieldGroup>

          <FieldGroup icon={<MapPin size={18} />} title="Site location">
            <TextField
              label="Site name"
              value={form.siteName}
              required
              onChange={(value) => {
                updateForm("siteName", value);
                if (!form.assessmentName.trim()) {
                  updateForm("assessmentName", value ? `${value} assessment` : "");
                }
              }}
            />
            <AddressAutocompleteField
              label="Address"
              value={form.address}
              onChange={(value) => updateForm("address", value)}
              onSelect={(suggestion) => {
                updateForm("address", suggestion.addressLine1 || suggestion.formattedAddress);
                updateForm("city", suggestion.city);
                updateForm("county", suggestion.county);
                updateForm("state", suggestion.stateCode || suggestion.state || form.state);
                updateForm("latitude", suggestion.latitude.toFixed(6));
                updateForm("longitude", suggestion.longitude.toFixed(6));
              }}
            />
            <TextField label="City" value={form.city} onChange={(value) => updateForm("city", value)} />
            <TextField label="County" value={form.county} onChange={(value) => updateForm("county", value)} />
            <TextField label="State" value={form.state} onChange={(value) => updateForm("state", value)} />
            <TextField
              label="Latitude"
              inputMode="decimal"
              value={form.latitude}
              onChange={(value) => updateForm("latitude", value)}
            />
            <TextField
              label="Longitude"
              inputMode="decimal"
              value={form.longitude}
              onChange={(value) => updateForm("longitude", value)}
            />
            <TextField label="Parcel ID" value={form.parcelId} onChange={(value) => updateForm("parcelId", value)} />
          </FieldGroup>

          <FieldGroup icon={<Zap size={18} />} title="Power assumptions">
            <TextField
              label="Assessment name"
              value={form.assessmentName}
              onChange={(value) => updateForm("assessmentName", value)}
            />
            <TextField
              label="Market region"
              value={form.marketRegion}
              onChange={(value) => updateForm("marketRegion", value)}
            />
            <TextField
              label="Target load MW"
              inputMode="decimal"
              value={form.targetLoadMw}
              required
              onChange={(value) => updateForm("targetLoadMw", value)}
            />
            <TextField
              label="Initial phase MW"
              inputMode="decimal"
              value={form.initialLoadMw}
              onChange={(value) => updateForm("initialLoadMw", value)}
            />
            <TextField
              label="Full buildout MW"
              inputMode="decimal"
              value={form.fullBuildoutLoadMw}
              onChange={(value) => updateForm("fullBuildoutLoadMw", value)}
            />
            <TextField
              label="Desired energization"
              type="date"
              value={form.desiredEnergizationDate}
              required
              onChange={(value) => updateForm("desiredEnergizationDate", value)}
            />
            <TextField
              label="Project stage"
              value={form.projectStage}
              onChange={(value) => updateForm("projectStage", value)}
            />
            <TextField
              label="Land control"
              value={form.landControlStatus}
              onChange={(value) => updateForm("landControlStatus", value)}
            />
            <TextField label="Known utility" value={form.knownUtility} onChange={(value) => updateForm("knownUtility", value)} />
            <TextField label="Known TSP" value={form.knownTsp} onChange={(value) => updateForm("knownTsp", value)} />
            <TextField
              label="Known substation or POI"
              value={form.knownSubstationOrPoi}
              onChange={(value) => updateForm("knownSubstationOrPoi", value)}
            />
          </FieldGroup>

          <FieldGroup icon={<ClipboardList size={18} />} title="Readiness notes">
            <TextAreaField
              label="Existing studies"
              value={form.existingStudiesSummary}
              onChange={(value) => updateForm("existingStudiesSummary", value)}
            />
            <TextAreaField
              label="Existing power quote"
              value={form.existingPowerQuoteSummary}
              onChange={(value) => updateForm("existingPowerQuoteSummary", value)}
            />
            <TextAreaField
              label="Backup generation"
              value={form.backupGenerationAssumptions}
              onChange={(value) => updateForm("backupGenerationAssumptions", value)}
            />
            <TextAreaField
              label="Battery/storage"
              value={form.batteryStorageAssumptions}
              onChange={(value) => updateForm("batteryStorageAssumptions", value)}
            />
            <SelectField
              label="Curtailment willingness"
              value={form.curtailmentWillingness}
              options={curtailmentOptions}
              onChange={(value) => updateForm("curtailmentWillingness", value)}
            />
            <TextAreaField
              label="Workload flexibility"
              value={form.workloadFlexibilityAssumptions}
              onChange={(value) => updateForm("workloadFlexibilityAssumptions", value)}
            />
            <TextAreaField
              label="Water/cooling"
              value={form.waterCoolingNotes}
              onChange={(value) => updateForm("waterCoolingNotes", value)}
            />
            <SelectField
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
          </FieldGroup>
        </div>
      </section>
    </form>
  );
}

function AssessmentDetailPanel({
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
}: {
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
}) {
  const site = single(assessment.sites);
  const project = single(assessment.projects);
  const organisation = single(project?.organisations);

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
        <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={assessment.status} />
              <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-[#1b365d]">
                {assessment.market_region}
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-[#10243f]">{assessment.assessment_name}</h2>
            <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <InfoLine icon={<Building2 size={16} />} label="Customer" value={organisation?.name ?? "Unassigned"} />
              <InfoLine icon={<ClipboardList size={16} />} label="Project" value={project?.name ?? "No project"} />
              <InfoLine icon={<MapPin size={16} />} label="Site" value={site?.site_name ?? "No site"} />
              <InfoLine
                icon={<CalendarDays size={16} />}
                label="Energization"
                value={formatDate(assessment.desired_energization_date)}
              />
              <InfoLine
                icon={<Zap size={16} />}
                label="Target load"
                value={assessment.target_load_mw ? `${assessment.target_load_mw} MW` : "Not set"}
              />
              <InfoLine
                icon={<UserRound size={16} />}
                label="Contact"
                value={assessment.contact?.email ?? assessment.contact?.name ?? "Not set"}
              />
            </div>
          </div>

          <div className="space-y-4">
            <CompletenessBar value={assessment.intake_completeness_score} />
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Workflow status</label>
              <div className="flex gap-2">
                <select
                  value={pendingStatus}
                  onChange={(event) => onPendingStatusChange(event.target.value as AssessmentStatus)}
                  className={cx(inputClass, "min-w-0 flex-1")}
                >
                  {assessmentStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onStatusSave}
                  disabled={saving}
                  className={secondaryButtonClass}
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteMapPanel
        assetDraft={gridAssetDraft}
        assets={gridAssets}
        error={gridAssetError}
        knownSubstationOrPoi={assessment.known_substation_or_poi}
        knownTsp={assessment.known_tsp}
        knownUtility={assessment.known_utility}
        marketRegion={assessment.market_region}
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

      <ChecklistPanel
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

      <FinalVerdictPanel
        draft={verdictDraft}
        saving={savingVerdict}
        verdict={assessmentVerdict}
        onChange={onVerdictChange}
        onSubmit={onVerdictSubmit}
      />

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

      <section className="grid gap-5 lg:grid-cols-2">
        <div className={cx(cardClass, "p-4")}>
          <h3 className="mb-4 text-base font-semibold text-[#10243f]">Assessment notes</h3>
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
              <article key={note.id} className="rounded-lg border border-slate-200 bg-[#f8faf7] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                    {note.note_type.replaceAll("_", " ")}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(note.created_at).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={cx(cardClass, "p-4")}>
          <h3 className="mb-4 text-base font-semibold text-[#10243f]">Document references</h3>
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
              <article key={file.id} className="rounded-lg border border-slate-200 bg-[#f8faf7] p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">{file.file_name}</p>
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                    {(file.document_category ?? "other").replaceAll("_", " ")}
                  </span>
                </div>
                {file.storage_path ? <p className="break-all text-xs text-slate-500">{file.storage_path}</p> : null}
                {file.description ? <p className="mt-2 text-sm text-slate-700">{file.description}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </section>
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
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
              <BarChart3 size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[#10243f]">Scorecard</h3>
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
        <span className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1">
          {scoreSummary.completedModules}/{scoreSummary.totalModules} modules scored
        </span>
        <span className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1">
          Lowest: {scoreSummary.lowestScore ? scoreSummary.lowestScore.label : "Not set"}
        </span>
        <span className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1">
          Evidence gaps: {evidenceGapCount}
        </span>
      </div>

      {loading ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-[#f8faf7] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading scorecard
        </div>
      ) : null}

      <form onSubmit={onSubmit}>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {scoreModules.map((module) => {
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
                        <span className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1 text-xs font-semibold text-slate-600">
                          Saved {new Date(savedScore.updated_at).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    <h4 className="text-sm font-semibold uppercase text-[#1b365d]">{module.label}</h4>
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#10243f]">Final Verdict</h3>
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
        <label className="flex items-end lg:col-span-3">
          <span className="inline-flex h-11 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
            <input
              checked={draft.approvedByAnalyst}
              onChange={(event) => onChange({ ...draft, approvedByAnalyst: event.target.checked })}
              type="checkbox"
              className="h-4 w-4 accent-[#1b365d]"
            />
            Analyst approved
          </span>
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
            <CheckCircle2 size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#10243f]">Delivery Gates</h3>
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
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-[#f8faf7] px-4 py-5 text-sm text-slate-600">
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

      <div className="mb-5 rounded-lg border border-slate-200 bg-[#f8faf7] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[#10243f]">Expert review triggers</h4>
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
            <h4 className="text-sm font-semibold text-[#10243f]">Final report expert review</h4>
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
  const sectionsByTemplateId = new Map(reportSections.map((section) => [section.template_section_id, section]));
  const savedCount = templateSections.filter((section) => sectionsByTemplateId.has(section.id)).length;
  const editedCount = reportSections.filter((section) => section.is_edited).length;
  const evidenceGapCount = templateSections.filter((section) => {
    const draft = reportSectionDrafts[section.id];
    return draft ? hasEvidenceGap(draft.content) : false;
  }).length;
  const exportStatus = exportRecord?.status ?? "not_started";

  return (
    <section className={cx(cardClass, "p-4")}>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
            <FileText size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#10243f]">Report Builder</h3>
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
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-[#f8faf7] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading report builder
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!template || loading || generating}
          onClick={onGenerate}
          className={primaryButtonClass}
        >
          {generating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          Generate draft
        </button>
        <button
          type="button"
          disabled={!template || loading || generating}
          onClick={onRegenerateAll}
          className={secondaryButtonClass}
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
          className={secondaryButtonClass}
        >
          {savingExport ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          Ready for review
        </button>
        <Link href={`/intake/reports/${assessmentId}`} target="_blank" className={secondaryButtonClass}>
          <ExternalLink size={16} />
          Print preview
        </Link>
      </div>

      {exportRecord?.ready_for_review_at ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          Ready for review since {new Date(exportRecord.ready_for_review_at).toLocaleString()}
        </div>
      ) : null}

      {templateSections.length === 0 && !loading ? (
        <div className="rounded-lg border border-slate-200 bg-[#f8faf7] px-4 py-5 text-sm text-slate-600">
          Apply the report builder SQL to load the ERCOT v1 report template.
        </div>
      ) : null}

      <div className="space-y-3">
        {templateSections.map((templateSection) => {
          const savedSection = sectionsByTemplateId.get(templateSection.id);
          const draft = reportSectionDrafts[templateSection.id] ?? { content: "", status: "draft" as ReportSectionStatus };
          const hasGap = hasEvidenceGap(draft.content);
          const isSaving = savingSectionId === templateSection.id;

          return (
            <article key={templateSection.id} className={cx(subtleCardClass, "p-3")}>
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                      {templateSection.sort_order}
                    </span>
                    <span className={cx("rounded-md border px-2 py-1 text-xs font-semibold", reportStatusTone(draft.status))}>
                      {reportSectionStatusLabel(draft.status)}
                    </span>
                    {savedSection?.is_edited ? (
                      <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-[#1b365d]">
                        Edited
                      </span>
                    ) : null}
                    {hasGap ? (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                        Evidence pending
                      </span>
                    ) : null}
                  </div>
                  <h4 className="text-sm font-semibold text-[#10243f]">{templateSection.title}</h4>
                  {templateSection.default_guidance ? (
                    <p className="mt-1 text-sm leading-6 text-slate-600">{templateSection.default_guidance}</p>
                  ) : null}
                </div>
                {savedSection?.updated_at ? (
                  <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                    Saved {new Date(savedSection.updated_at).toLocaleString()}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
                <SelectField
                  label="Section status"
                  value={draft.status}
                  options={reportSectionStatuses}
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
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
              <FileText size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[#10243f]">Evidence Library</h3>
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
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[#f8faf7] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading evidence
        </div>
      ) : null}

      {!loading && groupedSources.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-[#f8faf7] px-4 py-5 text-sm text-slate-600">
          No evidence sources yet
        </div>
      ) : null}

      {!loading && groupedSources.length > 0 ? (
        <div className="space-y-5">
          {groupedSources.map((group) => (
            <section key={group.value} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase text-[#1b365d]">{group.label}</h4>
                <span className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1 text-xs font-semibold text-slate-600">
                  {group.sources.length}
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {group.sources.map((source) => (
                  <article key={source.id} className="rounded-lg border border-slate-200 bg-[#f8faf7] p-3">
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
                          className="inline-flex max-w-full items-center gap-1 font-semibold text-[#1b365d] underline-offset-2 hover:underline"
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
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
              <AlertTriangle size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[#10243f]">Findings</h3>
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
        <div className="hidden lg:block" />
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

        <div className="rounded-lg border border-slate-200 bg-[#f8faf7] p-3 lg:col-span-4">
          <div className="mb-3 flex items-center gap-2">
            <Link2 size={16} className="text-[#1b365d]" />
            <h4 className="text-sm font-semibold text-[#10243f]">Linked evidence</h4>
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
                    className="mt-1 h-4 w-4 shrink-0 accent-[#1b365d]"
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
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[#f8faf7] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading findings
        </div>
      ) : null}

      {!loading ? (
        <div className="space-y-5">
          {findings.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-[#f8faf7] px-4 py-5 text-sm text-slate-600">
              No findings yet
            </div>
          ) : null}
          {groupedFindings.map((group) => (
            <section key={group.value} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase text-[#1b365d]">{group.label}</h4>
                <span className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1 text-xs font-semibold text-slate-600">
                  {group.findings.length}
                </span>
              </div>
              {group.findings.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-[#f8faf7] px-3 py-3 text-sm text-slate-500">
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
                              <span className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1 text-xs font-semibold text-slate-600">
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
                                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1 text-xs font-semibold text-slate-700"
                                >
                                  <FileText size={13} className="shrink-0 text-[#1b365d]" />
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
    neutral: "border-slate-200 bg-[#f8faf7] text-slate-800",
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

  return (
    <section className={cx(cardClass, "p-4")}>
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
              <ClipboardList size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[#10243f]">Analysis checklist</h3>
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
          </div>
        </div>

        <div className="w-full shrink-0 lg:w-80">
          <ProgressMeter label="Overall progress" value={progress.progressPercent} />
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1">
              {progress.answeredItems}/{progress.totalItems} answered
            </span>
            <span className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1">
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
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[#f8faf7] px-4 py-5 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading checklist
        </div>
      ) : null}

      {!loading && !error && groups.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-[#f8faf7] px-4 py-5 text-sm text-slate-600">
          No checklist items found for the active template.
        </div>
      ) : null}

      {!loading && groups.length > 0 ? (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.moduleKey} className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
              <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_280px] lg:items-center">
                <div>
                  <h4 className="text-sm font-semibold uppercase text-[#1b365d]">{group.moduleName}</h4>
                  <p className="mt-1 text-sm text-slate-600">
                    {group.answeredItems}/{group.totalItems} answered - {group.requiredAnsweredItems}/{group.requiredItems} required
                  </p>
                </div>
                <ProgressMeter label={`${group.moduleName} progress`} value={group.progressPercent} compact />
              </div>

              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {group.items.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    saving={savingItemId === item.id}
                    savingAll={savingAll}
                    onChange={onChange}
                    onSave={onSave}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ChecklistItemRow({
  item,
  saving,
  savingAll,
  onChange,
  onSave,
}: {
  item: ChecklistModuleGroup["items"][number];
  saving: boolean;
  savingAll: boolean;
  onChange: (itemId: string, updates: Partial<Pick<ChecklistDraft, "status" | "analystNote" | "evidenceNote">>) => void;
  onSave: (itemId: string) => void;
}) {
  return (
    <article className="bg-white p-4 first:rounded-t-lg last:rounded-b-lg">
      <div className="grid gap-4 xl:grid-cols-[1fr_220px]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ChecklistStatusBadge status={item.draft.status} />
            {item.is_required ? (
              <span className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1 text-xs font-semibold text-slate-600">
                Required
              </span>
            ) : null}
          </div>
          <h5 className="text-sm font-semibold leading-6 text-slate-900">{item.prompt}</h5>
          {item.guidance ? <p className="mt-1 text-sm leading-6 text-slate-600">{item.guidance}</p> : null}
          {item.draft.updatedAt ? (
            <p className="mt-2 text-xs text-slate-500">Last saved {new Date(item.draft.updatedAt).toLocaleString()}</p>
          ) : null}
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
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
        <span className="text-sm font-semibold text-[#10243f]">{value}%</span>
      </div>
      <div className={cx("overflow-hidden rounded-md bg-slate-200", compact ? "h-1.5" : "h-2")}>
        <div className={cx("h-full rounded-md", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function FieldGroup({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3 text-slate-800">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
          {icon}
        </span>
        <h3 className="text-base font-semibold text-[#10243f]">{title}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function TextField({
  inputMode,
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  inputMode?: "decimal" | "numeric";
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </label>
  );
}

function TextAreaField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block min-w-0 sm:col-span-2">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className={textareaClass}
      />
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "border-slate-200 bg-white text-slate-700",
    intake_incomplete: "border-amber-200 bg-amber-50 text-amber-800",
    intake_complete: "border-emerald-200 bg-emerald-50 text-emerald-800",
    in_analyst_review: "border-sky-200 bg-sky-50 text-[#1b365d]",
    in_expert_review: "border-violet-200 bg-violet-50 text-violet-800",
    report_drafting: "border-blue-200 bg-blue-50 text-blue-800",
    final_review: "border-indigo-200 bg-indigo-50 text-indigo-800",
    delivered: "border-emerald-200 bg-emerald-50 text-emerald-800",
    archived: "border-slate-200 bg-slate-100 text-slate-600",
  };

  return (
    <span className={cx("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", styles[status] ?? styles.draft)}>
      {statusLabel(status)}
    </span>
  );
}

function CompletenessBar({ value }: { value: number }) {
  const color = value >= 75 ? "bg-emerald-500" : value >= 45 ? "bg-amber-400" : "bg-rose-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase text-slate-500">Completeness</span>
        <span className="text-sm font-semibold text-[#10243f]">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-md bg-slate-200">
        <div className={cx("h-full rounded-md", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-[#1b365d]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}
