"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Painel modal: folha inferior no celular e diálogo centralizado no desktop. */
export function Sheet({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector("[data-keypad]")) closeRef.current(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 lg:items-center lg:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        className="animate-sheet-in flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] outline-none lg:max-w-[480px] lg:rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div className="min-w-0">
            <h2 id="sheet-title" className="text-xl font-semibold">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-5 text-[var(--color-muted)]">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-soft)] transition-colors hover:bg-[var(--color-border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-2">{children}</div>
        {footer ? <div className="border-t border-[var(--color-border)] px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">{footer}</div> : null}
      </div>
    </div>
  );
}
