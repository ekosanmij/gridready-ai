"use client";

import { AlertCircle, ClipboardList, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { primaryButtonClass, secondaryButtonClass, cx } from "@/components/ui-primitives";
import { AssessmentList } from "@/components/work-queue/assessment-list";
import {
  PortalAssessmentRecord,
  portalAssessmentSearchText,
} from "@/lib/portal-assessments";
import { AssessmentStatus, assessmentStatuses } from "@/lib/intake";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

const visibleStatuses = assessmentStatuses.filter((status) => status.value !== "archived");

export function AssessmentQueue() {
  const [assessments, setAssessments] = useState<PortalAssessmentRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<AssessmentStatus>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadAssessments() {
      if (!supabase) {
        setLoading(false);
        return;
      }

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
        .order("updated_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (loadError) {
        setError(loadError.message);
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

  const filteredAssessments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return assessments.filter((assessment) => {
      const matchesStatus = selectedStatuses.size === 0 || selectedStatuses.has(assessment.status);
      const matchesQuery = !normalizedQuery || portalAssessmentSearchText(assessment).includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [assessments, query, selectedStatuses]);

  function toggleStatus(status: AssessmentStatus) {
    setSelectedStatuses((current) => {
      const next = new Set(current);

      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }

      return next;
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm shadow-[var(--color-shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">Analyst queue</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">Find the next work item</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Filter by lifecycle state, search by customer/site/grid context, and open the workspace for deeper analysis.
            </p>
          </div>
          <Link href="/intake/requests/new" className={primaryButtonClass}>
            Start request
          </Link>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <span className="sr-only">Search assessments</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-9 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              placeholder="Search site, customer, county, utility, TSP"
            />
          </label>
          <Link href="/intake/workspace" className={secondaryButtonClass}>
            <ClipboardList size={16} />
            Existing console
          </Link>
        </div>

        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible">
          <button
            type="button"
            onClick={() => setSelectedStatuses(new Set())}
            className={queueFilterClass(selectedStatuses.size === 0)}
          >
            All
          </button>
          {visibleStatuses.map((status) => {
            const selected = selectedStatuses.has(status.value);

            return (
              <button
                key={status.value}
                type="button"
                onClick={() => toggleStatus(status.value)}
                className={queueFilterClass(selected)}
                aria-pressed={selected}
              >
                {status.label}
              </button>
            );
          })}
        </div>
      </section>

      {!hasSupabaseConfig ? (
        <EmptyState
          icon={<AlertCircle size={20} />}
          title="Supabase connection needed"
          description="Configure the Supabase environment variables to use the live analyst queue."
          action={<Link href="/intake/workspace" className={secondaryButtonClass}>Open existing console</Link>}
        />
      ) : error ? (
        <EmptyState
          icon={<AlertCircle size={20} />}
          title="Could not load queue"
          description={error}
          action={<Link href="/intake/workspace" className={secondaryButtonClass}>Open existing console</Link>}
        />
      ) : loading ? (
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
          Loading analyst queue
        </section>
      ) : filteredAssessments.length > 0 ? (
        <AssessmentList assessments={filteredAssessments} title={`${filteredAssessments.length} work item${filteredAssessments.length === 1 ? "" : "s"}`} />
      ) : (
        <EmptyState
          icon={<ClipboardList size={20} />}
          title={assessments.length === 0 ? "No assessments yet" : "No queue items match your filters"}
          description={
            assessments.length === 0
              ? "Start a request from the catalog to create the first analyst work item."
              : "Clear the filters or start a new request if this is new work."
          }
          action={<Link href="/intake/requests/new" className={primaryButtonClass}>Start request</Link>}
          secondaryAction={
            assessments.length > 0 ? (
              <button type="button" onClick={() => { setSelectedStatuses(new Set()); setQuery(""); }} className={secondaryButtonClass}>
                Clear filters
              </button>
            ) : null
          }
        />
      )}
    </div>
  );
}

function queueFilterClass(selected: boolean) {
  return cx(
    "inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]",
    selected
      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]"
      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]",
  );
}
