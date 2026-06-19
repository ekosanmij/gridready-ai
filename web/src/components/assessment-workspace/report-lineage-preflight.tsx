"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Edit3, Loader2, Plus, Save, ShieldCheck } from "lucide-react";
import { canAuthorReports, type AppRole, useAuth } from "@/components/auth/auth-provider";
import { FieldControl, StatusPill, inputClass, primaryButtonClass, secondaryButtonClass, textareaClass } from "@/components/ui-primitives";
import { evidenceConfidenceLevels, evidenceRelationships, supportStatuses, type AssessmentFindingRecord, type EvidenceRelationship, type EvidenceSourceRecord } from "@/lib/evidence";
import {
  type AssessmentPreflightRunRecord,
  type AssessmentReportExportRecord,
  type AssessmentReportSectionRecord,
  type ReportClaimEvidenceLinkRecord,
  type ReportClaimRecord,
  type ReportSectionFindingLinkRecord,
  formatEvidenceCitation,
} from "@/lib/report-builder";
import { supabase } from "@/lib/supabase";

type ClaimDraft = {
  claimText: string;
  confidenceLevel: ReportClaimRecord["confidence_level"];
  isMaterial: boolean;
  rationale: string;
  reportSectionId: string;
  supportStatus: ReportClaimRecord["support_status"];
};

function blankClaim(sectionId = ""): ClaimDraft {
  return { claimText: "", confidenceLevel: "unknown", isMaterial: true, rationale: "", reportSectionId: sectionId, supportStatus: "unsupported" };
}

