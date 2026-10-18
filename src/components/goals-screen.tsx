"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { GoalForm } from "@/components/goal-form";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { Illustration, goalIllustration } from "@/components/ui/illustration";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Sheet } from "@/components/ui/sheet";
import { Card, Meter, focusRing, primaryButton } from "@/components/ui/primitives";
import { goalProgress } from "@/domain/planning";
import { formatCurrency, formatShortDate } from "@/lib/formatting";

/** Tons de verde do sucesso para separar as metas no anel (do mais forte ao mais suave). */
export const goalShades = ["#1E8E5A", "#3FAE79", "#78C9A0", "#B2E0C6", "#2F6B4F", "#5C9C7F"];

export function GoalsScreen() {
  const router = useRouter();
  const { savingsGoals } = useFinance();
  const { today, currency } = useFinanceSummary();
  const [creating, setCreating] = useState(false);

  const goals = savingsGoals.map((goal, index) => ({ goal, progress: goalProgress(goal, today), color: goalShades[index % goalShades.length] }));
  const totalSaved = goals.reduce((sum, item) => sum + item.progress.savedCents, 0);
  const totalTarget = goals.reduce((sum, item) => sum + item.goal.targetCents, 0);
  const monthlyNeeded = goals.reduce((sum, item) => sum + (item.progress.isComplete ? 0 : item.progress.monthlyNeededCents ?? 0), 0);

  return (
    <div className="space-y-4">
      {goals.length ? (
        <section aria-labelledby="goals-summary" className="rounded-3xl bg-[var(--color-text)] p-6 text-white sm:p-8">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-12">
            <ProgressRing
              size={232}
              stroke={14}
              track="rgba(255,255,255,0.14)"
              segments={goals.map((item) => ({ value: totalTarget ? item.progress.savedCents / totalTarget : 0, color: item.color, label: item.goal.name }))}
              label={`${formatCurrency(totalSaved, currency)} guardados de ${formatCurrency(totalTarget, currency)}`}
            >
              <span className="text-sm text-white/70">Guardado</span>
              <span className="tabular mt-1 text-3xl font-semibold">{formatCurrency(totalSaved, currency)}</span>
              <span className="mt-1 text-xs text-white/70">de {formatCurrency(totalTarget, currency)}</span>
            </ProgressRing>
            <div className="w-full flex-1">
              <h2 id="goals-summary" className="text-xl font-semibold">Suas metas</h2>
              {monthlyNeeded ? <p className="mt-1 text-sm text-white/70">Para cumprir os prazos: <span className="tabular font-semibold text-white">{formatCurrency(monthlyNeeded, currency)}/mês</span></p> : null}
              <ul className="mt-4 divide-y divide-white/10">
                {goals.map(({ goal, progress, color }) => (
                  <li key={goal.id}>
                    <Link href={`/goals/detail?id=${goal.id}`} className="flex min-h-12 items-center gap-3 rounded-xl py-2 focus-visible:outline-2 focus-visible:outline-white">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-base">{goal.name}</span>
                      <span className="tabular text-sm text-white/80">{Math.round(progress.ratio * 100)}%</span>
                      <ChevronRight size={18} className="text-white/60" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setCreating(true)} className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-base font-semibold text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto">
                <Plus size={20} aria-hidden="true" /> Nova meta
              </button>
            </div>
          </div>
        </section>
      ) : (
        <Card className="flex flex-col items-center px-6 py-12 text-center">
          <Illustration name="piggy-bank" size={128} />
          <h2 className="mt-6 text-2xl font-semibold">Guarde para o que importa</h2>
          <p className="mt-2 max-w-[360px] text-sm leading-5 text-[var(--color-muted)]">Crie metas como uma viagem, um computador novo ou uma reserva de emergência. Calculamos quanto guardar por mês — o dinheiro continua na sua conta.</p>
          <button type="button" onClick={() => setCreating(true)} className={`${primaryButton} mt-6 w-full max-w-[320px]`}><Plus size={20} aria-hidden="true" /> Criar primeira meta</button>
        </Card>
      )}

      {goals.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map(({ goal, progress }) => (
            <article key={goal.id} className="flex flex-col rounded-3xl bg-white p-5">
              <Link href={`/goals/detail?id=${goal.id}`} className={`flex items-start gap-4 rounded-2xl ${focusRing}`}>
                <Illustration name={goalIllustration(goal.icon)} size={72} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{goal.name}</span>
                  <span className="mt-0.5 block text-sm text-[var(--color-muted)]">{goal.deadline ? `até ${formatShortDate(goal.deadline)}` : "sem prazo"}</span>
                  {progress.isComplete ? <span className="mt-2 inline-flex rounded-full bg-[var(--color-success-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-success)]">Concluída</span> : null}
                </span>
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
              <Link href={`/add?goal=${goal.id}`} className={`mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-success-soft)] px-4 text-sm font-semibold text-[var(--color-success)] transition-colors hover:bg-[#d6ecdf] ${focusRing}`}>Guardar dinheiro</Link>
            </article>
          ))}
        </div>
      ) : null}

      {creating ? (
        <Sheet title="Nova meta" description="Defina o objetivo, o valor e, se quiser, um prazo." onClose={() => setCreating(false)}>
          <GoalForm currency={currency} onCancel={() => setCreating(false)} onSaved={(goal) => { setCreating(false); router.push(`/goals/detail?id=${goal.id}`); }} />
        </Sheet>
      ) : null}
    </div>
  );
}
