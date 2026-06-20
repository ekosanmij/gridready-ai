"use client";

import { AlertCircle, CheckCircle2, Download, Loader2, Save, Send, Sparkles, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AddressAutocompleteField } from "@/components/address-autocomplete-field";
import { useAuth } from "@/components/auth/auth-provider";
import {
  FieldControl,
  StatusPill,
  cx,
  inputClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from "@/components/ui-primitives";
import {
  AssessmentFormState,
  blankAssessmentForm,
  calculateCompletenessScore,
  isValidContactEmail,
  parseOptionalNumber,
  suggestedIntakeStatus,
} from "@/lib/intake";
import { getErrorMessage } from "@/lib/errors";
import {
  IntakeFieldState,
  IntakeRequestType,
} from "@/lib/intake-request-types";
import { ensureCustomerContact, ensureCustomerOrganisation } from "@/lib/customer-tenancy";
import {
  customerEvidenceAccept,
  discardCustomerIntakeDraft,
  formatFileSize,
  linkCustomerIntakeFiles,
  listCustomerIntakeFiles,
  loadCustomerIntakeDraft,
  markCustomerIntakeDraftSubmitted,
  removeCustomerIntakeFile,
  saveCustomerIntakeDraft,
  uploadCustomerIntakeFile,
  type CustomerIntakeFile,
} from "@/lib/customer-intake-drafts";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  getClientHydrationSnapshot,
  getServerHydrationSnapshot,
  subscribeHydrationChange,
} from "@/lib/ui-preferences";

const fieldStateOptions: Array<{ label: string; value: IntakeFieldState }> = [
  { value: "provided", label: "Provided" },
  { value: "unknown", label: "Unknown" },
  { value: "to_confirm", label: "To confirm" },
  { value: "provided_in_attachment", label: "In attachment" },
  { value: "not_applicable", label: "N/A" },
];

const requestProjectType: Record<IntakeRequestType["id"], string> = {
  "evidence-upload": "single_site",
  "existing-assessment-update": "single_site",
  "investor-underwriting": "investor_underwriting",
  "portfolio-triage": "multi_site",
  "report-package": "single_site",
  "single-site-screen": "single_site",
};

const smartIntakeDraftVersion = 1;

type SmartIntakeDraft = {
  fieldStates: Partial<Record<keyof AssessmentFormState, IntakeFieldState>>;
  form: AssessmentFormState;
  id: string;
  savedAt: string;
  status: "active" | "submitted";
  submittedAssessmentId: string | null;
};

type DuplicateRequestSuggestion = {
  id: string;
  label: string;
  reason: string;
};

type SmartIntakeSuggestion = {
  body: string;
  confidence: "High" | "Medium" | "Low";
  label: string;
  tone: "danger" | "info" | "success" | "warning";
};

function createBlankSmartIntakeDraft(requestType: IntakeRequestType): SmartIntakeDraft {
  return {
    fieldStates: {} as Partial<Record<keyof AssessmentFormState, IntakeFieldState>>,
    form: {
      ...blankAssessmentForm,
      projectType: requestProjectType[requestType.id],
    },
    id: "",
    savedAt: "",
    status: "active",
    submittedAssessmentId: null,
  };
}

function parseSmartIntakeDraft(savedDraft: string, requestType: IntakeRequestType): SmartIntakeDraft {
  const fallback = createBlankSmartIntakeDraft(requestType);

  if (!savedDraft) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(savedDraft) as {
      fieldStates?: Partial<Record<keyof AssessmentFormState, IntakeFieldState>>;
      form?: AssessmentFormState;
      id?: string;
      savedAt?: string;
      status?: "active" | "submitted";
      submittedAssessmentId?: string | null;
      version?: number;
    };

    if (parsed.version !== smartIntakeDraftVersion) {
      return fallback;
    }

    return {
      fieldStates: parsed.fieldStates ?? fallback.fieldStates,
      form: {
        ...blankAssessmentForm,
        ...parsed.form,
        projectType: requestProjectType[requestType.id],
      },
      id: parsed.id ?? "",
      savedAt: parsed.savedAt ?? "",
      status: parsed.status ?? "active",
      submittedAssessmentId: parsed.submittedAssessmentId ?? null,
    };
  } catch {
    return fallback;
  }
}

function getSmartIntakeDraftSnapshot(draftKey: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(draftKey) ?? "";
}

function getSmartIntakeDraftServerSnapshot() {
  return "";
}

function subscribeSmartIntakeDraft(draftKey: string, onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === draftKey) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
  };
}

