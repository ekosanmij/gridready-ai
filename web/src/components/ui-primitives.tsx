import { AlertCircle } from "lucide-react";
import { ReactNode } from "react";

export type StatusTone = "brand" | "danger" | "info" | "neutral" | "success" | "warning";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const panelClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm shadow-[var(--color-shadow)]";
export const mutedPanelClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] shadow-sm shadow-[var(--color-shadow)]";
export const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-3 text-sm font-semibold text-[var(--color-brand-primary-contrast)] shadow-sm shadow-[var(--color-shadow)] transition hover:bg-[var(--color-brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-text-primary)] shadow-sm shadow-[var(--color-shadow)] transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-70";
export const warningButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-3 text-sm font-semibold text-[var(--color-warning)] shadow-sm shadow-[var(--color-shadow)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-70";
export const successButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--color-success)] bg-[var(--color-success)] px-3 text-sm font-semibold text-[var(--color-success-contrast)] shadow-sm shadow-[var(--color-shadow)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-70";
export const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]";
export const textareaClass =
  "w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export function statusToneClass(tone: StatusTone) {
  const styles: Record<StatusTone, string> = {
    brand: "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]",
    danger: "border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    info: "border-[var(--color-info)] bg-[var(--color-info-soft)] text-[var(--color-info)]",
    neutral: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]",
    success: "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
    warning: "border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  };

  return styles[tone];
}

export function SectionHeader({
  action,
  description,
  eyebrow,
  icon,
  title,
}: {
  action?: ReactNode;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold uppercase text-[var(--color-brand-primary)]">{eyebrow}</p> : null}
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
          {description ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function MetricTile({
  icon,
  label,
  tone = "neutral",
  value,
}: {
  icon?: ReactNode;
  label: string;
  tone?: StatusTone;
  value: string;
}) {
  return (
    <div className={cx(panelClass, "p-4")}>
      <div className="mb-3 flex items-center gap-2 text-[var(--color-text-secondary)]">
        {icon ? (
          <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg border", statusToneClass(tone))}>
            {icon}
          </span>
        ) : null}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

export function StatusPill({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: StatusTone;
}) {
  return (
    <span className={cx("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", statusToneClass(tone), className)}>
      {children}
    </span>
  );
}

export function FieldControl({
  badge,
  children,
  error,
  helpText,
  id,
  label,
  required,
  wide,
}: {
  badge?: string;
  children: ReactNode;
  error?: string;
  helpText?: string;
  id?: string;
  label: string;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label className={cx("block min-w-0", wide && "sm:col-span-2")}>
      <span className="mb-1.5 flex min-h-5 flex-wrap items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
        <span>
          {label}
          {required ? <span className="text-[var(--color-danger)]"> *</span> : null}
        </span>
        {badge ? <StatusPill tone="success">{badge}</StatusPill> : null}
      </span>
      {children}
      {helpText ? <span id={id ? `${id}-help` : undefined} className="mt-1.5 block text-xs leading-5 text-[var(--color-text-secondary)]">{helpText}</span> : null}
      {error ? (
        <span id={id ? `${id}-error` : undefined} className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-[var(--color-danger)]">
          <AlertCircle size={14} />
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function SplitPane({
  aside,
  children,
  className,
}: {
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]", className)}>
      <div className="min-w-0">{children}</div>
      {aside ? <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">{aside}</aside> : null}
    </div>
  );
}

export function DrawerSurface({
  children,
  description,
  open,
  title,
}: {
  children: ReactNode;
  description?: string;
  open: boolean;
  title: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <section className={cx(panelClass, "overflow-hidden")}>
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {description ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function WorkItemPanel({
  action,
  children,
  description,
  eyebrow,
  title,
  tone = "neutral",
}: {
  action?: ReactNode;
  children?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
  tone?: StatusTone;
}) {
  return (
    <section className={cx(panelClass, "overflow-hidden")}>
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <StatusPill tone={tone}>{eyebrow}</StatusPill> : null}
          <h3 className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
          {description ? <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="p-4">{children}</div> : null}
    </section>
  );
}

export function Timeline({
  emptyText = "No activity yet.",
  items,
}: {
  emptyText?: string;
  items: Array<{
    body?: string;
    id: string;
    meta?: string;
    title: string;
    tone?: StatusTone;
  }>;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-[var(--color-text-secondary)]">
        {emptyText}
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <span className={cx("mt-1 h-3 w-3 rounded-full border", statusToneClass(item.tone ?? "neutral"))} />
          <div className="min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
              {item.meta ? <span className="text-xs font-medium text-[var(--color-text-secondary)]">{item.meta}</span> : null}
            </div>
            {item.body ? <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-secondary)]">{item.body}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SegmentedControl<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <div>
      <p className="sr-only">{label}</p>
      <div className="flex flex-wrap gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={cx(
                "h-8 rounded px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]",
                selected
                  ? "bg-[var(--color-surface)] text-[var(--color-brand-primary)] shadow-sm shadow-[var(--color-shadow)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
