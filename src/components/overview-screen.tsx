"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { TransactionRow } from "@/components/transaction-row";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { Illustration } from "@/components/ui/illustration";
import { MoneyKeypad } from "@/components/ui/money-keypad";
import { Card, SectionHeader, TileLink, focusRing, textButton } from "@/components/ui/primitives";
import { percentChange, shiftMonth } from "@/domain/planning";
import { addDays } from "@/lib/dates";
import { formatCurrency, formatMonthKey, formatShortDate } from "@/lib/formatting";

function Comparison({ current, previous, previousLabel, higherIsGood }: { current: number; previous: number; previousLabel: string; higherIsGood: boolean }) {
  const change = percentChange(current, previous);
  if (change === null) return <p className="mt-1 text-xs text-[var(--color-muted)]">Sem registros em {previousLabel}</p>;
  if (change === 0) return <p className="mt-1 text-xs text-[var(--color-muted)]">Igual a {previousLabel}</p>;
  const good = change > 0 === higherIsGood;
  const Icon = change > 0 ? TrendingUp : TrendingDown;
  return (
    <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${good ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>
      <Icon size={14} aria-hidden="true" />
      {change > 0 ? "+" : ""}{change}% vs. {previousLabel}
    </p>
  );
}

export function OverviewScreen() {
  const { expenses, preferences, savingsGoals, savePreferences } = useFinance();
  const { today, month, currency, balanceCents, summary, previousSummary, spendable, projectionCents, savedCents, budgets } = useFinanceSummary();
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const previousLabel = formatMonthKey(shiftMonth(month, -1)).split(" ")[0];
  const weekAhead = addDays(today, 7);
  const upcoming = expenses
    .filter((item) => item.status !== "paid" && item.date <= weekAhead)
    .sort((left, right) => left.date.localeCompare(right.date));
  const nextBill = expenses
    .filter((item) => item.kind === "expense" && item.status !== "paid" && item.date >= today)
    .sort((left, right) => left.date.localeCompare(right.date))[0];
  const recent = [...expenses]
    .filter((item) => item.date <= today)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 5);
  const budgetsAtRisk = budgets.filter((item) => item.level !== "ok").length;

  async function saveBalance(cents: number) {
    if (!preferences) return;
    setBalanceError(null);
    try {
      await savePreferences({ ...preferences, reportedBalanceCents: cents, balanceReportedOn: today });
      setEditingBalance(false);
    } catch {
      setBalanceError("Não foi possível salvar o saldo. Tente novamente.");
    }
  }

  return (
    <div className="space-y-4">

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card aria-labelledby="balance-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="balance-title" className="text-base font-semibold">Saldo disponível</h2>
            <button type="button" onClick={() => setEditingBalance(true)} className={textButton}>{balanceCents === null ? "Informar" : "Atualizar"}</button>
          </div>
          <p className={`tabular mt-3 text-4xl font-semibold ${balanceCents !== null && balanceCents < 0 ? "text-[var(--color-error)]" : ""}`}>
            {balanceCents === null ? formatCurrency(0, currency).replace(/0,00$/, "—") : formatCurrency(balanceCents, currency)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {balanceCents === null
              ? "Informe quanto tem na conta para acompanhar o saldo."
              : preferences?.balanceReportedOn
                ? `Informado em ${formatShortDate(preferences.balanceReportedOn)} e ajustado pelo que foi pago ou recebido desde então.`
                : "Valor informado por você; não consultamos o banco."}
          </p>
          {balanceError ? <p className="mt-2 text-sm text-[var(--color-error)]" role="alert">{balanceError}</p> : null}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link href="/add?kind=income" className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[var(--color-soft)] px-4 text-base font-semibold transition-colors hover:bg-[var(--color-border)] ${focusRing}`}>
              <ArrowDownLeft size={18} className="text-[var(--color-success)]" aria-hidden="true" /> Adicionar
            </Link>
            <Link href="/add?kind=expense" className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[var(--color-soft)] px-4 text-base font-semibold transition-colors hover:bg-[var(--color-border)] ${focusRing}`}>
              <ArrowUpRight size={18} className="text-[var(--color-action)]" aria-hidden="true" /> Novo gasto
            </Link>
          </div>
        </Card>

        <Card aria-labelledby="spendable-title">
          <h2 id="spendable-title" className="text-base font-semibold">Quanto ainda pode gastar</h2>
          {spendable ? (
            <>
              <p className={`tabular mt-3 text-4xl font-semibold ${spendable.amountCents < 0 ? "text-[var(--color-error)]" : "text-[var(--color-action)]"}`}>{formatCurrency(spendable.amountCents, currency)}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">até o fim de {formatMonthKey(month).split(" ")[0]}</p>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-[var(--color-muted)]">{spendable.basis === "balance" ? "Saldo atual" : "Renda do mês"}</dt><dd className="tabular font-medium">{formatCurrency(spendable.basis === "balance" ? balanceCents ?? 0 : spendable.incomingCents, currency)}</dd></div>
                {spendable.basis === "balance" ? <div className="flex justify-between gap-3"><dt className="text-[var(--color-muted)]">A receber</dt><dd className="tabular font-medium text-[var(--color-success)]">+{formatCurrency(spendable.incomingCents, currency)}</dd></div> : null}
                <div className="flex justify-between gap-3"><dt className="text-[var(--color-muted)]">{spendable.basis === "balance" ? "Contas a pagar" : "Despesas do mês"}</dt><dd className="tabular font-medium">−{formatCurrency(spendable.outgoingCents, currency)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--color-muted)]">Reservado para metas</dt><dd className="tabular font-medium">−{formatCurrency(spendable.reservedCents, currency)}</dd></div>
              </dl>
            </>
          ) : (
            <div className="mt-3">
              <p className="text-base text-[var(--color-muted)]">Informe seu saldo ou registre uma receita para calcularmos quanto ainda cabe no mês.</p>
              <Link href="/add?kind=income" className={`${textButton} mt-3 -ml-3`}>Registrar receita</Link>
            </div>
          )}
        </Card>
      </div>

      <Card aria-labelledby="month-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="month-title" className="text-base font-semibold first-letter:uppercase">{formatMonthKey(month)}</h2>
          <Link href="/reports" className={textButton}>Ver relatório</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Receitas</p>
            <p className="tabular mt-1 text-2xl font-semibold text-[var(--color-success)]">{formatCurrency(summary.incomeCents, currency)}</p>
            <Comparison current={summary.incomeCents} previous={previousSummary.incomeCents} previousLabel={previousLabel} higherIsGood />
          </div>
          <div>
            <p className="text-sm text-[var(--color-muted)]">Despesas</p>
            <p className="tabular mt-1 text-2xl font-semibold">{formatCurrency(summary.expenseCents, currency)}</p>
            <Comparison current={summary.expenseCents} previous={previousSummary.expenseCents} previousLabel={previousLabel} higherIsGood={false} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TileLink href="/goals" title="Metas">
          <Illustration name="goals" size={88} className="-ml-1 mt-3" />
          <span className="tabular mt-4 text-xl font-semibold">{formatCurrency(savedCents, currency)}</span>
          <span className="mt-0.5 text-sm text-[var(--color-muted)]">{savingsGoals.length ? `guardados em ${savingsGoals.length} ${savingsGoals.length === 1 ? "meta" : "metas"}` : "Guarde para um objetivo"}</span>
        </TileLink>
        <TileLink href="/budgets" title="Orçamentos">
          <Illustration name="budgets" size={88} className="-ml-1 mt-3" />
          <span className={`mt-4 text-xl font-semibold ${budgetsAtRisk ? "text-[var(--color-warning)]" : ""}`}>{budgets.length ? budgetsAtRisk ? `${budgetsAtRisk} em alerta` : "Tudo em dia" : "Sem limites"}</span>
          <span className="mt-0.5 text-sm text-[var(--color-muted)]">{budgets.length ? `de ${budgets.length} ${budgets.length === 1 ? "categoria com limite" : "categorias com limite"}` : "Defina quanto gastar"}</span>
        </TileLink>
        <TileLink href="/bills" title="Agenda">
          <Illustration name="bills" size={88} className="-ml-1 mt-3" />
          <span className="mt-4 truncate text-xl font-semibold">{nextBill ? formatShortDate(nextBill.date) : "Em dia"}</span>
          <span className="mt-0.5 truncate text-sm text-[var(--color-muted)]">{nextBill ? `${nextBill.description} · ${formatCurrency(nextBill.amountCents, currency)}` : "Nenhuma conta a pagar"}</span>
        </TileLink>
        <TileLink href="/reports" title="Relatórios">
          <Illustration name="reports" size={88} className="-ml-1 mt-3" />
          <span className={`tabular mt-4 text-xl font-semibold ${projectionCents !== null && projectionCents < 0 ? "text-[var(--color-error)]" : ""}`}>{projectionCents === null ? "—" : formatCurrency(projectionCents, currency)}</span>
          <span className="mt-0.5 text-sm text-[var(--color-muted)]">sobra estimada no fim do mês</span>
        </TileLink>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-labelledby="upcoming-title">
          <SectionHeader id="upcoming-title" title="Próximos vencimentos" action={<Link href="/bills" className={textButton}>Agenda</Link>} />
          {upcoming.length ? (
            <ul className="-my-1 divide-y divide-[var(--color-border)]">
              {upcoming.slice(0, 5).map((item) => <TransactionRow key={item.id} transaction={item} currency={currency} showSettle />)}
            </ul>
          ) : <p className="py-4 text-sm text-[var(--color-muted)]">Nada vencendo nos próximos 7 dias.</p>}
        </Card>

        <Card aria-labelledby="recent-title">
          <SectionHeader id="recent-title" title="Últimas transações" action={<Link href="/transactions" className={textButton}>Ver todas</Link>} />
          {recent.length ? (
            <ul className="-my-1 divide-y divide-[var(--color-border)]">
              {recent.map((item) => <TransactionRow key={item.id} transaction={item} currency={currency} />)}
            </ul>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="mt-4 text-base font-semibold">Seu mês começa aqui</p>
              <p className="mt-1 max-w-[280px] text-sm text-[var(--color-muted)]">Registre um gasto ou uma receita para ver para onde o dinheiro está indo.</p>
              <Link href="/add" className={`${textButton} mt-3`}>Fazer primeiro registro</Link>
            </div>
          )}
        </Card>
      </div>

      {editingBalance ? (
        <MoneyKeypad
          title="Atualizar saldo"
          currency={currency}
          allowZero
          initialCents={balanceCents !== null && balanceCents > 0 ? balanceCents : null}
          submitLabel="Salvar saldo"
          helper={balanceError ?? "Quanto há na sua conta agora? O que você pagar ou receber a partir de hoje ajusta este valor."}
          onSubmit={(cents) => void saveBalance(cents)}
          onClose={() => setEditingBalance(false)}
        />
      ) : null}
    </div>
  );
}
