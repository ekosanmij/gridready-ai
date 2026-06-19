"use client";

import { useState } from "react";
import { Download, ExternalLink, FilePlus2, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { canAuthorReports, type AppRole } from "@/components/auth/auth-provider";
import { ReportLineagePreflight } from "@/components/assessment-workspace/report-lineage-preflight";
import { FieldControl, StatusPill, primaryButtonClass, secondaryButtonClass, textareaClass, inputClass } from "@/components/ui-primitives";
import { type AssessmentPreflightRunRecord, type AssessmentReportExportRecord, type AssessmentReportSectionRecord, type ReportClaimEvidenceLinkRecord, type ReportClaimRecord, type ReportSectionFindingLinkRecord, reportSectionStatuses } from "@/lib/report-builder";
import type { AssessmentFindingRecord, EvidenceSourceRecord } from "@/lib/evidence";
import { supabase } from "@/lib/supabase";

type Draft = { content: string; status: string };
type TemplateSection = { default_guidance: string | null; id: string; section_key: string; title: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

export function ReportAuthor({ assessmentId, assessmentName, claimLinks, claims, evidenceSources, findings, latestPreflight, marketRegion, role, sections, sectionFindingLinks, reportExport, onChanged }: {
  assessmentId: string;
  assessmentName: string;
  claimLinks: ReportClaimEvidenceLinkRecord[];
  claims: ReportClaimRecord[];
  evidenceSources: EvidenceSourceRecord[];
  findings: AssessmentFindingRecord[];
  latestPreflight: AssessmentPreflightRunRecord | null;
  marketRegion: string;
  role: AppRole;
  sections: AssessmentReportSectionRecord[];
  sectionFindingLinks: ReportSectionFindingLinkRecord[];
  reportExport: AssessmentReportExportRecord | null;
  onChanged: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [message, setMessage] = useState("");
  const editable = canAuthorReports(role);

  async function initialize() {
    if (!supabase || !editable) return;
    setInitializing(true);
    setMessage("");
    const { data: template } = await supabase.from("report_templates").select("id").eq("market_region", marketRegion).eq("report_type", "single_site").eq("is_active", true).maybeSingle();
    if (!template) {
      setMessage("No active report template is configured for this market.");
      setInitializing(false);
      return;
    }
    const { data: templateSections, error } = await supabase.from("report_template_sections").select("id, section_key, title, default_guidance").eq("template_id", template.id).order("sort_order");
    if (error) {
      setMessage(error.message);
      setInitializing(false);
      return;
    }
    const rows = ((templateSections ?? []) as TemplateSection[]).map((section) => ({
      site_assessment_id: assessmentId,
      template_section_id: section.id,
      section_key: section.section_key,
      title: section.title,
      content: section.default_guidance ? `Evidence pending.\n\nAuthor guidance: ${section.default_guidance}` : "Evidence pending.",
      generation_notes: "Initialized from the active template for analyst authoring.",
      generated_at: new Date().toISOString(),
    }));
    const { error: insertError } = await supabase.from("assessment_report_sections").upsert(rows, { onConflict: "site_assessment_id,template_section_id" });
    if (!insertError) {
      await supabase.from("assessment_report_exports").upsert({ site_assessment_id: assessmentId, template_id: template.id, export_type: "print_preview", status: "draft_generated" }, { onConflict: "site_assessment_id,template_id,export_type" });
      onChanged();
    } else setMessage(insertError.message);
    setInitializing(false);
  }

  async function save(section: AssessmentReportSectionRecord) {
    if (!supabase || !editable) return;
    const draft = drafts[section.id] ?? { content: section.content, status: section.status };
    setSavingId(section.id);
    const { error } = await supabase.from("assessment_report_sections").update({ content: draft.content, status: draft.status, is_edited: true }).eq("id", section.id);
    setSavingId(null);
    setMessage(error ? error.message : `${section.title} saved.`);
    if (!error) onChanged();
  }

  async function exportHtml() {
    const content = sections.map((section) => {
      const draft = drafts[section.id] ?? { content: section.content, status: section.status };
      return `<section><h2>${escapeHtml(section.title)}</h2><p class="status">${escapeHtml(draft.status.replaceAll("_", " "))}</p><div>${escapeHtml(draft.content).replaceAll("\n", "<br>")}</div></section>`;
    }).join("\n");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(assessmentName)}</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;color:#172033;line-height:1.55}header{border-bottom:2px solid #1b365d;margin-bottom:28px}section{break-inside:avoid;margin:28px 0}h1,h2{color:#1b365d}.status{text-transform:capitalize;color:#667085;font-size:12px}</style></head><body><header><p>GridReady AI assessment report</p><h1>${escapeHtml(assessmentName)}</h1></header>${content}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${assessmentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Draft HTML downloaded. This does not create or mark a final report artifact.");
  }

  if (sections.length === 0) {
    return <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5 text-center"><p className="text-sm text-[var(--color-text-secondary)]">No authored report sections yet.</p>{editable ? <button type="button" disabled={initializing} onClick={() => void initialize()} className={`${primaryButtonClass} mt-4`}>{initializing ? <Loader2 className="animate-spin" size={16} /> : <FilePlus2 size={16} />} Initialize report</button> : null}{message ? <p className="mt-3 text-sm text-[var(--color-danger)]">{message}</p> : null}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
        <div><StatusPill tone="info">{sections.length} sections</StatusPill><p className="mt-1 text-xs text-[var(--color-text-secondary)]">Author, review, and export without leaving the workbench.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondaryButtonClass} onClick={() => void exportHtml()}><Download size={16} /> Download draft HTML</button><Link href={`/intake/reports/${assessmentId}`} target="_blank" className={primaryButtonClass}><ExternalLink size={16} /> Draft preview</Link></div>
      </div>
      {sections.map((section) => {
        const draft = drafts[section.id] ?? { content: section.content, status: section.status };
        const allowedStatuses = section.status === "final" ? reportSectionStatuses : reportSectionStatuses.filter((status) => status.value !== "final");
        return <article key={section.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]"><FieldControl label={section.title}><textarea className={textareaClass} disabled={!editable} rows={8} value={draft.content} onChange={(event) => setDrafts((current) => ({ ...current, [section.id]: { ...draft, content: event.target.value } }))} /></FieldControl><div className="space-y-3"><FieldControl label="Status"><select className={inputClass} disabled={!editable} value={draft.status} onChange={(event) => setDrafts((current) => ({ ...current, [section.id]: { ...draft, status: event.target.value } }))}>{allowedStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></FieldControl>{editable ? <button type="button" disabled={savingId === section.id} className={`${primaryButtonClass} w-full`} onClick={() => void save(section)}>{savingId === section.id ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save section</button> : null}</div></div></article>;
      })}
      {message ? <p aria-live="polite" className="text-sm text-[var(--color-text-secondary)]">{message}</p> : null}
      <ReportLineagePreflight assessmentId={assessmentId} claimLinks={claimLinks} claims={claims} findings={findings} latestPreflight={latestPreflight} onChanged={onChanged} reportExport={reportExport} role={role} sections={sections} sectionFindingLinks={sectionFindingLinks} sources={evidenceSources} />
    </div>
  );
}
