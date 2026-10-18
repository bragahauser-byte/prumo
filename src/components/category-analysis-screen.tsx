"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { budgetLevelLabels } from "@/components/budgets-screen";
import { useFinance } from "@/components/finance-provider";
import { TransactionRow } from "@/components/transaction-row";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, SectionHeader, Segmented, fieldClass, focusRing, labelClass, primaryButton, textButton } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { analyzeCategories, monthRange, rangeMonth, spendingEntries, type CategoryTotal, type DateRange } from "@/domain/category-analysis";
import { shiftMonth } from "@/domain/planning";
import { currentMonth } from "@/lib/dates";
import type { FinanceExpense } from "@/lib/finance/repository";
import { formatCurrency, formatMonthKey, formatShortDate } from "@/lib/formatting";

/** Cor fixa por categoria (a cor acompanha a categoria, nunca a posição no ranking). */
const categoryColors: Record<string, string> = {
  Moradia: "#163300",
  Alimentação: "#9FE870",
  Transporte: "#A0E1E1",
  Saúde: "#FFC091",
  Contas: "#260A2F",
  Assinaturas: "#FFD7EF",
  Lazer: "#FFEB69",
  Compras: "#3A341C",
  Educação: "#320707",
  Outros: "#868685",
};
export const categoryColor = (category: string) => categoryColors[category] ?? "#C9CCC6";

type Mode = "month" | "range";
type Sort = "desc" | "asc";

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
const isDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

