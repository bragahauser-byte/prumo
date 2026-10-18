import type { ReactNode } from "react";

export type RingSegment = { value: number; color: string; label: string };

/**
 * Anel de progresso. Com `segments`, desenha arcos consecutivos (ex.: distribuição entre metas);
 * cada arco deixa um pequeno respiro para separar visualmente as partes.
 */
export function ProgressRing({
  value = 0,
  segments,
  size = 240,
  stroke = 14,
  color = "var(--color-action)",
  track = "var(--color-border)",
  label,
  children,
}: {
  value?: number;
  segments?: RingSegment[];
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const parts = segments ?? [{ value: Math.max(0, Math.min(1, value)), color, label }];
  const gap = parts.length > 1 ? stroke * 1.2 : 0;
  const starts = parts.map((_, index) => parts.slice(0, index).reduce((total, part) => total + Math.max(0, Math.min(1, part.value)) * circumference, 0));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        {parts.map((part, index) => {
          const length = Math.max(0, Math.min(1, part.value)) * circumference;
          const visible = Math.max(0, length - gap);
          const start = starts[index];
          if (visible <= 0) return null;
          return (
            <circle
              key={part.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={part.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${visible} ${circumference}`}
              strokeDashoffset={-start}
              className="transition-[stroke-dasharray] duration-700 ease-out"
            />
          );
        })}
      </svg>
      {children ? <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div> : null}
    </div>
  );
}
