import { ArrowRight, CalendarDays, Zap } from "lucide-react";
import Link from "next/link";
import { StatusPill, cx, panelClass, secondaryButtonClass } from "@/components/ui-primitives";
import {
  PortalAssessmentRecord,
  formatPortalDate,
  getPortalNextAction,
  single,
} from "@/lib/portal-assessments";
import { statusLabel } from "@/lib/intake";

export function AssessmentList({
  assessments,
  compact = false,
  title = "Active assessments",
}: {
  assessments: PortalAssessmentRecord[];
  compact?: boolean;
  title?: string;
}) {
  return (
    <section className={cx(panelClass, "overflow-hidden")}>
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-primary)]">Work queue</p>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
        </div>
        <Link href="/intake/assessments" className={secondaryButtonClass}>
          View queue
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {assessments.map((assessment) => {
          const site = single(assessment.sites);
          const project = single(assessment.projects);
          const organisation = single(project?.organisations);
          const nextAction = getPortalNextAction(assessment);

          return (
            <article key={assessment.id} className="grid gap-3 px-4 py-4 transition hover:bg-[var(--color-surface-muted)]/70 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap gap-2">
                  <StatusPill tone={nextAction.tone}>{nextAction.label}</StatusPill>
                  <StatusPill tone="neutral">{statusLabel(assessment.status)}</StatusPill>
                  <StatusPill tone={assessment.intake_completeness_score >= 100 ? "success" : "warning"}>
                    {assessment.intake_completeness_score}% intake
                  </StatusPill>
                </div>
                <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)] sm:text-base">
                  {assessment.assessment_name}
                </h3>
                <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
                  {organisation?.name ?? "Unassigned customer"} · {site?.site_name ?? project?.name ?? "Site pending"}
                </p>
                {!compact ? (
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--color-text-secondary)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Zap className="text-[var(--color-brand-primary)]" size={15} />
                      {assessment.target_load_mw ? `${assessment.target_load_mw} MW` : "Load pending"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="text-[var(--color-brand-primary)]" size={15} />
                      {formatPortalDate(assessment.desired_energization_date)}
                    </span>
                    <span>{[assessment.known_utility, assessment.known_tsp].filter(Boolean).join(" / ") || "Grid context pending"}</span>
                  </div>
                ) : null}
              </div>
              <Link href={`/intake/assessments/${assessment.id}`} className={secondaryButtonClass}>
                Open
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

