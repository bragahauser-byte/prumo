"use client";

import { useState, type FormEvent } from "react";
import { parseCurrencyToCents } from "@/domain/financial";
import { useFinance } from "@/components/finance-provider";
import { createFinanceId, type FinanceExpense } from "@/lib/finance/repository";

function centsToInput(cents: number | null) {
  if (cents === null) return "";
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

export function ExpenseForm({
  expense,
  onSaved,
  onCancel,
}: {
  expense?: FinanceExpense;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const { saveExpense, isSaving, preferences } = useFinance();
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(centsToInput(expense?.amountCents ?? null));
  const [category, setCategory] = useState(expense?.category ?? "");
  const [dueDate, setDueDate] = useState(expense?.date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const amountCents = parseCurrencyToCents(amount);
    const parsedDate = new Date(`${dueDate}T00:00:00.000Z`);
    if (!description.trim() || description.trim().length > 120 || !category || amountCents === null || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dueDate) {
      setError("Confira a descrição, categoria, valor positivo e data de vencimento.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const nextExpense: FinanceExpense = {
      id: expense?.id ?? createFinanceId(),
      description: description.trim(),
      amountCents,
      category,
      date: dueDate,
      status: expense?.status ?? (dueDate > today ? "scheduled" : "pending"),
      paidOn: expense?.paidOn ?? null,
      notes: notes.trim() || null,
      recurringRuleId: expense?.recurringRuleId ?? null,
      occurrenceDate: expense?.occurrenceDate ?? null,
    };

    try {
      await saveExpense(nextExpense);
      onSaved?.();
    } catch {
      setError("Não foi possível salvar. Os campos continuam preenchidos; tente novamente.");
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 border-y border-[var(--color-border)] py-6 md:grid-cols-2">
      <label className="block text-sm font-medium">
        Descrição
        <input name="description" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={120} autoComplete="off" className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base" />
      </label>
      <label className="block text-sm font-medium">
        Valor ({preferences?.currency ?? "BRL"})
        <input name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" required className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base" />
      </label>
      <label className="block text-sm font-medium">
        Categoria
        <select name="category" value={category} onChange={(event) => setCategory(event.target.value)} required className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base">
          <option value="" disabled>Selecione</option>
          <option>Moradia</option>
          <option>Alimentação</option>
          <option>Transporte</option>
          <option>Saúde</option>
          <option>Contas</option>
          <option>Assinaturas</option>
          <option>Outros</option>
        </select>
      </label>
      <label className="block text-sm font-medium">
        Vencimento
        <input name="dueDate" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base" />
      </label>
      <label className="block text-sm font-medium md:col-span-2">
        Observação (opcional)
        <textarea name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={2} className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-base" />
      </label>
      <div className="md:col-span-2">
        {error ? <p className="mb-3 text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
        <button disabled={isSaving} className="min-h-11 rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white disabled:opacity-60">
          {isSaving ? "Salvando..." : expense ? "Salvar alterações" : "Salvar despesa"}
        </button>
        {onCancel ? <button type="button" onClick={onCancel} className="min-h-11 rounded-full px-4 text-sm font-medium text-[var(--color-muted)] underline underline-offset-4">Cancelar</button> : null}
        </div>
      </div>
    </form>
  );
}
