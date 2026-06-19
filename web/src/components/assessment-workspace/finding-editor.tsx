"use client";

import { FormEvent, useState } from "react";
import { Edit3, Loader2, Plus, Save } from "lucide-react";
import { canManageAssessments, type AppRole } from "@/components/auth/auth-provider";
import { FieldControl, StatusPill, inputClass, primaryButtonClass, secondaryButtonClass, textareaClass } from "@/components/ui-primitives";
import {
  type AssessmentFindingDraft,
  type AssessmentFindingRecord,
  type EvidenceRelationship,
  type EvidenceSourceRecord,
  type FindingEvidenceLinkRecord,
  blankAssessmentFindingDraft,
  createAssessmentFindingDraft,
  evidenceConfidenceLevels,
  evidenceRelationships,
  findingModules,
  findingStatuses,
  findingTypes,
  linksForFinding,
  riskLevelLabel,
  riskLevels,
  supportStatuses,
} from "@/lib/evidence";
import { supabase } from "@/lib/supabase";

export function FindingEditor({ assessmentId, findings, links, onChanged, role, sources }: {
  assessmentId: string;
  findings: AssessmentFindingRecord[];
  links: FindingEvidenceLinkRecord[];
  onChanged: () => void;
  role: AppRole;
  sources: EvidenceSourceRecord[];
}) {
  const editable = canManageAssessments(role);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<AssessmentFindingDraft>({ ...blankAssessmentFindingDraft, linkedEvidenceSourceIds: [] });
  const [relationships, setRelationships] = useState<Record<string, EvidenceRelationship>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update<Key extends keyof AssessmentFindingDraft>(key: Key, value: AssessmentFindingDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function edit(finding: AssessmentFindingRecord) {
    const findingLinks = linksForFinding(finding.id, links);
    setEditingId(finding.id);
    setDraft(createAssessmentFindingDraft(finding, findingLinks.map((link) => link.evidence_source_id)));
    setRelationships(Object.fromEntries(findingLinks.map((link) => [link.evidence_source_id, link.relationship])));
    setError("");
  }

  function reset() {
    setEditingId("");
    setDraft({ ...blankAssessmentFindingDraft, linkedEvidenceSourceIds: [] });
    setRelationships({});
    setError("");
  }

  function toggleSource(sourceId: string, checked: boolean) {
    update("linkedEvidenceSourceIds", checked
      ? [...draft.linkedEvidenceSourceIds, sourceId]
      : draft.linkedEvidenceSourceIds.filter((id) => id !== sourceId));
    if (checked) setRelationships((current) => ({ ...current, [sourceId]: current[sourceId] ?? "supporting" }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editable) return;
    if (!draft.title.trim()) {
      setError("Finding title is required.");
      return;
    }
    const selectedRelationships = draft.linkedEvidenceSourceIds.map((id) => relationships[id] ?? "supporting");
    if (["supported", "mixed"].includes(draft.supportStatus) && !selectedRelationships.includes("supporting")) {
      setError("Supported or mixed findings require supporting evidence.");
      return;
    }
    if (["contradicted", "mixed"].includes(draft.supportStatus) && !selectedRelationships.includes("contradicting")) {
      setError("Contradicted or mixed findings require contradictory evidence.");
      return;
    }

    setSaving(true);
    setError("");
    const { error: saveError } = await supabase.rpc("save_assessment_finding", {
      p_assessment_id: assessmentId,
      p_finding: {
        id: editingId || null,
        assumption_note: draft.assumptionNote.trim() || null,
        confidence_level: draft.confidenceLevel,
        finding_type: draft.findingType,
        module_key: draft.moduleKey,
        recommendation: draft.recommendation.trim() || null,
        risk_level: draft.riskLevel,
        statement: draft.statement.trim() || null,
        status: draft.status,
        support_status: draft.supportStatus,
        title: draft.title.trim(),
      },
      p_links: draft.linkedEvidenceSourceIds.map((sourceId) => ({
        evidence_source_id: sourceId,
        relationship: relationships[sourceId] ?? "supporting",
      })),
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    reset();
    onChanged();
  }

  return (
    <div className="space-y-4">
      {editable ? (
        <form onSubmit={save} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-[var(--color-text-primary)]">{editingId ? "Edit finding" : "Add finding"}</h3>
            {editingId ? <button type="button" className={secondaryButtonClass} onClick={reset}><Plus size={16} /> New finding</button> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <FieldControl label="Title" required><input className={inputClass} required value={draft.title} onChange={(event) => update("title", event.target.value)} /></FieldControl>
            <FieldControl label="Module"><select className={inputClass} value={draft.moduleKey} onChange={(event) => update("moduleKey", event.target.value as AssessmentFindingDraft["moduleKey"])}>{findingModules.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
            <FieldControl label="Finding type"><select className={inputClass} value={draft.findingType} onChange={(event) => update("findingType", event.target.value as AssessmentFindingDraft["findingType"])}>{findingTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
            <FieldControl label="Risk"><select className={inputClass} value={draft.riskLevel} onChange={(event) => update("riskLevel", event.target.value as AssessmentFindingDraft["riskLevel"])}>{riskLevels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
            <FieldControl label="Confidence"><select className={inputClass} value={draft.confidenceLevel} onChange={(event) => update("confidenceLevel", event.target.value as AssessmentFindingDraft["confidenceLevel"])}>{evidenceConfidenceLevels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
            <FieldControl label="Support status"><select className={inputClass} value={draft.supportStatus} onChange={(event) => update("supportStatus", event.target.value as AssessmentFindingDraft["supportStatus"])}>{supportStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
            <FieldControl label="Workflow status"><select className={inputClass} value={draft.status} onChange={(event) => update("status", event.target.value as AssessmentFindingDraft["status"])}>{findingStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
            <FieldControl label="Statement" wide><textarea className={textareaClass} rows={3} value={draft.statement} onChange={(event) => update("statement", event.target.value)} /></FieldControl>
            <FieldControl label="Recommendation"><textarea className={textareaClass} rows={3} value={draft.recommendation} onChange={(event) => update("recommendation", event.target.value)} /></FieldControl>
            <FieldControl label="Assumption note"><textarea className={textareaClass} rows={3} value={draft.assumptionNote} onChange={(event) => update("assumptionNote", event.target.value)} /></FieldControl>
          </div>
          <div className="mt-3 rounded-md border border-[var(--color-border)] bg-white p-3">
            <p className="text-sm font-semibold">Evidence relationships</p>
            {sources.length === 0 ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Add evidence sources before marking a finding supported.</p> : (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {sources.map((source) => {
                  const selected = draft.linkedEvidenceSourceIds.includes(source.id);
                  return <div key={source.id} className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-2 rounded-md border border-[var(--color-border)] p-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected} onChange={(event) => toggleSource(source.id, event.target.checked)} />{source.title}</label><select className={inputClass} disabled={!selected} value={relationships[source.id] ?? "supporting"} onChange={(event) => setRelationships((current) => ({ ...current, [source.id]: event.target.value as EvidenceRelationship }))}>{evidenceRelationships.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>;
                })}
              </div>
            )}
          </div>
          {error ? <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
          <button type="submit" disabled={saving} className={`${primaryButtonClass} mt-4`}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save finding and lineage</button>
        </form>
      ) : null}

      <div className="grid gap-3">
        {findings.length === 0 ? <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-secondary)]">No findings captured yet.</p> : findings.map((finding) => {
          const linked = linksForFinding(finding.id, links);
          return <article key={finding.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex flex-wrap gap-2"><StatusPill tone={finding.risk_level === "critical" || finding.risk_level === "high" ? "danger" : "neutral"}>{riskLevelLabel(finding.risk_level)}</StatusPill><StatusPill tone={finding.support_status === "supported" ? "success" : finding.support_status === "unsupported" ? "warning" : "info"}>{finding.support_status.replaceAll("_", " ")}</StatusPill><StatusPill tone="info">{linked.length} source link{linked.length === 1 ? "" : "s"}</StatusPill></div>{editable ? <button type="button" className={secondaryButtonClass} onClick={() => edit(finding)}><Edit3 size={16} /> Edit</button> : null}</div><h3 className="mt-2 font-semibold">{finding.title}</h3>{finding.statement ? <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{finding.statement}</p> : null}</article>;
        })}
      </div>
    </div>
  );
}
