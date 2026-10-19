"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { GoalIcon } from "@/components/ui/category-icon";
import { Illustration } from "@/components/ui/illustration";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, SectionHeader, focusRing, inkButton } from "@/components/ui/primitives";
import { goalPace, type GoalPaceStatus } from "@/domain/planning";
import { formatCurrency, formatShortDate } from "@/lib/formatting";

/**
 * Cores que separam as metas no anel dividido: alternam tons escuros e claros da paleta
 * (verde floresta, verde vivo e as secundárias) para que fatias vizinhas nunca se confundam.
 */
export const goalShades = ["#163300", "#9FE870", "#260A2F", "#FFC091", "#3A341C", "#A0E1E1", "#320707", "#FFD7EF"];

export const paceLabels: Record<GoalPaceStatus, { label: string; className: string }> = {
  complete: { label: "Meta alcançada", className: "bg-[var(--color-success-soft)] text-[var(--color-success)]" },
  ahead: { label: "Adiantada", className: "bg-[var(--color-success-soft)] text-[var(--color-success)]" },
  on_track: { label: "No ritmo", className: "bg-[var(--color-success-soft)] text-[var(--color-success)]" },
  behind: { label: "Abaixo do ritmo", className: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" },
  overdue: { label: "Prazo vencido", className: "bg-[var(--color-over-soft)] text-[var(--color-over)]" },
  no_deadline: { label: "Sem prazo", className: "bg-[var(--color-soft)] text-[var(--color-muted)]" },
};

const percent = (ratio: number) => Math.floor(ratio * 100);

/**
 * Barra de progresso da meta. O preenchimento é o que já foi guardado; a marca vertical é
 * onde a meta deveria estar hoje para cumprir o prazo — dá para ver de relance se está no ritmo.
 */
export function GoalProgressBar({ ratio, expectedRatio, name, complete }: { ratio: number; expectedRatio: number | null; name: string; complete: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const filled = ratio > 0 ? Math.max(ratio, 0.025) : 0;
  const showExpected = expectedRatio !== null && !complete && expectedRatio > 0 && expectedRatio < 1;
  const valueText = `${percent(ratio)}% guardado${showExpected ? `; o esperado para hoje é ${percent(expectedRatio!)}%` : ""}`;

  return (
    <div className="relative py-1.5" role="progressbar" aria-label={`Progresso de ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(ratio)} aria-valuetext={valueText}>
      <div className="h-3 overflow-hidden rounded-full bg-[var(--color-soft)]">
        <div
          className={`h-full rounded-full ${complete ? "bg-[var(--color-bright-green)]" : "bg-[var(--color-forest-green)]"}`}
          style={{ width: `${(shown ? filled : 0) * 100}%`, transition: "width 800ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        />
      </div>
      {showExpected ? (
        <span className="absolute top-0 h-6 w-[3px] -translate-x-1/2 rounded-full bg-[var(--color-text)] ring-2 ring-white" style={{ left: `${expectedRatio! * 100}%` }} aria-hidden="true" />
      ) : null}
    </div>
  );
}

export function GoalsScreen() {
  const { savingsGoals } = useFinance();
  const { today, currency } = useFinanceSummary();

  const goals = savingsGoals.map((goal, index) => ({ goal, pace: goalPace(goal, today), color: goalShades[index % goalShades.length] }));
  const totalSaved = goals.reduce((sum, item) => sum + Math.min(item.pace.progress.savedCents, item.goal.targetCents), 0);
  const totalTarget = goals.reduce((sum, item) => sum + item.goal.targetCents, 0);
  const totalRatio = totalTarget ? totalSaved / totalTarget : 0;
  const monthlyNeeded = goals.reduce((sum, item) => sum + (item.pace.progress.isComplete ? 0 : item.pace.progress.monthlyNeededCents ?? 0), 0);

  if (!goals.length) {
    return (
      <section className="mx-auto flex max-w-[420px] flex-col items-center px-2 py-6 text-center">
        <Illustration name="goals" size={200} priority />
        <h2 className="mt-6 text-2xl font-semibold tracking-[-0.01em]">Aonde você quer chegar?</h2>
        <p className="mt-3 text-base leading-6 text-[var(--color-muted)]">Uma viagem, um carro, a reserva de emergência. Crie quantas metas quiser — o Prumo calcula quanto guardar por mês e o dinheiro continua na sua conta.</p>
        <Link href="/goals/new" className={`${inkButton} mt-8 w-full`}><Plus size={20} aria-hidden="true" /> Criar primeira meta</Link>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <Card aria-labelledby="goals-summary" className="p-6 sm:p-8">
        <h2 id="goals-summary" className="sr-only">Resumo das metas</h2>
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-12">
          <ProgressRing
            size={240}
            stroke={14}
            marker
            segments={goals.map((item) => ({ value: totalTarget ? Math.min(item.pace.progress.savedCents, item.goal.targetCents) / totalTarget : 0, color: item.color, label: item.goal.name }))}
            label={`${percent(totalRatio)}% do total: ${formatCurrency(totalSaved, currency)} guardados de ${formatCurrency(totalTarget, currency)}`}
          >
            <span className="tabular text-4xl font-semibold tracking-[-0.02em]">{percent(totalRatio)}%</span>
            <span className="text-sm text-[var(--color-muted)]">do total guardado</span>
            <span className="tabular mt-3 text-base font-semibold">{formatCurrency(totalSaved, currency)}</span>
            <span className="tabular text-xs text-[var(--color-tertiary)]">de {formatCurrency(totalTarget, currency)}</span>
          </ProgressRing>

          <div className="w-full min-w-0 flex-1">
            <dl className="grid grid-cols-2 gap-4 border-b border-[var(--color-border)] pb-4">
              <div className="min-w-0">
                <dt className="text-sm text-[var(--color-muted)]">{goals.length === 1 ? "Meta ativa" : "Metas"}</dt>
                <dd className="tabular text-xl font-semibold">{goals.length}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-[var(--color-muted)]">Guardar por mês</dt>
                <dd className="tabular truncate text-xl font-semibold">{monthlyNeeded ? formatCurrency(monthlyNeeded, currency) : "—"}</dd>
              </div>
            </dl>
            <ul className="mt-2 divide-y divide-[var(--color-border)]" aria-label="Parte de cada meta no anel">
              {goals.map(({ goal, pace, color }) => (
                <li key={goal.id}>
                  <Link href={`/goals/detail?id=${goal.id}`} className={`flex min-h-12 items-center gap-3 rounded-xl py-2 ${focusRing}`}>
                    <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5" style={{ backgroundColor: color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-base">{goal.name}</span>
                    <span className="tabular shrink-0 text-sm font-semibold">{percent(pace.progress.ratio)}%</span>
                    <ChevronRight size={18} className="shrink-0 text-[var(--color-tertiary)]" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/goals/new" className={`${inkButton} mt-4 w-full`}><Plus size={20} aria-hidden="true" /> Nova meta</Link>
          </div>
        </div>
      </Card>

      <section aria-labelledby="goals-list">
        <SectionHeader id="goals-list" title="Suas metas" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map(({ goal, pace, color }) => {
            const { progress } = pace;
            const status = paceLabels[pace.status];
            return (
              <Card key={goal.id} className="flex flex-col p-5 sm:p-5">
                <Link href={`/goals/detail?id=${goal.id}`} className={`flex items-center gap-3 rounded-xl ${focusRing}`}>
                  <GoalIcon icon={goal.icon} size={56} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-base font-semibold leading-5 [overflow-wrap:anywhere]">{goal.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                      {goal.deadline ? `até ${formatShortDate(goal.deadline)}` : "sem prazo"}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-[var(--color-tertiary)]" aria-hidden="true" />
                </Link>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="tabular truncate text-xl font-semibold">{formatCurrency(progress.savedCents, currency)}</p>
                    <p className="tabular truncate text-sm text-[var(--color-muted)]">de {formatCurrency(goal.targetCents, currency)}</p>
                  </div>
                  <p className="tabular shrink-0 text-xl font-semibold">{percent(progress.ratio)}%</p>
                </div>
                <div className="mt-2"><GoalProgressBar ratio={progress.ratio} expectedRatio={pace.expectedRatio} name={goal.name} complete={progress.isComplete} /></div>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
                  <span className="text-[var(--color-muted)]">
                    {progress.isComplete
                      ? "Parabéns, você chegou lá."
                      : progress.monthlyNeededCents !== null
                        ? <>Guarde <span className="tabular font-semibold text-[var(--color-text)]">{formatCurrency(progress.monthlyNeededCents, currency)}</span>/mês</>
                        : <>Faltam <span className="tabular font-semibold text-[var(--color-text)]">{formatCurrency(progress.remainingCents, currency)}</span></>}
                  </span>
                </div>
                {pace.expectedRatio !== null && !progress.isComplete && pace.expectedRatio > 0 && pace.expectedRatio < 1 ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-tertiary)]">
                    <span className="h-3 w-[3px] rounded-full bg-[var(--color-text)]" aria-hidden="true" /> onde deveria estar hoje: {percent(pace.expectedRatio)}%
                  </p>
                ) : null}

                {!progress.isComplete ? (
                  <Link href={`/add?goal=${goal.id}`} className={`mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-soft)] px-4 text-sm font-semibold transition-colors hover:bg-[var(--color-border)] ${focusRing}`}>Guardar dinheiro</Link>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
