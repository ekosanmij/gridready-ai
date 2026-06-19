"use client";

import { FormEvent, useState } from "react";
import { Download, Edit3, Loader2, Plus, Save, Upload } from "lucide-react";
import { canManageAssessments, type AppRole, useAuth } from "@/components/auth/auth-provider";
import { FieldControl, StatusPill, inputClass, primaryButtonClass, secondaryButtonClass, textareaClass } from "@/components/ui-primitives";
import { customerEvidenceAccept, sha256File, validateCustomerEvidenceFile } from "@/lib/customer-intake-drafts";
import { createEvidenceSourceDraft, evidenceConfidenceLevels, evidenceSourceTypes, type EvidenceSourceDraft, type EvidenceSourceRecord } from "@/lib/evidence";
import { supabase } from "@/lib/supabase";

export function EvidenceEditor({ assessmentId, role, sources, onChanged }: {
  assessmentId: string;
  role: AppRole;
  sources: EvidenceSourceRecord[];
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EvidenceSourceDraft>(createEvidenceSourceDraft());
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const canCurateEvidence = canManageAssessments(role);
  const canUpload = canCurateEvidence || role === "customer";

  function update<Key extends keyof EvidenceSourceDraft>(key: Key, value: EvidenceSourceDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function edit(source: EvidenceSourceRecord) {
    setEditingId(source.id);
    setDraft(createEvidenceSourceDraft(source));
    setFile(null);
  }

  function reset() {
    setEditingId(null);
    setDraft(createEvidenceSourceDraft());
    setFile(null);
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !canUpload || !user || (canCurateEvidence && !draft.title.trim()) || (!canCurateEvidence && !file)) return;
    setSaving(true);
    setError("");
    let fileReference = draft.fileReference.trim() || null;

    if (file) {
      const validationError = validateCustomerEvidenceFile(file);
      if (validationError) {
        setError(validationError);
        setSaving(false);
        return;
      }
      const checksumSha256 = await sha256File(file);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = canCurateEvidence
        ? `${assessmentId}/${crypto.randomUUID()}-${safeName}`
        : `${assessmentId}/customer/${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("assessment-evidence").upload(storagePath, file, { upsert: false });
      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }
      fileReference = storagePath;
      const { error: fileError } = await supabase.from("uploaded_files").insert({
        checksum_sha256: checksumSha256,
        description: draft.summary.trim() || null,
        document_category: canCurateEvidence ? "evidence" : "customer_evidence",
        file_name: file.name,
        malware_scan_status: "pending",
        mime_type: file.type || null,
        original_filename: file.name,
        processing_status: "uploaded",
        retention_state: "active",
        site_assessment_id: assessmentId,
        size_bytes: file.size,
        storage_path: storagePath,
        uploaded_by: user.id,
      });
      if (fileError) {
        await supabase.storage.from("assessment-evidence").remove([storagePath]);
        setError(fileError.message);
        setSaving(false);
        return;
      }
    }

    if (!canCurateEvidence) {
      setSaving(false);
      reset();
      onChanged();
      return;
    }

    const payload = {
      site_assessment_id: assessmentId,
      title: draft.title.trim(),
      source_type: draft.sourceType,
      publisher: draft.publisher.trim() || null,
      url: draft.url.trim() || null,
      file_reference: fileReference,
      accessed_at: draft.accessedAt || null,
      published_at: draft.publishedAt || null,
      confidence_level: draft.confidenceLevel,
      license_notes: draft.licenseNotes.trim() || null,
      limitation_notes: draft.limitationNotes.trim() || null,
      summary: draft.summary.trim() || null,
    };
    const result = editingId
      ? await supabase.from("evidence_sources").update(payload).eq("id", editingId)
      : await supabase.from("evidence_sources").insert(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    reset();
    onChanged();
  }

  async function download(source: EvidenceSourceRecord) {
    if (!source.file_reference || !supabase) return;
    const { data, error: signedError } = await supabase.storage.from("assessment-evidence").createSignedUrl(source.file_reference, 60);
    if (signedError) setError(signedError.message);
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      {canUpload ? (
        <form onSubmit={save} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-[var(--color-text-primary)]">{canCurateEvidence ? editingId ? "Edit evidence source" : "Add evidence source" : "Upload supporting file"}</h3>
            {editingId ? <button type="button" className={secondaryButtonClass} onClick={reset}><Plus size={16} /> New source</button> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {canCurateEvidence ? (
              <>
                <FieldControl label="Title" required><input className={inputClass} required value={draft.title} onChange={(event) => update("title", event.target.value)} /></FieldControl>
                <FieldControl label="Source type"><select className={inputClass} value={draft.sourceType} onChange={(event) => update("sourceType", event.target.value as EvidenceSourceDraft["sourceType"])}>{evidenceSourceTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
                <FieldControl label="Publisher"><input className={inputClass} value={draft.publisher} onChange={(event) => update("publisher", event.target.value)} /></FieldControl>
                <FieldControl label="Confidence"><select className={inputClass} value={draft.confidenceLevel} onChange={(event) => update("confidenceLevel", event.target.value as EvidenceSourceDraft["confidenceLevel"])}>{evidenceConfidenceLevels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
                <FieldControl label="Source URL"><input className={inputClass} type="url" value={draft.url} onChange={(event) => update("url", event.target.value)} /></FieldControl>
              </>
            ) : null}
            <FieldControl label="Evidence file" wide={!canCurateEvidence}><label className={`${secondaryButtonClass} w-full cursor-pointer`}><Upload size={16} />{file?.name || "Choose file"}<input accept={customerEvidenceAccept} className="sr-only" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label></FieldControl>
            <FieldControl label={canCurateEvidence ? "Summary" : "Description"} wide><textarea className={textareaClass} rows={3} value={draft.summary} onChange={(event) => update("summary", event.target.value)} /></FieldControl>
            {canCurateEvidence ? <FieldControl label="Limitations" wide><textarea className={textareaClass} rows={2} value={draft.limitationNotes} onChange={(event) => update("limitationNotes", event.target.value)} /></FieldControl> : null}
          </div>
          {error ? <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
          <button type="submit" disabled={saving || (!canCurateEvidence && !file)} className={`${primaryButtonClass} mt-4`}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} {canCurateEvidence ? "Save evidence" : "Upload file"}</button>
        </form>
      ) : null}
      <div className="grid gap-3">
        {sources.map((source) => (
          <article key={source.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><StatusPill tone={source.confidence_level === "high" ? "success" : "info"}>{source.confidence_level}</StatusPill><h3 className="mt-2 font-semibold text-[var(--color-text-primary)]">{source.title}</h3></div>
              <div className="flex gap-2">{source.file_reference ? <button type="button" className={secondaryButtonClass} onClick={() => void download(source)}><Download size={16} /> File</button> : null}{canCurateEvidence ? <button type="button" className={secondaryButtonClass} onClick={() => edit(source)}><Edit3 size={16} /> Edit</button> : null}</div>
            </div>
            {source.summary ? <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{source.summary}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
