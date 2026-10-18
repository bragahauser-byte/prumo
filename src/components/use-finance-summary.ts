"use client";

import { useMemo } from "react";
import { useFinance } from "@/components/finance-provider";
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

/** Valores derivados usados por várias telas (saldo, quanto pode gastar, mês atual e anterior). */
export function useFinanceSummary(month = currentMonth()) {
  const finance = useFinance();
  const { expenses, preferences, savingsGoals, budgets } = finance;

  return useMemo(() => {
    const today = todayISO();
    const currency = preferences?.currency ?? "BRL";
    const balanceCents = currentBalance(preferences?.reportedBalanceCents ?? null, preferences?.balanceReportedOn ?? null, expenses);
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
      summary,
      previousSummary,
      spendable,
      projectionCents: endOfMonthProjection(balanceCents, preferences?.monthlyIncomeCents ?? null, expenses, month),
      savedCents: savedInGoals(savingsGoals),
      budgets: budgetUsage(budgets, expenses, month),
    };
  }, [budgets, expenses, month, preferences, savingsGoals]);
}
