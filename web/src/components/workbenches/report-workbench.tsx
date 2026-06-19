"use client";

import { AlertCircle, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, WorkItemPanel, cx, inputClass, secondaryButtonClass } from "@/components/ui-primitives";
import {
  AssessmentReportExportRecord,
  AssessmentReportSectionRecord,
  reportExportStatusLabel,
  reportSectionStatusLabel,
} from "@/lib/report-builder";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type ReportAssessment = {
  assessment_name: string;
  id: string;
  status: string;
};

export function ReportWorkbench() {
  const [assessments, setAssessments] = useState<ReportAssessment[]>([]);
  const [sections, setSections] = useState<AssessmentReportSectionRecord[]>([]);
  const [exports, setExports] = useState<AssessmentReportExportRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      if (!hasSupabaseConfig || !supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const [
        { data: assessmentData, error: assessmentError },
        { data: sectionData, error: sectionError },
        { data: exportData, error: exportError },
      ] = await Promise.all([
        supabase
          .from("site_assessments")
          .select("id, assessment_name, status")
          .order("updated_at", { ascending: false })
          .limit(200),
        supabase
          .from("assessment_report_sections")
          .select("id, site_assessment_id, template_section_id, section_key, title, content, status, is_edited, generated_at, generation_notes, updated_at")
          .order("updated_at", { ascending: false })
          .limit(200),
        supabase
          .from("assessment_report_exports")
          .select("id, site_assessment_id, template_id, export_type, status, notes, ready_for_review_at, version_number, finalized_at, finalization_snapshot, updated_at")
          .order("updated_at", { ascending: false })
          .limit(200),
      ]);

      if (cancelled) {
        return;
      }

      if (assessmentError || sectionError || exportError) {
        setError(assessmentError?.message ?? sectionError?.message ?? exportError?.message ?? "Could not load report workbench.");
      } else {
        setAssessments((assessmentData ?? []) as ReportAssessment[]);
        setSections((sectionData ?? []) as AssessmentReportSectionRecord[]);
        setExports((exportData ?? []) as AssessmentReportExportRecord[]);
      }

      setLoading(false);
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, []);

  const assessmentById = useMemo(() => new Map(assessments.map((assessment) => [assessment.id, assessment])), [assessments]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSections = useMemo(
    () =>
      sections.filter((section) =>
        [
          section.title,
          section.section_key,
          section.status,
          section.content,
          section.generation_notes,
          assessmentById.get(section.site_assessment_id)?.assessment_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [assessmentById, normalizedQuery, sections],
  );
  const filteredExports = useMemo(
    () =>
      exports.filter((reportExport) =>
        [
          reportExport.status,
          reportExport.export_type,
          reportExport.notes,
          assessmentById.get(reportExport.site_assessment_id)?.assessment_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [assessmentById, exports, normalizedQuery],
  );
  const readyPackages = filteredExports.filter((reportExport) => reportExport.status === "ready_for_review" || reportExport.status === "exported");

  if (!hasSupabaseConfig) {
    return (
      <EmptyState
        icon={<AlertCircle size={20} />}
        title="Supabase connection needed"
        description="Configure Supabase to use the report workbench."
        action={<Link href="/intake/workspace" className={secondaryButtonClass}>Open existing console</Link>}
      />
    );
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-10 text-center text-sm text-[var(--color-text-secondary)]">
        <Loader2 className="mx-auto mb-3 animate-spin text-[var(--color-brand-primary)]" size={22} />
        Loading report workbench
      </section>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertCircle size={20} />}
        title="Could not load report workbench"
        description={error}
        action={<Link href="/intake/workspace" className={secondaryButtonClass}>Open existing console</Link>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm shadow-[var(--color-shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">Report workbench</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">Report packages and sections</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Track report package readiness, section status, and review queues across assessments.
            </p>
          </div>
          <Link href="/intake/assessments" className={secondaryButtonClass}>
            Assessment queue
          </Link>
        </div>
        <label className="relative mt-5 block">
          <span className="sr-only">Search reports</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={cx(inputClass, "pl-9")}
            placeholder="Search report section, package, assessment"
          />
        </label>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <WorkItemPanel title="Package queue" eyebrow={`${filteredExports.length} packages`} tone={readyPackages.length > 0 ? "success" : "info"}>
            <div className="space-y-2">
              {filteredExports.length === 0 ? (
                <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-4 text-sm text-[var(--color-text-secondary)]">
                  No report packages match the current search.
                </p>
              ) : (
                filteredExports.map((reportExport) => (
                  <Link key={reportExport.id} href={`/intake/reports/${reportExport.site_assessment_id}`} className="block rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
                    <StatusPill tone={reportExport.status === "ready_for_review" || reportExport.status === "exported" ? "success" : "info"}>
                      {reportExportStatusLabel(reportExport.status)}
                    </StatusPill>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{assessmentById.get(reportExport.site_assessment_id)?.assessment_name ?? "Unknown assessment"}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{reportExport.export_type}</p>
                  </Link>
                ))
              )}
            </div>
          </WorkItemPanel>

          <WorkItemPanel title="Ready for review" eyebrow={`${readyPackages.length} ready`} tone={readyPackages.length > 0 ? "success" : "neutral"}>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              Packages marked ready or exported appear here so reviewers can move without opening each assessment first.
            </p>
          </WorkItemPanel>
        </aside>

        <WorkItemPanel title="Report sections" eyebrow={`${filteredSections.length} sections`} tone="brand">
          <div className="grid gap-3">
            {filteredSections.length === 0 ? (
              <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-[var(--color-text-secondary)]">
                No report sections match the current search.
              </p>
            ) : (
              filteredSections.map((section) => (
                <Link
                  key={section.id}
                  href={`/intake/reports/${section.site_assessment_id}`}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 transition hover:border-[var(--color-brand-primary)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={section.status === "final" || section.status === "ready" ? "success" : section.status === "needs_review" ? "warning" : "neutral"}>
                      {reportSectionStatusLabel(section.status)}
                    </StatusPill>
                    {section.is_edited ? <StatusPill tone="brand">Edited</StatusPill> : null}
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      {assessmentById.get(section.site_assessment_id)?.assessment_name ?? "Unknown assessment"}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold text-[var(--color-text-primary)]">{section.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {section.content || section.generation_notes || "No content saved."}
                  </p>
                </Link>
              ))
            )}
          </div>
        </WorkItemPanel>
      </div>
    </div>
  );
}
