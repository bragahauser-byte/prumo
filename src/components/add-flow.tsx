"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, CalendarDays, Check, Clock3, History, Repeat, Search, Tag, X } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { CategoryIcon, GoalIcon } from "@/components/ui/category-icon";
import { Confetti } from "@/components/ui/confetti";
import { AmountDisplay, KeypadGrid, useKeypadInput } from "@/components/ui/money-keypad";
import { focusRing, inkButton } from "@/components/ui/primitives";
import { categoriesFor, suggestCategory, type TransactionKind } from "@/domain/categories";
import { budgetUsage, goalProgress } from "@/domain/planning";
import { addDays, todayISO } from "@/lib/dates";
import { createFinanceId, type FinanceRecurringRule } from "@/lib/finance/repository";
import { currencySymbol, formatCalendarDate, formatCurrency, formatCurrencyCompact, formatShortDate } from "@/lib/formatting";

type Action = TransactionKind | "goal";
type Stage = "amount" | "pick" | "note" | "confirm" | "done";
type Repeat = "none" | FinanceRecurringRule["frequency"];

const repeatCycle: Repeat[] = ["none", "weekly", "monthly", "yearly"];
const repeatLabels: Record<Repeat, string> = { none: "Não repete", weekly: "Toda semana", monthly: "Todo mês", yearly: "Todo ano" };

function useClose() {
  const router = useRouter();
  return () => {
    if (window.history.length > 1) router.back();
    else router.push("/overview");
  };
}

