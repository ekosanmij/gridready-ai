"use client";

import { AlertCircle, ArrowLeft, Loader2, Printer } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AssessmentFindingRecord,
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
  scoreModules,
  verdictLabel,
} from "@/lib/scorecard";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  AssessmentReportExportRecord,
  AssessmentReportSectionRecord,
  ReportTemplateRecord,
  ReportTemplateSectionRecord,
  defaultLimitationsText,
  reportExportStatusLabel,
  reportSectionStatusLabel,
} from "@/lib/report-builder";
import { StatusPill, primaryButtonClass, secondaryButtonClass } from "@/components/ui-primitives";

type OrganisationRecord = {
  id: string;
  name: string;
  organisation_type: string | null;
};

type ProjectRecord = {
  id: string;
  name: string;
  project_type: string | null;
  organisations?: OrganisationRecord | OrganisationRecord[] | null;
};

type SiteRecord = {
  address: string | null;
  city: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  parcel_id: string | null;
  site_name: string;
  state: string | null;
};

type PreviewAssessmentRecord = {
  assessment_name: string;
  desired_energization_date: string | null;
  full_buildout_load_mw: number | null;
  id: string;
  initial_load_mw: number | null;
  market_region: string;
  projects?: ProjectRecord | ProjectRecord[] | null;
  sites?: SiteRecord | SiteRecord[] | null;
  status: string;
  target_load_mw: number | null;
};

type ChecklistPreviewSummary = {
  answeredItems: number;
  blockedItems: number;
  riskItems: number;
  totalItems: number;
};

