"use client";

import { useState } from "react";

export type ColumnSeries = { key: string; label: string; color: string };
export type ColumnDatum = { label: string; longLabel: string; values: Record<string, number> };

function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value / 4) ?? 10;
  return Math.ceil(value / (step * magnitude)) * step * magnitude;
}

/**
 * Colunas agrupadas com eixo único, grade discreta, legenda, tooltip por grupo (hover/foco)
 * e tabela equivalente para leitores de tela e consulta precisa.
 */
export function ColumnChart({
  data,
  series,
  formatValue,
  formatTick,
  title,
}: {
  data: ColumnDatum[];
  series: ColumnSeries[];
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  title: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.flatMap((item) => series.map((entry) => item.values[entry.key] ?? 0))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => max * ratio);
  const height = 180;

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="mb-4 flex flex-wrap gap-4 text-sm text-[var(--color-muted)]" aria-hidden="true">
        {series.map((entry) => (
          <span key={entry.key} className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />{entry.label}</span>
        ))}
      </div>
      <div className="relative flex gap-2" aria-hidden="true">
        <div className="relative w-12 shrink-0 text-right text-xs text-[var(--color-muted)]" style={{ height }}>
          {ticks.map((tick) => (
            <span key={tick} className="tabular absolute right-0" style={{ bottom: `${(tick / max) * 100}%`, transform: "translateY(50%)" }}>{formatTick(tick)}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 top-0" style={{ height }}>
            {ticks.map((tick) => <div key={tick} className="absolute inset-x-0 h-px bg-[var(--color-border)]" style={{ bottom: `${(tick / max) * 100}%` }} />)}
          </div>
          <div className="relative flex items-end justify-around" style={{ height }}>
            {data.map((item, index) => (
              <div
                key={item.longLabel}
                className="relative flex h-full flex-1 cursor-default items-end justify-center gap-[2px]"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
              >
                {active === index ? <div className="absolute inset-x-1 inset-y-0 rounded-lg bg-[var(--color-soft)]" /> : null}
                {series.map((entry) => {
                  const value = item.values[entry.key] ?? 0;
                  return (
                    <div
                      key={entry.key}
                      className="relative w-full max-w-6 rounded-t-[4px] transition-[height] duration-500"
                      style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? 2 : 0, backgroundColor: entry.color }}
                    />
                  );
                })}
                {active === index ? (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-2xl bg-[var(--color-text)] px-3 py-2 text-xs text-white shadow-lg">
                    <p className="mb-1 font-semibold first-letter:uppercase">{item.longLabel}</p>
                    {series.map((entry) => (
                      <p key={entry.key} className="tabular flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />{entry.label}: {formatValue(item.values[entry.key] ?? 0)}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-around text-xs text-[var(--color-muted)]">
            {data.map((item) => <span key={item.longLabel} className="flex-1 text-center">{item.label}</span>)}
          </div>
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-[var(--color-action)]">Ver em tabela</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{title}</caption>
          <thead><tr className="text-[var(--color-muted)]"><th className="py-2 font-medium">Mês</th>{series.map((entry) => <th key={entry.key} className="py-2 text-right font-medium">{entry.label}</th>)}</tr></thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.map((item) => (
              <tr key={item.longLabel}><td className="py-2 first-letter:uppercase">{item.longLabel}</td>{series.map((entry) => <td key={entry.key} className="tabular py-2 text-right">{formatValue(item.values[entry.key] ?? 0)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