/** Fluxo de registro: valor primeiro (teclado em tela cheia) e detalhes num painel que sobe por cima. */
export function AddFlow() {
  const searchParams = useSearchParams();
  const close = useClose();
  const finance = useFinance();
  const { expenses, savingsGoals, budgets, preferences, isSaving, saveExpense, saveRecurringRule, generateOccurrences, saveSavingsGoal } = finance;
  const { currency, spendable, balanceCents } = useFinanceSummary();
  const today = todayISO();
  const fixedGoal = savingsGoals.find((goal) => goal.id === searchParams.get("goal")) ?? null;

  const [stage, setStage] = useState<Stage>("amount");
  const [action, setAction] = useState<Action>(fixedGoal ? "goal" : "expense");
  const [amountCents, setAmountCents] = useState(0);
  const [category, setCategory] = useState("");
  const [goalId, setGoalId] = useState<string | null>(fixedGoal?.id ?? null);
  const [search, setSearch] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [settled, setSettled] = useState(true);
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const keypad = useKeypadInput({ currency, enabled: stage === "amount", onEscape: close });
  const goal = savingsGoals.find((item) => item.id === goalId) ?? null;
  const kind: TransactionKind = action === "income" ? "income" : "expense";
  const isPaid = settled && date <= today;
  const amountLabel = formatCurrencyCompact(amountCents, currency);

  const recentCategories = useMemo(() => {
    const seen: string[] = [];
    for (const item of [...expenses].sort((left, right) => right.date.localeCompare(left.date))) {
      if (item.kind === kind && !seen.includes(item.category)) seen.push(item.category);
      if (seen.length === 3) break;
    }
    return seen;
  }, [expenses, kind]);
  const spentThisMonth = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of expenses) if (item.kind === kind && item.date.startsWith(today.slice(0, 7))) totals.set(item.category, (totals.get(item.category) ?? 0) + item.amountCents);
    return totals;
  }, [expenses, kind, today]);

  const budget = action === "expense" && category ? budgets.find((item) => item.category === category) : undefined;
  const budgetAfter = budget
    ? budgetUsage([budget], [...expenses, { id: "preview", kind: "expense", amountCents, status: "pending", date, paidOn: null, category, recurringRuleId: null }], date.slice(0, 7))[0]
    : null;

  function choose(next: Action) {
    if (keypad.cents <= 0) { keypad.reject(); return; }
    setAmountCents(keypad.cents);
    setAction(next);
    setError(null);
    setSearch("");
    if (next === "goal" && fixedGoal) { setGoalId(fixedGoal.id); setStage("confirm"); return; }
    setStage("pick");
  }

  function pickCategory(value: string) {
    setCategory(value);
    const typed = search.trim();
    if (typed && typed.toLocaleLowerCase("pt-BR") !== value.toLocaleLowerCase("pt-BR") && !description) setDescription(typed);
    setStage("note");
  }

  function reset() {
    setStage("amount");
    setCategory("");
    setGoalId(fixedGoal?.id ?? null);
    setDescription("");
    setDate(today);
    setSettled(true);
    setRepeat("none");
    setError(null);
    keypad.clear();
  }

  async function save() {
    setError(null);
    try {
      if (action === "goal") {
        if (!goal) return setError("Escolha uma meta.");
        const planned = date > today;
        await saveSavingsGoal({ ...goal, contributions: [...goal.contributions, { id: createFinanceId(), amountCents, date: planned ? date : today, status: planned ? "planned" : "done" }] });
      } else {
        const name = description.trim();
        if (!name) { setStage("note"); return setError("Escreva uma descrição."); }
        const status = isPaid ? "paid" as const : date > today ? "scheduled" as const : "pending" as const;
        const ruleId = repeat === "none" ? null : createFinanceId();
        if (ruleId && repeat !== "none") {
          await saveRecurringRule({
            id: ruleId, kind, name, amountCents, category, frequency: repeat, interval: 1, startsOn: date,
            dueDay: repeat === "weekly" ? null : Number(date.slice(8, 10)), endsOn: null, isActive: true, isVariable: false, notes: null,
          });
        }
        await saveExpense({
          id: createFinanceId(), kind, description: name, amountCents, category, date, status,
          paidOn: isPaid ? date : null, notes: null, recurringRuleId: ruleId, occurrenceDate: ruleId ? date : null,
        });
        if (ruleId) await generateOccurrences(ruleId, addDays(today, 90));
      }
      setSavedAt(new Date());
      setStage("done");
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    }
  }

  if (stage === "done") {
    return (
      <Receipt
        action={action}
        amount={formatCurrencyCompact(amountCents, currency)}
        title={action === "goal" ? goal?.name ?? "Meta" : description.trim()}
        icon={action === "goal" ? <GoalIcon icon={goal?.icon ?? "other"} size={64} /> : <CategoryIcon category={category} kind={kind} size={64} />}
        when={`${date === today ? "Hoje" : formatShortDate(date)}${savedAt ? ` · ${savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
        subtitle={action === "goal" ? (date > today ? `Aporte planejado para ${formatShortDate(date)}` : "Guardado na meta") : `Em ${category}`}
        details={[
          { icon: <Check size={20} aria-hidden="true" />, title: action === "goal" ? (date > today ? "Planejado" : "Guardado") : "Registrado", text: action === "goal" ? "O dinheiro continua na sua conta; a meta foi atualizada." : action === "income" ? "Receita salva com sucesso" : "Gasto salvo com sucesso" },
          action === "goal" && goal
            ? { icon: <Tag size={20} aria-hidden="true" />, title: "Progresso", text: `${Math.round(goalProgress(goal, today).ratio * 100)}% · ${formatCurrency(goalProgress(goal, today).savedCents, currency)} de ${formatCurrency(goal.targetCents, currency)}` }
            : { icon: <Tag size={20} aria-hidden="true" />, title: "Categoria", text: `${category}${repeat !== "none" ? " · fixo" : " · variável"}` },
          { icon: <CalendarDays size={20} aria-hidden="true" />, title: "Data", text: `${formatCalendarDate(date)}${action === "goal" ? "" : ` · ${isPaid ? (kind === "income" ? "Recebido" : "Pago") : "Previsto"}`}` },
          repeat !== "none" && action !== "goal" ? { icon: <Repeat size={20} aria-hidden="true" />, title: "Repetição", text: `${repeatLabels[repeat]} · próximas ocorrências na Agenda` } : null,
          budgetAfter && budgetAfter.level !== "ok" ? { icon: <AlertTriangle size={20} aria-hidden="true" />, title: "Orçamento", text: `${budgetAfter.category} chegou a ${Math.round(budgetAfter.ratio * 100)}% do limite do mês`, tone: budgetAfter.level } : null,
        ]}
        onDone={close}
        onAgain={reset}
      />
    );
  }

  const sheetOpen = stage !== "amount";
  const titleVerb = action === "goal" ? `Guardar ${amountLabel}` : action === "income" ? `Receita de ${amountLabel}` : `Gasto de ${amountLabel}`;
  const titlePrep = action === "income" ? "de" : "em";
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const suggested = suggestCategory(search, kind);
  const options = categoriesFor(kind).filter((item) => !query || item.toLocaleLowerCase("pt-BR").includes(query) || item === suggested);
  const firstRows = query ? [] : recentCategories;
  const goalOptions = savingsGoals.filter((item) => !query || item.name.toLocaleLowerCase("pt-BR").includes(query));

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 lg:items-center lg:p-6">
      <div className={`relative flex w-full flex-col overflow-hidden text-[#163300] transition-colors duration-300 lg:h-[min(840px,calc(100dvh-48px))] lg:max-w-[420px] lg:rounded-[40px] lg:shadow-[0_24px_80px_rgba(0,0,0,0.3)] ${sheetOpen ? "bg-[var(--color-accent-deep)]" : "bg-[var(--color-accent)]"}`}>
        <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),16px)]">
          <button type="button" onClick={close} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[#163300]/10 focus-visible:outline-2 focus-visible:outline-[#163300]">
            <X size={24} aria-hidden="true" />
          </button>
          <Link href="/settings" aria-label="Perfil e ajustes" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163300]">
            <ProfileAvatar name={preferences?.displayName} photo={preferences?.avatarDataUrl} inverse />
          </Link>
        </div>

        <div className={`flex flex-col items-center justify-center px-6 text-center ${sheetOpen ? "pt-6" : "pb-8 pt-12"}`}>
          <AmountDisplay value={sheetOpen ? String(amountCents / 100).replace(".", ",") : keypad.value} currency={currency} feedback={sheetOpen ? null : keypad.feedback} bumpKey={sheetOpen ? 0 : keypad.bumpKey} className={!sheetOpen && !keypad.value ? "opacity-60" : ""} />
          {!sheetOpen && fixedGoal ? <p className="mt-4 text-sm text-[#163300]/80">Guardar em {fixedGoal.name}</p> : null}
        </div>

        {!sheetOpen ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col justify-center px-4"><KeypadGrid onPress={keypad.press} decimals={keypad.decimals} /></div>
            <div className="space-y-2 px-4 pt-4">
              {fixedGoal ? (
                <button type="button" onClick={() => choose("goal")} className="min-h-12 w-full rounded-full bg-[#163300]/10 text-base font-semibold transition-colors hover:bg-[#163300]/15 focus-visible:outline-2 focus-visible:outline-[#163300]">Guardar</button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => choose("income")} className="min-h-12 rounded-full bg-[#163300]/10 text-base font-semibold transition-colors hover:bg-[#163300]/15 focus-visible:outline-2 focus-visible:outline-[#163300]">Receita</button>
                    <button type="button" onClick={() => choose("goal")} className="min-h-12 rounded-full bg-[#163300]/10 text-base font-semibold transition-colors hover:bg-[#163300]/15 focus-visible:outline-2 focus-visible:outline-[#163300]">Guardar</button>
                  </div>
                  <button type="button" onClick={() => choose("expense")} className="min-h-12 w-full rounded-full bg-[#163300]/10 text-base font-semibold transition-colors hover:bg-[#163300]/15 focus-visible:outline-2 focus-visible:outline-[#163300]">Gasto</button>
                </>
              )}
            </div>
            <nav aria-label="Atalhos" className="flex items-center justify-around px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
              <Link href="/overview" className="tabular min-w-16 text-center text-base font-semibold text-[#163300]/70 hover:text-[#163300]" aria-label={`Início, ainda pode gastar ${formatCurrency(Math.max(0, spendable?.amountCents ?? balanceCents ?? 0), currency)}`}>
                {formatCurrencyCompact(Math.max(0, spendable?.amountCents ?? balanceCents ?? 0), currency)}
              </Link>
              <span className="flex h-12 w-16 items-center justify-center rounded-full bg-[#163300]/10 text-xl font-semibold" aria-current="page" aria-label="Registrar">{currencySymbol(currency)}</span>
              <Link href="/transactions" aria-label="Extrato" className="flex min-w-16 justify-center text-[#163300]/70 hover:text-[#163300]"><History size={24} aria-hidden="true" /></Link>
            </nav>
          </>
        ) : (
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-sheet-title"
            className="animate-sheet-in absolute inset-x-0 bottom-0 top-[30%] flex flex-col rounded-t-[28px] bg-white text-[var(--color-text)] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] lg:rounded-b-[40px]"
          >
            <span className="mx-auto mt-2 h-1 w-9 rounded-full bg-[var(--color-placeholder)]" aria-hidden="true" />
            <div className="px-6 pt-3">
              <button
                type="button"
                onClick={() => { setError(null); setStage(stage === "pick" ? "amount" : stage === "note" ? "pick" : action === "goal" ? (fixedGoal ? "amount" : "pick") : "note"); }}
                aria-label={stage === "pick" ? "Fechar" : "Voltar"}
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.12)] ${focusRing}`}
              >
                {stage === "pick" ? <X size={22} aria-hidden="true" /> : <ArrowLeft size={22} aria-hidden="true" />}
              </button>
              <h2 id="add-sheet-title" className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.01em]">
                {titleVerb} <span className="text-[var(--color-placeholder)]">{action === "goal" || stage === "pick" ? (action === "goal" ? "em" : titlePrep) : titlePrep}</span>
                {stage !== "pick" ? (
                  <span className="mt-1 flex items-center gap-2">
                    {action === "goal" ? <GoalIcon icon={goal?.icon ?? "other"} size={32} /> : <CategoryIcon category={category} kind={kind} size={32} />}
                    <span className="truncate">{action === "goal" ? goal?.name : category}</span>
                    {action !== "goal" ? <span className="text-[var(--color-placeholder)]">{kind === "income" ? "por" : "com"}</span> : null}
                  </span>
                ) : null}
                {stage === "confirm" && action !== "goal" ? <span className="mt-1 block break-words">{description.trim()}</span> : null}
              </h2>
            </div>

            {stage === "pick" ? (
              <div className="flex min-h-0 flex-1 flex-col px-6 pt-5">
                <label className="relative block">
                  <span className="sr-only">{action === "goal" ? "Buscar meta" : "Buscar categoria"}</span>
                  <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden="true" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={action === "goal" ? "Buscar meta" : "Categoria ou o que você comprou"} className="min-h-12 w-full rounded-full bg-[var(--color-soft)] pl-11 pr-4 text-base outline-none placeholder:text-[var(--color-muted)] focus:ring-2 focus:ring-[var(--color-action-soft)]" />
                </label>
                <div className="-mx-6 mt-3 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                  {action === "goal" ? (
                    goalOptions.length ? (
                      <ul>
                        {goalOptions.map((item) => {
                          const progress = goalProgress(item, today);
                          return (
                            <li key={item.id}>
                              <button type="button" onClick={() => { setGoalId(item.id); setStage("confirm"); }} className={`flex min-h-16 w-full items-center gap-4 rounded-2xl py-2 text-left ${focusRing}`}>
                                <GoalIcon icon={item.icon} size={48} />
                                <span className="min-w-0 flex-1"><span className="block truncate text-base font-semibold">{item.name}</span><span className="block text-sm text-[var(--color-muted)]">{formatCurrency(progress.savedCents, currency)} de {formatCurrency(item.targetCents, currency)}</span></span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-base font-semibold">Nenhuma meta ainda</p>
                        <Link href="/goals/new" className="mt-2 inline-block text-sm font-semibold text-[var(--color-action)]">Criar uma meta</Link>
                      </div>
                    )
                  ) : (
                    <>
                      {firstRows.length ? (
                        <ul>
                          {firstRows.map((item) => <CategoryRow key={`recent-${item}`} category={item} kind={kind} subtitle={spentThisMonth.get(item) ? `${formatCurrency(spentThisMonth.get(item)!, currency)} neste mês` : "Usada recentemente"} onPick={pickCategory} />)}
                        </ul>
                      ) : null}
                      <h3 className="mt-4 text-xl font-semibold">{query ? "Resultados" : "Categorias"}</h3>
                      <ul className="mt-1">
                        {options.filter((item) => !firstRows.includes(item)).map((item) => (
                          <CategoryRow key={item} category={item} kind={kind} subtitle={item === suggested ? "Sugerida pela busca" : spentThisMonth.get(item) ? `${formatCurrency(spentThisMonth.get(item)!, currency)} neste mês` : kind === "income" ? "Entrada" : "Saída"} onPick={pickCategory} />
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {stage === "note" ? (
              <form onSubmit={(event) => { event.preventDefault(); if (!description.trim()) { setError("Escreva uma descrição."); return; } setError(null); setStage("confirm"); }} className="mt-5 border-t border-[var(--color-border)] px-6 pt-4">
                <div className="flex items-center gap-3">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Descrição</span>
                    <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} autoFocus placeholder="Descrição (obrigatória)" className="w-full bg-transparent text-base outline-none placeholder:text-[var(--color-placeholder)]" />
                  </label>
                  <button className={`min-h-11 shrink-0 rounded-full bg-[var(--color-soft)] px-5 text-base font-semibold transition-colors hover:bg-[var(--color-border)] ${focusRing}`}>Continuar</button>
                </div>
                {error ? <p className="mt-3 text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
              </form>
            ) : null}

            {stage === "confirm" ? (
              <div className="flex min-h-0 flex-1 flex-col px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">
                <div className="flex flex-wrap gap-2">
                  <span className="relative inline-flex">
                    <button type="button" onClick={() => dateInputRef.current?.showPicker?.()} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--color-soft)] px-3 text-sm font-medium ${focusRing}`}>
                      <CalendarDays size={16} aria-hidden="true" /> {date === today ? "Hoje" : formatShortDate(date)}
                    </button>
                    <input ref={dateInputRef} type="date" aria-label="Data" value={date} min={action === "goal" ? today : undefined} onChange={(event) => { if (event.target.value) { setDate(event.target.value); if (event.target.value > today) setSettled(false); } }} className="absolute inset-0 cursor-pointer opacity-0" />
                  </span>
                  {action !== "goal" ? (
                    <>
                      <button type="button" onClick={() => setSettled(!settled)} disabled={date > today} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--color-soft)] px-3 text-sm font-medium disabled:opacity-60 ${focusRing}`}>
                        {isPaid ? <Check size={16} aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />}
                        {isPaid ? (kind === "income" ? "Já recebi" : "Já paguei") : (kind === "income" ? "Vou receber" : "Vou pagar")}
                      </button>
                      <button type="button" onClick={() => setRepeat(repeatCycle[(repeatCycle.indexOf(repeat) + 1) % repeatCycle.length])} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--color-soft)] px-3 text-sm font-medium ${focusRing}`}>
                        <Repeat size={16} aria-hidden="true" /> {repeatLabels[repeat]}
                      </button>
                    </>
                  ) : null}
                </div>

                <div className="min-h-6 flex-1" />

                {budgetAfter && budgetAfter.level !== "ok" ? (
                  <p className={`mb-3 flex items-start gap-2 text-sm ${budgetAfter.level === "over" ? "text-[var(--color-error)]" : "text-[var(--color-warning)]"}`} role="status">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {budgetAfter.category} fica em {Math.round(budgetAfter.ratio * 100)}% do orçamento do mês.
                  </p>
                ) : null}
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className={`h-4 w-4 rounded-full ${action === "expense" ? "bg-[var(--color-action)]" : "bg-[var(--color-success)]"}`} aria-hidden="true" />
                  {action === "goal" && goal ? (
                    <><span className="font-semibold">Guardado em {goal.name}</span><span className="tabular text-[var(--color-muted)]">{formatCurrency(goalProgress(goal, today).savedCents, currency)} → {formatCurrency(goalProgress(goal, today).savedCents + (date > today ? 0 : amountCents), currency)}</span></>
                  ) : action === "expense" ? (
                    <><span className="font-semibold">Ainda pode gastar</span><span className="tabular text-[var(--color-muted)]">{spendable ? `${formatCurrency(spendable.amountCents - amountCents, currency)} depois` : "—"}</span></>
                  ) : (
                    <><span className="font-semibold">Saldo disponível</span><span className="tabular text-[var(--color-muted)]">{balanceCents !== null ? `${formatCurrency(balanceCents + (isPaid ? amountCents : 0), currency)} depois` : "não informado"}</span></>
                  )}
                </p>
                {error ? <p className="mt-3 text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
                <button type="button" onClick={() => void save()} disabled={isSaving} className={`${inkButton} mt-4 w-full`}>
                  {isSaving ? "Salvando..." : action === "goal" ? (date > today ? "Planejar aporte" : "Guardar") : action === "income" ? "Registrar receita" : "Registrar gasto"}
                </button>
                <p className="mt-3 text-center font-mono text-xs text-[var(--color-muted)]">O Prumo só registra: nenhum dinheiro é movimentado.</p>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}

