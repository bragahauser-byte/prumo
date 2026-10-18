"use client";

import { useState, type FormEvent } from "react";
import { useFinance } from "@/components/finance-provider";
import { formatCentsAsDecimal, parseCurrencyToCents } from "@/domain/financial";
import { createFinanceId, type FinanceRecurringRule } from "@/lib/finance/repository";

function centsToInput(cents: number) {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

function isDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function RecurringForm({
  rule,
  onSaved,
  onCancel,
}: {
  rule?: FinanceRecurringRule;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const { saveRecurringRule, generateOccurrences, isSaving } = useFinance();
  const [name, setName] = useState(rule?.name ?? "");
  const [amount, setAmount] = useState(rule ? centsToInput(rule.amountCents) : "");
  const [category, setCategory] = useState(rule?.category ?? "");
  const [frequency, setFrequency] = useState<FinanceRecurringRule["frequency"]>(rule?.frequency ?? "monthly");
  const [startsOn, setStartsOn] = useState(rule?.startsOn ?? new Date().toISOString().slice(0, 10));
  const [dueDay, setDueDay] = useState(rule?.dueDay == null ? "" : String(rule.dueDay));
  const [endsOn, setEndsOn] = useState(rule?.endsOn ?? "");
  const [isVariable, setIsVariable] = useState(rule?.isVariable ?? false);
  const [notes, setNotes] = useState(rule?.notes ?? "");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setFailed(false);
    const amountCents = parseCurrencyToCents(amount);
    const configuredDueDay = frequency === "weekly" ? null : Number(dueDay);
    if (!name.trim() || name.trim().length > 120 || !category || amountCents === null || !isDate(startsOn)
      || (frequency !== "weekly" && (!Number.isInteger(configuredDueDay) || configuredDueDay! < 1 || configuredDueDay! > 31))
      || (endsOn && (!isDate(endsOn) || endsOn < startsOn))) {
      setFailed(true);
      setMessage("Confira nome, valor, categoria, frequência e datas.");
      return;
    }

    const nextRule: FinanceRecurringRule = {
      id: rule?.id ?? createFinanceId(),
      name: name.trim(),
      amountCents,
      category,
      frequency,
      startsOn,
      dueDay: configuredDueDay,
      endsOn: endsOn || null,
      isActive: rule?.isActive ?? true,
      isVariable,
      notes: notes.trim() || null,
    };

    let saved = false;
    try {
      await saveRecurringRule(nextRule);
      saved = true;
      if (!rule) {
        const through = new Date();
        through.setUTCDate(through.getUTCDate() + 90);
        const created = await generateOccurrences(nextRule.id, through.toISOString().slice(0, 10));
        setMessage(`${created} ocorrência(s) gerada(s) para os próximos 90 dias.`);
      } else {
        setMessage("Regra atualizada. Ocorrências já criadas mantêm seus valores e datas.");
      }
      onSaved?.();
    } catch {
      setFailed(true);
      setMessage(saved
        ? "A regra foi salva, mas não foi possível gerar as ocorrências. Use Gerar próximas para tentar novamente."
        : "Não foi possível salvar. Os campos continuam preenchidos; tente novamente.");
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 border-y border-[var(--color-border)] py-6 md:grid-cols-2">
      <label className="block text-sm font-medium">
        Nome
        <input name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base" />
      </label>
      <label className="block text-sm font-medium">
        Valor de referência
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
        Frequência
        <select name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as FinanceRecurringRule["frequency"])} required className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base">
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
          <option value="yearly">Anual</option>
        </select>
      </label>
      <label className="block text-sm font-medium">
        Data inicial
        <input name="startsOn" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} required className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base" />
      </label>
      <label className="block text-sm font-medium">
        Dia do vencimento (mensal/anual)
        <input name="dueDay" type="number" min={1} max={31} value={dueDay} onChange={(event) => setDueDay(event.target.value)} disabled={frequency === "weekly"} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base disabled:opacity-50" />
      </label>
      <label className="block text-sm font-medium">
        Data final (opcional)
        <input name="endsOn" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base" />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium md:col-span-2">
        <input type="checkbox" checked={isVariable} onChange={(event) => setIsVariable(event.target.checked)} className="h-5 w-5 accent-[var(--color-action)]" />
        O valor pode mudar a cada ocorrência
      </label>
      <label className="block text-sm font-medium md:col-span-2">
        Observação (opcional)
        <textarea name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={2} className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-base" />
      </label>
      <div className="md:col-span-2">
        {message ? <p className="mb-3 text-sm" role={failed ? "alert" : "status"}>{message}</p> : null}
        <div className="flex flex-wrap gap-3">
        <button disabled={isSaving} className="min-h-11 rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white disabled:opacity-60">
          {isSaving ? "Salvando..." : rule ? "Salvar regra" : "Salvar recorrência"}
        </button>
        {onCancel ? <button type="button" onClick={onCancel} className="min-h-11 rounded-full px-4 text-sm font-medium text-[var(--color-muted)] underline underline-offset-4">Cancelar</button> : null}
        </div>
      </div>
    </form>
  );
}
