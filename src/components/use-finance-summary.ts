"use client";

import { useMemo } from "react";
import { useExchangeRates } from "@/components/exchange-rates";
import { useFinance } from "@/components/finance-provider";
import { accountBalances } from "@/domain/accounts";
import {
  budgetUsage,
  currentBalance,
  endOfMonthProjection,
  savedInGoals,
  shiftMonth,
  spendableThisMonth,
  summarizeMonth,
} from "@/domain/planning";
import { currentMonth, todayISO } from "@/lib/dates";

/**
 * Valores derivados usados por várias telas (saldo, quanto pode gastar, mês atual e anterior).
 * Com saldos informados por conta, o saldo disponível é a soma das contas convertida para a moeda-base;
 * sem contas com saldo, vale o saldo geral informado no perfil.
 */
export function useFinanceSummary(month = currentMonth()) {
  const finance = useFinance();
  const { table, manualRates } = useExchangeRates();
  const { expenses, preferences, savingsGoals, budgets, accounts } = finance;

  return useMemo(() => {
    const today = todayISO();
    const currency = preferences?.currency ?? "BRL";
    const byAccount = accountBalances(accounts, expenses, currency, table, manualRates);
    const balanceSource = byAccount.hasBalances ? "accounts" as const : "profile" as const;
    const balanceCents = byAccount.hasBalances
      ? byAccount.totalCents
      : currentBalance(preferences?.reportedBalanceCents ?? null, preferences?.balanceReportedOn ?? null, expenses);
    const summary = summarizeMonth(expenses, month);
    const previousSummary = summarizeMonth(expenses, shiftMonth(month, -1));
    const spendable = spendableThisMonth({
      balanceCents,
      monthlyIncomeCents: preferences?.monthlyIncomeCents ?? null,
      movements: expenses,
      goals: savingsGoals,
      month,
    });
    return {
      today,
      month,
      currency,
      balanceCents,
      balanceSource,
      accountBalances: byAccount,
      summary,
      previousSummary,
      spendable,
      projectionCents: endOfMonthProjection(balanceCents, preferences?.monthlyIncomeCents ?? null, expenses, month),
      savedCents: savedInGoals(savingsGoals),
      budgets: budgetUsage(budgets, expenses, month),
    };
  }, [accounts, budgets, expenses, manualRates, month, preferences, savingsGoals, table]);
}
