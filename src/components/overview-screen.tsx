"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { BankBreakdown } from "@/components/accounts/bank-breakdown";
import { QuickBalanceUpdate } from "@/components/accounts/quick-balance";
import { useFinance } from "@/components/finance-provider";
import { usePrivacy } from "@/components/privacy";
import { TransactionRow } from "@/components/transaction-row";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { Illustration } from "@/components/ui/illustration";
import { Card, SectionHeader, TileLink, focusRing, textButton } from "@/components/ui/primitives";
import { summarizeInvestments } from "@/domain/investments";
import { percentChange, shiftMonth } from "@/domain/planning";
import { addDays } from "@/lib/dates";
import { formatCurrency, formatMonthKey, formatShortDate } from "@/lib/formatting";

function Comparison({ current, previous, previousLabel, higherIsGood }: { current: number; previous: number; previousLabel: string; higherIsGood: boolean }) {
  const change = percentChange(current, previous);
  if (change === null) return <p className="mt-1 text-xs text-[var(--color-tertiary)]">Sem registros em {previousLabel}</p>;
  if (change === 0) return <p className="mt-1 text-xs text-[var(--color-tertiary)]">Igual a {previousLabel}</p>;
  const good = change > 0 === higherIsGood;
  const Icon = change > 0 ? TrendingUp : TrendingDown;
  return (
    <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${good ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"}`}>
      <Icon size={14} aria-hidden="true" />
      {change > 0 ? "+" : ""}{change}% vs. {previousLabel}
    </p>
  );
}

const softLink = `inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[var(--color-soft)] px-4 text-base font-semibold transition-colors hover:bg-[var(--color-border)] ${focusRing}`;

export function OverviewScreen() {
  const { expenses, preferences, investments } = useFinance();
  const { today, month, currency, balanceCents, balanceSource, accountBalances, summary, previousSummary, spendable, projectionCents, budgets } = useFinanceSummary();
  const { mask } = usePrivacy();
  const money = (cents: number) => mask(formatCurrency(cents, currency));
  const [editingBalance, setEditingBalance] = useState(false);
  const investmentSummary = summarizeInvestments(investments);
  const investmentPlaces = new Set(investments.map((item) => item.institution.trim().toLocaleLowerCase("pt-BR"))).size;
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
  const accountsWithBalance = accountBalances.items.filter((item) => item.balanceCents !== null);

  return (
    <div className="space-y-4">

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card aria-labelledby="balance-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="balance-title" className="text-sm font-medium text-[var(--color-muted)]">Saldo disponível</h2>
            <button type="button" onClick={() => setEditingBalance(true)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--color-soft)] px-4 text-sm font-semibold transition-colors hover:bg-[var(--color-border)] ${focusRing}`}>
              <RefreshCw size={15} aria-hidden="true" /> {balanceCents === null ? "Informar saldo" : "Atualizar"}
            </button>
          </div>
          <p className="tabular mt-2 text-4xl font-semibold">
            {balanceCents === null ? formatCurrency(0, currency).replace(/0,00$/, "—") : money(balanceCents)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-tertiary)]">
            {balanceCents === null
              ? "Informe quanto tem na conta para acompanhar o saldo."
              : balanceSource === "accounts"
                ? `Soma de ${accountsWithBalance.length} ${accountsWithBalance.length === 1 ? "conta" : "contas"}, ajustada pelo que foi pago ou recebido em cada uma.${accountBalances.missingRates.length ? ` Sem cotação para ${accountBalances.missingRates.join(", ")}.` : ""}`
                : preferences?.balanceReportedOn
                  ? `Informado em ${formatShortDate(preferences.balanceReportedOn)} e ajustado pelo que foi pago ou recebido desde então.`
                  : "Valor informado por você; não consultamos o banco."}
          </p>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-[var(--color-tertiary)]">De onde vem seu dinheiro</h3>
              {accountsWithBalance.length ? <Link href="/settings/accounts" className="text-xs font-semibold text-[var(--color-link)] underline-offset-4 hover:underline">Bancos</Link> : null}
            </div>
            <BankBreakdown compact />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link href="/add?kind=income" className={softLink}>
              <ArrowDownLeft size={18} className="text-[var(--color-success)]" aria-hidden="true" /> Receita
            </Link>
            <Link href="/add?kind=expense" className={softLink}>
              <ArrowUpRight size={18} className="text-[var(--color-muted)]" aria-hidden="true" /> Gasto
            </Link>
          </div>
        </Card>

        <Card aria-labelledby="spendable-title">
          <h2 id="spendable-title" className="text-sm font-medium text-[var(--color-muted)]">Quanto ainda pode gastar</h2>
          {spendable ? (
            <>
              <p className="tabular mt-2 text-4xl font-semibold">{money(spendable.amountCents)}</p>
              <p className="mt-1 text-sm text-[var(--color-tertiary)]">até o fim de {formatMonthKey(month).split(" ")[0]}</p>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-[var(--color-muted)]">{spendable.basis === "balance" ? "Saldo atual" : "Renda do mês"}</dt><dd className="tabular font-medium">{money(spendable.basis === "balance" ? balanceCents ?? 0 : spendable.incomingCents)}</dd></div>
                {spendable.basis === "balance" ? <div className="flex justify-between gap-3"><dt className="text-[var(--color-muted)]">A receber</dt><dd className="tabular font-medium text-[var(--color-success)]">+{money(spendable.incomingCents)}</dd></div> : null}
                <div className="flex justify-between gap-3"><dt className="text-[var(--color-muted)]">{spendable.basis === "balance" ? "Contas a pagar" : "Despesas do mês"}</dt><dd className="tabular font-medium">−{money(spendable.outgoingCents)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--color-muted)]">Reservado para metas</dt><dd className="tabular font-medium">−{money(spendable.reservedCents)}</dd></div>
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
            <p className="tabular mt-1 text-2xl font-semibold text-[var(--color-income)]">{money(summary.incomeCents)}</p>
            <Comparison current={summary.incomeCents} previous={previousSummary.incomeCents} previousLabel={previousLabel} higherIsGood />
          </div>
          <div>
            <p className="text-sm text-[var(--color-muted)]">Despesas</p>
            <p className="tabular mt-1 text-2xl font-semibold">{money(summary.expenseCents)}</p>
            <Comparison current={summary.expenseCents} previous={previousSummary.expenseCents} previousLabel={previousLabel} higherIsGood={false} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TileLink href="/budgets" title="Orçamentos">
          <Illustration name="budgets" size={88} className="-ml-1 mt-3" />
          <span className={`mt-4 text-xl font-semibold ${budgetsAtRisk ? "text-[var(--color-warning)]" : ""}`}>{budgets.length ? budgetsAtRisk ? `${budgetsAtRisk} em alerta` : "Tudo em dia" : "Sem limites"}</span>
          <span className="mt-0.5 text-sm text-[var(--color-tertiary)]">{budgets.length ? `de ${budgets.length} ${budgets.length === 1 ? "categoria com limite" : "categorias com limite"}` : "Defina quanto gastar"}</span>
        </TileLink>
        <TileLink href="/bills" title="Agenda">
          <Illustration name="bills" size={88} className="-ml-1 mt-3" />
          <span className="mt-4 truncate text-xl font-semibold">{nextBill ? formatShortDate(nextBill.date) : "Em dia"}</span>
          <span className="mt-0.5 truncate text-sm text-[var(--color-tertiary)]">{nextBill ? `${nextBill.description} · ${money(nextBill.amountCents)}` : "Nenhuma conta a pagar"}</span>
        </TileLink>
        <TileLink href="/reports" title="Relatórios">
          <Illustration name="reports" size={88} className="-ml-1 mt-3" />
          <span className="tabular mt-4 truncate text-xl font-semibold">{projectionCents === null ? "—" : money(projectionCents)}</span>
          <span className="mt-0.5 text-sm text-[var(--color-tertiary)]">sobra estimada no fim do mês</span>
        </TileLink>
        <TileLink href="/investments" title="Investimentos">
          <Illustration name="investments" size={88} className="-ml-1 mt-3" />
          <span className="tabular mt-4 truncate text-xl font-semibold">{investmentSummary.count ? money(investmentSummary.currentCents) : "Comece já"}</span>
          <span className="mt-0.5 truncate text-sm text-[var(--color-tertiary)]">
            {investmentSummary.count
              ? `em ${investmentPlaces} ${investmentPlaces === 1 ? "instituição" : "instituições"}`
              : "Cadastre onde você investe"}
          </span>
        </TileLink>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-labelledby="upcoming-title">
          <SectionHeader id="upcoming-title" title="Próximos vencimentos" action={<Link href="/bills" className={textButton}>Agenda</Link>} />
          {upcoming.length ? (
            <ul className="-my-1 divide-y divide-[var(--color-border)]">
              {upcoming.slice(0, 5).map((item) => <TransactionRow key={item.id} transaction={item} currency={currency} showSettle />)}
            </ul>
          ) : <p className="py-4 text-sm text-[var(--color-tertiary)]">Nada vencendo nos próximos 7 dias.</p>}
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
              <p className="mt-1 max-w-[280px] text-sm text-[var(--color-tertiary)]">Registre um gasto ou uma receita para ver para onde o dinheiro está indo.</p>
              <Link href="/add" className={`${textButton} mt-3`}>Fazer primeiro registro</Link>
            </div>
          )}
        </Card>
      </div>

      {editingBalance ? <QuickBalanceUpdate onClose={() => setEditingBalance(false)} /> : null}
    </div>
  );
}
