"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, FileCheck2, Loader2, RotateCcw, Save } from "lucide-react";
import { type AppRole, useAuth } from "@/components/auth/auth-provider";
import { FieldControl, StatusPill, inputClass, primaryButtonClass, textareaClass } from "@/components/ui-primitives";
import type { AssessmentReportExportRecord } from "@/lib/report-builder";
import {
  type ExpertReviewChecklistDraft,
  type ExpertReviewChecklistItemRecord,
  type ExpertReviewDraft,
  type ExpertReviewRecord,
  type ReviewStatus,
  buildExpertReviewChecklistDrafts,
  createExpertReviewDraft,
  expertReviewChecklistStatuses,
  reviewStatuses,
  reviewStatusLabel,
} from "@/lib/scorecard";
import { saveExpertReview } from "@/lib/scorecard-service";
import { supabase } from "@/lib/supabase";

const decisionStatuses: ReviewStatus[] = ["approved", "changes_requested", "rejected"];
type ReviewerOption = { full_name: string | null; id: string; role: AppRole };

export function ExpertReviewEditor({
  assessmentId,
  checklistItems,
  onChanged,
  reportExport,
  required,
  review,
  role,
  triggerReason,
}: {
  assessmentId: string;
  checklistItems: ExpertReviewChecklistItemRecord[];
  onChanged: () => void;
  reportExport: AssessmentReportExportRecord | null;
  required: boolean;
  review: ExpertReviewRecord | null;
  role: AppRole;
  triggerReason: string;
}) {
  const { user } = useAuth();
  const assignedToCurrentUser = Boolean(review?.reviewer_id && review.reviewer_id === user?.id);
  const canAssign = role === "admin" || role === "analyst";
  const editable = canAssign || (role === "reviewer" && assignedToCurrentUser);
  const canDecide = role === "admin" || (role === "reviewer" && assignedToCurrentUser);
  const [draft, setDraft] = useState<ExpertReviewDraft>(() => createExpertReviewDraft(review));
  const [checklist, setChecklist] = useState<ExpertReviewChecklistDraft[]>(() => buildExpertReviewChecklistDrafts(checklistItems));
  const [reviewers, setReviewers] = useState<ReviewerOption[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revisionReason, setRevisionReason] = useState(review?.required_changes ?? review?.decision_reason ?? "");
  const [revising, setRevising] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase || !canAssign) return;
    void supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .in("role", ["admin", "reviewer"])
      .order("full_name")
      .then(({ data }) => setReviewers((data ?? []) as ReviewerOption[]));
  }, [canAssign]);

  function updateDraft<Key extends keyof ExpertReviewDraft>(key: Key, value: ExpertReviewDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateChecklist(index: number, patch: Partial<ExpertReviewChecklistDraft>) {
    setChecklist((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function startRevision() {
    if (!supabase || !reportExport || !canAssign) return;
    if (revisionReason.trim().length < 10) {
      setError("Enter a substantive revision reason of at least 10 characters.");
      return;
    }
    setRevising(true);
    setError("");
    setMessage("");
    const { error: revisionError } = await supabase.rpc("start_report_revision", {
      p_assessment_id: assessmentId,
      p_export_id: reportExport.id,
      p_reason: revisionReason.trim(),
    });
    setRevising(false);
    if (revisionError) {
      setError(revisionError.message);
      return;
    }
    setMessage("A new report revision is open for analyst changes.");
    onChanged();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editable) return;

    if (decisionStatuses.includes(draft.status) && !canDecide) {
      setError("Only the assigned reviewer or an administrator can record a review decision.");
      return;
    }
    if (["requested", "in_review"].includes(draft.status) && !draft.reviewerId) {
      setError("Assign a reviewer before requesting review.");
      return;
    }
    if (decisionStatuses.includes(draft.status) && (!reportExport?.finalized_at || !reportExport.version_number)) {
      setError("Finalize the current report version before recording a review decision.");
      return;
    }
    if (decisionStatuses.includes(draft.status) && (review?.report_export_id !== reportExport?.id || review?.report_export_version !== reportExport?.version_number)) {
      setError("Save this report version as requested or in review before recording a decision.");
      return;
    }
    if (draft.status === "approved" && checklist.some((item) => item.status === "not_checked" || item.status === "fail")) {
      setError("Approval requires every checklist item to be completed without failures.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveExpertReview(supabase, {
        assessmentId,
        checklist,
        draft: {
          ...draft,
          triggerReason: draft.triggerReason.trim() || triggerReason,
        },
        reportExportId: reportExport?.id ?? null,
        review,
      });
      onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save expert review.");
    } finally {
      setSaving(false);
    }
  }

  const reviewMatchesCurrentVersion = review?.report_export_id === reportExport?.id
    && review?.report_export_version === reportExport?.version_number;
  const statusOptions = reviewStatuses.filter((status) => (
    !decisionStatuses.includes(status.value)
    || (canDecide && reviewMatchesCurrentVersion)
    || status.value === draft.status
  ));
  const finalizedVersion = reportExport?.finalized_at && reportExport.version_number
    ? `Version ${reportExport.version_number}`
    : "No finalized version";
  const canStartRevision = canAssign
    && Boolean(review && ["changes_requested", "rejected"].includes(review.status))
    && review?.report_export_id === reportExport?.id
    && review?.report_export_version === reportExport?.version_number
    && Boolean(reportExport?.finalized_at);

  return (
    <form className="space-y-4" onSubmit={save}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={required ? "warning" : "success"}>{required ? "Expert review required" : "No automatic trigger"}</StatusPill>
        <StatusPill tone={reportExport?.finalized_at ? "success" : "neutral"}><FileCheck2 size={14} /> {finalizedVersion}</StatusPill>
        {review?.report_export_version ? <StatusPill tone={reviewMatchesCurrentVersion ? "success" : "danger"}>Review tied to version {review.report_export_version}</StatusPill> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FieldControl label="Assigned reviewer">
          {canAssign ? (
            <select className={inputClass} value={draft.reviewerId} onChange={(event) => updateDraft("reviewerId", event.target.value)}>
              <option value="">Select reviewer</option>
              {reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.full_name || reviewer.id} ({reviewer.role})</option>)}
            </select>
          ) : (
            <input className={inputClass} disabled value={draft.reviewerName || "Not assigned"} />
          )}
        </FieldControl>
        <FieldControl label="Review status">
          <select className={inputClass} disabled={!editable} value={draft.status} onChange={(event) => updateDraft("status", event.target.value as ReviewStatus)}>
            {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </FieldControl>
        <FieldControl label="Trigger reason" wide>
          <textarea className={textareaClass} disabled={!editable} placeholder={triggerReason} rows={2} value={draft.triggerReason} onChange={(event) => updateDraft("triggerReason", event.target.value)} />
        </FieldControl>
        <FieldControl label="Reviewer comments" wide>
          <textarea className={textareaClass} disabled={!editable} rows={3} value={draft.comments} onChange={(event) => updateDraft("comments", event.target.value)} />
        </FieldControl>
        <FieldControl label="Required changes" wide>
          <textarea className={textareaClass} disabled={!editable} required={draft.status === "changes_requested"} rows={3} value={draft.requiredChanges} onChange={(event) => updateDraft("requiredChanges", event.target.value)} />
        </FieldControl>
        {decisionStatuses.includes(draft.status) ? <FieldControl label="Decision reason" required={draft.status === "rejected"} wide>
          <textarea className={textareaClass} disabled={!editable} rows={2} value={draft.decisionReason} onChange={(event) => updateDraft("decisionReason", event.target.value)} />
        </FieldControl> : null}
      </div>

      {canStartRevision ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <FieldControl label="Revision reason">
            <textarea className={textareaClass} rows={2} value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} />
          </FieldControl>
          <button className={`${primaryButtonClass} mt-3`} disabled={revising} onClick={() => void startRevision()} type="button">
            {revising ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />} Start report revision
          </button>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center gap-2"><CheckCircle2 size={17} /><h3 className="font-semibold">Review checklist</h3></div>
        <div className="grid gap-3 lg:grid-cols-2">
          {checklist.map((item, index) => (
            <fieldset className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3" disabled={!editable} key={item.itemKey}>
              <legend className="px-1 text-sm font-semibold">{item.label}</legend>
              <div className="space-y-3 pt-1">
                <select aria-label={`${item.label} status`} className={inputClass} value={item.status} onChange={(event) => updateChecklist(index, { status: event.target.value as ExpertReviewChecklistDraft["status"] })}>
                  {expertReviewChecklistStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
                <textarea aria-label={`${item.label} comments`} className={textareaClass} placeholder="Reviewer comment" rows={2} value={item.comments} onChange={(event) => updateChecklist(index, { comments: event.target.value })} />
                {(item.status === "fail" || item.requiredChange) ? <textarea aria-label={`${item.label} required change`} className={textareaClass} placeholder="Required change" required={item.status === "fail"} rows={2} value={item.requiredChange} onChange={(event) => updateChecklist(index, { requiredChange: event.target.value })} /> : null}
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      {review ? <p className="text-xs text-[var(--color-text-secondary)]">Current decision: {reviewStatusLabel(review.status)}{review.decision_at ? ` on ${new Date(review.decision_at).toLocaleString()}` : ""}.</p> : null}
      {error ? <p className="text-sm font-semibold text-[var(--color-danger)]" role="alert">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-[var(--color-success)]" role="status">{message}</p> : null}
      {editable ? <button className={primaryButtonClass} disabled={saving} type="submit">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save expert review</button> : null}
    </form>
  );
}
