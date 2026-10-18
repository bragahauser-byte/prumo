"use client";

import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { GoalIcon } from "@/components/ui/category-icon";
import { Illustration } from "@/components/ui/illustration";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, Meter, focusRing, inkButton } from "@/components/ui/primitives";
import { goalProgress } from "@/domain/planning";
import { formatCurrency, formatShortDate } from "@/lib/formatting";

/** Tons de verde do sucesso para separar as metas no anel (do mais forte ao mais suave). */
export const goalShades = ["#1E8E5A", "#3FAE79", "#78C9A0", "#2F6B4F", "#5C9C7F", "#A3D9BC"];

export function GoalsScreen() {
  const { savingsGoals } = useFinance();
  const { today, currency } = useFinanceSummary();

  const goals = savingsGoals.map((goal, index) => ({ goal, progress: goalProgress(goal, today), color: goalShades[index % goalShades.length] }));
  const totalSaved = goals.reduce((sum, item) => sum + item.progress.savedCents, 0);
  const totalTarget = goals.reduce((sum, item) => sum + item.goal.targetCents, 0);
  const monthlyNeeded = goals.reduce((sum, item) => sum + (item.progress.isComplete ? 0 : item.progress.monthlyNeededCents ?? 0), 0);

  if (!goals.length) {
    return (
      <section className="mx-auto flex max-w-[420px] flex-col items-center px-2 py-10 text-center">
        <Illustration name="goals" size={200} priority />
        <h2 className="mt-6 text-3xl font-semibold tracking-[-0.01em]">Aonde você quer chegar?</h2>
        <p className="mt-3 text-base leading-6 text-[var(--color-muted)]">Uma viagem, um computador novo ou uma reserva de emergência. Defina o destino e o Prumo calcula quanto guardar por mês — o dinheiro continua na sua conta.</p>
        <Link href="/goals/new" className={`${inkButton} mt-8 w-full`}><Plus size={20} aria-hidden="true" /> Criar primeira meta</Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <Card aria-labelledby="goals-summary" className="p-6 sm:p-8">
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-12">
          <ProgressRing
            size={232}
            stroke={12}
            track="var(--color-soft)"
            segments={goals.map((item) => ({ value: totalTarget ? item.progress.savedCents / totalTarget : 0, color: item.color, label: item.goal.name }))}
            label={`${formatCurrency(totalSaved, currency)} guardados de ${formatCurrency(totalTarget, currency)}`}
          >
            <span className="text-sm text-[var(--color-muted)]">Guardado</span>
            <span className="tabular mt-1 text-3xl font-semibold">{formatCurrency(totalSaved, currency)}</span>
            <span className="mt-1 text-xs text-[var(--color-muted)]">de {formatCurrency(totalTarget, currency)}</span>
          </ProgressRing>
          <div className="w-full flex-1">
            <h2 id="goals-summary" className="text-xl font-semibold">Suas metas</h2>
            {monthlyNeeded ? <p className="mt-1 text-sm text-[var(--color-muted)]">Para cumprir os prazos: <span className="tabular font-semibold text-[var(--color-text)]">{formatCurrency(monthlyNeeded, currency)}/mês</span></p> : null}
            <ul className="mt-4 divide-y divide-[var(--color-border)]">
              {goals.map(({ goal, progress, color }) => (
                <li key={goal.id}>
                  <Link href={`/goals/detail?id=${goal.id}`} className={`flex min-h-12 items-center gap-3 rounded-xl py-2 ${focusRing}`}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-base">{goal.name}</span>
                    <span className="tabular text-sm text-[var(--color-muted)]">{Math.round(progress.ratio * 100)}%</span>
                    <ChevronRight size={18} className="text-[var(--color-muted)]" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/goals/new" className={`${inkButton} mt-5 w-full sm:w-auto`}><Plus size={20} aria-hidden="true" /> Nova meta</Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {goals.map(({ goal, progress }) => (
          <Card key={goal.id} className="flex flex-col p-5 sm:p-5">
            <Link href={`/goals/detail?id=${goal.id}`} className={`flex items-center gap-3 rounded-xl ${focusRing}`}>
              <GoalIcon icon={goal.icon} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold">{goal.name}</span>
                <span className="block text-sm text-[var(--color-muted)]">{goal.deadline ? `até ${formatShortDate(goal.deadline)}` : "sem prazo"}</span>
              </span>
              {progress.isComplete ? <span className="rounded-full bg-[var(--color-success-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-success)]">Concluída</span> : null}
            </Link>
            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="tabular text-xl font-semibold">{formatCurrency(progress.savedCents, currency)}</span>
                <span className="tabular text-sm text-[var(--color-muted)]">de {formatCurrency(goal.targetCents, currency)}</span>
              </div>
              <div className="mt-2"><Meter value={progress.ratio} label={`${goal.name}: ${Math.round(progress.ratio * 100)}%`} /></div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                {progress.isComplete
                  ? "Meta alcançada!"
                  : progress.monthlyNeededCents !== null
                    ? <>Guarde <span className="tabular font-semibold text-[var(--color-text)]">{formatCurrency(progress.monthlyNeededCents, currency)}</span> por mês</>
                    : <>Faltam <span className="tabular font-semibold text-[var(--color-text)]">{formatCurrency(progress.remainingCents, currency)}</span></>}
              </p>
            </div>
            <Link href={`/add?goal=${goal.id}`} className={`mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-soft)] px-4 text-sm font-semibold transition-colors hover:bg-[var(--color-border)] ${focusRing}`}>Guardar dinheiro</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