export function ReportLineagePreflight({
  assessmentId,
  claimLinks,
  claims,
  findings,
  latestPreflight,
  onChanged,
  reportExport,
  role,
  sections,
  sectionFindingLinks,
  sources,
}: {
  assessmentId: string;
  claimLinks: ReportClaimEvidenceLinkRecord[];
  claims: ReportClaimRecord[];
  findings: AssessmentFindingRecord[];
  latestPreflight: AssessmentPreflightRunRecord | null;
  onChanged: () => void;
  reportExport: AssessmentReportExportRecord | null;
  role: AppRole;
  sections: AssessmentReportSectionRecord[];
  sectionFindingLinks: ReportSectionFindingLinkRecord[];
  sources: EvidenceSourceRecord[];
}) {
  const editable = canAuthorReports(role);
  const { user } = useAuth();
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<ClaimDraft>(() => blankClaim(sections[0]?.id));
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [relationships, setRelationships] = useState<Record<string, EvidenceRelationship>>({});
  const [locators, setLocators] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingClaim, setSavingClaim] = useState(false);
  const [runningPreflight, setRunningPreflight] = useState(false);
  const [preflight, setPreflight] = useState(latestPreflight);
  const [exceptionKey, setExceptionKey] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [approvingException, setApprovingException] = useState(false);
  const [findingSectionId, setFindingSectionId] = useState(sections[0]?.id ?? "");
  const [findingId, setFindingId] = useState("");
  const [findingRelationship, setFindingRelationship] = useState<ReportSectionFindingLinkRecord["relationship"]>("supports_section");

  function resetClaim() {
    setEditingId("");
    setDraft(blankClaim(sections[0]?.id));
    setSelectedSourceIds([]);
    setRelationships({});
    setLocators({});
    setError("");
  }

  function editClaim(claim: ReportClaimRecord) {
    const links = claimLinks.filter((link) => link.report_claim_id === claim.id);
    setEditingId(claim.id);
    setDraft({ claimText: claim.claim_text, confidenceLevel: claim.confidence_level, isMaterial: claim.is_material, rationale: claim.rationale ?? "", reportSectionId: claim.report_section_id, supportStatus: claim.support_status });
    setSelectedSourceIds(links.map((link) => link.evidence_source_id));
    setRelationships(Object.fromEntries(links.map((link) => [link.evidence_source_id, link.relationship])));
    setLocators(Object.fromEntries(links.map((link) => [link.evidence_source_id, link.citation_locator ?? ""])));
    setError("");
  }

  function toggleSource(sourceId: string, checked: boolean) {
    setSelectedSourceIds((current) => checked ? [...current, sourceId] : current.filter((id) => id !== sourceId));
    if (checked) setRelationships((current) => ({ ...current, [sourceId]: current[sourceId] ?? "supporting" }));
  }

  async function saveClaim(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editable) return;
    if (!draft.reportSectionId || !draft.claimText.trim()) {
      setError("Select a report section and enter the claim.");
      return;
    }
    const selectedRelationships = selectedSourceIds.map((id) => relationships[id] ?? "supporting");
    if (["supported", "mixed"].includes(draft.supportStatus) && !selectedRelationships.includes("supporting")) {
      setError("Supported or mixed claims require supporting evidence.");
      return;
    }
    if (["contradicted", "mixed"].includes(draft.supportStatus) && !selectedRelationships.includes("contradicting")) {
      setError("Contradicted or mixed claims require contradictory evidence.");
      return;
    }

    setSavingClaim(true);
    setError("");
    const { error: saveError } = await supabase.rpc("save_report_claim", {
      p_assessment_id: assessmentId,
      p_claim: {
        claim_text: draft.claimText.trim(),
        confidence_level: draft.confidenceLevel,
        id: editingId || null,
        is_material: draft.isMaterial,
        rationale: draft.rationale.trim() || null,
        report_section_id: draft.reportSectionId,
        support_status: draft.supportStatus,
      },
      p_links: selectedSourceIds.map((sourceId) => ({ citation_locator: locators[sourceId]?.trim() || null, evidence_source_id: sourceId, relationship: relationships[sourceId] ?? "supporting" })),
    });
    setSavingClaim(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setMessage("Report claim and evidence snapshot saved.");
    resetClaim();
    onChanged();
  }

  async function runPreflight(finalize: boolean) {
    if (!supabase || !editable) return;
    setRunningPreflight(true);
    setError("");
    setMessage("");
    if (finalize) {
      const { data, error: runError } = await supabase.rpc("finalize_assessment_report", { p_assessment_id: assessmentId, p_export_id: reportExport?.id ?? null });
      setRunningPreflight(false);
      if (runError) {
        setError(runError.message);
        return;
      }
      const result = data as { finalized: boolean; preflight: AssessmentPreflightRunRecord };
      setPreflight(result.preflight);
      setMessage(result.finalized ? "Preflight passed. The report is finalized and ready for review." : "Preflight saved with blockers; the report was not finalized.");
      if (result.finalized) onChanged();
      return;
    }

    const { data, error: runError } = await supabase.rpc("run_assessment_preflight", { p_assessment_id: assessmentId, p_purpose: "review" }).single();
    setRunningPreflight(false);
    if (runError) {
      setError(runError.message);
      return;
    }
    setPreflight(data as AssessmentPreflightRunRecord);
    setMessage("Preflight result saved for audit.");
    onChanged();
  }

  async function approveException(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !["admin", "reviewer"].includes(role)) return;
    if (!exceptionKey || exceptionReason.trim().length < 10) {
      setError("Select a blocker and provide a substantive exception reason.");
      return;
    }
    setApprovingException(true);
    const { error: approvalError } = await supabase.rpc("approve_delivery_exception", { p_assessment_id: assessmentId, p_blocker_key: exceptionKey, p_expires_at: null, p_reason: exceptionReason.trim() });
    setApprovingException(false);
    if (approvalError) {
      setError(approvalError.message);
      return;
    }
    setExceptionKey("");
    setExceptionReason("");
    setMessage("Exception approved. Run preflight again to apply it.");
  }

  async function linkFinding(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editable || !findingSectionId || !findingId) return;
    const { error: linkError } = await supabase.from("report_section_finding_links").upsert({
      finding_id: findingId,
      linked_by: user?.id ?? null,
      relationship: findingRelationship,
      report_section_id: findingSectionId,
    }, { onConflict: "report_section_id,finding_id" });
    if (linkError) {
      setError(linkError.message);
      return;
    }
    setFindingId("");
    setMessage("Finding linked to the report section.");
    onChanged();
  }

  async function insertClaimCitations(claim: ReportClaimRecord) {
    if (!supabase || !editable) return;
    const section = sections.find((item) => item.id === claim.report_section_id);
    if (!section) return;
    if (section.status === "final") {
      setError("Final report sections are locked. Return the report to drafting before changing citations.");
      return;
    }
    const linkedSourceIds = new Set(claimLinks.filter((link) => link.report_claim_id === claim.id).map((link) => link.evidence_source_id));
    const citations = sources.filter((source) => linkedSourceIds.has(source.id)).map(formatEvidenceCitation);
    if (citations.length === 0) {
      setError("Link evidence to this claim before inserting citations.");
      return;
    }
    const citationBlock = citations.map((citation) => `[Source: ${citation}]`).join("\n");
    const nextContent = section.content.includes(citationBlock) ? section.content : `${section.content.trim()}\n\n${citationBlock}`.trim();
    const { error: citationError } = await supabase.from("assessment_report_sections").update({ content: nextContent, is_edited: true, status: "draft" }).eq("id", section.id);
    if (citationError) {
      setError(citationError.message);
      return;
    }
    setMessage("Linked evidence citations inserted into the report section.");
    onChanged();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Material claim lineage</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Link report claims to exact evidence snapshots before finalization.</p></div><StatusPill tone={claims.some((claim) => claim.is_material && claim.support_status === "unsupported") ? "warning" : "success"}>{claims.length} claim{claims.length === 1 ? "" : "s"}</StatusPill></div>
        {editable ? <form onSubmit={saveClaim} className="mt-4 rounded-md border border-[var(--color-border)] bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-semibold">{editingId ? "Edit claim" : "Add material claim"}</p>{editingId ? <button type="button" className={secondaryButtonClass} onClick={resetClaim}><Plus size={16} /> New claim</button> : null}</div>
          <div className="grid gap-3 md:grid-cols-3">
            <FieldControl label="Report section"><select className={inputClass} required value={draft.reportSectionId} onChange={(event) => setDraft((current) => ({ ...current, reportSectionId: event.target.value }))}><option value="">Select section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></FieldControl>
            <FieldControl label="Support status"><select className={inputClass} value={draft.supportStatus} onChange={(event) => setDraft((current) => ({ ...current, supportStatus: event.target.value as ClaimDraft["supportStatus"] }))}>{supportStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
            <FieldControl label="Confidence"><select className={inputClass} value={draft.confidenceLevel} onChange={(event) => setDraft((current) => ({ ...current, confidenceLevel: event.target.value as ClaimDraft["confidenceLevel"] }))}>{evidenceConfidenceLevels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldControl>
            <FieldControl label="Claim" wide><textarea className={textareaClass} required rows={3} value={draft.claimText} onChange={(event) => setDraft((current) => ({ ...current, claimText: event.target.value }))} /></FieldControl>
            <FieldControl label="Lineage rationale"><textarea className={textareaClass} rows={3} value={draft.rationale} onChange={(event) => setDraft((current) => ({ ...current, rationale: event.target.value }))} /></FieldControl>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.isMaterial} onChange={(event) => setDraft((current) => ({ ...current, isMaterial: event.target.checked }))} />Material claim</label>
          </div>
          <div className="mt-3 grid gap-2">{sources.map((source) => { const selected = selectedSourceIds.includes(source.id); return <div key={source.id} className="grid gap-2 rounded-md border border-[var(--color-border)] p-2 md:grid-cols-[minmax(0,1fr)_150px_180px]"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected} onChange={(event) => toggleSource(source.id, event.target.checked)} />{source.title}</label><select className={inputClass} disabled={!selected} value={relationships[source.id] ?? "supporting"} onChange={(event) => setRelationships((current) => ({ ...current, [source.id]: event.target.value as EvidenceRelationship }))}>{evidenceRelationships.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><input className={inputClass} disabled={!selected} placeholder="Page / section locator" value={locators[source.id] ?? ""} onChange={(event) => setLocators((current) => ({ ...current, [source.id]: event.target.value }))} /></div>; })}</div>
          <button type="submit" disabled={savingClaim} className={`${primaryButtonClass} mt-3`}>{savingClaim ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save claim lineage</button>
        </form> : null}
        <div className="mt-3 grid gap-2">{claims.map((claim) => <article key={claim.id} className="rounded-md border border-[var(--color-border)] bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2"><StatusPill tone={claim.support_status === "supported" ? "success" : claim.is_material ? "warning" : "neutral"}>{claim.support_status.replaceAll("_", " ")}</StatusPill>{claim.is_material ? <StatusPill tone="info">material</StatusPill> : null}</div>{editable ? <div className="flex flex-wrap gap-2"><button type="button" className={secondaryButtonClass} onClick={() => void insertClaimCitations(claim)}><Plus size={16} /> Insert citations</button><button type="button" className={secondaryButtonClass} onClick={() => editClaim(claim)}><Edit3 size={16} /> Edit</button></div> : null}</div><p className="mt-2 text-sm leading-6">{claim.claim_text}</p></article>)}</div>
        {editable ? <form onSubmit={linkFinding} className="mt-4 grid gap-3 rounded-md border border-[var(--color-border)] bg-white p-3 md:grid-cols-3"><FieldControl label="Report section"><select className={inputClass} value={findingSectionId} onChange={(event) => setFindingSectionId(event.target.value)}>{sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></FieldControl><FieldControl label="Finding"><select className={inputClass} value={findingId} onChange={(event) => setFindingId(event.target.value)}><option value="">Select finding</option>{findings.map((finding) => <option key={finding.id} value={finding.id}>{finding.title}</option>)}</select></FieldControl><FieldControl label="Relationship"><select className={inputClass} value={findingRelationship} onChange={(event) => setFindingRelationship(event.target.value as ReportSectionFindingLinkRecord["relationship"])}><option value="supports_section">Supports section</option><option value="contradicts_section">Contradicts section</option><option value="context">Context</option></select></FieldControl><button type="submit" className={secondaryButtonClass}><Plus size={16} /> Link finding to section</button></form> : null}
        {sectionFindingLinks.length ? <p className="mt-3 text-xs text-[var(--color-text-secondary)]">{sectionFindingLinks.length} direct finding-to-section link{sectionFindingLinks.length === 1 ? "" : "s"} recorded.</p> : null}
      </section>

      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Server preflight</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Required sections, evidence, critical gaps, scoring, verdict, review and limitations are checked on the server.</p></div>{preflight ? <StatusPill tone={preflight.status === "passed" ? "success" : "danger"}>{preflight.status}</StatusPill> : <StatusPill tone="neutral">not run</StatusPill>}</div>
        {preflight?.blockers.length ? <div className="mt-3 space-y-2">{preflight.blockers.map((blocker) => <div key={blocker.key} className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950"><p className="font-semibold">{blocker.label}</p>{blocker.detail ? <p className="mt-1">{blocker.detail}</p> : null}{blocker.remediation ? <p className="mt-1">{blocker.remediation}</p> : null}</div>)}</div> : preflight ? <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 size={16} /> No unresolved blockers.</p> : null}
        {preflight?.bypassed_blockers.length ? <p className="mt-3 text-sm text-amber-800">{preflight.bypassed_blockers.length} blocker(s) bypassed by approved exception and retained in the audit snapshot.</p> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}{message ? <p aria-live="polite" className="mt-3 text-sm text-[var(--color-text-secondary)]">{message}</p> : null}
        {editable ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={runningPreflight} className={secondaryButtonClass} onClick={() => void runPreflight(false)}>{runningPreflight ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Run preflight</button><button type="button" disabled={runningPreflight || !reportExport} className={primaryButtonClass} onClick={() => void runPreflight(true)}><CheckCircle2 size={16} /> Finalize for review</button></div> : null}
        {["admin", "reviewer"].includes(role) && preflight?.blockers.length ? <form onSubmit={approveException} className="mt-4 grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"><FieldControl label="Blocker"><select className={inputClass} value={exceptionKey} onChange={(event) => setExceptionKey(event.target.value)}><option value="">Select blocker</option>{preflight.blockers.map((blocker) => <option key={blocker.key} value={blocker.key}>{blocker.label}</option>)}</select></FieldControl><FieldControl label="Exception reason"><input className={inputClass} value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} /></FieldControl><button type="submit" disabled={approvingException} className={`${secondaryButtonClass} self-end`}>{approvingException ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Approve exception</button></form> : null}
      </section>
    </div>
  );
}
