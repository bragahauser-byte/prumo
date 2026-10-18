"use client";

import { useEffect, useState, type ReactNode } from "react";

export type RingSegment = { value: number; color: string; label: string };

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Anel de progresso. Com `segments`, divide o anel em arcos consecutivos (ex.: a parte de cada meta),
 * separados por um respiro de `gap` px. As pontas são arredondadas e o comprimento visível de cada arco
 * desconta as pontas, então o desenho corresponde ao valor real; um valor pequeno, mas maior que zero,
 * aparece como um ponto em vez de sumir. `marker` mostra um indicador no fim do progresso.
 */
export function ProgressRing({
  value = 0,
  segments,
  size = 240,
  stroke = 14,
  gap = 6,
  color = "var(--color-action)",
  track = "var(--color-soft)",
  marker = false,
  label,
  children,
}: {
  value?: number;
  segments?: RingSegment[];
  size?: number;
  stroke?: number;
  gap?: number;
  color?: string;
  track?: string;
  marker?: boolean;
  label: string;
  children?: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const raw = (segments ?? [{ value, color, label }]).map((part) => ({ ...part, value: clamp(part.value) }));
  const rawTotal = raw.reduce((total, part) => total + part.value, 0);
  const scale = rawTotal > 1 ? 1 / rawTotal : 1;
  const parts = raw.map((part) => ({ ...part, value: part.value * scale })).filter((part) => part.value > 0);
  const total = Math.min(1, rawTotal * scale);
  const complete = total >= 0.999;
  const spacing = parts.length > 1 || (parts.length === 1 && !complete && segments) ? gap : 0;
  const factor = shown ? 1 : 0;
  const center = size / 2;

  const starts = parts.map((_, index) => parts.slice(0, index).reduce((sum, part) => sum + part.value * circumference, 0));
  const arcs = parts.map((part, index) => {
    const length = part.value * circumference;
    const start = starts[index];
    if (complete && parts.length === 1) return { ...part, dash: circumference, offset: 0, round: false };
    const visible = length - stroke - spacing;
    // Arco curto demais: vira um ponto no meio da sua fatia.
    if (visible <= 0.5) return { ...part, dash: 0.001, offset: start + length / 2, round: true };
    return { ...part, dash: visible, offset: start + (stroke + spacing) / 2, round: true };
  });

  const markerAngle = total > 0 && !complete ? ((total * circumference - spacing / 2 - stroke / 2) / circumference) * 360 : null;
  const markerColor = parts[parts.length - 1]?.color ?? color;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible" aria-hidden="true">
        <circle cx={center} cy={center} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        {arcs.map((arc, index) => (
          <circle
            key={`${arc.label}-${index}`}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeLinecap={arc.round ? "round" : "butt"}
            strokeDasharray={`${arc.dash * factor} ${circumference}`}
            strokeDashoffset={-arc.offset * factor}
            style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.2, 0.8, 0.2, 1), stroke-dashoffset 900ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          />
        ))}
        {marker && markerAngle !== null ? (
          <g style={{ transform: `rotate(${markerAngle * factor}deg)`, transformOrigin: `${center}px ${center}px`, transition: "transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
            <circle cx={center + radius} cy={center} r={stroke * 0.95} fill={markerColor} stroke="#fff" strokeWidth={3} />
            <circle cx={center + radius} cy={center} r={stroke * 0.35} fill="#fff" />
          </g>
        ) : null}
      </svg>
      {children ? <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">{children}</div> : null}
    </div>
  );
}
