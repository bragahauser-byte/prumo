import type { DisplayStatus } from "@/domain/planning";

const statusStyles: Record<DisplayStatus, { label: string; className: string }> = {
  paid: { label: "Pago", className: "bg-[var(--color-soft)] text-[var(--color-muted)]" },
  received: { label: "Recebido", className: "bg-[var(--color-success-soft)] text-[var(--color-success)]" },
  overdue: { label: "Atrasado", className: "bg-[var(--color-over-soft)] text-[var(--color-over)]" },
  due_today: { label: "Vence hoje", className: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" },
  scheduled: { label: "Previsto", className: "bg-[var(--color-action-soft)] text-[var(--color-action)]" },
};

export function statusLabel(status: DisplayStatus) {
  return statusStyles[status].label;
}

export function StatusChip({ status }: { status: DisplayStatus }) {
  const style = statusStyles[status];
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold ${style.className}`}>{style.label}</span>;
}
