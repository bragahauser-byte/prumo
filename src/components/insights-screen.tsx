"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { useFinance } from "@/components/finance-provider";
import { sumByCategory, sumExpenses } from "@/domain/financial";
import { formatCurrency, formatMonth } from "@/lib/formatting";

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function InsightsScreen() {
  const { expenses, preferences } = useFinance();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const currency = preferences?.currency ?? "BRL";
  const monthExpenses = useMemo(() => expenses.filter((expense) => expense.date.startsWith(`${month}-`)), [expenses, month]);
  const previousMonth = shiftMonth(month, -1);
  const previousExpenses = useMemo(() => expenses.filter((expense) => expense.date.startsWith(`${previousMonth}-`)), [expenses, previousMonth]);
  const monthTotal = sumExpenses(monthExpenses);
  const previousTotal = sumExpenses(previousExpenses);
  const byCategory = sumByCategory(monthExpenses);
  const nextWeek = new Date();
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const today = new Date().toISOString().slice(0, 10);
  const nextWeekTotal = expenses
    .filter((expense) => expense.status !== "paid" && expense.date >= today && expense.date <= nextWeek.toISOString().slice(0, 10))
    .reduce((total, expense) => total + expense.amountCents, 0);
  const incomeCents = preferences?.monthlyIncomeCents ?? null;

  if (expenses.length === 0) {
    return (
      <EmptyState
        title="Seus insights aparecem conforme você registra despesas"
        description="Com os seus lançamentos, mostramos vencimentos próximos, distribuição por categoria e comparações entre períodos quando houver dados suficientes."
        action={<Link href="/expenses" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white">Adicionar primeira despesa</Link>}
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted)]">Indicadores baseados apenas nos registros salvos.</p>
        <nav aria-label="Período dos insights" className="flex items-center gap-4 text-sm">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="min-h-10 underline underline-offset-4">Mês anterior</button>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="min-h-10 underline underline-offset-4">Próximo mês</button>
        </nav>
      </div>
      <h2 className="text-lg font-semibold capitalize">{formatMonth(new Date(`${month}-01T00:00:00Z`))}</h2>

      <ul className="mt-2 divide-y divide-[var(--color-border)]">
        <li className="py-5">
          <h3 className="font-semibold">Compromissos nos próximos 7 dias</h3>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(nextWeekTotal, currency)}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Soma de despesas não pagas com vencimento entre hoje e {nextWeek.toLocaleDateString("pt-BR", { timeZone: "UTC" })}.</p>
        </li>
        {monthExpenses.length ? (
          <>
            <li className="py-5">
              <h3 className="font-semibold">Total registrado no período</h3>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(monthTotal, currency)}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">Inclui despesas pagas e pendentes com vencimento em {formatMonth(new Date(`${month}-01T00:00:00Z`))}.</p>
            </li>
            <li className="py-5">
              <h3 className="font-semibold">Maior categoria registrada</h3>
              <p className="mt-2 text-2xl font-semibold">{byCategory[0].category}: {formatCurrency(byCategory[0].amountCents, currency)}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">Base: {formatMonth(new Date(`${month}-01T00:00:00Z`))}; não inclui despesas que você ainda não registrou.</p>
            </li>
          </>
        ) : (
          <li className="py-5 text-sm text-[var(--color-muted)]">Não há despesas registradas em {formatMonth(new Date(`${month}-01T00:00:00Z`))}; não há base para indicadores deste período.</li>
        )}
        {monthExpenses.length && previousExpenses.length ? (
          <li className="py-5">
            <h3 className="font-semibold">Variação frente ao mês anterior</h3>
            <p className="mt-2 text-2xl font-semibold">{monthTotal === previousTotal ? "Sem variação" : `${monthTotal > previousTotal ? "+" : "−"}${formatCurrency(Math.abs(monthTotal - previousTotal), currency)}`}</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{formatCurrency(monthTotal, currency)} em {formatMonth(new Date(`${month}-01T00:00:00Z`))} comparados com {formatCurrency(previousTotal, currency)} em {formatMonth(new Date(`${previousMonth}-01T00:00:00Z`))}. É uma comparação dos registros disponíveis.</p>
          </li>
        ) : (
          <li className="py-5 text-sm text-[var(--color-muted)]">A comparação mensal aparecerá quando os dois períodos tiverem despesas registradas.</li>
        )}
        {incomeCents !== null && incomeCents > 0 && monthExpenses.length ? (
          <li className="py-5">
            <h3 className="font-semibold">Participação na renda informada</h3>
            <p className="mt-2 text-2xl font-semibold">{Math.round((monthTotal / incomeCents) * 100)}%</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{formatCurrency(monthTotal, currency)} em despesas registradas ÷ {formatCurrency(incomeCents, currency)} de renda informada. Não representa todos os seus gastos.</p>
          </li>
        ) : (
          <li className="py-5 text-sm text-[var(--color-muted)]">{incomeCents === null ? <><Link href="/settings" className="underline underline-offset-4">Informe sua renda mensal</Link> para habilitar esta comparação.</> : "Registre despesas neste período para comparar com a renda informada."}</li>
        )}
      </ul>
    </div>
  );
}
