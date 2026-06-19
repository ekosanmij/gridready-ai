"use client";

import { FormEvent, useState } from "react";
import { Edit3, Loader2, Plus, Save } from "lucide-react";
import { canManageAssessments, type AppRole, useAuth } from "@/components/auth/auth-provider";
import { FieldControl, StatusPill, inputClass, primaryButtonClass, secondaryButtonClass, textareaClass } from "@/components/ui-primitives";
import {
  type EvidenceGapDraft,
  type EvidenceGapRecord,
  type EvidenceSourceRecord,
  blankEvidenceGapDraft,
  createEvidenceGapDraft,
  evidenceGapCategories,
  evidenceGapStatuses,
} from "@/lib/evidence";
import { supabase } from "@/lib/supabase";

export function EvidenceGapEditor({ assessmentId, gaps, onChanged, role, sources }: {
  assessmentId: string;
  gaps: EvidenceGapRecord[];
  onChanged: () => void;
  role: AppRole;
  sources: EvidenceSourceRecord[];
}) {
  const editable = canManageAssessments(role);
  const { user } = useAuth();
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<EvidenceGapDraft>({ ...blankEvidenceGapDraft });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update<Key extends keyof EvidenceGapDraft>(key: Key, value: EvidenceGapDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function edit(gap: EvidenceGapRecord) {
    setEditingId(gap.id);
    setDraft(createEvidenceGapDraft(gap));
    setError("");
  }

  function reset() {
    setEditingId("");
    setDraft({ ...blankEvidenceGapDraft });
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editable) return;
    if (!draft.title.trim() || !draft.impact.trim()) {
      setError("Gap title and decision impact are required.");
      return;
    }
    if (["open", "in_progress"].includes(draft.status) && !draft.dueAt) {
      setError("Open evidence gaps require a due date.");
      return;
    }
    if (draft.status === "resolved" && !draft.resolvedSourceId) {
      setError("Select the source that resolves this gap.");
      return;
    }
    if (draft.status === "accepted_unknown" && draft.resolutionNote.trim().length < 10) {
      setError("Accepting an unknown requires a documented rationale.");
      return;
    }

    setSaving(true);
    setError("");
    const { error: saveError } = await supabase.rpc("save_evidence_gap", {
      p_assessment_id: assessmentId,
      p_gap: {
        blocks_confidence: draft.blocksConfidence,
        blocks_delivery: draft.blocksDelivery,
        blocks_review: draft.blocksReview,
        category: draft.category,
        description: draft.description.trim() || null,
        due_at: draft.dueAt || null,
        id: editingId || null,
        impact: draft.impact.trim(),
        owner_id: draft.ownerId || user?.id || null,
        resolution_note: draft.resolutionNote.trim() || null,
        resolution_type: draft.status === "resolved" ? "source" : draft.status === "accepted_unknown" ? "accepted_unknown" : null,
        resolved_source_id: draft.status === "resolved" ? draft.resolvedSourceId : null,
        severity: draft.severity,
        status: draft.status,
        title: draft.title.trim(),
      },
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    reset();
    onChanged();
  }

  const statusOptions = evidenceGapStatuses.filter((status) => status.value !== "exception_approved");

  return (
    <div className="space-y-4">
      {editable ? <form onSubmit={save} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">{editingId ? "Edit evidence gap" : "Add evidence gap"}</h3>{editingId ? <button type="button" className={secondaryButtonClass} onClick={reset}><Plus size={16} /> New gap</button> : null}</div>
        <div className="grid gap-3 md:grid-cols-3">
          <FieldControl label="Gap title" required><input className={inputClass} required value={draft.title} onChange={(event) => update("title", event.target.value)} /></FieldControl>
          <FieldControl label="Category"><select className={inputClass} value={draft.category} onChange={(event) => update("category", event.target.value as EvidenceGapDraft["category"])}>{evidenceGapCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
          <FieldControl label="Severity"><select className={inputClass} value={draft.severity} onChange={(event) => update("severity", event.target.value as EvidenceGapDraft["severity"])}>{["low", "medium", "high", "critical"].map((value) => <option key={value} value={value}>{value}</option>)}</select></FieldControl>
          <FieldControl label="Status"><select className={inputClass} value={draft.status} onChange={(event) => update("status", event.target.value as EvidenceGapDraft["status"])}>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
          <FieldControl label="Due date" required={draft.status === "open" || draft.status === "in_progress"}><input className={inputClass} required={draft.status === "open" || draft.status === "in_progress"} type="datetime-local" value={draft.dueAt} onChange={(event) => update("dueAt", event.target.value)} /></FieldControl>
          {draft.status === "resolved" ? <FieldControl label="Resolving source"><select className={inputClass} value={draft.resolvedSourceId} onChange={(event) => update("resolvedSourceId", event.target.value)}><option value="">Select source</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select></FieldControl> : null}
          <FieldControl label="Description" wide><textarea className={textareaClass} rows={3} value={draft.description} onChange={(event) => update("description", event.target.value)} /></FieldControl>
          <FieldControl label="Decision impact" wide><textarea className={textareaClass} required rows={3} value={draft.impact} onChange={(event) => update("impact", event.target.value)} /></FieldControl>
          {draft.status === "accepted_unknown" ? <FieldControl label="Accepted-unknown rationale" wide><textarea className={textareaClass} required rows={3} value={draft.resolutionNote} onChange={(event) => update("resolutionNote", event.target.value)} /></FieldControl> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.blocksConfidence} onChange={(event) => update("blocksConfidence", event.target.checked)} />Blocks confidence</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.blocksReview} onChange={(event) => update("blocksReview", event.target.checked)} />Blocks review</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.blocksDelivery} onChange={(event) => update("blocksDelivery", event.target.checked)} />Blocks delivery</label></div>
        {error ? <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
        <button className={`${primaryButtonClass} mt-4`} disabled={saving} type="submit">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save evidence gap</button>
      </form> : null}
      <div className="grid gap-3 md:grid-cols-2">{gaps.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">No explicit evidence gaps recorded.</p> : gaps.map((gap) => <article key={gap.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"><div className="flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2"><StatusPill tone={gap.severity === "critical" || gap.severity === "high" ? "danger" : "warning"}>{gap.severity}</StatusPill><StatusPill tone={gap.status === "resolved" ? "success" : "warning"}>{gap.status.replaceAll("_", " ")}</StatusPill>{gap.blocks_delivery ? <StatusPill tone="danger">delivery blocker</StatusPill> : null}</div>{editable ? <button type="button" className={secondaryButtonClass} onClick={() => edit(gap)}><Edit3 size={16} /> Edit</button> : null}</div><h3 className="mt-2 font-semibold">{gap.title}</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{gap.impact}</p></article>)}</div>
    </div>
  );
}
