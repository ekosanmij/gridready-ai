"use client";

import { AlertCircle, ArrowRight, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, panelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-primitives";
import {
  PortalAssessmentRecord,
  formatPortalDate,
  getPortalNextAction,
  single,
} from "@/lib/portal-assessments";
import { statusLabel } from "@/lib/intake";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export function AssessmentStatusPage({ assessmentId }: { assessmentId: string }) {
  const [assessment, setAssessment] = useState<PortalAssessmentRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAssessment() {
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
        .eq("id", assessmentId)
        .single();

      if (cancelled) {
        return;
      }

      if (loadError) {
        setError(loadError.message);
      } else {
        setAssessment(data as PortalAssessmentRecord);
      }

      setLoading(false);
    }

    void loadAssessment();

    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  if (!hasSupabaseConfig) {
    return (
      <EmptyState
        icon={<AlertCircle size={20} />}
        title="Supabase connection needed"
        description="Configure Supabase to open request status pages."
        action={<Link href="/intake/workspace" className={secondaryButtonClass}>Open existing console</Link>}
      />
    );
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
        Loading request
      </section>
    );
  }

  if (error || !assessment) {
    return (
      <EmptyState
        icon={<AlertCircle size={20} />}
        title="Request could not be loaded"
        description={error || "This request was not found."}
        action={<Link href="/intake/assessments" className={secondaryButtonClass}>Back to queue</Link>}
      />
    );
  }

  const site = single(assessment.sites);
  const project = single(assessment.projects);
  const organisation = single(project?.organisations);
  const nextAction = getPortalNextAction(assessment);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm shadow-[var(--color-shadow)]">
        <div className="grid gap-5 border-b border-[var(--color-border)] px-5 py-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusPill tone={nextAction.tone}>{nextAction.label}</StatusPill>
              <StatusPill tone="neutral">{statusLabel(assessment.status)}</StatusPill>
              <StatusPill tone={assessment.intake_completeness_score >= 100 ? "success" : "warning"}>
                {assessment.intake_completeness_score}% intake
              </StatusPill>
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">{assessment.assessment_name}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              {organisation?.name ?? "Unassigned customer"} · {project?.name ?? "No project"} · {site?.site_name ?? "No site"}
            </p>
          </div>

          <aside className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">Workspace bridge</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              This route is ready for the module-based workspace. Deep tools are still available in the existing console while the split lands.
            </p>
          </aside>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatusFact label="Target load" value={assessment.target_load_mw ? `${assessment.target_load_mw} MW` : "Not set"} />
          <StatusFact label="Energization" value={formatPortalDate(assessment.desired_energization_date)} />
          <StatusFact label="Utility" value={assessment.known_utility || "Not set"} />
          <StatusFact label="TSP" value={assessment.known_tsp || "Not set"} />
        </div>
      </section>

      <section className={panelClass}>
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Next action</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{nextAction.label}</p>
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-4">
          <Link href="/intake/workspace" className={primaryButtonClass}>
            <ClipboardList size={16} />
            Open existing console
          </Link>
          <Link href="/intake/assessments" className={secondaryButtonClass}>
            Back to queue
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function StatusFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
