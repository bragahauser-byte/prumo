"use client";

import { useState, type FormEvent } from "react";
import { CategoryPicker } from "@/components/category-picker";
import { useFinance } from "@/components/finance-provider";
import { MoneyKeypad } from "@/components/ui/money-keypad";
import { Segmented, fieldClass, focusRing, labelClass, primaryButton, softButton } from "@/components/ui/primitives";
import { categoriesFor, type TransactionKind } from "@/domain/categories";
import { addDays, todayISO } from "@/lib/dates";
import { createFinanceId, type FinanceRecurringRule } from "@/lib/finance/repository";
import { formatCurrency } from "@/lib/formatting";

function isDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const frequencyLabels: Record<FinanceRecurringRule["frequency"], { one: string; many: string; adjective: string }> = {
  weekly: { one: "semana", many: "semanas", adjective: "Semanal" },
  monthly: { one: "mês", many: "meses", adjective: "Mensal" },
  yearly: { one: "ano", many: "anos", adjective: "Anual" },
};

export function describeSchedule(rule: Pick<FinanceRecurringRule, "frequency" | "interval" | "dueDay">) {
  const label = frequencyLabels[rule.frequency];
  const base = rule.interval > 1 ? `A cada ${rule.interval} ${label.many}` : label.adjective;
  return rule.dueDay && rule.frequency !== "weekly" ? `${base} · dia ${rule.dueDay}` : base;
}

export function RecurringForm({
  rule,
  defaultKind = "expense",
  currency,
  onSaved,
  onCancel,
}: {
  rule?: FinanceRecurringRule;
  defaultKind?: TransactionKind;
  currency: string;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const { saveRecurringRule, generateOccurrences, isSaving } = useFinance();
  const today = todayISO();
  const [kind, setKind] = useState<TransactionKind>(rule?.kind ?? defaultKind);
  const [name, setName] = useState(rule?.name ?? "");
  const [amountCents, setAmountCents] = useState(rule?.amountCents ?? 0);
  const [category, setCategory] = useState(rule?.category ?? "");
  const [frequency, setFrequency] = useState<FinanceRecurringRule["frequency"]>(rule?.frequency ?? "monthly");
  const [interval, setInterval] = useState(String(rule?.interval ?? 1));
  const [startsOn, setStartsOn] = useState(rule?.startsOn ?? today);
  const [dueDay, setDueDay] = useState(rule?.dueDay == null ? String(Number(today.slice(8, 10))) : String(rule.dueDay));
  const [endsOn, setEndsOn] = useState(rule?.endsOn ?? "");
  const [isVariable, setIsVariable] = useState(rule?.isVariable ?? false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const configuredDueDay = frequency === "weekly" ? null : Number(dueDay);
    const configuredInterval = Number(interval);
    if (!name.trim()) return setError("Dê um nome para a recorrência.");
    if (!amountCents) return setError("Informe o valor.");
    if (!categoriesFor(kind).includes(category)) return setError("Escolha uma categoria.");
    if (!isDate(startsOn)) return setError("Confira a data inicial.");
    if (!Number.isInteger(configuredInterval) || configuredInterval < 1 || configuredInterval > 12) return setError("A repetição deve ser de 1 a 12.");
    if (frequency !== "weekly" && (!Number.isInteger(configuredDueDay) || configuredDueDay! < 1 || configuredDueDay! > 31)) return setError("Escolha um dia de vencimento entre 1 e 31.");
    if (endsOn && (!isDate(endsOn) || endsOn < startsOn)) return setError("A data final precisa ser depois da inicial.");

    const nextRule: FinanceRecurringRule = {
      id: rule?.id ?? createFinanceId(),
      kind,
      name: name.trim(),
      amountCents,
      category,
      frequency,
      interval: configuredInterval,
      startsOn,
      dueDay: configuredDueDay,
      endsOn: endsOn || null,
      isActive: rule?.isActive ?? true,
      isVariable,
      notes: rule?.notes ?? null,
    };

    let saved = false;
    try {
      await saveRecurringRule(nextRule);
      saved = true;
      if (!rule) {
        const created = await generateOccurrences(nextRule.id, addDays(today, 90));
        onSaved(`${nextRule.name}: ${created} ${created === 1 ? "ocorrência criada" : "ocorrências criadas"} para os próximos 90 dias.`);
      } else {
        onSaved("Recorrência atualizada. Ocorrências já criadas mantêm seus valores.");
      }
    } catch {
      setError(saved
        ? "A regra foi salva, mas não foi possível gerar as ocorrências. Use “Gerar próximas”."
        : "Não foi possível salvar. Tente novamente.");
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <Segmented className="flex w-full" label="Tipo" value={kind} onChange={(value) => { setKind(value); setCategory(""); }} options={[{ value: "expense", label: "Conta a pagar" }, { value: "income", label: "Valor a receber" }]} />
      <label className={labelClass}>Nome<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder={kind === "income" ? "Ex.: Salário" : "Ex.: Aluguel"} className={fieldClass} /></label>
      <div>
        <span className="text-sm font-medium">Valor {isVariable ? "de referência" : ""}</span>
        <button type="button" onClick={() => setEditingAmount(true)} className={`mt-2 flex min-h-12 w-full items-center justify-between rounded-2xl border border-[var(--color-border)] px-4 text-left ${focusRing}`}>
          <span className={`tabular text-base font-semibold ${amountCents ? "" : "text-[var(--color-muted)]"}`}>{formatCurrency(amountCents, currency)}</span>
          <span className="text-sm font-semibold text-[var(--color-action)]">{amountCents ? "Alterar" : "Digitar"}</span>
        </button>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={isVariable} onChange={(event) => setIsVariable(event.target.checked)} className="h-5 w-5 accent-[var(--color-action)]" />
          O valor pode mudar a cada vez (ex.: conta de luz)
        </label>
      </div>
      <CategoryPicker kind={kind} value={category} onChange={setCategory} />
      <fieldset>
        <legend className="text-sm font-medium">Frequência</legend>
        <Segmented className="mt-2 flex w-full" label="Frequência" value={frequency} onChange={setFrequency} options={[{ value: "weekly", label: "Semanal" }, { value: "monthly", label: "Mensal" }, { value: "yearly", label: "Anual" }]} />
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>Repetir a cada
          <select value={interval} onChange={(event) => setInterval(event.target.value)} className={fieldClass}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>{value} {value === 1 ? frequencyLabels[frequency].one : frequencyLabels[frequency].many}</option>
            ))}
          </select>
        </label>
        <label className={labelClass}>Dia do vencimento
          <input type="number" min={1} max={31} value={frequency === "weekly" ? "" : dueDay} disabled={frequency === "weekly"} placeholder={frequency === "weekly" ? "Pela data inicial" : ""} onChange={(event) => setDueDay(event.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>Começa em<input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className={fieldClass} /></label>
        <label className={labelClass}>Termina em (opcional)<input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className={fieldClass} /></label>
      </div>
      {error ? <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button type="button" onClick={onCancel} className={softButton}>Cancelar</button>
        <button disabled={isSaving} className={primaryButton}>{isSaving ? "Salvando..." : rule ? "Salvar" : "Criar"}</button>
      </div>
      {editingAmount ? (
        <MoneyKeypad title={name.trim() || "Valor da recorrência"} currency={currency} tone={kind === "income" ? "success" : "action"} initialCents={amountCents || null} submitLabel="Confirmar" closeVariant="back" onSubmit={(cents) => { setAmountCents(cents); setEditingAmount(false); }} onClose={() => setEditingAmount(false)} />
      ) : null}
    </form>
  );
}
