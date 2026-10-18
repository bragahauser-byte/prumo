"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { CategoryPicker } from "@/components/category-picker";
import { useFinance } from "@/components/finance-provider";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { Illustration, goalIllustration } from "@/components/ui/illustration";
import { MoneyKeypad } from "@/components/ui/money-keypad";
import { Segmented, fieldClass, focusRing, labelClass, primaryButton, softButton } from "@/components/ui/primitives";
import { suggestCategory, type TransactionKind } from "@/domain/categories";
import { budgetUsage, goalProgress } from "@/domain/planning";
import { addDays, todayISO } from "@/lib/dates";
import { createFinanceId, type FinanceRecurringRule } from "@/lib/finance/repository";
import { formatCalendarDate, formatCurrency } from "@/lib/formatting";

type Repeat = "none" | FinanceRecurringRule["frequency"];

const repeatOptions: { value: Repeat; label: string }[] = [
  { value: "none", label: "Não" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

function useClose() {
  const router = useRouter();
  return () => {
    if (window.history.length > 1) router.back();
    else router.push("/overview");
  };
}

export function AddFlow() {
  const searchParams = useSearchParams();
  const goalId = searchParams.get("goal");
  return goalId ? <GoalContributionFlow goalId={goalId} /> : <TransactionFlow initialKind={searchParams.get("kind") === "income" ? "income" : "expense"} />;
}

function TransactionFlow({ initialKind }: { initialKind: TransactionKind }) {
  const close = useClose();
  const { saveExpense, saveRecurringRule, generateOccurrences, budgets, expenses, isSaving } = useFinance();
  const { currency, spendable, summary } = useFinanceSummary();
  const today = todayISO();
  const [kind, setKind] = useState<TransactionKind>(initialKind);
  const [step, setStep] = useState<"amount" | "details" | "done">("amount");
  const [amountCents, setAmountCents] = useState(0);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [date, setDate] = useState(today);
  const [settled, setSettled] = useState(true);
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const suggested = suggestCategory(description, kind);
  const effectiveCategory = categoryTouched ? category : category || suggested || "";
  const isIncome = kind === "income";
  const noun = isIncome ? "receita" : "gasto";
  const budget = !isIncome && effectiveCategory ? budgets.find((item) => item.category === effectiveCategory) : undefined;
  const budgetAfter = budget
    ? budgetUsage([budget], [...expenses, { id: "preview", kind: "expense", amountCents, status: "pending", date, paidOn: null, category: effectiveCategory, recurringRuleId: null }], date.slice(0, 7))[0]
    : null;

  function changeKind(next: TransactionKind) {
    setKind(next);
    setCategory("");
    setCategoryTouched(false);
  }

  function reset() {
    setStep("amount");
    setAmountCents(0);
    setDescription("");
    setCategory("");
    setCategoryTouched(false);
    setDate(today);
    setSettled(true);
    setRepeat("none");
    setNotes("");
    setError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const name = description.trim();
    if (!name) return setError(`Dê um nome para ${isIncome ? "esta receita" : "este gasto"}.`);
    if (!effectiveCategory) return setError("Escolha uma categoria.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Confira a data.");

    const isPaid = settled && date <= today;
    const status = isPaid ? "paid" as const : date > today ? "scheduled" as const : "pending" as const;
    const ruleId = repeat === "none" ? null : createFinanceId();

    try {
      if (ruleId && repeat !== "none") {
        await saveRecurringRule({
          id: ruleId,
          kind,
          name,
          amountCents,
          category: effectiveCategory,
          frequency: repeat,
          interval: 1,
          startsOn: date,
          dueDay: repeat === "weekly" ? null : Number(date.slice(8, 10)),
          endsOn: null,
          isActive: true,
          isVariable: false,
          notes: notes.trim() || null,
        });
      }
      await saveExpense({
        id: createFinanceId(),
        kind,
        description: name,
        amountCents,
        category: effectiveCategory,
        date,
        status,
        paidOn: isPaid ? date : null,
        notes: notes.trim() || null,
        recurringRuleId: ruleId,
        occurrenceDate: ruleId ? date : null,
      });
      if (ruleId) await generateOccurrences(ruleId, addDays(today, 90));
      setStep("done");
    } catch {
      setError("Não foi possível salvar. Seus dados continuam preenchidos; tente novamente.");
    }
  }

  if (step === "amount") {
    return (
      <MoneyKeypad
        title={isIncome ? "Adicionar dinheiro" : "Registrar gasto"}
        currency={currency}
        tone={isIncome ? "success" : "action"}
        initialCents={amountCents || null}
        submitLabel="Continuar"
        header={<Segmented tone="inverse" label="Tipo de registro" value={kind} onChange={changeKind} options={[{ value: "expense", label: "Gasto" }, { value: "income", label: "Receita" }]} />}
        helper={isIncome
          ? `Entradas registradas neste mês: ${formatCurrency(summary.incomeCents, currency)}`
          : spendable ? `Você ainda pode gastar ${formatCurrency(Math.max(0, spendable.amountCents), currency)} este mês` : "Digite o valor do gasto"}
        onSubmit={(cents) => { setAmountCents(cents); setStep("details"); }}
        onClose={close}
      />
    );
  }

  if (step === "done") {
    return (
      <DoneScreen
        title={isIncome ? "Receita registrada" : "Gasto registrado"}
        amount={`${isIncome ? "+" : "−"}${formatCurrency(amountCents, currency)}`}
        lines={[
          `${description.trim()} · ${effectiveCategory}`,
          `${formatCalendarDate(date)} · ${settled && date <= today ? (isIncome ? "Recebido" : "Pago") : "Previsto"}`,
          repeat !== "none" ? `Repete: ${repeatOptions.find((item) => item.value === repeat)?.label.toLocaleLowerCase("pt-BR")}` : null,
        ]}
        alert={budgetAfter && budgetAfter.level !== "ok"
          ? `${budgetAfter.category} chegou a ${Math.round(budgetAfter.ratio * 100)}% do orçamento do mês.`
          : null}
        alertLevel={budgetAfter?.level === "over" ? "over" : "warning"}
        onAgain={reset}
        againLabel={`Registrar outro ${noun}`}
        onDone={close}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] lg:flex lg:items-center lg:justify-center lg:p-6">
      <form onSubmit={(event) => void save(event)} className="animate-sheet-in mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-white lg:min-h-0 lg:rounded-[32px] lg:shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),16px)]">
          <button type="button" onClick={() => setStep("amount")} aria-label="Voltar ao valor" className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold">Detalhes {isIncome ? "da receita" : "do gasto"}</h1>
          <span className="h-11 w-11" aria-hidden="true" />
        </div>

        <button type="button" onClick={() => setStep("amount")} className={`mx-auto mt-6 rounded-2xl px-4 py-1 text-center ${focusRing}`} aria-label="Editar valor">
          <span className={`tabular block text-4xl font-semibold ${isIncome ? "text-[var(--color-success)]" : "text-[var(--color-text)]"}`}>{isIncome ? "+" : ""}{formatCurrency(amountCents, currency)}</span>
          <span className="mt-1 block text-xs font-semibold text-[var(--color-action)]">Toque para editar o valor</span>
        </button>

        <div className="flex-1 space-y-6 px-6 pb-6 pt-6">
          <label className={labelClass}>
            {isIncome ? "De onde veio?" : "Com o que foi?"}
            <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} autoFocus autoComplete="off" placeholder={isIncome ? "Ex.: Salário de outubro" : "Ex.: Mercado da semana"} className={fieldClass} />
          </label>

          <div>
            <CategoryPicker kind={kind} value={effectiveCategory} suggested={suggested} onChange={(value) => { setCategory(value); setCategoryTouched(true); }} />
            {suggested && !categoryTouched && effectiveCategory === suggested ? <p className="mt-2 text-xs text-[var(--color-muted)]" role="status">Categoria sugerida pela descrição. Toque em outra para trocar.</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Data
              <input type="date" value={date} onChange={(event) => { setDate(event.target.value); if (event.target.value > today) setSettled(false); }} className={fieldClass} />
            </label>
            <fieldset>
              <legend className="text-sm font-medium">Status</legend>
              <Segmented
                className="mt-2 flex w-full"
                label="Status"
                value={settled && date <= today ? "done" : "later"}
                onChange={(value) => setSettled(value === "done")}
                options={isIncome
                  ? [{ value: "done", label: "Já recebi" }, { value: "later", label: "Vou receber" }]
                  : [{ value: "done", label: "Já paguei" }, { value: "later", label: "Vou pagar" }]}
              />
              {date > today ? <p className="mt-1 text-xs text-[var(--color-muted)]">Datas futuras ficam como previstas.</p> : null}
            </fieldset>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Repetir</legend>
            <Segmented className="mt-2 flex w-full" label="Repetir" value={repeat} onChange={setRepeat} options={repeatOptions} />
            {repeat !== "none" ? <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">Criamos as próximas ocorrências dos próximos 90 dias na Agenda. Você pode pausar quando quiser.</p> : null}
          </fieldset>

          <label className={labelClass}>
            Observação (opcional)
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={2} className={`${fieldClass} py-3`} />
          </label>

          {budgetAfter ? (
            <p className={`rounded-2xl px-4 py-3 text-sm ${budgetAfter.level === "over" ? "bg-[var(--color-error-soft)] text-[var(--color-error)]" : budgetAfter.level === "warning" ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" : "bg-[var(--color-soft)] text-[var(--color-muted)]"}`} role="status">
              Com este gasto, {budgetAfter.category} fica em {Math.round(budgetAfter.ratio * 100)}% do orçamento ({formatCurrency(budgetAfter.spentCents, currency)} de {formatCurrency(budgetAfter.limitCents, currency)}).
            </p>
          ) : null}

          {error ? <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
        </div>

        <div className="sticky bottom-0 bg-white px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-3 lg:rounded-b-[32px]">
          <button disabled={isSaving} className={`${primaryButton} w-full ${isIncome ? "bg-[var(--color-success)] hover:bg-[var(--color-success)]" : ""}`}>
            {isSaving ? "Salvando..." : `Salvar ${noun}`}
          </button>
        </div>
      </form>
    </div>
  );
}

function GoalContributionFlow({ goalId }: { goalId: string }) {
  const close = useClose();
  const { savingsGoals, saveSavingsGoal, isSaving } = useFinance();
  const { currency } = useFinanceSummary();
  const today = todayISO();
  const goal = savingsGoals.find((item) => item.id === goalId);
  const [mode, setMode] = useState<"now" | "planned">("now");
  const [step, setStep] = useState<"amount" | "date" | "done">("amount");
  const [amountCents, setAmountCents] = useState(0);
  const [date, setDate] = useState(addDays(today, 30));
  const [error, setError] = useState<string | null>(null);

  if (!goal) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">Meta não encontrada</h1>
        <Link href="/goals" className={primaryButton}>Ver metas</Link>
      </div>
    );
  }

  const progress = goalProgress(goal, today);

  async function save(cents: number, contributionDate: string, status: "done" | "planned") {
    if (!goal) return;
    setError(null);
    try {
      await saveSavingsGoal({
        ...goal,
        contributions: [...goal.contributions, { id: createFinanceId(), amountCents: cents, date: contributionDate, status }],
      });
      setStep("done");
    } catch {
      setError("Não foi possível salvar o aporte. Tente novamente.");
    }
  }

  if (step === "amount") {
    return (
      <MoneyKeypad
        title={`Guardar em ${goal.name}`}
        currency={currency}
        tone="success"
        initialCents={amountCents || null}
        submitLabel={mode === "now" ? (isSaving ? "Salvando..." : "Guardar") : "Escolher data"}
        header={<Segmented tone="inverse" label="Tipo de aporte" value={mode} onChange={setMode} options={[{ value: "now", label: "Guardar agora" }, { value: "planned", label: "Planejar" }]} />}
        helper={error ?? (progress.isComplete
          ? "Meta concluída! Aportes extras continuam somando."
          : progress.monthlyNeededCents !== null
            ? `Sugestão: ${formatCurrency(progress.monthlyNeededCents, currency)} por mês · faltam ${formatCurrency(progress.remainingCents, currency)}`
            : `Faltam ${formatCurrency(progress.remainingCents, currency)} para a meta`)}
        onSubmit={(cents) => {
          setAmountCents(cents);
          if (mode === "now") void save(cents, today, "done");
          else setStep("date");
        }}
        onClose={close}
      />
    );
  }

  if (step === "date") {
    return (
      <div className="min-h-dvh bg-[var(--color-bg)] lg:flex lg:items-center lg:justify-center lg:p-6">
        <form
          onSubmit={(event) => { event.preventDefault(); if (date < today) setError("Escolha hoje ou uma data futura."); else void save(amountCents, date, "planned"); }}
          className="animate-sheet-in mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-white px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),16px)] lg:min-h-0 lg:rounded-[32px]"
        >
          <button type="button" onClick={() => setStep("amount")} aria-label="Voltar ao valor" className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="mt-6 text-3xl font-semibold">Quando você pretende guardar?</h1>
          <p className="mt-2 text-base text-[var(--color-muted)]">{formatCurrency(amountCents, currency)} para {goal.name}. O aporte planejado é descontado de “quanto ainda pode gastar” no mês escolhido.</p>
          <label className={`${labelClass} mt-8`}>
            Data do aporte
            <input type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
          </label>
          {error ? <p className="mt-3 text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
          <button disabled={isSaving} className={`${primaryButton} mt-auto w-full`}>{isSaving ? "Salvando..." : "Planejar aporte"}</button>
        </form>
      </div>
    );
  }

  const after = goalProgress(goal, today);
  return (
    <DoneScreen
      illustration={goalIllustration(goal.icon)}
      title={mode === "now" ? "Dinheiro guardado" : "Aporte planejado"}
      amount={formatCurrency(amountCents, currency)}
      lines={[
        goal.name,
        mode === "now"
          ? `${Math.round(after.ratio * 100)}% da meta · ${formatCurrency(after.savedCents, currency)} de ${formatCurrency(goal.targetCents, currency)}`
          : `Previsto para ${formatCalendarDate(date)}`,
      ]}
      onAgain={() => { setStep("amount"); setAmountCents(0); }}
      againLabel="Fazer outro aporte"
      onDone={close}
    />
  );
}

function DoneScreen({
  title,
  amount,
  lines,
  alert,
  alertLevel = "warning",
  illustration = "success",
  onAgain,
  againLabel,
  onDone,
}: {
  title: string;
  amount: string;
  lines: (string | null)[];
  alert?: string | null;
  alertLevel?: "warning" | "over";
  illustration?: Parameters<typeof Illustration>[0]["name"];
  onAgain: () => void;
  againLabel: string;
  onDone: () => void;
}) {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] lg:flex lg:items-center lg:justify-center lg:p-6">
      <div className="animate-sheet-in mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center bg-white px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-16 text-center lg:min-h-[680px] lg:rounded-[32px]" role="status">
        <div className="relative mt-6">
          <Illustration name={illustration} size={144} />
          <span className="absolute -bottom-2 -right-2 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[var(--color-success)] text-white">
            <Check size={24} strokeWidth={3} aria-hidden="true" />
          </span>
        </div>
        <h1 className="mt-10 text-3xl font-semibold">{title}</h1>
        <p className="tabular mt-2 text-4xl font-semibold">{amount}</p>
        <ul className="mt-4 space-y-1 text-base text-[var(--color-muted)]">
          {lines.filter(Boolean).map((line) => <li key={line}>{line}</li>)}
        </ul>
        {alert ? <p className={`mt-6 rounded-2xl px-4 py-3 text-sm ${alertLevel === "over" ? "bg-[var(--color-error-soft)] text-[var(--color-error)]" : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"}`}>{alert}</p> : null}
        <div className="mt-auto flex w-full flex-col gap-3 pt-10">
          <button type="button" onClick={onDone} className={`${primaryButton} w-full`}>Concluir</button>
          <button type="button" onClick={onAgain} className={`${softButton} w-full`}>{againLabel}</button>
        </div>
      </div>
    </div>
  );
}
