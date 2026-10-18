"use client";

import { useState, type FormEvent } from "react";
import { useFinance } from "@/components/finance-provider";
import { GoalIcon, goalIcons } from "@/components/ui/category-icon";
import { MoneyInput } from "@/components/ui/money-input";
import { fieldClass, focusRing, labelClass, primaryButton, softButton } from "@/components/ui/primitives";
import { goalProgress } from "@/domain/planning";
import { todayISO } from "@/lib/dates";
import { createFinanceId, type FinanceSavingsGoal } from "@/lib/finance/repository";
import { formatCurrency } from "@/lib/formatting";

export function GoalForm({
  goal,
  currency,
  onSaved,
  onCancel,
}: {
  goal?: FinanceSavingsGoal;
  currency: string;
  onSaved: (goal: FinanceSavingsGoal) => void;
  onCancel: () => void;
}) {
  const { saveSavingsGoal, isSaving } = useFinance();
  const today = todayISO();
  const [name, setName] = useState(goal?.name ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? "travel");
  const [targetCents, setTargetCents] = useState(goal?.targetCents ?? 0);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [error, setError] = useState<string | null>(null);
  const preview = targetCents ? goalProgress({ targetCents, deadline: deadline || null, contributions: goal?.contributions ?? [] }, today) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Dê um nome para a meta.");
    if (!targetCents) return setError("Informe o valor da meta.");
    if (deadline && deadline < today) return setError("O prazo precisa ser hoje ou depois.");
    const next: FinanceSavingsGoal = {
      id: goal?.id ?? createFinanceId(),
      name: name.trim(),
      icon,
      targetCents,
      deadline: deadline || null,
      createdOn: goal?.createdOn ?? today,
      contributions: goal?.contributions ?? [],
    };
    try {
      await saveSavingsGoal(next);
      onSaved(next);
    } catch {
      setError("Não foi possível salvar a meta. Tente novamente.");
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium">Para que é?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Ícone da meta">
          {goalIcons.map((item) => {
            const selected = icon === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => { setIcon(item.value); if (!name.trim() || goalIcons.some((option) => option.label === name)) setName(item.value === "other" ? "" : item.label); }}
                className={`flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-center text-xs font-semibold transition-colors ${focusRing} ${selected ? "border-[var(--color-action)] bg-[var(--color-action-soft)] text-[var(--color-action)]" : "border-[var(--color-border)] hover:bg-[var(--color-soft)]"}`}
              >
                <GoalIcon icon={item.value} size={40} />
                <span className="w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className={labelClass}>Nome da meta<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Ex.: Viagem para o Chile" className={fieldClass} /></label>
      <MoneyInput label="Valor da meta" value={targetCents || null} onChange={(cents) => setTargetCents(cents ?? 0)} currency={currency} />
      <label className={labelClass}>Prazo (opcional)<input type="date" min={today} value={deadline} onChange={(event) => setDeadline(event.target.value)} className={fieldClass} /></label>
      {preview?.monthlyNeededCents ? (
        <p className="rounded-2xl bg-[var(--color-action-soft)] px-4 py-3 text-sm text-[var(--color-action)]" role="status">
          Guardando <strong className="tabular">{formatCurrency(preview.monthlyNeededCents, currency)}</strong> por mês você chega lá em {preview.monthsLeft} {preview.monthsLeft === 1 ? "mês" : "meses"}.
        </p>
      ) : null}
      {error ? <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancel} className={softButton}>Cancelar</button>
        <button disabled={isSaving} className={primaryButton}>{isSaving ? "Salvando..." : goal ? "Salvar" : "Criar meta"}</button>
      </div>
    </form>
  );
}
