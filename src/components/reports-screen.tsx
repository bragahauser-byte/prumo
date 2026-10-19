"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ColumnChart } from "@/components/ui/column-chart";
import { Illustration } from "@/components/ui/illustration";
import { Card, SectionHeader, focusRing, primaryButton, textButton } from "@/components/ui/primitives";
import { expensesByCategory, fixedVariableSplit, monthlySeries, percentChange, shiftMonth, unusualIncreases } from "@/domain/planning";
import { currentMonth } from "@/lib/dates";
import { formatCurrency, formatMonthKey } from "@/lib/formatting";

const incomeColor = "#9FE870";
/** Saídas em cinza escuro: valores gastos não usam vermelho nem a cor de destaque. */
const expenseColor = "#6A6C6A";

function compactCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
}

function Change({ value, higherIsGood }: { value: number | null; higherIsGood: boolean }) {
  if (value === null) return <span className="text-xs text-[var(--color-muted)]">sem base</span>;
  if (value === 0) return <span className="text-xs text-[var(--color-muted)]">estável</span>;
  const good = value > 0 === higherIsGood;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${good ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"}`}><Icon size={14} aria-hidden="true" />{value > 0 ? "+" : ""}{value}%</span>;
}

export function ReportsScreen() {
  const { expenses } = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const { currency, summary, previousSummary, projectionCents, balanceCents } = useFinanceSummary(month);
  const previousMonth = shiftMonth(month, -1);
  const series = useMemo(() => monthlySeries(expenses, month, 6), [expenses, month]);
  const categories = useMemo(() => expensesByCategory(expenses, month), [expenses, month]);
  const previousCategories = useMemo(() => new Map(expensesByCategory(expenses, previousMonth).map((item) => [item.category, item.amountCents])), [expenses, previousMonth]);
  const unusual = useMemo(() => unusualIncreases(expenses, month), [expenses, month]);
  const split = fixedVariableSplit(expenses, month);
  const net = summary.incomeCents - summary.expenseCents;
  const previousNet = previousSummary.incomeCents - previousSummary.expenseCents;
  const topTotal = categories.reduce((sum, item) => sum + item.amountCents, 0);
  const isCurrent = month === currentMonth();

  if (expenses.length === 0) {
    return (
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <Illustration name="reports" size={144} />
        <h2 className="mt-6 text-xl font-semibold">Seus relatórios aparecem aqui</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-5 text-[var(--color-muted)]">Com receitas e despesas registradas, mostramos a evolução do mês a mês, as categorias que mais pesam e aumentos fora do comum.</p>
        <Link href="/add" className={`${primaryButton} mt-6 w-full max-w-[320px]`}>Fazer primeiro registro</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior" className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}><ChevronLeft size={20} aria-hidden="true" /></button>
        <p className="text-base font-semibold first-letter:uppercase" aria-live="polite">{formatMonthKey(month)}</p>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês" className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <p className="text-sm text-[var(--color-muted)]">{isCurrent ? "Estimativa de sobra no fim do mês" : "Saldo projetado no fim do mês"}</p>
          <p className="tabular mt-2 text-4xl font-semibold">{projectionCents === null ? "—" : formatCurrency(projectionCents, currency)}</p>
          <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
            {balanceCents !== null
              ? "Saldo atual + receitas a receber − contas a pagar até o último dia do mês."
              : "Receitas do mês (ou renda informada) − despesas do mês. Informe seu saldo para uma estimativa mais precisa."}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Resultado do mês</p>
          <p className="tabular mt-2 text-2xl font-semibold">{net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(net), currency)}</p>
          <div className="mt-1 flex items-center gap-2"><Change value={percentChange(net, previousNet)} higherIsGood /><span className="text-xs text-[var(--color-muted)]">vs. {formatMonthKey(previousMonth).split(" ")[0]}</span></div>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--color-muted)]">Receitas</dt><dd className="tabular font-medium text-[var(--color-income)]">{formatCurrency(summary.incomeCents, currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-muted)]">Despesas</dt><dd className="tabular font-medium text-[var(--color-expense)]">{formatCurrency(summary.expenseCents, currency)}</dd></div>
          </dl>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Gastos fixos e variáveis</p>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--color-soft)]" role="img" aria-label={`Fixos ${formatCurrency(split.fixedCents, currency)}, variáveis ${formatCurrency(split.variableCents, currency)}`}>
            <div className="h-full bg-[var(--color-action)]" style={{ width: `${summary.expenseCents ? (split.fixedCents / summary.expenseCents) * 100 : 0}%` }} />
            <div className="h-full border-l-2 border-white bg-[var(--color-accent)]" style={{ width: `${summary.expenseCents ? (split.variableCents / summary.expenseCents) * 100 : 0}%` }} />
          </div>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-[var(--color-muted)]"><span className="h-2.5 w-2.5 rounded-full bg-[var(--color-action)]" />Fixos (recorrentes)</dt><dd className="tabular font-medium">{formatCurrency(split.fixedCents, currency)}</dd></div>
            <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-[var(--color-muted)]"><span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />Variáveis</dt><dd className="tabular font-medium">{formatCurrency(split.variableCents, currency)}</dd></div>
          </dl>
        </Card>
      </div>

      {unusual.length ? (
        <Card aria-labelledby="unusual-title" className="bg-[var(--color-warning-soft)]">
          <h2 id="unusual-title" className="flex items-center gap-2 text-base font-semibold text-[var(--color-warning)]"><AlertTriangle size={18} aria-hidden="true" /> Aumentos fora do comum</h2>
          <ul className="mt-3 space-y-2">
            {unusual.map((item) => (
              <li key={item.category} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                <CategoryIcon category={item.category} size={40} />
                <p className="min-w-0 flex-1 text-sm"><strong className="font-semibold">{item.category}</strong>: {formatCurrency(item.currentCents, currency)} neste mês, {formatCurrency(item.increaseCents, currency)} acima da média dos últimos 3 meses ({formatCurrency(item.averageCents, currency)}).</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card aria-labelledby="evolution-title">
        <SectionHeader id="evolution-title" title="Evolução de receitas e despesas" />
        <ColumnChart
          title="Receitas e despesas nos últimos seis meses"
          series={[{ key: "income", label: "Receitas", color: incomeColor }, { key: "expense", label: "Despesas", color: expenseColor }]}
          data={series.map((item) => ({ label: formatMonthKey(item.month, "short"), longLabel: formatMonthKey(item.month), values: { income: item.incomeCents, expense: item.expenseCents } }))}
          formatValue={(value) => formatCurrency(value, currency)}
          formatTick={(value) => compactCurrency(value, currency)}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-labelledby="categories-title">
          <SectionHeader id="categories-title" title="Onde o dinheiro mais vai" action={<Link href={`/reports/categories?month=${month}`} className={textButton}>Análise completa</Link>} />
          {categories.length ? (
            <ul className="space-y-4">
              {categories.map((item) => {
                const share = topTotal ? item.amountCents / topTotal : 0;
                return (
                  <li key={item.category} className="flex items-center gap-3">
                    <CategoryIcon category={item.category} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{item.category}</span>
                        <span className="tabular shrink-0 font-semibold">{formatCurrency(item.amountCents, currency)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-soft)]"><div className="h-full rounded-full bg-[var(--color-action)]" style={{ width: `${share * 100}%` }} /></div>
                        <span className="tabular w-10 text-right text-xs text-[var(--color-muted)]">{Math.round(share * 100)}%</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-[var(--color-muted)]">Nenhuma despesa registrada em {formatMonthKey(month)}.</p>}
        </Card>

        <Card aria-labelledby="comparison-title">
          <SectionHeader id="comparison-title" title="Comparação com o mês anterior" />
          {categories.length || previousCategories.size ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-muted)]">
                  <th className="pb-2 font-medium">Categoria</th>
                  <th className="pb-2 text-right font-medium first-letter:uppercase">{formatMonthKey(previousMonth, "short")}</th>
                  <th className="pb-2 text-right font-medium first-letter:uppercase">{formatMonthKey(month, "short")}</th>
                  <th className="pb-2 text-right font-medium">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {[...new Set([...categories.map((item) => item.category), ...previousCategories.keys()])].map((category) => {
                  const current = categories.find((item) => item.category === category)?.amountCents ?? 0;
                  const previous = previousCategories.get(category) ?? 0;
                  return (
                    <tr key={category}>
                      <td className="py-2.5 font-medium">{category}</td>
                      <td className="tabular py-2.5 text-right text-[var(--color-muted)]">{formatCurrency(previous, currency)}</td>
                      <td className="tabular py-2.5 text-right">{formatCurrency(current, currency)}</td>
                      <td className="py-2.5 text-right"><Change value={percentChange(current, previous)} higherIsGood={false} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="text-sm text-[var(--color-muted)]">Sem despesas nos dois meses para comparar.</p>}
        </Card>
      </div>

      <p className="px-1 text-xs leading-5 text-[var(--color-muted)]">Relatórios usam apenas o que você registrou no Prumo. Não são saldo bancário confirmado nem recomendação de investimento.</p>
    </div>
  );
}