type PreviewState = {
  assessment: PreviewAssessmentRecord;
  checklist: ChecklistPreviewSummary | null;
  evidenceLinks: FindingEvidenceLinkRecord[];
  evidenceSources: EvidenceSourceRecord[];
  expertReview: ExpertReviewRecord | null;
  exportRecord: AssessmentReportExportRecord | null;
  findings: AssessmentFindingRecord[];
  gridAssets: GridAssetRecord[];
  reportSections: AssessmentReportSectionRecord[];
  scores: AssessmentScoreRecord[];
  template: ReportTemplateRecord | null;
  templateSections: ReportTemplateSectionRecord[];
  verdict: AssessmentVerdictRecord | null;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function ReportPreview({ assessmentId }: { assessmentId: string }) {
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState("");
  const [state, setState] = useState<PreviewState | null>(null);

  const scoreSummary = useMemo(
    () => calculateScorecardSummary(state?.scores ?? []),
    [state?.scores],
  );

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      return;
    }

    let isActive = true;

    async function loadPreview() {
      setLoading(true);
      setError("");

      try {
        const previewState = await fetchReportPreviewState(assessmentId);

        if (isActive) {
          setState(previewState);
        }
      } catch (previewError) {
        if (isActive) {
          setError(previewError instanceof Error ? previewError.message : "Could not load report preview.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isActive = false;
    };
  }, [assessmentId]);

  if (!hasSupabaseConfig) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
          Supabase configuration is required to load report previews.
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] text-slate-700">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Loader2 className="animate-spin" size={18} />
          Loading report preview
        </div>
      </main>
    );
  }

  if (error || !state) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-6 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-lg border border-rose-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3 text-rose-800">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p>{error || "Report preview could not be loaded."}</p>
          </div>
          <Link href="/intake" className="mt-4 inline-flex text-sm font-semibold text-[var(--color-brand-primary)]">
            Back to intake
          </Link>
        </div>
      </main>
    );
  }

  const site = single(state.assessment.sites);
  const project = single(state.assessment.projects);
  const organisation = single(project?.organisations);
  const sectionsByTemplateId = new Map(state.reportSections.map((section) => [section.template_section_id, section]));
  const scoresByModule = new Map(state.scores.map((score) => [score.module_key, score]));

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-slate-950 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl print:max-w-none">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/intake"
            className={secondaryButtonClass}
          >
            <ArrowLeft size={16} />
            Back to intake
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className={primaryButtonClass}
          >
            <Printer size={16} />
            Print
          </button>
        </div>

        <article className="bg-white p-8 shadow-sm print:p-8 print:shadow-none">
          <header className="border-b border-slate-200 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-primary)]">GridReady AI draft package</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{state.assessment.assessment_name}</h1>
            <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <MetaLine label="Customer" value={organisation?.name ?? "Evidence pending"} />
              <MetaLine label="Project" value={project?.name ?? "Evidence pending"} />
              <MetaLine label="Site" value={site?.site_name ?? "Evidence pending"} />
              <MetaLine label="Location" value={formatLocation(site)} />
              <MetaLine label="Market" value={state.assessment.market_region || "Evidence pending"} />
              <MetaLine label="Target load" value={formatMw(state.assessment.target_load_mw)} />
              <MetaLine label="Status" value={state.assessment.status.replaceAll("_", " ")} />
              <MetaLine
                label="Report package"
                value={reportExportStatusLabel(state.exportRecord?.status ?? "not_started")}
              />
            </div>
          </header>

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <PreviewBlock title="Verdict">
              <p>{state.verdict ? verdictLabel(state.verdict.verdict) : "Evidence pending"}</p>
              <p className="mt-2 text-slate-600">{state.verdict?.summary ?? "Evidence pending"}</p>
              <p className="mt-2 text-slate-600">Confidence: {state.verdict?.confidence_level ?? "Evidence pending"}</p>
              {state.verdict?.conditions ? <p className="mt-2 text-slate-600">Conditions: {state.verdict.conditions}</p> : null}
            </PreviewBlock>
            <PreviewBlock title="Scorecard">
              <p>{scoreSummary.completionPercent}% complete</p>
              <p className="mt-2 text-slate-600">
                Weighted readiness: {scoreSummary.averageScore === null ? "Evidence pending" : `${scoreSummary.averageScore}/100`}
              </p>
              <p className="text-slate-600">
                Lowest: {scoreSummary.lowestScore ? `${scoreSummary.lowestScore.label} (${scoreSummary.lowestScore.score})` : "Evidence pending"}
              </p>
            </PreviewBlock>
            <PreviewBlock title="Checklist">
              {state.checklist ? (
                <>
                  <p>
                    {state.checklist.answeredItems}/{state.checklist.totalItems} answered
                  </p>
                  <p className="mt-2 text-slate-600">
                    {state.checklist.riskItems} risk item(s), {state.checklist.blockedItems} blocked item(s)
                  </p>
                </>
              ) : (
                <p>Evidence pending</p>
              )}
            </PreviewBlock>
          </section>

          <ReportSection title="Saved Report Sections">
            <div className="space-y-6">
              {state.templateSections.map((templateSection) => {
                const savedSection = sectionsByTemplateId.get(templateSection.id);

                return (
                  <section key={templateSection.id} className="break-inside-avoid border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{templateSection.title}</h3>
                      {savedSection ? (
                        <span className="rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {reportSectionStatusLabel(savedSection.status)}
                        </span>
                      ) : null}
                      {savedSection?.is_edited ? (
                        <StatusPill tone="info" className="py-0.5">Edited</StatusPill>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                      {savedSection?.content || "Evidence pending"}
                    </p>
                  </section>
                );
              })}
            </div>
          </ReportSection>

          <ReportSection title="Scorecard Detail">
            <div className="grid gap-3 md:grid-cols-2">
              {scoreModules.map((module) => {
                const score = scoresByModule.get(module.value);

                return (
                  <div key={module.value} className="break-inside-avoid rounded-lg border border-slate-200 p-3">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{module.label}</h3>
                    <p className="mt-1 text-sm text-slate-700">{score ? `${score.score}/100` : "Evidence pending"}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      Risk: {score ? riskLevelLabel(score.risk_level) : "Evidence pending"}; confidence:{" "}
                      {score ? evidenceConfidenceLabel(score.confidence_level) : "Evidence pending"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {score?.rationale || "Evidence pending"}
                    </p>
                  </div>
                );
              })}
            </div>
          </ReportSection>

          <ReportSection title="Findings">
            {state.findings.length === 0 ? (
              <p className="text-sm text-slate-700">Evidence pending</p>
            ) : (
              <div className="space-y-3">
                {state.findings.map((finding) => {
                  const linkedSources = evidenceForFinding(finding.id, state.evidenceSources, state.evidenceLinks);

                  return (
                    <div key={finding.id} className="break-inside-avoid rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{finding.title}</h3>
                        <span className="rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {findingModuleLabel(finding.module_key)}
                        </span>
                        <span className="rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {riskLevelLabel(finding.risk_level)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {finding.statement || "Evidence pending"}
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        Evidence: {linkedSources.length > 0 ? linkedSources.map((source) => source.title).join(", ") : "Evidence pending"}
                      </p>
                      {finding.recommendation ? (
                        <p className="mt-2 text-sm leading-6 text-slate-700">Recommendation: {finding.recommendation}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </ReportSection>

          <ReportSection title="Grid Assets and POIs">
            {state.gridAssets.length === 0 ? (
              <p className="text-sm text-slate-700">Evidence pending</p>
            ) : (
              <div className="space-y-2">
                {state.gridAssets.map((asset) => (
                  <p key={asset.id} className="text-sm leading-6 text-slate-700">
                    <strong>{asset.asset_name}</strong>: {gridAssetTypeLabel(asset.asset_type)},{" "}
                    {formatDistanceMiles(asset.distance_miles)}, voltage {asset.voltage_kv ?? "Evidence pending"} kV,
                    owner/operator {asset.owner_operator || "Evidence pending"}, source {asset.source || "Evidence pending"}.
                  </p>
                ))}
              </div>
            )}
          </ReportSection>

          <ReportSection title="Evidence Appendix">
            {state.evidenceSources.length === 0 ? (
              <p className="text-sm text-slate-700">Evidence pending</p>
            ) : (
              <div className="space-y-2">
                {state.evidenceSources.map((source) => (
                  <p key={source.id} className="break-inside-avoid text-sm leading-6 text-slate-700">
                    <strong>{source.title}</strong>: {evidenceSourceTypeLabel(source.source_type)}, confidence{" "}
                    {evidenceConfidenceLabel(source.confidence_level)}, publisher {source.publisher || "Evidence pending"},
                    accessed {source.accessed_at || "Evidence pending"}. {source.url || source.file_reference || "Evidence pending"}
                  </p>
                ))}
              </div>
            )}
          </ReportSection>

          <ReportSection title="Expert Review and Limitations">
            <p className="text-sm leading-6 text-slate-700">
              Expert review: {state.expertReview ? reviewStatusLabel(state.expertReview.status) : "Evidence pending"}.
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {state.verdict?.limitations_note || defaultLimitationsText}
            </p>
          </ReportSection>
        </article>
      </div>
    </main>
  );
}

async function fetchReportPreviewState(assessmentId: string): Promise<PreviewState> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { data: assessmentData, error: assessmentError } = await supabase
    .from("site_assessments")
    .select(
      `
      id,
      assessment_name,
      market_region,
      status,
      target_load_mw,
      initial_load_mw,
      full_buildout_load_mw,
      desired_energization_date,
      sites (
        site_name,
        address,
        city,
        county,
        state,
        latitude,
        longitude,
        parcel_id
      ),
      projects (
        id,
        name,
        project_type,
        organisations (
          id,
          name,
          organisation_type
        )
      )
    `,
    )
    .eq("id", assessmentId)
    .single();

  if (assessmentError) {
    throw assessmentError;
  }

  const assessment = assessmentData as PreviewAssessmentRecord;
  const template = await loadReportTemplate(assessment.market_region);
  const templateSections = template ? await loadTemplateSections(template.id) : [];
  const checklist = await loadChecklistSummary(assessment.id, assessment.market_region);

  const [
    { data: reportSectionData, error: reportSectionError },
    { data: exportData, error: exportError },
    { data: scoreData, error: scoreError },
    { data: verdictData, error: verdictError },
    { data: reviewData, error: reviewError },
    { data: findingData, error: findingError },
    { data: evidenceData, error: evidenceError },
    { data: gridAssetData, error: gridAssetError },
  ] = await Promise.all([
    supabase
      .from("assessment_report_sections")
      .select("id, site_assessment_id, template_section_id, section_key, title, content, status, is_edited, generated_at, generation_notes, updated_at")
      .eq("site_assessment_id", assessment.id),
    template
      ? supabase
          .from("assessment_report_exports")
          .select("id, site_assessment_id, template_id, export_type, status, notes, ready_for_review_at, version_number, finalized_at, finalization_snapshot, updated_at")
          .eq("site_assessment_id", assessment.id)
          .eq("template_id", template.id)
          .eq("export_type", "print_preview")
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("assessment_scores")
      .select("id, site_assessment_id, module_key, score, risk_level, confidence_level, rationale, override_note, calculation_origin, is_derived, methodology_version_id, weight, weighted_contribution, created_at, updated_at")
      .eq("site_assessment_id", assessment.id),
    supabase
      .from("assessment_verdicts")
      .select("id, site_assessment_id, verdict, confidence_level, conditions, summary, key_strengths, key_risks, recommended_next_steps, limitations_note, approved_by_analyst, approved_at, authored_by, methodology_version_id, current_event_id, created_at, updated_at")
      .eq("site_assessment_id", assessment.id)
      .maybeSingle(),
    supabase
      .from("expert_reviews")
      .select("id, site_assessment_id, review_type, reviewer_name, reviewer_id, status, trigger_reason, comments, required_changes, approved_at, assigned_at, submitted_at, decision_at, decision_reason, report_export_id, report_export_version, created_at, updated_at")
      .eq("site_assessment_id", assessment.id)
      .eq("review_type", "final_report")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("assessment_findings")
      .select("id, site_assessment_id, module_key, title, finding_type, risk_level, confidence_level, statement, assumption_note, recommendation, status, support_status, created_at, updated_at")
      .eq("site_assessment_id", assessment.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("evidence_sources")
      .select("id, site_assessment_id, title, source_type, publisher, url, file_reference, accessed_at, published_at, confidence_level, license_notes, limitation_notes, notes, authored_by, metadata_version, summary, created_at, updated_at")
      .eq("site_assessment_id", assessment.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("assessment_grid_assets")
      .select("id, site_assessment_id, site_id, asset_name, asset_type, latitude, longitude, voltage_kv, owner_operator, source, confidence_level, is_candidate_poi, rationale, analyst_notes, distance_miles, created_at, updated_at")
      .eq("site_assessment_id", assessment.id)
      .order("distance_miles", { ascending: true }),
  ]);

  if (
    reportSectionError ||
    exportError ||
    scoreError ||
    verdictError ||
    reviewError ||
    findingError ||
    evidenceError ||
    gridAssetError
  ) {
    throw (
      reportSectionError ??
      exportError ??
      scoreError ??
      verdictError ??
      reviewError ??
      findingError ??
      evidenceError ??
      gridAssetError
    );
  }

  const findings = (findingData ?? []) as AssessmentFindingRecord[];
  const findingIds = findings.map((finding) => finding.id);
  let evidenceLinks: FindingEvidenceLinkRecord[] = [];

  if (findingIds.length > 0) {
    const { data: linkData, error: linkError } = await supabase
      .from("finding_evidence_links")
      .select("id, finding_id, evidence_source_id, relationship, link_note, linked_by, created_at")
      .in("finding_id", findingIds);

    if (linkError) {
      throw linkError;
    }

    evidenceLinks = (linkData ?? []) as FindingEvidenceLinkRecord[];
  }

  return {
    assessment,
    checklist,
    evidenceLinks,
    evidenceSources: (evidenceData ?? []) as EvidenceSourceRecord[],
    expertReview: (reviewData as ExpertReviewRecord | null) ?? null,
    exportRecord: (exportData as AssessmentReportExportRecord | null) ?? null,
    findings,
    gridAssets: (gridAssetData ?? []) as GridAssetRecord[],
    reportSections: (reportSectionData ?? []) as AssessmentReportSectionRecord[],
    scores: (scoreData ?? []) as AssessmentScoreRecord[],
    template,
    templateSections,
    verdict: (verdictData as AssessmentVerdictRecord | null) ?? null,
  };
}

async function loadReportTemplate(marketRegion: string) {
  if (!supabase) {
    return null;
  }

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

  if (marketTemplateData) {
    return marketTemplateData as ReportTemplateRecord;
  }

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

  return (fallbackTemplateData as ReportTemplateRecord | null) ?? null;
}

async function loadTemplateSections(templateId: string) {
  if (!supabase) {
    return [];
  }

  const { data, error: sectionError } = await supabase
    .from("report_template_sections")
    .select("id, template_id, section_key, title, sort_order, is_required, default_guidance")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });

  if (sectionError) {
    throw sectionError;
  }

  return (data ?? []) as ReportTemplateSectionRecord[];
}

async function loadChecklistSummary(
  assessmentIdValue: string,
  marketRegion: string,
): Promise<ChecklistPreviewSummary | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data: templateData, error: templateError } = await supabase
      .from("checklist_templates")
      .select("id")
      .eq("is_active", true)
      .eq("market_region", marketRegion || "ERCOT")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (templateError) {
      throw templateError;
    }

    let templateId = (templateData as { id: string } | null)?.id ?? null;

    if (!templateId && marketRegion !== "ERCOT") {
      const { data: fallbackTemplateData, error: fallbackTemplateError } = await supabase
        .from("checklist_templates")
        .select("id")
        .eq("is_active", true)
        .eq("market_region", "ERCOT")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackTemplateError) {
        throw fallbackTemplateError;
      }

      templateId = (fallbackTemplateData as { id: string } | null)?.id ?? null;
    }

    if (!templateId) {
      return null;
    }

    const { data: itemData, error: itemError } = await supabase
      .from("checklist_template_items")
      .select("id")
      .eq("template_id", templateId);

    if (itemError) {
      throw itemError;
    }

    const itemIds = ((itemData ?? []) as Array<{ id: string }>).map((item) => item.id);

    if (itemIds.length === 0) {
      return { answeredItems: 0, blockedItems: 0, riskItems: 0, totalItems: 0 };
    }

    const { data: responseData, error: responseError } = await supabase
      .from("assessment_checklist_responses")
      .select("template_item_id, status")
      .eq("site_assessment_id", assessmentIdValue)
      .in("template_item_id", itemIds);

    if (responseError) {
      throw responseError;
    }

    const responses = (responseData ?? []) as Array<{ status: string; template_item_id: string }>;

    return {
      answeredItems: responses.filter((response) => response.status !== "not_started").length,
      blockedItems: responses.filter((response) => response.status === "blocked").length,
      riskItems: responses.filter((response) => response.status === "risk").length,
      totalItems: itemIds.length,
    };
  } catch {
    return null;
  }
}

function PreviewBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="break-inside-avoid rounded-lg border border-slate-200 p-3">
      <h2 className="text-xs font-semibold uppercase text-[var(--color-brand-primary)]">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-slate-800">{children}</div>
    </div>
  );
}

function ReportSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="mb-3 border-b border-slate-200 pb-2 text-xl font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {children}
    </section>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold text-slate-950">{label}:</span> {value}
    </p>
  );
}

function formatLocation(site: SiteRecord | null) {
  if (!site) {
    return "Evidence pending";
  }

  const parts = [site.address, site.city, site.county, site.state].filter(Boolean);
  const coordinates =
    typeof site.latitude === "number" && typeof site.longitude === "number"
      ? `${site.latitude}, ${site.longitude}`
      : null;
  const location = [parts.join(", "), coordinates ? `Coordinates: ${coordinates}` : null, site.parcel_id ? `Parcel: ${site.parcel_id}` : null]
    .filter(Boolean)
    .join("; ");

  return location || "Evidence pending";
}

function formatMw(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value} MW` : "Evidence pending";
}
