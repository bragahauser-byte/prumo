"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { goalShades } from "@/components/goals-screen";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { GoalIcon, goalIcons } from "@/components/ui/category-icon";
import { Illustration } from "@/components/ui/illustration";
import { MoneyInput } from "@/components/ui/money-input";
import { ProgressRing } from "@/components/ui/progress-ring";
import { focusRing, inkButton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { goalProgress } from "@/domain/planning";
import { addDays } from "@/lib/dates";
import { createFinanceId } from "@/lib/finance/repository";
import { formatCalendarDate, formatCurrency } from "@/lib/formatting";

type DeadlineOption = "6m" | "1y" | "2y" | "custom" | "none";

type Draft = {
  icon: string;
  name: string;
  targetCents: number | null;
  savedCents: number | null;
  showSaved: boolean;
  deadlineOption: DeadlineOption;
  customDeadline: string;
};

const deadlineOptions: [DeadlineOption, string, string][] = [
  ["6m", "Em 6 meses", "6 meses"],
  ["1y", "Em 1 ano", "1 ano"],
  ["2y", "Em 2 anos", "2 anos"],
  ["custom", "Escolher data", "Data"],
  ["none", "Sem prazo", "Livre"],
];

function addMonthsTo(date: string, months: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}

const titles = ["Quais são suas metas?", "Quanto para cada uma?", "Até quando?"];
const subtitles = [
  "Escolha uma ou várias. Depois dá para criar quantas quiser.",
  "Digite o valor de cada meta. Nenhum dinheiro é movimentado.",
  "O Prumo divide o que falta pelos meses até o prazo, sem juros ou rendimentos.",
];

export function GoalCreateFlow() {
  const router = useRouter();
  const toast = useToast();
  const { saveSavingsGoal, savingsGoals, isSaving } = useFinance();
  const { today, currency } = useFinanceSummary();
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const single = drafts.length === 1;
  const colorFor = (index: number) => goalShades[(savingsGoals.length + index) % goalShades.length];

  const deadlineFor = (draft: Draft, option = draft.deadlineOption) => option === "6m" ? addMonthsTo(today, 6)
    : option === "1y" ? addMonthsTo(today, 12)
      : option === "2y" ? addMonthsTo(today, 24)
        : option === "custom" ? draft.customDeadline : null;
  const projection = (draft: Draft, option = draft.deadlineOption) => goalProgress({
    targetCents: draft.targetCents ?? 0,
    deadline: deadlineFor(draft, option),
    contributions: draft.savedCents ? [{ amountCents: draft.savedCents, date: today, status: "done" }] : [],
  }, today);

  const update = (index: number, patch: Partial<Draft>) => setDrafts((current) => current.map((draft, position) => position === index ? { ...draft, ...patch } : draft));

  function toggle(icon: string) {
    setError(null);
    setDrafts((current) => {
      if (current.some((draft) => draft.icon === icon)) return current.filter((draft) => draft.icon !== icon);
      const label = goalIcons.find((item) => item.value === icon)?.label ?? "";
      return [...current, { icon, name: icon === "other" ? "" : label, targetCents: null, savedCents: null, showSaved: false, deadlineOption: "1y", customDeadline: addMonthsTo(today, 12) }];
    });
  }

  function back() {
    setError(null);
    if (step === 0) router.back();
    else setStep(step - 1);
  }

  function next() {
    setError(null);
    if (step === 0) {
      if (!drafts.length) return setError("Escolha pelo menos uma meta para continuar.");
      return setStep(1);
    }
    if (step === 1) {
      for (const draft of drafts) {
        const label = draft.name.trim() || "a meta";
        if (!draft.name.trim()) return setError("Dê um nome para cada meta.");
        if (!draft.targetCents || draft.targetCents <= 0) return setError(`Digite o valor de ${label}.`);
        if (draft.savedCents && draft.savedCents > draft.targetCents) return setError(`O valor já guardado em ${label} passa do valor da meta.`);
      }
      return setStep(2);
    }
    void create();
  }

  async function create() {
    for (const draft of drafts) {
      const deadline = deadlineFor(draft);
      if (draft.deadlineOption === "custom" && (!deadline || deadline <= today)) return setError(`Escolha uma data futura para ${draft.name.trim()}.`);
    }
    const ids: string[] = [];
    try {
      for (const draft of drafts) {
        const id = createFinanceId();
        await saveSavingsGoal({
          id,
          name: draft.name.trim(),
          icon: draft.icon,
          targetCents: draft.targetCents ?? 0,
          deadline: deadlineFor(draft),
          createdOn: today,
          contributions: draft.savedCents ? [{ id: createFinanceId(), amountCents: draft.savedCents, date: today, status: "done" }] : [],
        });
        ids.push(id);
      }
      toast(ids.length === 1 ? "Meta criada com sucesso" : `${ids.length} metas criadas com sucesso`);
      router.replace(ids.length === 1 ? `/goals/detail?id=${ids[0]}` : "/goals");
    } catch {
      setError(ids.length ? `${ids.length} de ${drafts.length} metas foram criadas. Tente de novo para as demais.` : "Não foi possível criar a meta. Tente novamente.");
    }
  }

  const totalTarget = drafts.reduce((sum, draft) => sum + (draft.targetCents ?? 0), 0);
  const monthly = drafts.map((draft) => projection(draft).monthlyNeededCents);
  const totalMonthly = monthly.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const ringSegments = drafts.map((draft, index) => ({
    label: draft.name || draft.icon,
    color: colorFor(index),
    value: step === 0 ? 1 / drafts.length
      : step === 1 ? (totalTarget ? (draft.targetCents ?? 0) / totalTarget : 0)
        : totalMonthly ? (monthly[index] ?? 0) / totalMonthly : 0,
  }));
  const ringLabel = step === 0 ? `${drafts.length} ${drafts.length === 1 ? "meta escolhida" : "metas escolhidas"}`
    : step === 1 ? `Total das metas: ${formatCurrency(totalTarget, currency)}`
      : `Guardar ${formatCurrency(totalMonthly, currency)} por mês`;

  return (
    <div className="min-h-dvh bg-white lg:flex lg:items-start lg:justify-center lg:py-10">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col lg:min-h-[calc(100dvh-80px)]">
        <div className="px-6 pt-[max(env(safe-area-inset-top),64px)] lg:pt-0">
          <button type="button" onClick={back} aria-label={step === 0 ? "Fechar" : "Voltar"} className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <p className="sr-only" aria-live="polite">Etapa {step + 1} de {titles.length}</p>
        </div>

        <header className="px-6 pt-6">
          <h1 className="text-3xl font-semibold tracking-[-0.01em]">{titles[step]}</h1>
          <p className="mt-2 text-base leading-6 text-[var(--color-muted)]">{subtitles[step]}</p>
        </header>

        <div className="flex justify-center px-6 pt-6">
          <ProgressRing size={step === 0 ? 216 : 248} stroke={12} segments={ringSegments} label={ringLabel}>
            {step === 0 ? (
              drafts.length ? (
                <>
                  <span className="tabular text-4xl font-semibold">{drafts.length}</span>
                  <span className="text-sm text-[var(--color-muted)]">{drafts.length === 1 ? "meta escolhida" : "metas escolhidas"}</span>
                </>
              ) : <Illustration name="journey" size={120} priority />
            ) : null}
            {step === 1 ? (
              single ? (
                <MoneyInput variant="hero" label="Valor da meta" value={drafts[0].targetCents} onChange={(cents) => update(0, { targetCents: cents })} currency={currency} autoFocus hint="valor da meta" />
              ) : (
                <>
                  <span className="tabular max-w-full truncate text-3xl font-semibold">{formatCurrency(totalTarget, currency)}</span>
                  <span className="text-sm text-[var(--color-muted)]">somando {drafts.length} metas</span>
                </>
              )
            ) : null}
            {step === 2 ? (
              totalMonthly ? (
                <>
                  <span className="tabular max-w-full truncate text-3xl font-semibold">{formatCurrency(totalMonthly, currency)}</span>
                  <span className="text-sm text-[var(--color-muted)]">por mês{single ? "" : ", somando as metas"}</span>
                  {single && monthly[0] !== null ? <span className="mt-2 text-xs text-[var(--color-tertiary)]">{projection(drafts[0]).monthsLeft} aportes mensais, contando este mês</span> : null}
                </>
              ) : (
                <>
                  <span className="text-xl font-semibold">No seu ritmo</span>
                  <span className="text-sm text-[var(--color-muted)]">sem valor mensal fixo</span>
                </>
              )
            ) : null}
          </ProgressRing>
        </div>

        <div className="flex-1 px-6 pb-4 pt-6">
          {step === 0 ? (
            <ul className="divide-y divide-[var(--color-border)]" aria-label="Destino da meta" role="group">
              {goalIcons.map((item) => {
                const index = drafts.findIndex((draft) => draft.icon === item.value);
                const active = index >= 0;
                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={active}
                      onClick={() => toggle(item.value)}
                      className={`flex min-h-16 w-full items-center gap-3 py-2 text-left ${focusRing}`}
                    >
                      <GoalIcon icon={item.value} size={48} />
                      <span className={`min-w-0 flex-1 text-base ${active ? "font-semibold" : ""}`}>{item.label}</span>
                      {active ? <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5" style={{ backgroundColor: colorFor(index) }} aria-hidden="true" /> : null}
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-[var(--color-forest-green)] bg-[var(--color-forest-green)] text-[var(--color-bright-green)]" : "border-[var(--color-border-overlay)]"}`} aria-hidden="true">
                        {active ? <Check size={16} strokeWidth={3} /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {step === 1 ? (
            <div className="space-y-8">
              {drafts.map((draft, index) => (
                <fieldset key={draft.icon} className="space-y-4">
                  <legend className="sr-only">{draft.name || "Meta"}</legend>
                  <div className="flex items-end gap-3">
                    <GoalIcon icon={draft.icon} size={44} />
                    <label className="block min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-tertiary)]">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(index) }} aria-hidden="true" />
                        Nome da meta
                      </span>
                      <input value={draft.name} onChange={(event) => update(index, { name: event.target.value })} maxLength={80} placeholder="Ex.: Viagem para o Chile" className="mt-1 w-full border-b border-[var(--color-text)] bg-transparent pb-2 text-xl font-medium outline-none placeholder:text-[var(--color-placeholder)] focus:border-[var(--color-action)]" />
                    </label>
                  </div>
                  {single ? null : (
                    <MoneyInput label={`Valor da meta ${draft.name.trim() || ""}`.trim()} value={draft.targetCents} onChange={(cents) => update(index, { targetCents: cents })} currency={currency} />
                  )}
                  {draft.showSaved || draft.savedCents ? (
                    <MoneyInput label={single ? "Já guardei (opcional)" : `Já guardei em ${draft.name.trim() || "esta meta"} (opcional)`} value={draft.savedCents} onChange={(cents) => update(index, { savedCents: cents })} currency={currency} autoFocus={draft.showSaved && !draft.savedCents} hint="Conta como primeiro aporte. Nenhum dinheiro é movimentado." />
                  ) : (
                    <button type="button" onClick={() => update(index, { showSaved: true })} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold text-[var(--color-link)] ${focusRing}`}>
                      <Plus size={18} aria-hidden="true" /> Já guardei uma parte
                    </button>
                  )}
                </fieldset>
              ))}
            </div>
          ) : null}

          {step === 2 && single ? (
            <ul role="radiogroup" aria-label="Prazo da meta" className="divide-y divide-[var(--color-border)]">
              {deadlineOptions.map(([option, label]) => {
                const draft = drafts[0];
                const active = draft.deadlineOption === option;
                const value = projection(draft, option);
                return (
                  <li key={option}>
                    <button type="button" role="radio" aria-checked={active} onClick={() => update(0, { deadlineOption: option })} className={`flex min-h-14 w-full items-center gap-3 py-2 text-left ${focusRing} ${active ? "text-[var(--color-text)]" : "text-[var(--color-muted)]"}`}>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-[var(--color-forest-green)]" : "border-[var(--color-border-overlay)]"}`} aria-hidden="true">
                        {active ? <span className="h-3 w-3 rounded-full bg-[var(--color-forest-green)]" /> : null}
                      </span>
                      <span className={`flex-1 text-base ${active ? "font-semibold" : ""}`}>{label}</span>
                      <span className="tabular text-sm">{value.monthlyNeededCents !== null ? `${formatCurrency(value.monthlyNeededCents, currency)}/mês` : "livre"}</span>
                    </button>
                    {option === "custom" && active ? (
                      <label className="block pb-3 pl-9">
                        <span className="sr-only">Data da meta</span>
                        <input type="date" min={addDays(today, 1)} value={draft.customDeadline} onChange={(event) => update(0, { customDeadline: event.target.value })} className="w-full border-b border-[var(--color-text)] bg-transparent pb-2 text-base outline-none" />
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {step === 2 && !single ? (
            <ul className="space-y-6">
              {drafts.map((draft, index) => {
                const value = projection(draft);
                return (
                  <li key={draft.icon} className="border-b border-[var(--color-border)] pb-5 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5" style={{ backgroundColor: colorFor(index) }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-base font-semibold">{draft.name.trim()}</span>
                      <span className="tabular shrink-0 text-sm font-semibold">{value.monthlyNeededCents !== null ? `${formatCurrency(value.monthlyNeededCents, currency)}/mês` : "livre"}</span>
                    </div>
                    <div role="radiogroup" aria-label={`Prazo de ${draft.name.trim()}`} className="mt-3 grid grid-cols-5 gap-1.5">
                      {deadlineOptions.map(([option, label, short]) => {
                        const active = draft.deadlineOption === option;
                        return (
                          <button key={option} type="button" role="radio" aria-checked={active} aria-label={label} onClick={() => update(index, { deadlineOption: option })} className={`min-h-11 rounded-full px-1 text-sm font-semibold transition-colors ${focusRing} ${active ? "bg-[var(--color-forest-green)] text-white" : "bg-[var(--color-soft)] text-[var(--color-text)] hover:bg-[var(--color-border)]"}`}>
                            {short}
                          </button>
                        );
                      })}
                    </div>
                    {draft.deadlineOption === "custom" ? (
                      <label className="mt-3 block">
                        <span className="sr-only">Data de {draft.name.trim()}</span>
                        <input type="date" min={addDays(today, 1)} value={draft.customDeadline} onChange={(event) => update(index, { customDeadline: event.target.value })} className="w-full border-b border-[var(--color-text)] bg-transparent pb-2 text-base outline-none" />
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {step === 2 && single && deadlineFor(drafts[0]) ? <p className="mt-4 text-sm text-[var(--color-muted)]">Prazo: {formatCalendarDate(deadlineFor(drafts[0])!)}.</p> : null}
          {error ? <p className="mt-4 text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
        </div>

        <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-white px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-4">
          <button type="button" onClick={next} disabled={isSaving || (step === 0 && !drafts.length)} className={`${inkButton} w-full`}>
            {step < 2 ? "Continuar" : isSaving ? "Criando..." : single ? "Criar meta" : `Criar ${drafts.length} metas`}
          </button>
        </div>
      </div>
    </div>
  );
}
