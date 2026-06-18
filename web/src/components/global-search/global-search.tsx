"use client";

import { FileText, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { cx, StatusPill } from "@/components/ui-primitives";
import { portalAssessmentSearchText, PortalAssessmentRecord, single } from "@/lib/portal-assessments";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type GlobalSearchResult = {
  eyebrow: string;
  href: string;
  id: string;
  subtitle: string;
  title: string;
  type: "assessment" | "evidence" | "finding" | "report";
};

type SearchAssessmentRecord = PortalAssessmentRecord & {
  projects?: Array<{ name: string; organisations?: Array<{ name: string }> | { name: string } | null }> | { name: string; organisations?: Array<{ name: string }> | { name: string } | null } | null;
};

type SearchEvidenceRecord = {
  confidence_level: string;
  id: string;
  publisher: string | null;
  site_assessment_id: string;
  source_type: string;
  summary: string | null;
  title: string;
};

type SearchFindingRecord = {
  id: string;
  module_key: string;
  risk_level: string;
  site_assessment_id: string;
  statement: string | null;
  status: string;
  title: string;
};

type SearchReportRecord = {
  id: string;
  section_key: string;
  site_assessment_id: string;
  status: string;
  title: string;
};

export function GlobalSearch({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setFocused(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (normalizedQuery.length < 2) {
        setResults([]);
        setError("");
        setLoading(false);
        return;
      }

      if (!hasSupabaseConfig || !supabase) {
        setResults([]);
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const pattern = `%${normalizedQuery.replace(/[%,]/g, " ")}%`;

      try {
        const [
          { data: assessmentData, error: assessmentError },
          { data: evidenceData, error: evidenceError },
          { data: findingData, error: findingError },
          { data: reportData, error: reportError },
        ] = await Promise.all([
          supabase
            .from("site_assessments")
            .select(`
              id,
              assessment_name,
              market_region,
              status,
              target_load_mw,
              desired_energization_date,
              intake_completeness_score,
              known_utility,
              known_tsp,
              updated_at,
              sites (site_name, address, city, county, state),
              projects (
                name,
                organisations (name)
              )
            `)
            .order("updated_at", { ascending: false })
            .limit(100),
          supabase
            .from("evidence_sources")
            .select("id, site_assessment_id, title, source_type, publisher, summary, confidence_level")
            .or(`title.ilike.${pattern},summary.ilike.${pattern},publisher.ilike.${pattern},file_reference.ilike.${pattern}`)
            .limit(20),
          supabase
            .from("assessment_findings")
            .select("id, site_assessment_id, module_key, title, risk_level, statement, status")
            .or(`title.ilike.${pattern},statement.ilike.${pattern},recommendation.ilike.${pattern},assumption_note.ilike.${pattern}`)
            .limit(20),
          supabase
            .from("assessment_report_sections")
            .select("id, site_assessment_id, section_key, title, status")
            .or(`title.ilike.${pattern},content.ilike.${pattern},generation_notes.ilike.${pattern}`)
            .limit(20),
        ]);

        if (cancelled) {
          return;
        }

        if (assessmentError || evidenceError || findingError || reportError) {
          throw assessmentError ?? evidenceError ?? findingError ?? reportError;
        }

        const assessments = ((assessmentData ?? []) as SearchAssessmentRecord[])
          .filter((assessment) => portalAssessmentSearchText(assessment).includes(normalizedQuery))
          .slice(0, 8)
          .map((assessment) => {
            const site = single(assessment.sites);
            const project = single(assessment.projects);
            const organisation = single(project?.organisations);

            return {
              eyebrow: "Request",
              href: `/intake/assessments/${assessment.id}`,
              id: `assessment-${assessment.id}`,
              subtitle: [organisation?.name, site?.site_name, assessment.known_utility].filter(Boolean).join(" · ") || assessment.status,
              title: assessment.assessment_name,
              type: "assessment" as const,
            };
          });
        const assessmentNames = new Map<string, string>(
          ((assessmentData ?? []) as SearchAssessmentRecord[]).map((assessment) => [assessment.id, assessment.assessment_name]),
        );

        const evidence = ((evidenceData ?? []) as SearchEvidenceRecord[]).map((source) => ({
          eyebrow: "Evidence",
          href: `/intake/assessments/${source.site_assessment_id}?module=evidence`,
          id: `evidence-${source.id}`,
          subtitle: [assessmentNames.get(source.site_assessment_id), source.source_type, source.confidence_level].filter(Boolean).join(" · "),
          title: source.title,
          type: "evidence" as const,
        }));
        const findings = ((findingData ?? []) as SearchFindingRecord[]).map((finding) => ({
          eyebrow: "Finding",
          href: `/intake/assessments/${finding.site_assessment_id}?module=findings`,
          id: `finding-${finding.id}`,
          subtitle: [assessmentNames.get(finding.site_assessment_id), finding.module_key, finding.risk_level, finding.status].filter(Boolean).join(" · "),
          title: finding.title,
          type: "finding" as const,
        }));
        const reports = ((reportData ?? []) as SearchReportRecord[]).map((section) => ({
          eyebrow: "Report",
          href: `/intake/reports/${section.site_assessment_id}`,
          id: `report-${section.id}`,
          subtitle: [assessmentNames.get(section.site_assessment_id), section.section_key, section.status].filter(Boolean).join(" · "),
          title: section.title,
          type: "report" as const,
        }));

        setResults([...assessments, ...evidence, ...findings, ...reports].slice(0, 16));
      } catch (searchError) {
        if (!cancelled) {
          setResults([]);
          setError(searchError instanceof Error ? searchError.message : "Search failed.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const timeout = window.setTimeout(() => {
      void runSearch();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [normalizedQuery]);

  const visible = focused && (query.trim().length > 0 || results.length > 0 || error);
  const groupedResults = useMemo(
    () =>
      results.reduce<Record<GlobalSearchResult["type"], GlobalSearchResult[]>>(
        (groups, result) => {
          groups[result.type].push(result);
          return groups;
        },
        { assessment: [], evidence: [], finding: [], report: [] },
      ),
    [results],
  );

  return (
    <div ref={containerRef} className={cx("relative min-w-[260px] flex-1", className)}>
      <label className="relative block">
        <span className="sr-only">Search portal</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          className="h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-9 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          placeholder="Search requests, evidence, findings, reports"
        />
        {loading ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-text-secondary)]" size={16} /> : null}
      </label>

      {visible ? (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(680px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-xl shadow-[var(--color-shadow)]">
          {query.trim().length < 2 ? (
            <div className="rounded-md bg-[var(--color-surface-muted)] px-3 py-4 text-sm text-[var(--color-text-secondary)]">
              Type at least 2 characters to search the portal.
            </div>
          ) : error ? (
            <div className="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-3 text-sm font-medium text-[var(--color-danger)]">
              {error}
            </div>
          ) : !loading && results.length === 0 ? (
            <div className="rounded-md bg-[var(--color-surface-muted)] px-3 py-4 text-sm text-[var(--color-text-secondary)]">
              No matching requests, evidence, findings, or report sections.
            </div>
          ) : (
            <div className="space-y-2">
              <ResultGroup icon={<Sparkles size={15} />} label="Requests" results={groupedResults.assessment} />
              <ResultGroup icon={<ShieldCheck size={15} />} label="Evidence" results={groupedResults.evidence} />
              <ResultGroup icon={<Search size={15} />} label="Findings" results={groupedResults.finding} />
              <ResultGroup icon={<FileText size={15} />} label="Reports" results={groupedResults.report} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ResultGroup({ icon, label, results }: { icon: ReactNode; label: string; results: GlobalSearchResult[] }) {
  if (results.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {icon}
        {label}
      </div>
      <div className="space-y-1">
        {results.map((result) => (
          <Link
            key={result.id}
            href={result.href}
            className="block rounded-md px-3 py-2 transition hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{result.title}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{result.subtitle || "Open record"}</p>
              </div>
              <StatusPill tone={result.type === "assessment" ? "brand" : result.type === "evidence" ? "success" : result.type === "finding" ? "warning" : "info"}>
                {result.eyebrow}
              </StatusPill>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