function CategoryRow({ category, kind, subtitle, onPick }: { category: string; kind: TransactionKind; subtitle: string; onPick: (category: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onPick(category)} className={`flex min-h-16 w-full items-center gap-4 rounded-2xl py-2 text-left ${focusRing}`}>
        <CategoryIcon category={category} kind={kind} size={48} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{category}</span>
          <span className="block truncate text-sm text-[var(--color-muted)]">{subtitle}</span>
        </span>
      </button>
    </li>
  );
}

type ReceiptDetail = { icon: ReactNode; title: string; text: string; tone?: "warning" | "over" } | null;

function Receipt({
  action,
  amount,
  title,
  icon,
  when,
  subtitle,
  details,
  onDone,
  onAgain,
}: {
  action: Action;
  amount: string;
  title: string;
  icon: ReactNode;
  when: string;
  subtitle: string;
  details: ReceiptDetail[];
  onDone: () => void;
  onAgain: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-white lg:bg-black/40 lg:items-center lg:p-6">
      <Confetti />
      <div className="animate-sheet-in flex w-full flex-col overflow-hidden bg-white lg:h-[min(840px,calc(100dvh-48px))] lg:max-w-[420px] lg:rounded-[40px]" role="status" aria-label={`${title}: ${amount}`}>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-[max(env(safe-area-inset-top),16px)]">
          <button type="button" onClick={onDone} aria-label="Fechar" className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}>
            <X size={22} aria-hidden="true" />
          </button>
          <div className="mt-6">{icon}</div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.01em]">{title}</h1>
          <p className="mt-2 text-sm">{when}</p>
          <p className="text-sm">{subtitle}</p>
          <p className="tabular mt-8 text-display font-semibold">{action === "income" ? "+" : ""}{amount}</p>
          <h2 className="mt-10 text-xl font-semibold">Detalhes</h2>
          <ul className="mt-4 space-y-5 pb-6">
            {details.filter(Boolean).map((detail) => detail ? (
              <li key={detail.title} className={`flex gap-4 ${detail.tone === "over" ? "text-[var(--color-error)]" : detail.tone === "warning" ? "text-[var(--color-warning)]" : ""}`}>
                <span className="mt-0.5 shrink-0">{detail.icon}</span>
                <span><span className="block text-base font-semibold">{detail.title}</span><span className="block text-sm">{detail.text}</span></span>
              </li>
            ) : null)}
          </ul>
        </div>
        <div className="border-t border-[var(--color-border)] px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">
          <button type="button" onClick={onDone} className={`${inkButton} w-full`}>Concluir</button>
          <button type="button" onClick={onAgain} className="mt-2 min-h-11 w-full text-sm font-semibold text-[var(--color-muted)]">Registrar outro</button>
        </div>
      </div>
    </div>
  );
}
