"use client";

import {
  Activity,
  AlertCircle,
  BarChart3,
  ClipboardList,
  FileText,
  Gauge,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MetricTile,
  SplitPane,
  StatusPill,
  Timeline,
  WorkItemPanel,
  cx,
  inputClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-primitives";
import { type AppRole, useAuth } from "@/components/auth/auth-provider";
import { AssignmentControls } from "@/components/assessment-workspace/assignment-controls";
import { EvidenceGapEditor } from "@/components/assessment-workspace/evidence-gap-editor";
import { EvidenceEditor } from "@/components/assessment-workspace/evidence-editor";
import { FindingEditor } from "@/components/assessment-workspace/finding-editor";
import { ReportAuthor } from "@/components/assessment-workspace/report-author";
import { ScorecardEditor } from "@/components/assessment-workspace/scorecard-editor";
import { SiteGridWorkspace } from "@/components/assessment-workspace/site-grid-workspace";
import { SmartAssistant } from "@/components/assessment-workspace/smart-assistant";
import {
  ActivityItem,
  AssessmentDetailRecord,
  AssessmentEventRecord,
  AssessmentWorkspaceData,
  ContactRecord,
  FileRecord,
  NoteRecord,
  StatusHistoryRecord,
  WorkspaceModuleId,
  buildActivityItems,
  buildDuplicateSignals,
  buildSmartSignals,
  buildWorkspaceData,
  formatWorkspaceDate,
  formatWorkspaceDateTime,
  getLifecycleFacts,
  getOrganisation,
  getProject,
  getSite,
  lifecycleTone,
  workspaceModules,
} from "@/lib/assessment-workspace";
import {
  AssessmentFindingRecord,
  EvidenceGapRecord,
  EvidenceSourceRecord,
  FindingEvidenceLinkRecord,
} from "@/lib/evidence";
import { GridAssetRecord } from "@/lib/gis";
import { AssessmentStatus, assessmentStatuses, statusLabel } from "@/lib/intake";
import { allowedAssessmentTransitions, transitionAssessmentStatus } from "@/lib/assessment-workflow";
import {
  AssessmentReportExportRecord,
  AssessmentPreflightRunRecord,
  AssessmentReportSectionRecord,
  ReportClaimEvidenceLinkRecord,
  ReportClaimRecord,
  ReportSectionFindingLinkRecord,
  reportExportStatusLabel,
} from "@/lib/report-builder";
import {
  AssessmentScoreCalculationRecord,
  AssessmentScoreRecord,
  AssessmentVerdictRecord,
  ExpertReviewRecord,
  calculateDeliveryGates,
  countCriticalFindings,
  countEvidenceGaps,
  detectExpertReviewTriggers,
  deliveryGatesAreComplete,
  deliveryGateTone,
  reviewStatusLabel,
} from "@/lib/scorecard";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type WorkspaceRole = "analyst" | "customer";

const moduleIcons: Record<WorkspaceModuleId, ReactNode> = {
  activity: <Activity size={16} />,
  evidence: <ShieldCheck size={16} />,
  findings: <AlertCircle size={16} />,
  intake: <ClipboardList size={16} />,
  overview: <Gauge size={16} />,
  report: <FileText size={16} />,
  scorecard: <BarChart3 size={16} />,
  "site-grid": <MapPin size={16} />,
};

export function AssessmentWorkspace({
  assessmentId,
}: {
  assessmentId: string;
}) {
  const [data, setData] = useState<AssessmentWorkspaceData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const { role: appRole } = useAuth();
  const role: WorkspaceRole = appRole === "customer" ? "customer" : "analyst";
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requestedModule = searchParams.get("module") as WorkspaceModuleId | null;
  const activeModule = workspaceModules.some((module) => module.id === requestedModule) ? requestedModule ?? "overview" : "overview";

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      if (!hasSupabaseConfig || !supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { data: assessmentData, error: assessmentError } = await supabase
          .from("site_assessments")
          .select(`
            *,
            sites (*),
            projects (
              *,
              organisations (*)
            )
          `)
          .eq("id", assessmentId)
          .single();

        if (assessmentError) {
          throw assessmentError;
        }

        const assessment = assessmentData as AssessmentDetailRecord;
        const project = getProject(assessment);
        let contact: ContactRecord | null = null;

        if (project?.lead_contact_id) {
          const { data: contactData } = await supabase
            .from("contacts")
            .select("*")
            .eq("id", project.lead_contact_id)
            .maybeSingle();

          contact = (contactData as ContactRecord | null) ?? null;
        }

        const [
          { data: noteData, error: noteError },
          { data: fileData, error: fileError },
          { data: gridAssetData, error: gridError },
          { data: sourceData, error: sourceError },
          { data: findingData, error: findingError },
          { data: gapData, error: gapError },
          { data: scoreData, error: scoreError },
          { data: scoreCalculationData, error: scoreCalculationError },
          { data: verdictData, error: verdictError },
          { data: reviewData, error: reviewError },
          { data: sectionData, error: sectionError },
          { data: exportData, error: exportError },
          { data: claimData, error: claimError },
          { data: preflightData, error: preflightError },
          { data: statusHistoryData, error: statusHistoryError },
          { data: assessmentEventData, error: assessmentEventError },
          { data: duplicateCandidateData, error: duplicateError },
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
            .select("id, site_assessment_id, site_id, asset_name, asset_type, latitude, longitude, voltage_kv, owner_operator, source, confidence_level, is_candidate_poi, rationale, analyst_notes, distance_miles, created_at, updated_at")
            .eq("site_assessment_id", assessmentId)
            .order("distance_miles", { ascending: true }),
          supabase
            .from("evidence_sources")
            .select("id, site_assessment_id, title, source_type, publisher, url, file_reference, accessed_at, published_at, confidence_level, license_notes, limitation_notes, notes, authored_by, metadata_version, summary, created_at, updated_at")
            .eq("site_assessment_id", assessmentId)
            .order("created_at", { ascending: false }),
          supabase
            .from("assessment_findings")
            .select("id, site_assessment_id, module_key, title, finding_type, risk_level, confidence_level, statement, assumption_note, recommendation, status, support_status, created_at, updated_at")
            .eq("site_assessment_id", assessmentId)
            .order("created_at", { ascending: false }),
          supabase
            .from("evidence_gaps")
            .select("id, site_assessment_id, category, title, description, impact, severity, owner_id, due_at, status, blocks_confidence, blocks_review, blocks_delivery, resolution_type, resolution_note, resolved_source_id, approved_exception_id, created_at, updated_at")
            .eq("site_assessment_id", assessmentId)
            .order("created_at", { ascending: false }),
          supabase
            .from("assessment_scores")
            .select("id, site_assessment_id, module_key, score, risk_level, confidence_level, rationale, override_note, calculation_origin, is_derived, methodology_version_id, weight, weighted_contribution, created_at, updated_at")
            .eq("site_assessment_id", assessmentId)
            .order("module_key", { ascending: true }),
          supabase
            .from("assessment_score_calculations")
            .select("id, site_assessment_id, methodology_version_id, completed_component_count, overall_score, readiness_band, confidence_points, overall_confidence, blockers, calculated_by, calculation_reason, created_at")
            .eq("site_assessment_id", assessmentId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("assessment_verdicts")
            .select("id, site_assessment_id, verdict, confidence_level, conditions, summary, key_strengths, key_risks, recommended_next_steps, limitations_note, approved_by_analyst, approved_at, authored_by, methodology_version_id, current_event_id, created_at, updated_at")
            .eq("site_assessment_id", assessmentId)
            .maybeSingle(),
          supabase
            .from("expert_reviews")
            .select("id, site_assessment_id, review_type, reviewer_name, status, trigger_reason, comments, required_changes, approved_at, created_at, updated_at")
            .eq("site_assessment_id", assessmentId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("assessment_report_sections")
            .select("id, site_assessment_id, template_section_id, section_key, title, content, status, is_edited, generated_at, generation_notes, updated_at")
            .eq("site_assessment_id", assessmentId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("assessment_report_exports")
            .select("id, site_assessment_id, template_id, export_type, status, notes, ready_for_review_at, updated_at")
            .eq("site_assessment_id", assessmentId)
            .order("updated_at", { ascending: false })
            .limit(1),
          supabase
            .from("report_claims")
            .select("id, report_section_id, site_assessment_id, claim_text, is_material, support_status, confidence_level, rationale, authored_by, created_at, updated_at")
            .eq("site_assessment_id", assessmentId)
            .order("created_at", { ascending: false }),
          supabase
            .from("assessment_preflight_runs")
            .select("id, site_assessment_id, purpose, status, blockers, warnings, bypassed_blockers, run_by, created_at")
            .eq("site_assessment_id", assessmentId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("status_history")
            .select("id, from_status, to_status, reason, created_at")
            .eq("site_assessment_id", assessmentId)
            .order("created_at", { ascending: false }),
          supabase
            .from("assessment_events")
            .select("id, event_type, actor_role, visibility, source_table, source_record_id, from_state, to_state, reason, metadata, created_at")
            .eq("site_assessment_id", assessmentId)
            .order("created_at", { ascending: false }),
          supabase
            .from("site_assessments")
            .select(`
              *,
              sites (*),
              projects (
                *,
                organisations (*)
              )
            `)
            .order("updated_at", { ascending: false })
            .limit(100),
        ]);

        if (
          noteError ||
          fileError ||
          gridError ||
          sourceError ||
          findingError ||
          gapError ||
          scoreError ||
          scoreCalculationError ||
          verdictError ||
          reviewError ||
          sectionError ||
          exportError ||
          claimError ||
          preflightError ||
          statusHistoryError ||
          assessmentEventError ||
          duplicateError
        ) {
          throw (
            noteError ??
            fileError ??
            gridError ??
            sourceError ??
            findingError ??
            gapError ??
            scoreError ??
            scoreCalculationError ??
            verdictError ??
            reviewError ??
            sectionError ??
            exportError ??
            claimError ??
            preflightError ??
            statusHistoryError ??
            assessmentEventError ??
            duplicateError
          );
        }

        const findings = (findingData ?? []) as AssessmentFindingRecord[];
        const claims = (claimData ?? []) as ReportClaimRecord[];
        let links: FindingEvidenceLinkRecord[] = [];
        let claimLinks: ReportClaimEvidenceLinkRecord[] = [];
        let sectionFindingLinks: ReportSectionFindingLinkRecord[] = [];

        if (findings.length > 0) {
          const { data: linkData, error: linkError } = await supabase
            .from("finding_evidence_links")
            .select("id, finding_id, evidence_source_id, relationship, link_note, linked_by, created_at")
            .in("finding_id", findings.map((finding) => finding.id))
            .order("created_at", { ascending: false });

          if (linkError) {
            throw linkError;
          }

          links = (linkData ?? []) as FindingEvidenceLinkRecord[];
        }

        if (claims.length > 0) {
          const { data: claimLinkData, error: claimLinkError } = await supabase
            .from("report_claim_evidence_links")
            .select("id, report_claim_id, evidence_source_id, relationship, citation_locator, link_note, evidence_snapshot, linked_by, created_at")
            .in("report_claim_id", claims.map((claim) => claim.id))
            .order("created_at", { ascending: false });
          if (claimLinkError) throw claimLinkError;
          claimLinks = (claimLinkData ?? []) as ReportClaimEvidenceLinkRecord[];
        }

        const reportSectionIds = ((sectionData ?? []) as AssessmentReportSectionRecord[]).map((section) => section.id);
        if (reportSectionIds.length > 0) {
          const { data: sectionFindingLinkData, error: sectionFindingLinkError } = await supabase
            .from("report_section_finding_links")
            .select("id, report_section_id, finding_id, relationship, linked_by, created_at")
            .in("report_section_id", reportSectionIds)
            .order("created_at", { ascending: false });
          if (sectionFindingLinkError) throw sectionFindingLinkError;
          sectionFindingLinks = (sectionFindingLinkData ?? []) as ReportSectionFindingLinkRecord[];
        }

        if (cancelled) {
          return;
        }

        const assessmentWithContact = { ...assessment, contact };
        const workspaceData = buildWorkspaceData({
          assessment: assessmentWithContact,
          assessmentEvents: (assessmentEventData ?? []) as AssessmentEventRecord[],
          duplicateSignals: buildDuplicateSignals(assessmentWithContact, (duplicateCandidateData ?? []) as AssessmentDetailRecord[]),
          evidenceLinks: links,
          evidenceGaps: (gapData ?? []) as EvidenceGapRecord[],
          evidenceSources: (sourceData ?? []) as EvidenceSourceRecord[],
          expertReview: (reviewData as ExpertReviewRecord | null) ?? null,
          files: (fileData ?? []) as FileRecord[],
          findings,
          gridAssets: (gridAssetData ?? []) as GridAssetRecord[],
          notes: (noteData ?? []) as NoteRecord[],
          reportExport: (((exportData ?? []) as AssessmentReportExportRecord[])[0] as AssessmentReportExportRecord | undefined) ?? null,
          reportClaimEvidenceLinks: claimLinks,
          reportClaims: claims,
          reportSectionFindingLinks: sectionFindingLinks,
          latestPreflight: (preflightData as AssessmentPreflightRunRecord | null) ?? null,
          reportSections: (sectionData ?? []) as AssessmentReportSectionRecord[],
          scoreCalculation: (scoreCalculationData as AssessmentScoreCalculationRecord | null) ?? null,
          scores: (scoreData ?? []) as AssessmentScoreRecord[],
          statusHistory: (statusHistoryData ?? []) as StatusHistoryRecord[],
          verdict: (verdictData as AssessmentVerdictRecord | null) ?? null,
        });

        setData(workspaceData);
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : "Could not load assessment workspace.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [assessmentId, reloadKey]);

  function refreshWorkspace() {
    setReloadKey((value) => value + 1);
  }

  function selectModule(moduleId: WorkspaceModuleId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("module", moduleId);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (!hasSupabaseConfig) {
    return (
      <EmptyState
        icon={<AlertCircle size={20} />}
        title="Supabase connection needed"
        description="Configure Supabase to open the decomposed assessment workspace."
        action={<Link href="/intake/workspace" className={secondaryButtonClass}>Open existing console</Link>}
      />
    );
  }

  if (loading) {
    return (
      <section className={cx(panelClass, "px-5 py-10 text-center text-sm text-[var(--color-text-secondary)]")}>
        <Loader2 className="mx-auto mb-3 animate-spin text-[var(--color-brand-primary)]" size={22} />
        Loading assessment workspace
      </section>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<AlertCircle size={20} />}
        title="Workspace could not be loaded"
        description={error || "This assessment was not found."}
        action={<Link href="/intake/assessments" className={secondaryButtonClass}>Back to queue</Link>}
      />
    );
  }

  const lifecycle = getLifecycleFacts(data.assessment);
  const site = getSite(data.assessment);
  const project = getProject(data.assessment);
  const organisation = getOrganisation(data.assessment);
  const smartSignals = buildSmartSignals(data);
  const activityItems = buildActivityItems(data);

  return (
    <div className="space-y-5">
      <section className={cx(panelClass, "overflow-hidden")}>
        <div className="grid gap-5 border-b border-[var(--color-border)] px-5 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusPill tone={lifecycleTone(data.assessment.status)}>{lifecycle.customerLabel}</StatusPill>
              <StatusPill tone="neutral">{statusLabel(data.assessment.status)}</StatusPill>
              <StatusPill tone={data.assessment.intake_completeness_score >= 100 ? "success" : "warning"}>
                {data.assessment.intake_completeness_score}% intake
              </StatusPill>
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">{data.assessment.assessment_name}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              {organisation?.name ?? "Unassigned customer"} · {project?.name ?? "No project"} · {site?.site_name ?? "No site"}
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">Authenticated role</p>
              <div className="mt-2"><StatusPill tone={role === "customer" ? "info" : "brand"}>{appRole}</StatusPill></div>
            </div>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">Current owner</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{lifecycle.owner}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Target: {lifecycle.slaLabel}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border-b border-[var(--color-border)] px-3 py-2">
          <div className="flex min-w-max gap-1">
            {workspaceModules.map((module) => {
              const selected = activeModule === module.id;

              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => selectModule(module.id)}
                  className={cx(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]",
                    selected
                      ? "bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  {moduleIcons[module.id]}
                  {module.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <SplitPane
        aside={
          <ContextRail
            activityItems={activityItems}
            data={data}
            lifecycle={lifecycle}
            role={role}
            appRole={appRole}
            smartSignals={smartSignals}
            onRefresh={refreshWorkspace}
          />
        }
      >
        <ModuleContent activeModule={activeModule} data={data} role={role} appRole={appRole} smartSignals={smartSignals} onRefresh={refreshWorkspace} />
      </SplitPane>
    </div>
  );
}

function ModuleContent({
  activeModule,
  appRole,
  data,
  onRefresh,
  role,
  smartSignals,
}: {
  activeModule: WorkspaceModuleId;
  appRole: AppRole;
  data: AssessmentWorkspaceData;
  onRefresh: () => void;
  role: WorkspaceRole;
  smartSignals: ReturnType<typeof buildSmartSignals>;
}) {
  switch (activeModule) {
    case "activity":
      return <ActivityModule data={data} role={role} />;
    case "evidence":
      return <EvidenceModule data={data} role={appRole} onRefresh={onRefresh} />;
    case "findings":
      return <FindingsModule data={data} role={appRole} onRefresh={onRefresh} />;
    case "intake":
      return <IntakeModule data={data} role={role} />;
    case "report":
      return <ReportModule data={data} role={appRole} onRefresh={onRefresh} />;
    case "scorecard":
      return <ScorecardModule data={data} role={appRole} onRefresh={onRefresh} />;
    case "site-grid":
      return <SiteGridModule data={data} role={appRole} onRefresh={onRefresh} />;
    case "overview":
    default:
      return <OverviewModule data={data} role={role} smartSignals={smartSignals} />;
  }
}

function ContextRail({
  activityItems,
  appRole,
  data,
  lifecycle,
  onRefresh,
  role,
  smartSignals,
}: {
  activityItems: ActivityItem[];
  appRole: AppRole;
  data: AssessmentWorkspaceData;
  lifecycle: ReturnType<typeof getLifecycleFacts>;
  onRefresh: () => void;
  role: WorkspaceRole;
  smartSignals: ReturnType<typeof buildSmartSignals>;
}) {
  return (
    <div className="space-y-4">
      <WorkItemPanel
        eyebrow={role === "customer" ? "Customer view" : "Analyst view"}
        title={lifecycle.customerLabel}
        description={lifecycle.description}
        tone={lifecycleTone(data.assessment.status)}
      >
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
              <span>Lifecycle</span>
              <span>{lifecycle.progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-md bg-[var(--color-surface-strong)]">
              <div className="h-full rounded-md bg-[var(--color-brand-primary)]" style={{ width: `${lifecycle.progress}%` }} />
            </div>
          </div>
          <Fact label="Owner" value={lifecycle.owner} />
          <Fact label="SLA target" value={lifecycle.slaLabel} />
        </div>
      </WorkItemPanel>

      <WorkItemPanel title="Assignment controls" eyebrow="Persistent" tone="brand">
        <AssignmentControls
          assessmentId={data.assessment.id}
          role={appRole}
          value={data.assessment}
          onSaved={onRefresh}
        />
      </WorkItemPanel>

      {role !== "customer" ? (
        <WorkItemPanel title="Workflow status" eyebrow="Controlled transition" tone="info">
          <WorkflowStatusControls
            key={data.assessment.status}
            data={data}
            role={appRole}
            onChanged={onRefresh}
          />
        </WorkItemPanel>
      ) : null}

      <SmartAssistant assessment={data.assessment} gridAssets={data.gridAssets} role={appRole} signals={smartSignals} onApplied={onRefresh} />

      <WorkItemPanel title="Recent activity" eyebrow={`${activityItems.length} events`} tone="info">
        <Timeline
          items={activityItems.slice(0, 5).map((item) => ({
            body: item.body,
            id: item.id,
            meta: formatWorkspaceDateTime(item.timestamp),
            title: item.title,
            tone: item.tone,
          }))}
        />
      </WorkItemPanel>
    </div>
  );
}

function WorkflowStatusControls({
  data,
  onChanged,
  role,
}: {
  data: AssessmentWorkspaceData;
  onChanged: () => void;
  role: AppRole;
}) {
  const transitions = allowedAssessmentTransitions(data.assessment.status, role).filter(
    (status) => status !== "delivered" || deliveryGatesAreComplete(getDeliveryGates(data)),
  );
  const [nextStatus, setNextStatus] = useState<AssessmentStatus>(transitions[0] ?? data.assessment.status);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (transitions.length === 0) {
    return <p className="text-sm text-[var(--color-text-secondary)]">No status transitions are available for this role.</p>;
  }

  async function save() {
    if (!supabase) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await transitionAssessmentStatus(supabase, {
        assessmentId: data.assessment.id,
        reason: reason.trim() || "Workflow status changed in assessment workspace",
        source: "assessment_workspace",
        toStatus: nextStatus,
      });
      onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update workflow status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <select
        aria-label="Next workflow status"
        className={inputClass}
        value={nextStatus}
        onChange={(event) => setNextStatus(event.target.value as AssessmentStatus)}
      >
        {assessmentStatuses.filter((status) => transitions.includes(status.value)).map((status) => (
          <option key={status.value} value={status.value}>{status.label}</option>
        ))}
      </select>
      <input
        aria-label="Transition reason"
        className={inputClass}
        placeholder="Reason (optional)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
      <button type="button" className={primaryButtonClass} disabled={saving} onClick={() => void save()}>
        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
        Update status
      </button>
    </div>
  );
}

function OverviewModule({
  data,
  role,
  smartSignals,
}: {
  data: AssessmentWorkspaceData;
  role: WorkspaceRole;
  smartSignals: ReturnType<typeof buildSmartSignals>;
}) {
  const lifecycle = getLifecycleFacts(data.assessment);
  const criticalFindings = countCriticalFindings(data.findings);
  const evidenceGaps = countEvidenceGaps(data.evidenceReadiness);
  const gates = getDeliveryGates(data);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon={<ClipboardList size={16} />} label="Lifecycle" tone={lifecycleTone(data.assessment.status)} value={lifecycle.customerLabel} />
        <MetricTile icon={<ShieldCheck size={16} />} label="Evidence readiness" tone={evidenceGaps > 0 ? "warning" : "success"} value={`${data.evidenceReadiness.readinessPercent}%`} />
        <MetricTile icon={<AlertCircle size={16} />} label="Critical findings" tone={criticalFindings > 0 ? "danger" : "success"} value={String(criticalFindings)} />
        <MetricTile icon={<BarChart3 size={16} />} label="Scorecard" tone={data.scoreSummary.completedModules === data.scoreSummary.totalModules ? "success" : "warning"} value={`${data.scoreSummary.completedModules}/${data.scoreSummary.totalModules}`} />
      </div>

      <WorkItemPanel
        eyebrow={role === "customer" ? "Customer summary" : "Analyst command center"}
        title="What needs attention"
        description={role === "customer" ? "Customer-visible request status and missing inputs." : "Next actions across intake, evidence, scorecard, and report delivery."}
        tone="brand"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {smartSignals.length > 0 ? (
            smartSignals.map((signal) => (
              <div key={signal.label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <StatusPill tone={signal.tone}>{signal.label}</StatusPill>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{signal.body}</p>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-[var(--color-success)] bg-[var(--color-success-soft)] p-3 text-sm font-medium text-[var(--color-success)]">
              No urgent smart-assistance flags found.
            </div>
          )}
        </div>
      </WorkItemPanel>

      <WorkItemPanel title="Delivery gates" eyebrow={deliveryGatesAreComplete(gates) ? "Ready" : "Open gates"} tone={deliveryGatesAreComplete(gates) ? "success" : "warning"}>
        <div className="grid gap-3 lg:grid-cols-2">
          {gates.map((gate) => (
            <div key={gate.key} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
              <StatusPill tone={gate.status === "pass" ? "success" : gate.status === "risk" ? "warning" : "danger"} className={deliveryGateTone(gate.status)}>
                {gate.status}
              </StatusPill>
              <p className="mt-2 font-semibold text-[var(--color-text-primary)]">{gate.label}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{gate.detail}</p>
            </div>
          ))}
        </div>
      </WorkItemPanel>
    </div>
  );
}

function IntakeModule({ data, role }: { data: AssessmentWorkspaceData; role: WorkspaceRole }) {
  const { assessment } = data;
  const site = getSite(assessment);
  const project = getProject(assessment);
  const organisation = getOrganisation(assessment);

  return (
    <WorkItemPanel
      eyebrow={role === "customer" ? "Shared intake" : "Intake record"}
      title="Intake facts"
      description="Essential request details, project assumptions, and customer context."
      tone={assessment.intake_completeness_score >= 100 ? "success" : "warning"}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Fact label="Customer" value={organisation?.name ?? "Not set"} />
        <Fact label="Contact" value={assessment.contact?.email ?? assessment.contact?.name ?? "Not set"} />
        <Fact label="Project" value={project?.name ?? "Not set"} />
        <Fact label="Site" value={site?.site_name ?? "Not set"} />
        <Fact label="Target load" value={assessment.target_load_mw ? `${assessment.target_load_mw} MW` : "Not set"} />
        <Fact label="Desired energization" value={formatWorkspaceDate(assessment.desired_energization_date)} />
        <Fact label="Project stage" value={assessment.project_stage ?? "Not set"} />
        <Fact label="Land control" value={assessment.land_control_status ?? "Not set"} />
        <Fact label="Confidentiality" value={assessment.confidentiality_status.replaceAll("_", " ")} />
        <Fact label="Completeness" value={`${assessment.intake_completeness_score}%`} />
      </div>
      {role === "analyst" ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <TextBlock label="Existing studies" value={assessment.existing_studies_summary} />
          <TextBlock label="Existing power quote" value={assessment.existing_power_quote_summary} />
          <TextBlock label="Backup generation" value={assessment.backup_generation_assumptions} />
          <TextBlock label="Storage assumptions" value={assessment.battery_storage_assumptions} />
        </div>
      ) : null}
    </WorkItemPanel>
  );
}

function SiteGridModule({ data, onRefresh, role }: { data: AssessmentWorkspaceData; onRefresh: () => void; role: AppRole }) {
  const site = getSite(data.assessment);

  return (
    <SiteGridWorkspace
      assessment={data.assessment}
      assets={data.gridAssets}
      onChanged={onRefresh}
      role={role}
      site={site}
    />
  );
}

function EvidenceModule({ data, role, onRefresh }: { data: AssessmentWorkspaceData; role: AppRole; onRefresh: () => void }) {
  return (
    <WorkItemPanel title="Evidence workstream" eyebrow={`${data.evidenceSources.length} sources`} tone={data.evidenceReadiness.readinessPercent >= 80 ? "success" : "warning"}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Fact label="Sources" value={String(data.evidenceReadiness.totalSources)} />
        <Fact label="Findings with evidence" value={`${data.evidenceReadiness.findingsWithEvidence}/${data.evidenceReadiness.totalFindings}`} />
        <Fact label="Low-confidence sources" value={String(data.evidenceReadiness.lowConfidenceSources)} />
      </div>
      <EvidenceEditor assessmentId={data.assessment.id} role={role} sources={data.evidenceSources} onChanged={onRefresh} />
      <div className="mt-5 border-t border-[var(--color-border)] pt-5">
        <EvidenceGapEditor assessmentId={data.assessment.id} gaps={data.evidenceGaps} role={role} sources={data.evidenceSources} onChanged={onRefresh} />
      </div>
    </WorkItemPanel>
  );
}

function FindingsModule({ data, role, onRefresh }: { data: AssessmentWorkspaceData; role: AppRole; onRefresh: () => void }) {
  return (
    <WorkItemPanel title="Findings" eyebrow={`${data.findings.length} findings`} tone={data.findings.some((finding) => finding.risk_level === "critical" || finding.risk_level === "high") ? "danger" : "info"}>
      <FindingEditor assessmentId={data.assessment.id} findings={data.findings} links={data.evidenceLinks} onChanged={onRefresh} role={role} sources={data.evidenceSources} />
    </WorkItemPanel>
  );
}

function ScorecardModule({ data, role, onRefresh }: { data: AssessmentWorkspaceData; role: AppRole; onRefresh: () => void }) {
  const triggerSummary = detectExpertReviewTriggers({
    assessment: data.assessment,
    findings: data.findings,
    projectType: getProject(data.assessment)?.project_type,
    rideThroughUnknown: false,
    scores: data.scores,
  });

  return (
    <div className="space-y-5">
      <WorkItemPanel title="Weighted scorecard and verdict" eyebrow={`${data.scoreSummary.completedModules}/${data.scoreSummary.totalModules} components`} tone={data.scoreSummary.completedModules === data.scoreSummary.totalModules ? "success" : "warning"}>
        <ScorecardEditor
          key={`${data.scoreCalculation?.id ?? "none"}-${data.verdict?.updated_at ?? "none"}`}
          assessmentId={data.assessment.id}
          calculation={data.scoreCalculation}
          onChanged={onRefresh}
          role={role}
          scores={data.scores}
          verdict={data.verdict}
        />
      </WorkItemPanel>

      <WorkItemPanel title="Expert review" eyebrow={data.expertReview ? reviewStatusLabel(data.expertReview.status) : "Not started"} tone={triggerSummary.required ? "warning" : "success"}>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <StatusPill tone={triggerSummary.required ? "warning" : "success"}>
            {triggerSummary.required ? "Expert review required" : "No expert review trigger"}
          </StatusPill>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {data.expertReview ? reviewStatusLabel(data.expertReview.status) : triggerSummary.reasonText || "No expert-review record yet."}
          </p>
        </div>
      </WorkItemPanel>
    </div>
  );
}

function ReportModule({ data, role, onRefresh }: { data: AssessmentWorkspaceData; role: AppRole; onRefresh: () => void }) {
  return (
    <WorkItemPanel
      title="Report workbench"
      eyebrow={data.reportExport ? reportExportStatusLabel(data.reportExport.status) : "Not started"}
      tone={data.reportExport?.status === "ready_for_review" || data.reportExport?.status === "exported" ? "success" : "info"}
    >
      <ReportAuthor assessmentId={data.assessment.id} assessmentName={data.assessment.assessment_name} claimLinks={data.reportClaimEvidenceLinks} claims={data.reportClaims} evidenceSources={data.evidenceSources} findings={data.findings} latestPreflight={data.latestPreflight} marketRegion={data.assessment.market_region} role={role} sections={data.reportSections} sectionFindingLinks={data.reportSectionFindingLinks} reportExport={data.reportExport} onChanged={onRefresh} />
    </WorkItemPanel>
  );
}

function ActivityModule({ data, role }: { data: AssessmentWorkspaceData; role: WorkspaceRole }) {
  const activityItems = buildActivityItems({
    ...data,
    notes: role === "customer" ? data.notes.filter((note) => !note.is_internal) : data.notes,
  });

  return (
    <WorkItemPanel title="Activity timeline" eyebrow={`${activityItems.length} events`} tone="info">
      <Timeline
        items={activityItems.map((item) => ({
          body: item.body,
          id: item.id,
          meta: formatWorkspaceDateTime(item.timestamp),
          title: item.title,
          tone: item.tone,
        }))}
      />
    </WorkItemPanel>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[var(--color-text-primary)]">{value || "Not set"}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-secondary)]">{value?.trim() || "Not set"}</p>
    </div>
  );
}

function getDeliveryGates(data: AssessmentWorkspaceData) {
  const triggerSummary = detectExpertReviewTriggers({
    assessment: data.assessment,
    findings: data.findings,
    projectType: getProject(data.assessment)?.project_type,
    rideThroughUnknown: false,
    scores: data.scores,
  });

  return calculateDeliveryGates({
    criticalFindingCount: countCriticalFindings(data.findings),
    evidenceReadiness: data.evidenceReadiness,
    expertReview: data.expertReview,
    expertReviewRequired: triggerSummary.required,
    scoreSummary: data.scoreSummary,
    verdict: data.verdict,
  });
}