export function SmartIntakeForm({ requestType }: { requestType: IntakeRequestType }) {
  const draftKey = `gridready-smart-intake:${requestType.id}`;
  const isHydrated = useSyncExternalStore(
    subscribeHydrationChange,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const draftSnapshot = useSyncExternalStore(
    (onStoreChange) => subscribeSmartIntakeDraft(draftKey, onStoreChange),
    () => getSmartIntakeDraftSnapshot(draftKey),
    getSmartIntakeDraftServerSnapshot,
  );
  const effectiveDraftSnapshot = isHydrated ? draftSnapshot : "";
  const initialDraft = useMemo(() => parseSmartIntakeDraft(effectiveDraftSnapshot, requestType), [effectiveDraftSnapshot, requestType]);
  const formKey = `${requestType.id}:${initialDraft.savedAt || "blank"}`;

  return <SmartIntakeFormContent key={formKey} draftKey={draftKey} initialDraft={initialDraft} requestType={requestType} />;
}

function SmartIntakeFormContent({
  draftKey,
  initialDraft,
  requestType,
}: {
  draftKey: string;
  initialDraft: SmartIntakeDraft;
  requestType: IntakeRequestType;
}) {
  const router = useRouter();
  const { organisationId, reloadAccount, user } = useAuth();
  const [form, setForm] = useState<AssessmentFormState>(initialDraft.form);
  const [fieldStates, setFieldStates] = useState<Partial<Record<keyof AssessmentFormState, IntakeFieldState>>>(initialDraft.fieldStates);
  const [error, setError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [draftFiles, setDraftFiles] = useState<CustomerIntakeFile[]>([]);
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftId, setDraftId] = useState(initialDraft.id);
  const [draftReady, setDraftReady] = useState(!hasSupabaseConfig);
  const [draftStatus, setDraftStatus] = useState<"active" | "submitted">(initialDraft.status);
  const [submittedAssessmentId, setSubmittedAssessmentId] = useState<string | null>(initialDraft.submittedAssessmentId);
  const [savedAt, setSavedAt] = useState(initialDraft.savedAt);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mobileQuestionIndex, setMobileQuestionIndex] = useState(0);
  const [duplicateSuggestions, setDuplicateSuggestions] = useState<DuplicateRequestSuggestion[]>([]);

  const missingItems = useMemo(() => getMissingItems(form, requestType), [form, requestType]);
  const completenessScore = useMemo(() => calculateCompletenessScore(form), [form]);
  const canSubmit = !submitting && (Boolean(submittedAssessmentId) || missingItems.length === 0);
  const mobileFields = useMemo(
    () =>
      requestType.fieldGroups.flatMap((group) =>
        group.fields.map((field) => ({
          field,
          groupDescription: group.description,
          groupTitle: group.title,
        })),
      ),
    [requestType],
  );
  const currentMobileField = mobileFields[Math.min(mobileQuestionIndex, Math.max(0, mobileFields.length - 1))] ?? null;
  const mobileProgress = mobileFields.length === 0 ? 0 : Math.round(((Math.min(mobileQuestionIndex, mobileFields.length - 1) + 1) / mobileFields.length) * 100);
  const smartSuggestions = useMemo(
    () => buildSmartIntakeSuggestions(form, duplicateSuggestions),
    [duplicateSuggestions, form],
  );

  useEffect(() => {
    let cancelled = false;

    async function recoverServerDraft() {
      if (!supabase || !user) {
        return;
      }

      try {
        const recovered = await loadCustomerIntakeDraft(supabase, {
          draftId: initialDraft.id || undefined,
          fallbackForm: initialDraft.form,
          requestType: requestType.id,
          userId: user.id,
        });

        if (cancelled) {
          return;
        }

        if (recovered) {
          setDraftId(recovered.id);
          setDraftStatus(recovered.status === "submitted" ? "submitted" : "active");
          setSubmittedAssessmentId(recovered.submittedAssessmentId);
          if (new Date(recovered.savedAt).getTime() >= new Date(initialDraft.savedAt || 0).getTime()) {
            setForm(recovered.form);
            setFieldStates(recovered.fieldStates);
            setSavedAt(recovered.savedAt);
          }
          setDraftFiles(await listCustomerIntakeFiles(supabase, recovered.id));
        } else {
          setDraftId(initialDraft.id || crypto.randomUUID());
        }
        setDraftError("");
      } catch (recoverError) {
        if (!cancelled) {
          setDraftError(getErrorMessage(recoverError, "Could not recover the server draft."));
        }
      } finally {
        if (!cancelled) {
          setDraftReady(true);
        }
      }
    }

    void recoverServerDraft();
    return () => {
      cancelled = true;
    };
  }, [initialDraft, requestType.id, user]);

  const persistDraft = useCallback(async (showSaving = false) => {
    if (draftStatus !== "active") {
      return null;
    }

    const nextDraftId = draftId || crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const localDraft = {
      fieldStates,
      form,
      id: nextDraftId,
      savedAt: timestamp,
      status: "active" as const,
      submittedAssessmentId: null,
      version: smartIntakeDraftVersion,
    };
    window.localStorage.setItem(draftKey, JSON.stringify(localDraft));
    setDraftId(nextDraftId);

    if (!supabase || !user) {
      setSavedAt(timestamp);
      setDraftDirty(false);
      return { ...localDraft, userId: user?.id ?? "" };
    }

    if (showSaving) {
      setSaving(true);
    }
    try {
      const saved = await saveCustomerIntakeDraft(supabase, {
        draftId: nextDraftId,
        fieldStates,
        form,
        organisationId,
        requestType: requestType.id,
        userId: user.id,
      });
      setSavedAt(saved.savedAt);
      setDraftDirty(false);
      setDraftError("");
      window.localStorage.setItem(draftKey, JSON.stringify({ ...localDraft, savedAt: saved.savedAt }));
      return saved;
    } catch (saveError) {
      setSavedAt(timestamp);
      setDraftError(`${getErrorMessage(saveError, "Server draft save failed.")} A local recovery copy was kept.`);
      return null;
    } finally {
      if (showSaving) {
        setSaving(false);
      }
    }
  }, [draftId, draftKey, draftStatus, fieldStates, form, organisationId, requestType.id, user]);

  useEffect(() => {
    if (!draftReady || !draftDirty || draftStatus !== "active") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistDraft(false);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [draftDirty, draftReady, draftStatus, persistDraft]);

  useEffect(() => {
    let cancelled = false;

    async function loadDuplicateSuggestions() {
      if (!hasSupabaseConfig || !supabase) {
        setDuplicateSuggestions([]);
        return;
      }

      const siteQuery = form.siteName.trim().toLowerCase();
      const addressQuery = form.address.trim().toLowerCase();
      const organisationQuery = form.organisationName.trim().toLowerCase();

      if (siteQuery.length < 3 && addressQuery.length < 5 && organisationQuery.length < 3) {
        setDuplicateSuggestions([]);
        return;
      }

      const { data } = await supabase
        .from("site_assessments")
        .select(`
          id,
          assessment_name,
          status,
          target_load_mw,
          sites (site_name, address, county, state),
          projects (
            name,
            organisations (name)
          )
        `)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (cancelled) {
        return;
      }

      const matches = ((data ?? []) as Array<{
        assessment_name: string;
        id: string;
        projects?: Array<{ organisations?: Array<{ name: string }> | { name: string } | null }> | { organisations?: Array<{ name: string }> | { name: string } | null } | null;
        sites?: Array<{ address: string | null; site_name: string }> | { address: string | null; site_name: string } | null;
      }>)
        .map((assessment) => {
          const site = Array.isArray(assessment.sites) ? assessment.sites[0] : assessment.sites;
          const project = Array.isArray(assessment.projects) ? assessment.projects[0] : assessment.projects;
          const organisation = Array.isArray(project?.organisations) ? project?.organisations[0] : project?.organisations;
          const reasons = [
            siteQuery && site?.site_name?.toLowerCase().includes(siteQuery) ? "similar site name" : "",
            addressQuery && site?.address?.toLowerCase().includes(addressQuery) ? "similar address" : "",
            organisationQuery && organisation?.name?.toLowerCase().includes(organisationQuery) ? "same customer" : "",
          ].filter(Boolean);

          if (reasons.length === 0) {
            return null;
          }

          return {
            id: assessment.id,
            label: assessment.assessment_name,
            reason: reasons.join(", "),
          };
        })
        .filter((item): item is DuplicateRequestSuggestion => Boolean(item))
        .slice(0, 4);

      setDuplicateSuggestions(matches);
    }

    const timeout = window.setTimeout(() => {
      void loadDuplicateSuggestions();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [form.address, form.organisationName, form.siteName]);

  function updateForm<K extends keyof AssessmentFormState>(key: K, value: AssessmentFormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "siteName" && !current.assessmentName.trim()) {
        next.assessmentName = value ? `${value} assessment` : "";
      }

      if (key === "siteName" && !current.projectName.trim()) {
        next.projectName = value || "";
      }

      return next;
    });
    setDraftDirty(true);
    setError("");
  }

  function setFieldState(field: keyof AssessmentFormState, value: IntakeFieldState) {
    setFieldStates((current) => ({ ...current, [field]: value }));
    setDraftDirty(true);
  }

  async function discardDraft() {
    setSaving(true);
    setDraftError("");
    try {
      if (supabase && draftId) {
        if (draftFiles.length > 0) {
          const { error: storageError } = await supabase.storage
            .from("assessment-evidence")
            .remove(draftFiles.map((file) => file.storagePath));
          if (storageError) {
            throw storageError;
          }
        }
        await discardCustomerIntakeDraft(supabase, draftId);
      }

      const blankDraft = createBlankSmartIntakeDraft(requestType);
      window.localStorage.removeItem(draftKey);
      setForm(blankDraft.form);
      setFieldStates(blankDraft.fieldStates);
      setDraftFiles([]);
      setDraftId(crypto.randomUUID());
      setDraftStatus("active");
      setSubmittedAssessmentId(null);
      setSavedAt("");
      setDraftDirty(false);
    } catch (discardError) {
      setDraftError(getErrorMessage(discardError, "Could not discard the draft."));
    } finally {
      setSaving(false);
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length || !supabase || !user) {
      return;
    }

    setDraftError("");
    const saved = await persistDraft(true);
    if (!saved) {
      return;
    }

    for (const file of Array.from(files)) {
      setUploadingFileName(file.name);
      setUploadProgress(0);
      try {
        const uploaded = await uploadCustomerIntakeFile(supabase, {
          draftId: saved.id,
          file,
          userId: user.id,
        }, setUploadProgress);
        setDraftFiles((current) => [...current, uploaded]);
      } catch (uploadError) {
        setDraftError(getErrorMessage(uploadError, `Could not upload ${file.name}.`));
        break;
      }
    }

    setUploadingFileName("");
    setUploadProgress(0);
  }

  async function downloadDraftFile(file: CustomerIntakeFile) {
    if (!supabase) {
      return;
    }
    if (file.malwareScanStatus !== "clean") {
      setDraftError("This file is unavailable until malware scanning reports a clean result.");
      return;
    }
    const { data, error: signedError } = await supabase.storage
      .from("assessment-evidence")
      .createSignedUrl(file.storagePath, 60);
    if (signedError) {
      setDraftError(signedError.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeDraftFile(file: CustomerIntakeFile) {
    if (!supabase) {
      return;
    }
    setDraftError("");
    try {
      await removeCustomerIntakeFile(supabase, file);
      setDraftFiles((current) => current.filter((item) => item.id !== file.id));
    } catch (removeError) {
      setDraftError(getErrorMessage(removeError, "Could not remove the file."));
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittedAssessmentId) {
      if (supabase && user && draftId) {
        setSubmitting(true);
        try {
          await linkCustomerIntakeFiles(supabase, {
            assessmentId: submittedAssessmentId,
            draftId,
          });
          window.localStorage.removeItem(draftKey);
          router.push(`/intake/requests/${submittedAssessmentId}`);
        } catch (linkError) {
          setError(getErrorMessage(linkError, "Could not finish linking the uploaded files."));
        } finally {
          setSubmitting(false);
        }
      } else {
        router.push(`/intake/requests/${submittedAssessmentId}`);
      }
      return;
    }

    if (!hasSupabaseConfig || !supabase) {
      setError("Supabase is not configured. Save this request as a draft until the backend is available.");
      return;
    }
    if (!user) {
      setError("Your authenticated session is not ready. Sign in again before submitting.");
      return;
    }

    if (missingItems.length > 0) {
      setError(`Add ${missingItems.join(", ")} before submitting.`);
      return;
    }

    if (form.contactEmail.trim() && !isValidContactEmail(form.contactEmail)) {
      setError("Enter a valid contact email.");
      return;
    }

    setSubmitting(true);
    setSaving(true);
    setError("");

    const organisationName = form.organisationName.trim();
    const projectName = form.projectName.trim() || form.assessmentName.trim() || form.siteName.trim() || requestType.title;
    const siteName = form.siteName.trim() || form.address.trim() || form.assessmentName.trim() || projectName;
    const assessmentName = form.assessmentName.trim() || `${siteName} assessment`;
    const nextStatus = suggestedIntakeStatus(form);

    try {
      const persistedDraft = await persistDraft(false);
      if (!persistedDraft) {
        throw new Error("The server draft could not be saved. Submission was stopped to prevent a duplicate assessment.");
      }

      const organisation = await ensureCustomerOrganisation(supabase, {
        organisationName,
        organisationType: form.organisationType || "developer",
      });
      await reloadAccount();

      const { data: existingAssessment, error: existingAssessmentError } = await supabase
        .from("site_assessments")
        .select("id")
        .eq("customer_intake_draft_id", persistedDraft.id)
        .maybeSingle();
      if (existingAssessmentError) {
        throw existingAssessmentError;
      }
      if (existingAssessment?.id) {
        await markCustomerIntakeDraftSubmitted(supabase, {
          assessmentId: existingAssessment.id,
          draftId: persistedDraft.id,
          organisationId: organisation.organisationId,
        });
        setDraftStatus("submitted");
        setSubmittedAssessmentId(existingAssessment.id);
        await linkCustomerIntakeFiles(supabase, {
          assessmentId: existingAssessment.id,
          draftId: persistedDraft.id,
        });
        window.localStorage.removeItem(draftKey);
        router.push(`/intake/requests/${existingAssessment.id}`);
        return;
      }

      const contact = await ensureCustomerContact(supabase, {
        email: form.contactEmail,
        name: form.contactName,
        organisationId: organisation.organisationId,
        phone: form.contactPhone,
        roleTitle: form.contactRoleTitle,
      });

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          deadline: form.projectDeadline || null,
          description: [
            form.projectDescription.trim(),
            `Request type: ${requestType.title}`,
            fieldStateSummary(fieldStates),
          ]
            .filter(Boolean)
            .join("\n\n"),
          lead_contact_id: contact.id,
          name: projectName,
          organisation_id: organisation.organisationId,
          project_type: requestProjectType[requestType.id],
          status: "active",
        })
        .select("id")
        .single();

      if (projectError) {
        throw projectError;
      }

      const { data: site, error: siteError } = await supabase
        .from("sites")
        .insert({
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          country: "USA",
          county: form.county.trim() || null,
          latitude: parseOptionalNumber(form.latitude),
          longitude: parseOptionalNumber(form.longitude),
          organisation_id: organisation.organisationId,
          parcel_id: form.parcelId.trim() || null,
          site_name: siteName,
          state: form.state.trim() || "TX",
        })
        .select("id")
        .single();

      if (siteError) {
        throw siteError;
      }

      const assessmentId = crypto.randomUUID();
      const { error: assessmentError } = await supabase
        .from("site_assessments")
        .insert({
          id: assessmentId,
          assessment_name: assessmentName,
          backup_generation_assumptions: form.backupGenerationAssumptions.trim() || null,
          battery_storage_assumptions: form.batteryStorageAssumptions.trim() || null,
          confidentiality_status: form.confidentialityStatus,
          curtailment_willingness: form.curtailmentWillingness || null,
          customer_intake_draft_id: persistedDraft.id,
          desired_energization_date: form.desiredEnergizationDate || null,
          existing_power_quote_summary: form.existingPowerQuoteSummary.trim() || null,
          existing_studies_summary: form.existingStudiesSummary.trim() || null,
          full_buildout_load_mw: parseOptionalNumber(form.fullBuildoutLoadMw),
          initial_load_mw: parseOptionalNumber(form.initialLoadMw),
          intake_completeness_score: completenessScore,
          known_substation_or_poi: form.knownSubstationOrPoi.trim() || null,
          known_tsp: form.knownTsp.trim() || null,
          known_utility: form.knownUtility.trim() || null,
          land_control_status: form.landControlStatus.trim() || null,
          market_region: form.marketRegion.trim() || "ERCOT",
          project_id: project.id,
          project_stage: form.projectStage.trim() || null,
          site_id: site.id,
          status: nextStatus,
          target_load_mw: parseOptionalNumber(form.targetLoadMw),
          water_cooling_notes: form.waterCoolingNotes.trim() || null,
          workload_flexibility_assumptions: form.workloadFlexibilityAssumptions.trim() || null,
        });

      if (assessmentError) {
        throw assessmentError;
      }

      await markCustomerIntakeDraftSubmitted(supabase, {
        assessmentId,
        draftId: persistedDraft.id,
        organisationId: organisation.organisationId,
      });
      setDraftStatus("submitted");
      setSubmittedAssessmentId(assessmentId);

      await linkCustomerIntakeFiles(supabase, {
        assessmentId,
        draftId: persistedDraft.id,
      });

      window.localStorage.removeItem(draftKey);
      router.push(`/intake/requests/${assessmentId}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Could not submit request."));
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitRequest} className="space-y-5">
      <section className={cx(panelClass, "overflow-hidden")}>
        <div className="grid gap-4 border-b border-[var(--color-border)] px-5 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">Smart request</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{requestType.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">{requestType.primaryOutcome}</p>
          </div>
          <aside className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusPill tone={canSubmit ? "success" : "warning"}>{submittedAssessmentId ? "Submitted" : canSubmit ? "Ready to submit" : "Needs minimum inputs"}</StatusPill>
              <StatusPill tone="info">{completenessScore}% complete</StatusPill>
            </div>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{requestType.expectedOutput}</p>
          </aside>
        </div>

        <div className="border-b border-[var(--color-border)] p-5 lg:hidden">
          {currentMobileField ? (
            <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--color-text-secondary)]">
                  <span>Question {Math.min(mobileQuestionIndex, mobileFields.length - 1) + 1} of {mobileFields.length}</span>
                  <span>{mobileProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-md bg-[var(--color-surface-strong)]">
                  <div className="h-full rounded-md bg-[var(--color-brand-primary)]" style={{ width: `${mobileProgress}%` }} />
                </div>
              </div>
              <div className="mb-4 border-b border-[var(--color-border)] pb-3">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{currentMobileField.groupTitle}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{currentMobileField.groupDescription}</p>
              </div>
              <SmartField
                field={currentMobileField.field}
                form={form}
                requestType={requestType}
                state={fieldStates[currentMobileField.field]}
                updateForm={updateForm}
                setFieldState={setFieldState}
              />
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMobileQuestionIndex((current) => Math.max(0, current - 1))}
                  disabled={mobileQuestionIndex === 0}
                  className={secondaryButtonClass}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setMobileQuestionIndex((current) => Math.min(mobileFields.length - 1, current + 1))}
                  disabled={mobileQuestionIndex >= mobileFields.length - 1}
                  className={secondaryButtonClass}
                >
                  Next
                </button>
              </div>
            </section>
          ) : null}

          <div className="mt-4 grid gap-3">
            <MinimumItemsPanel missingItems={missingItems} />
            <SmartAssistancePanel suggestions={smartSuggestions} />
          </div>
        </div>

        <div className="hidden gap-5 p-5 lg:grid xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {requestType.fieldGroups.map((group) => (
              <section key={group.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="mb-4 border-b border-[var(--color-border)] pb-3">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{group.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{group.description}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <SmartField
                      key={field}
                      field={field}
                      form={form}
                      requestType={requestType}
                      state={fieldStates[field]}
                      updateForm={updateForm}
                      setFieldState={setFieldState}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-3 xl:sticky xl:top-24 xl:self-start">
            <MinimumItemsPanel missingItems={missingItems} />
            <SmartAssistancePanel suggestions={smartSuggestions} />

            <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Draft state</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                {savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : "Not saved yet."}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Changes autosave to the server, with a local recovery copy.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void persistDraft(true)} className={secondaryButtonClass}>
                  <Save size={16} />
                  Save now
                </button>
                <button type="button" onClick={() => void discardDraft()} className={secondaryButtonClass}>
                  <Trash2 size={16} />
                  Discard
                </button>
              </div>
            </section>
          </aside>
        </div>

        <section className="mx-5 mb-5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">Supporting files</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">Private files up to 50 MB. PDF, DOCX, XLSX, CSV, KML/KMZ, ZIP, GeoJSON and common images are accepted.</p>
            </div>
            <label className={`${secondaryButtonClass} cursor-pointer`}>
              <Upload size={16} />
              Add files
              <input
                accept={customerEvidenceAccept}
                className="sr-only"
                disabled={Boolean(uploadingFileName) || draftStatus !== "active"}
                multiple
                type="file"
                onChange={(event) => {
                  void addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {uploadingFileName ? (
            <div className="mt-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-[var(--color-text-primary)]">Uploading {uploadingFileName}</span>
                <span className="text-[var(--color-text-secondary)]">{uploadProgress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-surface-strong)]">
                <div className="h-full rounded-full bg-[var(--color-brand-primary)]" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : null}

          {draftFiles.length > 0 ? (
            <div className="mt-4 space-y-2">
              {draftFiles.map((file) => (
                <article key={file.id} className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{file.originalFilename}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{formatFileSize(file.sizeBytes)} · Processing: {file.processingStatus} · Malware scan: {file.malwareScanStatus}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" className={secondaryButtonClass} disabled={file.malwareScanStatus !== "clean"} onClick={() => void downloadDraftFile(file)}>
                      <Download size={15} />
                      {file.malwareScanStatus === "clean" ? "Open" : "Scanning"}
                    </button>
                    {draftStatus === "active" ? (
                      <button type="button" className={secondaryButtonClass} onClick={() => void removeDraftFile(file)}>
                        <Trash2 size={15} />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">No supporting files attached.</p>
          )}
        </section>

        {submittedAssessmentId ? (
          <div className="mx-5 mb-5 rounded-md border border-[var(--color-success)] bg-[var(--color-success-soft)] px-4 py-3 text-sm font-medium text-[var(--color-success)]">
            This draft has already created an assessment. Continue to the request instead of submitting it again.
          </div>
        ) : null}

        {draftError ? (
          <div className="mx-5 mb-5 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm font-medium text-[var(--color-warning)]">
            {draftError}
          </div>
        ) : null}

        {error ? (
          <div className="mx-5 mb-5 rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
            {error}
          </div>
        ) : null}

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <Link href="/intake/requests/new" className={secondaryButtonClass}>
            Back to catalog
          </Link>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button type="button" onClick={() => void persistDraft(true)} disabled={saving || draftStatus !== "active"} className={secondaryButtonClass}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save now
            </button>
            <button type="submit" disabled={!canSubmit} className={primaryButtonClass}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              {submittedAssessmentId ? "Open request" : "Submit request"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}

function MinimumItemsPanel({ missingItems }: { missingItems: string[] }) {
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
      <div className="mb-3 flex items-center gap-2 text-[var(--color-brand-primary)]">
        <Sparkles size={16} />
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Minimum to submit</h3>
      </div>
      {missingItems.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {missingItems.map((item) => (
            <li key={item} className="flex items-center gap-2 text-[var(--color-warning)]">
              <AlertCircle size={15} />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-md border border-[var(--color-success)] bg-[var(--color-success-soft)] px-3 py-2 text-sm font-medium text-[var(--color-success)]">
          <CheckCircle2 size={15} />
          This request has enough information to submit.
        </p>
      )}
    </section>
  );
}

function SmartAssistancePanel({ suggestions }: { suggestions: SmartIntakeSuggestion[] }) {
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
      <div className="mb-3 flex items-center gap-2 text-[var(--color-brand-primary)]">
        <Sparkles size={16} />
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">Smart assistance</h3>
      </div>
      <div className="space-y-2">
        {suggestions.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-sm text-[var(--color-text-secondary)]">
            Add site, address, customer, load, or timing to unlock proactive checks.
          </p>
        ) : (
          suggestions.map((suggestion) => (
            <div key={suggestion.label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={suggestion.tone}>{suggestion.label}</StatusPill>
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{suggestion.confidence} confidence</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{suggestion.body}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SmartField({
  field,
  form,
  requestType,
  setFieldState,
  state,
  updateForm,
}: {
  field: keyof AssessmentFormState;
  form: AssessmentFormState;
  requestType: IntakeRequestType;
  setFieldState: (field: keyof AssessmentFormState, value: IntakeFieldState) => void;
  state?: IntakeFieldState;
  updateForm: <K extends keyof AssessmentFormState>(key: K, value: AssessmentFormState[K]) => void;
}) {
  const config = fieldConfig[field] ?? { label: field };
  const required = requestType.requiredFields.includes(field);
  const badge = state && state !== "provided" ? fieldStateOptions.find((option) => option.value === state)?.label : undefined;

  return (
    <div className={cx(config.type === "textarea" && "sm:col-span-2")}>
      {field === "address" ? (
        <AddressAutocompleteField
          id="address"
          label="Address"
          value={form.address}
          badge={badge}
          helpText={config.helpText}
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
      ) : (
        <FieldControl badge={badge} helpText={config.helpText} label={config.label} required={required}>
          {config.type === "textarea" ? (
            <textarea
              value={form[field]}
              onChange={(event) => updateForm(field, event.target.value)}
              rows={3}
              className={textareaClass}
            />
          ) : config.type === "select" ? (
            <select value={form[field]} onChange={(event) => updateForm(field, event.target.value)} className={inputClass}>
              {(config.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={form[field]}
              type={config.inputType ?? "text"}
              inputMode={config.inputMode}
              onChange={(event) => updateForm(field, event.target.value)}
              className={inputClass}
            />
          )}
        </FieldControl>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {fieldStateOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFieldState(field, option.value)}
            className={cx(
              "rounded-md border px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]",
              state === option.value
                ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function buildSmartIntakeSuggestions(
  form: AssessmentFormState,
  duplicateSuggestions: DuplicateRequestSuggestion[],
): SmartIntakeSuggestion[] {
  const suggestions: Array<SmartIntakeSuggestion | null> = [
    duplicateSuggestions.length > 0
      ? {
          body: `${duplicateSuggestions.length} possible duplicate${duplicateSuggestions.length === 1 ? "" : "s"} found: ${duplicateSuggestions.map((duplicate) => `${duplicate.label} (${duplicate.reason})`).join("; ")}.`,
          confidence: "High",
          label: "Duplicate check",
          tone: "warning",
        }
      : null,
    form.state.trim().toUpperCase() === "TX" && form.marketRegion.trim().toUpperCase() !== "ERCOT"
      ? {
          body: "Texas site context usually maps to ERCOT unless the address is outside ERCOT territory. Consider ERCOT as the market region.",
          confidence: "Medium",
          label: "Market inference",
          tone: "info",
        }
      : null,
    !form.knownUtility.trim() && (form.address.trim() || form.county.trim())
      ? {
          body: "Utility can likely be inferred after address lookup or service-territory evidence. Mark this as to-confirm if the requester does not know it.",
          confidence: "Medium",
          label: "Utility suggestion",
          tone: "info",
        }
      : null,
    !form.knownTsp.trim() && (form.marketRegion.trim() || form.state.trim())
      ? {
          body: "TSP can be suggested from market/state context and nearby grid assets once GIS evidence is attached.",
          confidence: form.marketRegion.trim().toUpperCase() === "ERCOT" ? "Medium" : "Low",
          label: "TSP suggestion",
          tone: "info",
        }
      : null,
    Number(form.targetLoadMw) >= 75
      ? {
          body: "Large-load request will likely require expert review, stronger reliability assumptions, and clearer energization staging.",
          confidence: "High",
          label: "Expert review trigger",
          tone: "warning",
        }
      : null,
    form.address.trim() && !form.latitude.trim() && !form.longitude.trim()
      ? {
          body: "Address is present but coordinates are not. Use lookup so the grid and evidence workbenches can reason over proximity.",
          confidence: "High",
          label: "Location inference",
          tone: "success",
        }
      : null,
    form.existingStudiesSummary.trim() || form.existingPowerQuoteSummary.trim()
      ? {
          body: "Evidence context is already present. Submit can proceed with source details marked as provided in attachment if files are not entered yet.",
          confidence: "Medium",
          label: "Evidence shortcut",
          tone: "success",
        }
      : null,
  ];

  return suggestions.filter((suggestion): suggestion is SmartIntakeSuggestion => Boolean(suggestion));
}

const fieldConfig: Partial<Record<keyof AssessmentFormState, {
  helpText?: string;
  inputMode?: "decimal" | "numeric";
  inputType?: string;
  label: string;
  options?: Array<{ label: string; value: string }>;
  type?: "input" | "select" | "textarea";
}>> = {
  address: { helpText: "Use lookup when possible so coordinates can be inferred.", label: "Address" },
  assessmentName: { helpText: "Use this when updating or referencing an existing assessment.", label: "Assessment name" },
  confidentialityStatus: {
    label: "Confidentiality",
    options: [
      { value: "confidential", label: "Confidential" },
      { value: "nda_required", label: "NDA required" },
      { value: "public", label: "Public" },
      { value: "internal_only", label: "Internal only" },
    ],
    type: "select",
  },
  contactEmail: { inputType: "email", label: "Contact email" },
  desiredEnergizationDate: { inputType: "date", label: "Desired energization" },
  existingPowerQuoteSummary: { label: "Existing power quote", type: "textarea" },
  existingStudiesSummary: { label: "Existing studies / evidence summary", type: "textarea" },
  knownTsp: { label: "Known TSP" },
  knownUtility: { label: "Known utility" },
  organisationName: { label: "Customer / sponsor" },
  projectDeadline: { inputType: "date", label: "Decision deadline" },
  projectDescription: { label: "Request description", type: "textarea" },
  projectName: { label: "Project / request name" },
  siteName: { label: "Site name" },
  targetLoadMw: { inputMode: "decimal", label: "Target load MW" },
};

function getMissingItems(form: AssessmentFormState, requestType: IntakeRequestType) {
  const missing = new Set<string>();

  for (const field of requestType.requiredFields) {
    if (!String(form[field] ?? "").trim()) {
      missing.add(fieldConfig[field]?.label ?? String(field));
    }
  }

  if (requestType.id === "single-site-screen") {
    if (!form.siteName.trim() && !form.address.trim()) {
      missing.add("Site name or address");
    }
  }

  return Array.from(missing);
}

function fieldStateSummary(fieldStates: Partial<Record<keyof AssessmentFormState, IntakeFieldState>>) {
  const entries = Object.entries(fieldStates).filter(([, state]) => state && state !== "provided");

  if (entries.length === 0) {
    return "";
  }

  return `Field states:\n${entries.map(([field, state]) => `- ${field}: ${state}`).join("\n")}`;
}
