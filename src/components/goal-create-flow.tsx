"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { goalShades } from "@/components/goals-screen";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { goalIcons } from "@/components/ui/category-icon";
import { Illustration } from "@/components/ui/illustration";
import { MoneyInput } from "@/components/ui/money-input";
import { ProgressRing } from "@/components/ui/progress-ring";
import { focusRing, inkButton } from "@/components/ui/primitives";
import { goalProgress } from "@/domain/planning";
import { addDays } from "@/lib/dates";
import { createFinanceId } from "@/lib/finance/repository";
import { formatCalendarDate, formatCurrency } from "@/lib/formatting";

type DeadlineOption = "6m" | "1y" | "2y" | "custom" | "none";

function addMonthsTo(date: string, months: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}

const steps = ["Para onde você quer ir?", "Quanto você quer juntar?", "Até quando?"];

export function GoalCreateFlow() {
  const router = useRouter();
  const { saveSavingsGoal, isSaving } = useFinance();
  const { today, currency } = useFinanceSummary();
  const [step, setStep] = useState(0);
  const [icon, setIcon] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [targetCents, setTargetCents] = useState<number | null>(null);
  const [savedCents, setSavedCents] = useState<number | null>(null);
  const [deadlineOption, setDeadlineOption] = useState<DeadlineOption>("1y");
  const [customDeadline, setCustomDeadline] = useState(addMonthsTo(today, 12));
  const [error, setError] = useState<string | null>(null);

  const deadlineFor = (option: DeadlineOption) => option === "6m" ? addMonthsTo(today, 6)
    : option === "1y" ? addMonthsTo(today, 12)
      : option === "2y" ? addMonthsTo(today, 24)
        : option === "custom" ? customDeadline : null;
  const projection = (option: DeadlineOption) => goalProgress({
    targetCents: targetCents ?? 0,
    deadline: deadlineFor(option),
    contributions: savedCents ? [{ amountCents: savedCents, date: today, status: "done" }] : [],
  }, today);
  const selected = projection(deadlineOption);

  function back() {
    setError(null);
    if (step === 0) router.back();
    else setStep(step - 1);
  }

  function next() {
    setError(null);
    if (step === 0) {
      if (!icon) return setError("Escolha um destino para continuar.");
      return setStep(1);
    }
    if (step === 1) {
      if (!name.trim()) return setError("Dê um nome para a meta.");
      if (!targetCents || targetCents <= 0) return setError("Digite um valor maior que zero.");
      if (savedCents && savedCents < 0) return setError("Confira o valor já guardado.");
      return setStep(2);
    }
    void create();
  }

  async function create() {
    const deadline = deadlineFor(deadlineOption);
    if (deadlineOption === "custom" && (!deadline || deadline <= today)) return setError("Escolha uma data futura.");
    const id = createFinanceId();
    try {
      await saveSavingsGoal({
        id,
        name: name.trim(),
        icon: icon ?? "other",
        targetCents: targetCents ?? 0,
        deadline,
        createdOn: today,
        contributions: savedCents ? [{ id: createFinanceId(), amountCents: savedCents, date: today, status: "done" }] : [],
      });
      router.replace(`/goals/detail?id=${id}`);
    } catch {
      setError("Não foi possível criar a meta. Tente novamente.");
    }
  }

  const ringValue = step === 2 ? Math.max(selected.ratio, 0.02) : (step + 1) / steps.length;

  return (
    <div className="min-h-dvh bg-white lg:flex lg:items-start lg:justify-center lg:py-10">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col lg:min-h-[calc(100dvh-80px)]">
        <div className="flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top),20px)]">
          <button type="button" onClick={back} aria-label={step === 0 ? "Fechar" : "Voltar"} className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <span className="text-sm font-medium text-[var(--color-muted)]" aria-label={`Etapa ${step + 1} de ${steps.length}`}>{step + 1}/{steps.length}</span>
        </div>

        <h1 className="px-6 pt-6 text-3xl font-semibold tracking-[-0.01em]">{steps[step]}</h1>

        <div className="flex justify-center px-6 pt-6">
          <ProgressRing
            size={256}
            stroke={10}
            value={ringValue}
            color="var(--color-success)"
            track="var(--color-soft)"
            label={step === 2 ? `${Math.round(selected.ratio * 100)}% já guardado` : `Etapa ${step + 1} de ${steps.length}`}
          >
            {step === 0 ? (
              <>
                <Illustration name="journey" size={132} priority />
                <span className="mt-1 text-sm text-[var(--color-muted)]">Cada aporte é um passo</span>
              </>
            ) : null}
            {step === 1 ? (
              <MoneyInput variant="hero" label="Valor da meta" value={targetCents} onChange={setTargetCents} currency={currency} autoFocus hint="valor da meta" />
            ) : null}
            {step === 2 ? (
              selected.monthlyNeededCents !== null ? (
                <>
                  <span className="tabular text-4xl font-semibold">{formatCurrency(selected.monthlyNeededCents, currency)}</span>
                  <span className="mt-1 text-sm text-[var(--color-muted)]">por mês</span>
                  <span className="mt-3 text-xs text-[var(--color-muted)]">{selected.monthsLeft} {selected.monthsLeft === 1 ? "aporte mensal" : "aportes mensais"}, contando este mês</span>
                </>
              ) : (
                <>
                  <span className="tabular text-3xl font-semibold">{formatCurrency(selected.remainingCents, currency)}</span>
                  <span className="mt-1 text-sm text-[var(--color-muted)]">no seu ritmo</span>
                </>
              )
            ) : null}
          </ProgressRing>
        </div>

        <div className="flex-1 px-6 pb-4 pt-6">
          {step === 0 ? (
            <ul role="radiogroup" aria-label="Destino da meta" className="divide-y divide-[var(--color-border)]">
              {goalIcons.map((item, index) => {
                const active = icon === item.value;
                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => { setIcon(item.value); if (!name.trim() || goalIcons.some((option) => option.label === name)) setName(item.value === "other" ? "" : item.label); }}
                      className={`flex min-h-12 w-full items-center gap-3 py-2 text-left ${focusRing} ${icon && !active ? "text-[var(--color-placeholder)]" : "text-[var(--color-text)]"}`}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: goalShades[index % goalShades.length], opacity: icon && !active ? 0.4 : 1 }} aria-hidden="true" />
                      <span className={`flex-1 text-base ${active ? "font-semibold" : ""}`}>{item.label}</span>
                      {active ? <Check size={18} className="text-[var(--color-success)]" aria-hidden="true" /> : <ChevronRight size={18} className="text-[var(--color-placeholder)]" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <label className="block">
                <span className="block text-xs font-semibold text-[#9A9AA0]">Nome da meta</span>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Ex.: Viagem para o Chile" className="mt-1 w-full border-b border-[var(--color-text)] bg-transparent pb-2 text-xl font-medium outline-none placeholder:text-[#C7C7CC] focus:border-[var(--color-action)]" />
              </label>
              <MoneyInput label="Já guardei (opcional)" value={savedCents} onChange={setSavedCents} currency={currency} hint="Conta como primeiro aporte. Nenhum dinheiro é movimentado." />
            </div>
          ) : null}

          {step === 2 ? (
            <ul role="radiogroup" aria-label="Prazo da meta" className="divide-y divide-[var(--color-border)]">
              {([
                ["6m", "Em 6 meses"],
                ["1y", "Em 1 ano"],
                ["2y", "Em 2 anos"],
                ["custom", "Escolher data"],
                ["none", "Sem prazo"],
              ] as [DeadlineOption, string][]).map(([option, label]) => {
                const active = deadlineOption === option;
                const value = projection(option);
                return (
                  <li key={option}>
                    <button type="button" role="radio" aria-checked={active} onClick={() => setDeadlineOption(option)} className={`flex min-h-12 w-full items-center gap-3 py-2 text-left ${focusRing} ${active ? "text-[var(--color-text)]" : "text-[var(--color-muted)]"}`}>
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${active ? "bg-[var(--color-success)]" : "bg-[var(--color-border)]"}`} aria-hidden="true" />
                      <span className={`flex-1 text-base ${active ? "font-semibold" : ""}`}>{label}</span>
                      <span className="tabular text-sm">{value.monthlyNeededCents !== null ? `${formatCurrency(value.monthlyNeededCents, currency)}/mês` : "livre"}</span>
                    </button>
                    {option === "custom" && active ? (
                      <label className="block pb-3 pl-6">
                        <span className="sr-only">Data da meta</span>
                        <input type="date" min={addDays(today, 1)} value={customDeadline} onChange={(event) => setCustomDeadline(event.target.value)} className="w-full border-b border-[var(--color-text)] bg-transparent pb-2 text-base outline-none" />
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {step === 2 && deadlineFor(deadlineOption) ? <p className="mt-4 text-sm text-[var(--color-muted)]">Prazo: {formatCalendarDate(deadlineFor(deadlineOption)!)}. Sem rendimentos ou juros nas contas — só o que você guardar.</p> : null}
          {error ? <p className="mt-4 text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
        </div>

        <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-white px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-4">
          <button type="button" onClick={next} disabled={isSaving || (step === 0 && !icon)} className={`${inkButton} w-full`}>
            {step < 2 ? "Continuar" : isSaving ? "Criando..." : "Criar meta"}
          </button>
        </div>
      </div>
    </div>
  );
}
