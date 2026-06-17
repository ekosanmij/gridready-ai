import { ReactNode } from "react";
import { cx, panelClass } from "@/components/ui-primitives";

export function EmptyState({
  action,
  description,
  icon,
  secondaryAction,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon?: ReactNode;
  secondaryAction?: ReactNode;
  title: string;
}) {
  return (
    <section className={cx(panelClass, "px-5 py-8 text-center")}>
      {icon ? (
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </section>
  );
}

