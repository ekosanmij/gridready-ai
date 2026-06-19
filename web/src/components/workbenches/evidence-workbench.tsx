"use client";

import { AlertCircle, Loader2, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, WorkItemPanel, cx, inputClass, secondaryButtonClass } from "@/components/ui-primitives";
import {
  AssessmentFindingRecord,
  EvidenceSourceRecord,
  evidenceConfidenceLabel,
  evidenceSourceTypeLabel,
  findingModuleLabel,
  findingStatusLabel,
  riskLevelLabel,
} from "@/lib/evidence";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type EvidenceAssessment = {
  assessment_name: string;
  id: string;
  status: string;
};

export function EvidenceWorkbench() {
  const [assessments, setAssessments] = useState<EvidenceAssessment[]>([]);
  const [sources, setSources] = useState<EvidenceSourceRecord[]>([]);
  const [findings, setFindings] = useState<AssessmentFindingRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEvidenceWorkbench() {
      if (!hasSupabaseConfig || !supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const [
        { data: assessmentData, error: assessmentError },
        { data: sourceData, error: sourceError },
        { data: findingData, error: findingError },
      ] = await Promise.all([
        supabase
          .from("site_assessments")
          .select("id, assessment_name, status")
          .order("updated_at", { ascending: false })
          .limit(200),
        supabase
          .from("evidence_sources")
          .select("id, site_assessment_id, title, source_type, publisher, url, file_reference, accessed_at, published_at, confidence_level, license_notes, limitation_notes, notes, authored_by, metadata_version, summary, created_at, updated_at")
          .order("updated_at", { ascending: false })
          .limit(200),
        supabase
          .from("assessment_findings")
          .select("id, site_assessment_id, module_key, title, finding_type, risk_level, confidence_level, statement, assumption_note, recommendation, status, support_status, created_at, updated_at")
          .order("updated_at", { ascending: false })
          .limit(200),
      ]);

      if (cancelled) {
        return;
      }

      if (assessmentError || sourceError || findingError) {
        setError(assessmentError?.message ?? sourceError?.message ?? findingError?.message ?? "Could not load evidence workbench.");
      } else {
        setAssessments((assessmentData ?? []) as EvidenceAssessment[]);
        setSources((sourceData ?? []) as EvidenceSourceRecord[]);
        setFindings((findingData ?? []) as AssessmentFindingRecord[]);
      }

      setLoading(false);
    }

    void loadEvidenceWorkbench();

    return () => {
      cancelled = true;
    };
  }, []);

  const assessmentById = useMemo(() => new Map(assessments.map((assessment) => [assessment.id, assessment])), [assessments]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSources = useMemo(
    () =>
      sources.filter((source) =>
        [
          source.title,
          source.summary,
          source.publisher,
          source.source_type,
          assessmentById.get(source.site_assessment_id)?.assessment_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [assessmentById, normalizedQuery, sources],
  );
  const filteredFindings = useMemo(
    () =>
      findings.filter((finding) =>
        [
          finding.title,
          finding.statement,
          finding.recommendation,
          finding.module_key,
          finding.risk_level,
          assessmentById.get(finding.site_assessment_id)?.assessment_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [assessmentById, findings, normalizedQuery],
  );
  const highRiskGaps = filteredFindings.filter((finding) => {
    const highRisk = finding.risk_level === "critical" || finding.risk_level === "high";
    return highRisk && finding.status !== "resolved";
  });

  if (!hasSupabaseConfig) {
    return (
      <EmptyState
        icon={<AlertCircle size={20} />}
        title="Supabase connection needed"
        description="Configure Supabase to use the evidence workbench."
        action={<Link href="/intake/workspace" className={secondaryButtonClass}>Open existing console</Link>}
      />
    );
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-10 text-center text-sm text-[var(--color-text-secondary)]">
        <Loader2 className="mx-auto mb-3 animate-spin text-[var(--color-brand-primary)]" size={22} />
        Loading evidence workbench
      </section>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertCircle size={20} />}
        title="Could not load evidence workbench"
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">Evidence workbench</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">Evidence, findings, and gaps</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Work across source confidence, high-risk findings, and unresolved diligence gaps.
            </p>
          </div>
          <Link href="/intake/assessments" className={secondaryButtonClass}>
            Assessment queue
          </Link>
        </div>
        <label className="relative mt-5 block">
          <span className="sr-only">Search evidence workbench</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={cx(inputClass, "pl-9")}
            placeholder="Search source, finding, module, assessment"
          />
        </label>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <WorkItemPanel title="Evidence sources" eyebrow={`${filteredSources.length} sources`} tone={filteredSources.length > 0 ? "success" : "neutral"}>
            <div className="grid gap-3">
              {filteredSources.length === 0 ? (
                <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-[var(--color-text-secondary)]">
                  No evidence sources match the current search.
                </p>
              ) : (
                filteredSources.map((source) => (
                  <Link
                    key={source.id}
                    href={`/intake/assessments/${source.site_assessment_id}?module=evidence`}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 transition hover:border-[var(--color-brand-primary)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone="info">{evidenceSourceTypeLabel(source.source_type)}</StatusPill>
                      <StatusPill tone={source.confidence_level === "high" ? "success" : source.confidence_level === "medium" ? "info" : "warning"}>
                        {evidenceConfidenceLabel(source.confidence_level)}
                      </StatusPill>
                    </div>
                    <p className="mt-2 font-semibold text-[var(--color-text-primary)]">{source.title}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{assessmentById.get(source.site_assessment_id)?.assessment_name ?? "Unknown assessment"}</p>
                  </Link>
                ))
              )}
            </div>
          </WorkItemPanel>

          <WorkItemPanel title="Findings" eyebrow={`${filteredFindings.length} findings`} tone={highRiskGaps.length > 0 ? "danger" : "info"}>
            <div className="grid gap-3">
              {filteredFindings.length === 0 ? (
                <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-[var(--color-text-secondary)]">
                  No findings match the current search.
                </p>
              ) : (
                filteredFindings.map((finding) => (
                  <Link
                    key={finding.id}
                    href={`/intake/assessments/${finding.site_assessment_id}?module=findings`}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 transition hover:border-[var(--color-brand-primary)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={finding.risk_level === "critical" || finding.risk_level === "high" ? "danger" : finding.risk_level === "medium" ? "warning" : "neutral"}>
                        {riskLevelLabel(finding.risk_level)}
                      </StatusPill>
                      <StatusPill tone="info">{findingModuleLabel(finding.module_key)}</StatusPill>
                      <StatusPill tone={finding.status === "resolved" ? "success" : finding.status === "needs_review" ? "warning" : "neutral"}>
                        {findingStatusLabel(finding.status)}
                      </StatusPill>
                    </div>
                    <p className="mt-2 font-semibold text-[var(--color-text-primary)]">{finding.title}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{assessmentById.get(finding.site_assessment_id)?.assessment_name ?? "Unknown assessment"}</p>
                  </Link>
                ))
              )}
            </div>
          </WorkItemPanel>
        </div>

        <aside className="space-y-4">
          <WorkItemPanel title="Gap queue" eyebrow={`${highRiskGaps.length} high-risk`} tone={highRiskGaps.length > 0 ? "danger" : "success"}>
            <div className="space-y-2">
              {highRiskGaps.length === 0 ? (
                <p className="rounded-md border border-[var(--color-success)] bg-[var(--color-success-soft)] px-3 py-3 text-sm font-medium text-[var(--color-success)]">
                  No unresolved high-risk findings in the current result set.
                </p>
              ) : (
                highRiskGaps.slice(0, 8).map((finding) => (
                  <Link key={finding.id} href={`/intake/assessments/${finding.site_assessment_id}?module=findings`} className="block rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{finding.title}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{riskLevelLabel(finding.risk_level)} · {assessmentById.get(finding.site_assessment_id)?.assessment_name ?? "Unknown assessment"}</p>
                  </Link>
                ))
              )}
            </div>
          </WorkItemPanel>

          <WorkItemPanel title="Workbench scope" eyebrow="Standalone module" tone="brand">
            <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <p className="flex items-center gap-2"><ShieldCheck size={16} /> Evidence source confidence and provenance</p>
              <p className="flex items-center gap-2"><AlertCircle size={16} /> Findings requiring source support</p>
              <p className="flex items-center gap-2"><Search size={16} /> Cross-assessment evidence search</p>
            </div>
          </WorkItemPanel>
        </aside>
      </div>
    </div>
  );
}