function Change({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-xs text-[var(--color-muted)]">sem gasto {label}</span>;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-[var(--color-expense)]" : "text-[var(--color-income)]"}`}>
      <Icon size={14} aria-hidden="true" />
      {up ? "+" : "−"}{Math.abs(Math.round(value * 100))}% <span className="font-normal text-[var(--color-muted)]">{label}</span>
    </span>
  );
}

export function CategoryAnalysisScreen() {
  const params = useSearchParams();
  const { expenses, budgets, preferences } = useFinance();
  const currency = preferences?.currency ?? "BRL";
  const initialFrom = params.get("from");
  const initialTo = params.get("to");
  const hasInitialRange = isDate(initialFrom) && isDate(initialTo) && initialFrom <= initialTo;
  const [mode, setMode] = useState<Mode>(hasInitialRange ? "range" : "month");
  const [month, setMonth] = useState(() => /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month")! : currentMonth());
  const [from, setFrom] = useState(hasInitialRange ? initialFrom! : monthRange(currentMonth()).from);
  const [to, setTo] = useState(hasInitialRange ? initialTo! : monthRange(currentMonth()).to);
  const [sort, setSort] = useState<Sort>("desc");
  const [selected, setSelected] = useState<string | null>(params.get("category"));

  const rangeError = mode === "range" && (!isDate(from) || !isDate(to) || from > to) ? "A data inicial precisa ser antes da final." : null;
  const range: DateRange = mode === "month" ? monthRange(month) : rangeError ? monthRange(month) : { from, to };
  const analysis = useMemo(() => analyzeCategories(expenses, range, budgets), [budgets, expenses, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const isMonth = rangeMonth(range) !== null;
  const previousLabel = isMonth ? `vs. ${formatMonthKey(rangeMonth(analysis.previousRange)!).split(" ")[0]}` : "vs. período anterior";
  const periodLabel = isMonth ? formatMonthKey(rangeMonth(range)!) : `${formatShortDate(range.from)} a ${formatShortDate(range.to)}`;

  const withSpending = analysis.categories.filter((item) => item.amountCents > 0);
  const onlyBefore = analysis.categories.filter((item) => item.amountCents === 0);
  const ordered = [...withSpending].sort((left, right) => sort === "desc" ? right.amountCents - left.amountCents : left.amountCents - right.amountCents);
  const selectedTotal = selected ? analysis.categories.find((item) => item.category === selected) ?? null : null;

  return (
    <div className="space-y-4">
      <Link href="/reports" className={`${textButton} -ml-3`}><ChevronLeft size={18} aria-hidden="true" /> Relatórios</Link>
      <h2 className="text-2xl font-semibold tracking-[-0.01em]">Gastos por categoria</h2>

      <Card className="space-y-4">
        <Segmented className="flex w-full" label="Período" value={mode} onChange={setMode} options={[{ value: "month", label: "Mês" }, { value: "range", label: "Intervalo de datas" }]} />
        {mode === "month" ? (
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior" className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}><ChevronLeft size={20} aria-hidden="true" /></button>
            <p className="text-base font-semibold first-letter:uppercase" aria-live="polite">{formatMonthKey(month)}</p>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês" className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}><ChevronRight size={20} aria-hidden="true" /></button>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>De<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className={fieldClass} /></label>
              <label className={labelClass}>Até<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} className={fieldClass} /></label>
            </div>
            {rangeError ? <p className="mt-2 text-sm text-[var(--color-error)]" role="alert">{rangeError}</p> : null}
          </div>
        )}
      </Card>

      {analysis.totalCents === 0 && !onlyBefore.length ? (
        <Card className="flex flex-col items-center px-6 py-12 text-center">
          <h3 className="text-xl font-semibold">Nenhum gasto em {periodLabel}</h3>
          <p className="mt-1 max-w-[320px] text-sm text-[var(--color-muted)]">Os gastos registrados no período aparecem aqui, somados por categoria.</p>
          <Link href="/add" className={`${primaryButton} mt-6`}><Plus size={20} aria-hidden="true" /> Registrar gasto</Link>
        </Card>
      ) : (
        <>
          <Card aria-labelledby="analysis-total" className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
            <ProgressRing
              size={216}
              stroke={16}
              gap={4}
              segments={ordered.map((item) => ({ value: item.share, color: categoryColor(item.category), label: item.category }))}
              label={`Distribuição dos gastos de ${periodLabel}: ${ordered.map((item) => `${item.category} ${percent(item.share)}`).join(", ")}`}
            >
              <span className="text-sm text-[var(--color-muted)]">{analysis.count} {analysis.count === 1 ? "lançamento" : "lançamentos"}</span>
              <span className="tabular max-w-full truncate text-2xl font-semibold text-[var(--color-expense)]">{formatCurrency(analysis.totalCents, currency)}</span>
              <span className="text-sm text-[var(--color-muted)]">{withSpending.length} {withSpending.length === 1 ? "categoria" : "categorias"}</span>
            </ProgressRing>
            <div className="w-full flex-1 text-center sm:text-left">
              <p id="analysis-total" className="text-sm text-[var(--color-muted)] first-letter:uppercase">Total de despesas · {periodLabel}</p>
              <p className="tabular mt-1 text-4xl font-semibold text-[var(--color-expense)]">{formatCurrency(analysis.totalCents, currency)}</p>
              <div className="mt-1"><Change value={analysis.change} label={previousLabel} /></div>
              <p className="tabular mt-3 text-sm text-[var(--color-muted)]">Período anterior: {formatCurrency(analysis.previousTotalCents, currency)}</p>
              <p className="mt-3 text-xs text-[var(--color-tertiary)]">Somente despesas. Entradas, transferências entre suas contas e pagamento de fatura não contam como gasto.</p>
            </div>
          </Card>

          <Card aria-labelledby="by-category">
            <SectionHeader id="by-category" title="Por categoria" action={<Segmented label="Ordenar" value={sort} onChange={setSort} options={[{ value: "desc", label: "Maior" }, { value: "asc", label: "Menor" }]} />} />
            <ul className="divide-y divide-[var(--color-border)]">
              {[...ordered, ...onlyBefore].map((item) => (
                <CategoryLine key={item.category} item={item} currency={currency} previousLabel={previousLabel} onOpen={() => setSelected(item.category)} />
              ))}
            </ul>
          </Card>
        </>
      )}

      {selected ? (
        <CategorySheet
          category={selected}
          total={selectedTotal}
          entries={spendingEntries(expenses, range, selected)}
          range={range}
          periodLabel={periodLabel}
          previousLabel={previousLabel}
          currency={currency}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function BudgetLine({ item, currency }: { item: CategoryTotal; currency: string }) {
  if (!item.budget) return <span className="text-xs text-[var(--color-muted)]">Sem orçamento</span>;
  const state = budgetLevelLabels[item.budget.level];
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className={`rounded-full px-2 py-0.5 font-semibold ${state.className}`}>{state.label}</span>
      <span className="tabular text-[var(--color-muted)]">
        {Math.floor(item.budget.ratio * 100)}% de {formatCurrency(item.budget.limitCents, currency)} ·{" "}
        {item.budget.remainingCents >= 0 ? `restam ${formatCurrency(item.budget.remainingCents, currency)}` : <span className="font-semibold text-[var(--color-error)]">excedente de {formatCurrency(-item.budget.remainingCents, currency)}</span>}
      </span>
    </span>
  );
}

function CategoryLine({ item, currency, previousLabel, onOpen }: { item: CategoryTotal; currency: string; previousLabel: string; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={`flex w-full items-start gap-3 rounded-xl py-3 text-left transition-colors hover:bg-[var(--color-soft)] ${focusRing}`} aria-label={`${item.category}: ${formatCurrency(item.amountCents, currency)}, ${percent(item.share)} das despesas. Ver lançamentos`}>
        <CategoryIcon category={item.category} size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5" style={{ backgroundColor: categoryColor(item.category) }} aria-hidden="true" />
              <span className="truncate text-base font-semibold">{item.category}</span>
            </span>
            <span className="tabular shrink-0 text-base font-semibold text-[var(--color-expense)]">{formatCurrency(item.amountCents, currency)}</span>
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-soft)]"><span className="block h-full rounded-full" style={{ width: `${item.share * 100}%`, backgroundColor: categoryColor(item.category) }} /></span>
            <span className="tabular w-10 shrink-0 text-right text-xs font-semibold">{percent(item.share)}</span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs text-[var(--color-muted)]">{item.count} {item.count === 1 ? "lançamento" : "lançamentos"}</span>
            <Change value={item.change} label={previousLabel} />
          </span>
          <span className="mt-1.5 block"><BudgetLine item={item} currency={currency} /></span>
        </span>
      </button>
    </li>
  );
}

function CategorySheet({ category, total, entries, range, periodLabel, previousLabel, currency, onClose }: {
  category: string;
  total: CategoryTotal | null;
  entries: FinanceExpense[];
  range: DateRange;
  periodLabel: string;
  previousLabel: string;
  currency: string;
  onClose: () => void;
}) {
  const query = new URLSearchParams({ category, from: range.from, to: range.to }).toString();
  return (
    <Sheet title={category} description={`Gastos de ${periodLabel}`} onClose={onClose} footer={<Link href={`/transactions?${query}`} className={`${primaryButton} w-full`}>Ver no extrato</Link>}>
      <dl className="grid grid-cols-2 gap-4">
        <div><dt className="text-sm text-[var(--color-muted)]">Total</dt><dd className="tabular text-xl font-semibold text-[var(--color-expense)]">{formatCurrency(total?.amountCents ?? 0, currency)}</dd></div>
        <div><dt className="text-sm text-[var(--color-muted)]">Das despesas</dt><dd className="tabular text-xl font-semibold">{percent(total?.share ?? 0)}</dd></div>
        <div><dt className="text-sm text-[var(--color-muted)]">Período anterior</dt><dd className="tabular text-base font-semibold">{formatCurrency(total?.previousCents ?? 0, currency)}</dd></div>
        <div><dt className="text-sm text-[var(--color-muted)]">Variação</dt><dd>{total ? <Change value={total.change} label={previousLabel} /> : "—"}</dd></div>
      </dl>
      {total?.budget ? (
        <div className="mt-4 rounded-2xl bg-[var(--color-soft)] p-4">
          <p className="text-sm font-semibold">Orçamento do mês</p>
          <div className="mt-2"><BudgetLine item={total} currency={currency} /></div>
        </div>
      ) : null}
      <h3 className="mt-6 text-base font-semibold">{entries.length} {entries.length === 1 ? "lançamento" : "lançamentos"}</h3>
      {entries.length ? (
        <ul className="divide-y divide-[var(--color-border)]">
          {entries.map((item) => <TransactionRow key={item.id} transaction={item} currency={currency} />)}
        </ul>
      ) : <p className="py-3 text-sm text-[var(--color-muted)]">Nenhum gasto nesta categoria no período.</p>}
    </Sheet>
  );
}
