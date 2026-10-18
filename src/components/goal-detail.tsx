"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock, Check, ChevronLeft, Trash2 } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { GoalForm } from "@/components/goal-form";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { Illustration, goalIllustration } from "@/components/ui/illustration";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Sheet } from "@/components/ui/sheet";
import { Card, SectionHeader, dangerButton, focusRing, primaryButton, softButton, textButton } from "@/components/ui/primitives";
import { goalProgress } from "@/domain/planning";
import type { FinanceGoalContribution } from "@/lib/finance/repository";
import { formatCalendarDate, formatCurrency, formatShortDate } from "@/lib/formatting";

export function GoalDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { savingsGoals, saveSavingsGoal, deleteSavingsGoal, isSaving } = useFinance();
  const { today, currency } = useFinanceSummary();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goal = savingsGoals.find((item) => item.id === id);

  if (!goal) {
    return (
      <Card className="flex flex-col items-center py-12 text-center">
        <h2 className="text-xl font-semibold">Meta não encontrada</h2>
        <Link href="/goals" className={`${primaryButton} mt-6`}>Ver metas</Link>
      </Card>
    );
  }

  const progress = goalProgress(goal, today);
  const contributions = [...goal.contributions].sort((left, right) => right.date.localeCompare(left.date));

  async function updateContributions(next: FinanceGoalContribution[]) {
    if (!goal) return;
    setError(null);
    try {
      await saveSavingsGoal({ ...goal, contributions: next });
    } catch {
      setError("Não foi possível atualizar os aportes.");
    }
  }

  async function remove() {
    if (!goal) return;
    try {
      await deleteSavingsGoal(goal.id);
      router.replace("/goals");
    } catch {
      setError("Não foi possível excluir a meta.");
    }
  }

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      <Link href="/goals" className={`${textButton} -ml-3`}><ChevronLeft size={18} aria-hidden="true" /> Metas</Link>

      <Card className="flex flex-col items-center text-center">
        <ProgressRing size={248} stroke={14} value={progress.ratio} color="var(--color-success)" track="var(--color-soft)" label={`${Math.round(progress.ratio * 100)}% da meta ${goal.name}`}>
          <Illustration name={goalIllustration(goal.icon)} size={88} />
          <span className="mt-2 text-3xl font-semibold">{Math.round(progress.ratio * 100)}%</span>
        </ProgressRing>
        <h2 className="mt-4 text-2xl font-semibold">{goal.name}</h2>
        <p className="tabular mt-1 text-base text-[var(--color-muted)]">{formatCurrency(progress.savedCents, currency)} de {formatCurrency(goal.targetCents, currency)}</p>
        <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
          <Link href={`/add?goal=${goal.id}`} className={`${primaryButton} bg-[var(--color-success)] hover:bg-[var(--color-success)]`}>Guardar dinheiro</Link>
          <button type="button" onClick={() => setEditing(true)} className={softButton}>Editar meta</button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-[var(--color-muted)]">Faltam</p><p className="tabular mt-1 text-xl font-semibold">{formatCurrency(progress.remainingCents, currency)}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--color-muted)]">Por mês</p><p className="tabular mt-1 text-xl font-semibold">{progress.isComplete ? "—" : progress.monthlyNeededCents === null ? "Sem prazo" : formatCurrency(progress.monthlyNeededCents, currency)}</p></Card>
        <Card className="col-span-2 p-5 sm:col-span-1"><p className="text-sm text-[var(--color-muted)]">Prazo</p><p className="mt-1 text-xl font-semibold">{goal.deadline ? formatShortDate(goal.deadline) : "Livre"}</p>{progress.monthsLeft !== null && !progress.isComplete ? <p className="text-xs text-[var(--color-muted)]">{progress.monthsLeft === 0 ? "prazo vencido" : `${progress.monthsLeft} ${progress.monthsLeft === 1 ? "mês" : "meses"} restantes`}</p> : null}</Card>
      </div>

      {error ? <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}

      <Card aria-labelledby="contributions-title">
        <SectionHeader id="contributions-title" title="Aportes" />
        {contributions.length ? (
          <ul className="divide-y divide-[var(--color-border)]">
            {contributions.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.status === "done" ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "bg-[var(--color-action-soft)] text-[var(--color-action)]"}`}>
                  {item.status === "done" ? <Check size={18} aria-hidden="true" /> : <CalendarClock size={18} aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="tabular block text-base font-semibold">{formatCurrency(item.amountCents, currency)}</span>
                  <span className="block text-sm text-[var(--color-muted)]">{item.status === "done" ? "Guardado" : "Planejado"} · {formatCalendarDate(item.date)}</span>
                </span>
                {item.status === "planned" ? (
                  <button type="button" disabled={isSaving} onClick={() => void updateContributions(goal.contributions.map((entry) => entry.id === item.id ? { ...entry, status: "done", date: today } : entry))} className={textButton}>Confirmar</button>
                ) : null}
                <button type="button" disabled={isSaving} aria-label={`Remover aporte de ${formatCurrency(item.amountCents, currency)}`} onClick={() => void updateContributions(goal.contributions.filter((entry) => entry.id !== item.id))} className={`flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-error)] ${focusRing}`}>
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="py-2 text-sm text-[var(--color-muted)]">Nenhum aporte ainda. Registre o que já guardou ou planeje os próximos.</p>}
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {confirmDelete ? (
          <>
            <span className="text-sm text-[var(--color-muted)]">Excluir a meta e seus aportes?</span>
            <button type="button" disabled={isSaving} onClick={() => void remove()} className={dangerButton}>Sim, excluir</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className={textButton}>Cancelar</button>
          </>
        ) : <button type="button" onClick={() => setConfirmDelete(true)} className={dangerButton}>Excluir meta</button>}
      </div>

      {editing ? (
        <Sheet title="Editar meta" onClose={() => setEditing(false)}>
          <GoalForm goal={goal} currency={currency} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
        </Sheet>
      ) : null}
    </div>
  );
}
