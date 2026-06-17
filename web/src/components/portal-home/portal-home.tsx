"use client";

import { AlertCircle, ClipboardList, FileText, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequestCatalog } from "@/components/request-catalog/request-catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricTile, primaryButtonClass, secondaryButtonClass } from "@/components/ui-primitives";
import { AssessmentList } from "@/components/work-queue/assessment-list";
import { PortalAssessmentRecord } from "@/lib/portal-assessments";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export function PortalHome() {
  const [assessments, setAssessments] = useState<PortalAssessmentRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAssessments() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
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
        .limit(6);

      if (cancelled) {
        return;
      }

      if (loadError) {
        setError(loadError.message);
        setAssessments([]);
      } else {
        setAssessments((data ?? []) as PortalAssessmentRecord[]);
      }

      setLoading(false);
    }

    void loadAssessments();

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const needsInput = assessments.filter(
      (assessment) =>
        assessment.intake_completeness_score < 100 ||
        assessment.status === "draft" ||
        assessment.status === "intake_incomplete",
    ).length;
    const inReview = assessments.filter((assessment) =>
      ["in_analyst_review", "in_expert_review", "final_review"].includes(assessment.status),
    ).length;
    const reportWork = assessments.filter((assessment) => assessment.status === "report_drafting").length;

    return { inReview, needsInput, reportWork, total: assessments.length };
  }, [assessments]);

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm shadow-[var(--color-shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">Service portal</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">What do you need GridReady to assess?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Start with a request type, save a draft with minimum inputs, and let the analyst workspace handle the deeper diligence.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/intake/requests/new" className={primaryButtonClass}>
              <Plus size={16} />
              Start request
            </Link>
            <Link href="/intake/assessments" className={secondaryButtonClass}>
              <ClipboardList size={16} />
              Analyst queue
            </Link>
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm shadow-[var(--color-shadow)]">
          <div className="mb-4 flex items-center gap-2 text-[var(--color-brand-primary)]">
            <Search size={17} />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Portal search</p>
          </div>
          <label className="block">
            <span className="sr-only">Search portal</span>
            <input
              className="h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              placeholder="Search by site, customer, utility, report"
            />
          </label>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            Search is wired as a portal affordance in this slice. Full cross-record search lands with the command/search epic.
          </p>
        </aside>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon={<ClipboardList size={18} />} label="Active records" value={metrics.total.toString()} />
        <MetricTile icon={<AlertCircle size={18} />} label="Needs input" tone={metrics.needsInput > 0 ? "warning" : "success"} value={metrics.needsInput.toString()} />
        <MetricTile icon={<ClipboardList size={18} />} label="In review" tone={metrics.inReview > 0 ? "info" : "neutral"} value={metrics.inReview.toString()} />
        <MetricTile icon={<FileText size={18} />} label="Report work" tone={metrics.reportWork > 0 ? "brand" : "neutral"} value={metrics.reportWork.toString()} />
      </section>

      <RequestCatalog featured />

      {!hasSupabaseConfig ? (
        <EmptyState
          icon={<AlertCircle size={20} />}
          title="Supabase connection needed"
          description="Configure .env.local to load and create live assessments. You can still explore the request catalog and portal shell."
          action={<Link href="/intake/requests/new" className={primaryButtonClass}>Explore request types</Link>}
        />
      ) : error ? (
        <EmptyState
          icon={<AlertCircle size={20} />}
          title="Could not load assessments"
          description={error}
          action={<Link href="/intake/workspace" className={secondaryButtonClass}>Open existing console</Link>}
        />
      ) : loading ? (
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
          Loading portal records
        </section>
      ) : assessments.length > 0 ? (
        <AssessmentList assessments={assessments} compact />
      ) : (
        <EmptyState
          icon={<Plus size={20} />}
          title="No assessments yet"
          description="Start with a single-site power feasibility request. You can submit a draft with only customer, site/load, and target energization details."
          action={<Link href="/intake/requests/new/single-site-screen" className={primaryButtonClass}>Start site screen</Link>}
          secondaryAction={<Link href="/intake/workspace" className={secondaryButtonClass}>Open existing console</Link>}
        />
      )}
    </div>
  );
}

