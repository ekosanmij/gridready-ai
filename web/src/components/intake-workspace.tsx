"use client";

import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  Loader2,
  MapPin,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  UserRound,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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

function getErrorMessage(error: unknown) {
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

  return "Could not save assessment.";
}

export function IntakeWorkspace() {
  const [mode, setMode] = useState<Mode>("dashboard");
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [assessments, setAssessments] = useState<AssessmentListRow[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentDetail | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [form, setForm] = useState<AssessmentFormState>(blankAssessmentForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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

    const [{ data: noteData, error: noteError }, { data: fileData, error: fileError }] = await Promise.all([
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
    ]);

    setLoading(false);

    if (noteError || fileError) {
      setError(noteError?.message ?? fileError?.message ?? "");
      return;
    }

    setSelectedAssessment({ ...assessment, contact });
    setNotes((noteData ?? []) as NoteRecord[]);
    setFiles((fileData ?? []) as FileRecord[]);
    setPendingStatus(assessment.status);
    setMode("detail");
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
            organisation_type: form.organisationType,
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
            project_type: form.projectType,
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
            organisation_type: form.organisationType,
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
            project_type: form.projectType,
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
            files={files}
            newFile={newFile}
            newNote={newNote}
            newNoteType={newNoteType}
            notes={notes}
            pendingStatus={pendingStatus}
            saving={saving}
            onAddFileReference={(event) => void addFileReference(event)}
            onAddNote={(event) => void addNote(event)}
            onBack={() => {
              setMode("dashboard");
              setSelectedAssessment(null);
              setSuccessMessage("");
              setError("");
            }}
            onEdit={() => populateEditForm(selectedAssessment)}
            onFileChange={setNewFile}
            onNoteChange={setNewNote}
            onNoteTypeChange={setNewNoteType}
            onPendingStatusChange={setPendingStatus}
            onStatusSave={() => void updateStatus()}
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
            <TextField label="Address" value={form.address} onChange={(value) => updateForm("address", value)} />
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
  files,
  newFile,
  newNote,
  newNoteType,
  notes,
  pendingStatus,
  saving,
  onAddFileReference,
  onAddNote,
  onBack,
  onEdit,
  onFileChange,
  onNoteChange,
  onNoteTypeChange,
  onPendingStatusChange,
  onStatusSave,
}: {
  assessment: AssessmentDetail;
  files: FileRecord[];
  newFile: { fileName: string; documentCategory: string; storagePath: string; description: string };
  newNote: string;
  newNoteType: string;
  notes: NoteRecord[];
  pendingStatus: AssessmentStatus;
  saving: boolean;
  onAddFileReference: (event: FormEvent<HTMLFormElement>) => void;
  onAddNote: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onEdit: () => void;
  onFileChange: (value: { fileName: string; documentCategory: string; storagePath: string; description: string }) => void;
  onNoteChange: (value: string) => void;
  onNoteTypeChange: (value: string) => void;
  onPendingStatusChange: (value: AssessmentStatus) => void;
  onStatusSave: () => void;
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
