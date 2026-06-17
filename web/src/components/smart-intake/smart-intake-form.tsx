"use client";

import { AlertCircle, CheckCircle2, Loader2, Save, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import { AddressAutocompleteField } from "@/components/address-autocomplete-field";
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
import {
  IntakeFieldState,
  IntakeRequestType,
} from "@/lib/intake-request-types";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

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
  savedAt: string;
};

function createBlankSmartIntakeDraft(requestType: IntakeRequestType): SmartIntakeDraft {
  return {
    fieldStates: {} as Partial<Record<keyof AssessmentFormState, IntakeFieldState>>,
    form: {
      ...blankAssessmentForm,
      projectType: requestProjectType[requestType.id],
    },
    savedAt: "",
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
      savedAt?: string;
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
      savedAt: parsed.savedAt ?? "",
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
  const draftSnapshot = useSyncExternalStore(
    (onStoreChange) => subscribeSmartIntakeDraft(draftKey, onStoreChange),
    () => getSmartIntakeDraftSnapshot(draftKey),
    getSmartIntakeDraftServerSnapshot,
  );
  const initialDraft = useMemo(() => parseSmartIntakeDraft(draftSnapshot, requestType), [draftSnapshot, requestType]);
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
  const [form, setForm] = useState<AssessmentFormState>(initialDraft.form);
  const [fieldStates, setFieldStates] = useState<Partial<Record<keyof AssessmentFormState, IntakeFieldState>>>(initialDraft.fieldStates);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(initialDraft.savedAt);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const missingItems = useMemo(() => getMissingItems(form, requestType), [form, requestType]);
  const completenessScore = useMemo(() => calculateCompletenessScore(form), [form]);
  const canSubmit = missingItems.length === 0 && !submitting;

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
    setError("");
  }

  function setFieldState(field: keyof AssessmentFormState, value: IntakeFieldState) {
    setFieldStates((current) => ({ ...current, [field]: value }));
  }

  function saveDraft() {
    const timestamp = new Date().toISOString();
    window.localStorage.setItem(draftKey, JSON.stringify({ fieldStates, form, savedAt: timestamp, version: smartIntakeDraftVersion }));
    setSavedAt(timestamp);
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseConfig || !supabase) {
      setError("Supabase is not configured. Save this request as a draft until the backend is available.");
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

    const now = new Date().toISOString();
    const organisationName = form.organisationName.trim();
    const projectName = form.projectName.trim() || form.assessmentName.trim() || form.siteName.trim() || requestType.title;
    const siteName = form.siteName.trim() || form.address.trim() || form.assessmentName.trim() || projectName;
    const assessmentName = form.assessmentName.trim() || `${siteName} assessment`;
    const nextStatus = requestType.id === "single-site-screen" ? suggestedIntakeStatus(form) : requestType.defaultStatus;

    try {
      const { data: organisation, error: organisationError } = await supabase
        .from("organisations")
        .insert({
          name: organisationName,
          organisation_type: form.organisationType || "developer",
        })
        .select("id")
        .single();

      if (organisationError) {
        throw organisationError;
      }

      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          email: form.contactEmail.trim() || null,
          is_primary: true,
          name: form.contactName.trim() || form.contactEmail.trim(),
          organisation_id: organisation.id,
          phone: form.contactPhone.trim() || null,
          role_title: form.contactRoleTitle.trim() || null,
        })
        .select("id")
        .single();

      if (contactError) {
        throw contactError;
      }

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
          organisation_id: organisation.id,
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
          parcel_id: form.parcelId.trim() || null,
          site_name: siteName,
          state: form.state.trim() || "TX",
        })
        .select("id")
        .single();

      if (siteError) {
        throw siteError;
      }

      const { data: assessment, error: assessmentError } = await supabase
        .from("site_assessments")
        .insert({
          assessment_name: assessmentName,
          backup_generation_assumptions: form.backupGenerationAssumptions.trim() || null,
          battery_storage_assumptions: form.batteryStorageAssumptions.trim() || null,
          confidentiality_status: form.confidentialityStatus,
          curtailment_willingness: form.curtailmentWillingness || null,
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
        })
        .select("id")
        .single();

      if (assessmentError) {
        throw assessmentError;
      }

      await supabase.from("status_history").insert({
        from_status: null,
        reason: `Assessment created from ${requestType.title}`,
        site_assessment_id: assessment.id,
        to_status: nextStatus,
      });

      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ fieldStates, form, savedAt: now, submittedAt: now, version: smartIntakeDraftVersion }),
      );
      router.push(`/intake/requests/${assessment.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit request.");
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
              <StatusPill tone={canSubmit ? "success" : "warning"}>{canSubmit ? "Ready to submit" : "Needs minimum inputs"}</StatusPill>
              <StatusPill tone="info">{completenessScore}% complete</StatusPill>
            </div>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{requestType.expectedOutput}</p>
          </aside>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
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

            <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Draft state</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                {savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : "No local draft saved yet."}
              </p>
              <button type="button" onClick={saveDraft} className={secondaryButtonClass}>
                <Save size={16} />
                Save draft
              </button>
            </section>
          </aside>
        </div>

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
            <button type="button" onClick={saveDraft} disabled={saving} className={secondaryButtonClass}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save draft
            </button>
            <button type="submit" disabled={!canSubmit} className={primaryButtonClass}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              Submit request
            </button>
          </div>
        </div>
      </section>
    </form>
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
