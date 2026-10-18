import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]";
export const primaryButton = `inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-base font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-pressed)] disabled:opacity-50 ${focusRing}`;
export const inkButton = `inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-base font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-pressed)] disabled:bg-[var(--color-soft)] disabled:text-[var(--color-placeholder)] disabled:opacity-100 ${focusRing}`;
export const outlineButton = `inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-[var(--color-ink)] bg-white px-6 text-base font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-soft)] disabled:opacity-50 ${focusRing}`;
export const softButton = `inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[var(--color-soft)] px-6 text-base font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] disabled:opacity-50 ${focusRing}`;
export const textButton = `inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--color-link)] underline-offset-4 transition-colors hover:bg-[var(--color-soft)] disabled:opacity-50 ${focusRing}`;
export const dangerButton = `inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error-soft)] disabled:opacity-50 ${focusRing}`;
export const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 text-base outline-none transition-colors focus:border-[var(--color-action)] focus:ring-2 focus:ring-[var(--color-action-soft)] disabled:opacity-50";
export const labelClass = "block text-sm font-medium text-[var(--color-text)]";

export function Card({ className = "", children, ...props }: ComponentProps<"section">) {
  const background = /(^|s)bg-/.test(className) ? "" : "bg-white";
  return <section className={`min-w-0 rounded-[20px] p-5 shadow-[var(--shadow-card)] sm:p-6 ${background} ${className}`} {...props}>{children}</section>;
}

/** Cartão inteiro clicável com título e seta, no padrão dos atalhos da tela inicial. */
export function TileLink({
  href,
  title,
  children,
  className = "",
}: {
  href: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`group flex min-w-0 flex-col rounded-[20px] bg-white p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_12px_32px_rgba(0,0,0,0.08)] ${focusRing} ${className}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold">{title}</span>
        <ChevronRight size={18} className="shrink-0 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
      {children}
    </Link>
  );
}

export function SectionHeader({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
      <h2 id={id} className="text-xl font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
  tone = "light",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  tone?: "light" | "inverse";
}) {
  const container = tone === "inverse" ? "bg-white/15" : "bg-[var(--color-soft)]";
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-full p-1 ${container} ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        const state = tone === "inverse"
          ? active ? "bg-white text-[var(--color-text)]" : "text-white/85 hover:text-white"
          : active ? "bg-white text-[var(--color-text)] shadow-[0_1px_4px_rgba(0,0,0,0.08)]" : "text-[var(--color-muted)] hover:text-[var(--color-text)]";
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`min-h-10 flex-1 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${focusRing} ${state}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Meter({ value, level = "ok", label }: { value: number; level?: "ok" | "warning" | "over"; label: string }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = level === "over" ? "bg-[var(--color-error)]" : level === "warning" ? "bg-[var(--color-warning-fill)]" : "bg-[var(--color-action)]";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-soft)]" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
