"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ExpensePaymentButton } from "@/components/expense-payment-button";
import { useFinance } from "@/components/finance-provider";
import {
  estimateBalanceAfterCommitments,
  getUpcomingExpenses,
  sumByCategory,
  sumExpenses,
  sumPaid,
  sumPending,
  type ExpenseLike,
} from "@/domain/financial";
import { formatCalendarDate, formatCurrency, formatMonth } from "@/lib/formatting";

function dateForMonth(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function addMonths(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function OverviewScreen() {
  const { expenses, preferences } = useFinance();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const currency = preferences?.currency ?? "BRL";
  const monthExpenses = useMemo(() => expenses.filter((expense) => expense.date.startsWith(`${month}-`)), [expenses, month]);
  const financeExpenses: ExpenseLike[] = monthExpenses.map((expense) => ({
    id: expense.id,
    amountCents: expense.amountCents,
    status: expense.status,
    date: expense.date,
    category: expense.category,
  }));
  const knownUnpaid: ExpenseLike[] = expenses
    .filter((expense) => expense.status !== "paid")
    .map((expense) => ({
      id: expense.id,
      amountCents: expense.amountCents,
      status: expense.status,
      date: expense.date,
      category: expense.category,
    }));
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = getUpcomingExpenses(expenses.map((expense) => ({
    id: expense.id,
    amountCents: expense.amountCents,
    status: expense.status,
    date: expense.date,
    category: expense.category,
  })), 7, today);
  const totals = {
    planned: sumExpenses(financeExpenses),
    paid: sumPaid(financeExpenses),
    pending: sumPending(financeExpenses),
  };
  const categories = sumByCategory(financeExpenses);
  const categoryTotal = categories.reduce((total, category) => total + category.amountCents, 0);
  const currentMonthName = formatMonth(dateForMonth(month));

  return (
    <div>
      {preferences?.displayName ? <p className="mb-2 text-sm text-[var(--color-muted)]">Olá, {preferences.displayName}</p> : null}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-muted)]">Resumo de vencimentos</p>
          <p className="mt-1 text-base font-medium capitalize">{currentMonthName}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior" className="min-h-10 underline underline-offset-4">Anterior</button>
          <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês" className="min-h-10 underline underline-offset-4">Próximo</button>
        </div>
      </div>

      <section aria-label="Resumo financeiro do mês" className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-5">
        <article className="border-t border-[var(--color-border)] py-5">
          <h2 className="text-sm text-[var(--color-muted)]">Saldo disponível informado</h2>
          <p className="mt-2 text-2xl font-semibold">{preferences?.reportedBalanceCents == null ? "Não informado" : formatCurrency(preferences.reportedBalanceCents, currency)}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Valor digitado por você; não consultado no banco.</p>
        </article>
        <article className="border-t border-[var(--color-border)] py-5">
          <h2 className="text-sm text-[var(--color-muted)]">Pagas neste mês</h2>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(totals.paid, currency)}</p>
        </article>
        <article className="border-t border-[var(--color-border)] py-5">
          <h2 className="text-sm text-[var(--color-muted)]">Compromissos pendentes</h2>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(totals.pending, currency)}</p>
        </article>
        <article className="border-t border-[var(--color-border)] py-5">
          <h2 className="text-sm text-[var(--color-muted)]">Total previsto</h2>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(totals.planned, currency)}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Soma do que foi registrado para o mês.</p>
        </article>
        <article className="border-t border-[var(--color-border)] py-5">
          <h2 className="text-sm text-[var(--color-muted)]">Renda mensal informada</h2>
          <p className="mt-2 text-2xl font-semibold">{preferences?.monthlyIncomeCents == null ? "Não informada" : formatCurrency(preferences.monthlyIncomeCents, currency)}</p>
          {preferences?.payday ? <p className="mt-1 text-xs text-[var(--color-muted)]">Recebimento habitual no dia {preferences.payday}.</p> : null}
        </article>
      </section>

      {preferences?.reportedBalanceCents != null ? (
        <section className="mb-8 border-y border-[var(--color-border)] py-4" aria-label="Estimativa após compromissos conhecidos">
          <h2 className="text-sm font-semibold">Estimativa após compromissos conhecidos</h2>
          <p className="mt-1 text-xl font-semibold">{formatCurrency(estimateBalanceAfterCommitments(preferences.reportedBalanceCents, knownUnpaid), currency)}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Saldo informado menos despesas não pagas registradas. Não representa saldo bancário confirmado nem considera gastos não registrados.</p>
        </section>
      ) : null}

      {monthExpenses.length === 0 ? (
        <EmptyState
          title={expenses.length === 0 ? "Seu mês começa aqui" : `Nenhuma despesa em ${currentMonthName}`}
          description={expenses.length === 0
            ? "Seu saldo e suas preferências estão disponíveis acima. Registre a primeira despesa para acompanhar pagamentos e vencimentos."
            : "Não há despesas salvas neste período. Seus outros registros permanecem disponíveis na tela de despesas."}
          action={<Link href="/expenses" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">Adicionar despesa</Link>}
        />
      ) : (
        <section className="grid gap-10 xl:grid-cols-[1.3fr_0.7fr]">
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold">Próximos 7 dias</h2>
              <Link href="/expenses" className="text-sm underline underline-offset-4">Ver despesas</Link>
            </div>
            {upcoming.length ? (
              <ul className="mt-3 divide-y divide-[var(--color-border)]">
                {upcoming.map((expense) => {
                  const detail = expenses.find((item) => item.id === expense.id);
                  return (
                    <li key={expense.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div>
                        <h3 className="font-medium">{detail?.description}</h3>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">{expense.category} · {formatCalendarDate(expense.date)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{formatCurrency(expense.amountCents, currency)}</span>
                        <ExpensePaymentButton id={expense.id} currentStatus={expense.status} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-4 text-sm text-[var(--color-muted)]">Nenhum vencimento pendente nos próximos sete dias.</p>}
          </div>

          <div>
            <h2 className="text-xl font-semibold">Despesas por categoria</h2>
            <ul className="mt-4 space-y-4">
              {categories.map(({ category, amountCents }) => {
                const share = categoryTotal ? Math.round((amountCents / categoryTotal) * 100) : 0;
                return (
                  <li key={category}>
                    <div className="flex justify-between gap-3 text-sm"><span>{category}</span><span>{formatCurrency(amountCents, currency)} · {share}%</span></div>
                    <div className="mt-2 h-1.5 bg-[var(--color-border)]" role="meter" aria-label={`${category}: ${share}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share}>
                      <div className="h-full bg-[var(--color-action)]" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
