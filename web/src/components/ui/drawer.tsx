"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { secondaryButtonClass } from "@/components/ui-primitives";

export function Drawer({ children, description, onClose, open, title }: {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(<div className="fixed inset-0 z-[100] flex justify-end" role="presentation">
    <button type="button" aria-label="Close drawer" onClick={onClose} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" />
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="relative flex h-full w-full max-w-md flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4"><div><h2 id={titleId} className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>{description ? <p id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p> : null}</div><button ref={closeButtonRef} type="button" onClick={onClose} className={secondaryButtonClass} aria-label="Close drawer"><X size={16} /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
    </section>
  </div>, document.body);
}
