import { ArrowRight, Clock, FileText, Layers3, MapPin, ShieldCheck, UploadCloud } from "lucide-react";
import Link from "next/link";
import { StatusPill, cx, panelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-primitives";
import { IntakeRequestType, intakeRequestTypes } from "@/lib/intake-request-types";

const requestIcons: Record<IntakeRequestType["id"], React.ReactNode> = {
  "evidence-upload": <UploadCloud size={18} />,
  "existing-assessment-update": <FileText size={18} />,
  "investor-underwriting": <ShieldCheck size={18} />,
  "portfolio-triage": <Layers3 size={18} />,
  "report-package": <FileText size={18} />,
  "single-site-screen": <MapPin size={18} />,
};

export function RequestCatalog({ featured = false }: { featured?: boolean }) {
  const visibleTypes = featured ? intakeRequestTypes.slice(0, 3) : intakeRequestTypes;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">Request catalog</p>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Start with the job, not the form</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Choose the request type first so GridReady only asks for what is relevant.
          </p>
        </div>
        {featured ? (
          <Link href="/intake/requests/new" className={secondaryButtonClass}>
            View all request types
            <ArrowRight size={16} />
          </Link>
        ) : null}
      </div>

      <div className={cx("grid gap-3", featured ? "lg:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3")}>
        {visibleTypes.map((requestType) => (
          <article key={requestType.id} className={cx(panelClass, "flex min-h-[260px] flex-col p-4")}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
                {requestIcons[requestType.id]}
              </span>
              <StatusPill tone="info">{requestType.shortLabel}</StatusPill>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{requestType.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{requestType.description}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-start gap-2 text-[var(--color-text-secondary)]">
                <Clock className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]" size={15} />
                <span>{requestType.slaLabel}</span>
              </div>
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Minimum inputs</p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                  {requestType.minimumRequirements.slice(0, 3).join(", ")}
                </p>
              </div>
            </div>
            <div className="mt-auto pt-4">
              <Link href={`/intake/requests/new/${requestType.id}`} className={primaryButtonClass}>
                Start request
                <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

