import type { TransactionKind } from "./categories";
import type { ExpenseStatus } from "./financial";

export type Movement = {
  id: string;
  kind: TransactionKind;
  amountCents: number;
  status: ExpenseStatus;
  date: string;
  paidOn: string | null;
  category: string;
  recurringRuleId: string | null;
};

export type GoalContributionLike = { amountCents: number; date: string; status: "planned" | "done" };
export type GoalLike = { targetCents: number; deadline: string | null; contributions: GoalContributionLike[] };
export type BudgetLike = { category: string; limitCents: number };

export type DisplayStatus = "paid" | "received" | "overdue" | "due_today" | "scheduled";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function lastDayOfMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

export function inMonth(date: string, month: string) {
  return date.startsWith(`${month}-`);
}

export function displayStatus(movement: Pick<Movement, "kind" | "status" | "date">, today: string): DisplayStatus {
  if (movement.status === "paid") return movement.kind === "income" ? "received" : "paid";
  if (movement.date < today) return "overdue";
  if (movement.date === today) return "due_today";
  return "scheduled";
}

export function summarizeMonth(movements: Movement[], month: string) {
  const current = movements.filter((movement) => inMonth(movement.date, month));
  const incomes = current.filter((movement) => movement.kind === "income");
  const expenses = current.filter((movement) => movement.kind === "expense");
  return {
    incomeCents: sum(incomes.map((movement) => movement.amountCents)),
    incomeReceivedCents: sum(incomes.filter((movement) => movement.status === "paid").map((movement) => movement.amountCents)),
    incomePendingCents: sum(incomes.filter((movement) => movement.status !== "paid").map((movement) => movement.amountCents)),
    expenseCents: sum(expenses.map((movement) => movement.amountCents)),
    expensePaidCents: sum(expenses.filter((movement) => movement.status === "paid").map((movement) => movement.amountCents)),
    expensePendingCents: sum(expenses.filter((movement) => movement.status !== "paid").map((movement) => movement.amountCents)),
  };
}

/**
 * Saldo informado ajustado pelas movimentações pagas/recebidas desde a data em que foi informado.
 * Sem data de referência, o saldo informado é exibido sem ajustes.
 */
export function currentBalance(reportedBalanceCents: number | null, reportedOn: string | null, movements: Movement[]) {
  if (reportedBalanceCents === null) return null;
  if (!reportedOn) return reportedBalanceCents;
  return movements
    .filter((movement) => movement.status === "paid" && movement.paidOn !== null && movement.paidOn >= reportedOn)
    .reduce((total, movement) => total + (movement.kind === "income" ? movement.amountCents : -movement.amountCents), reportedBalanceCents);
}

export function savedInGoals(goals: GoalLike[]) {
  return sum(goals.flatMap((goal) => goal.contributions.filter((item) => item.status === "done").map((item) => item.amountCents)));
}

export function plannedGoalContributions(goals: GoalLike[], month: string) {
  return sum(goals.flatMap((goal) => goal.contributions
    .filter((item) => item.status === "planned" && item.date <= lastDayOfMonth(month))
    .map((item) => item.amountCents)));
}

/**
 * Quanto ainda pode gastar até o fim do mês.
 * Com saldo: saldo atual + receitas a receber − contas a pagar (incluindo atrasadas) − dinheiro guardado em metas − aportes planejados.
 * Sem saldo: renda (registrada no mês ou informada) − despesas do mês − aportes do mês.
 */
export function spendableThisMonth({
  balanceCents,
  monthlyIncomeCents,
  movements,
  goals,
  month,
}: {
  balanceCents: number | null;
  monthlyIncomeCents: number | null;
  movements: Movement[];
  goals: GoalLike[];
  month: string;
}) {
  const end = lastDayOfMonth(month);
  const planned = plannedGoalContributions(goals, month);
  if (balanceCents !== null) {
    const unpaidUntilEnd = movements.filter((movement) => movement.status !== "paid" && movement.date <= end);
    const incoming = sum(unpaidUntilEnd.filter((movement) => movement.kind === "income").map((movement) => movement.amountCents));
    const outgoing = sum(unpaidUntilEnd.filter((movement) => movement.kind === "expense").map((movement) => movement.amountCents));
    const reserved = savedInGoals(goals);
    return {
      basis: "balance" as const,
      amountCents: balanceCents + incoming - outgoing - reserved - planned,
      incomingCents: incoming,
      outgoingCents: outgoing,
      reservedCents: reserved + planned,
    };
  }

  const summary = summarizeMonth(movements, month);
  const income = summary.incomeCents || monthlyIncomeCents;
  if (!income) return null;
  const doneThisMonth = sum(goals.flatMap((goal) => goal.contributions
    .filter((item) => item.status === "done" && inMonth(item.date, month))
    .map((item) => item.amountCents)));
  return {
    basis: "income" as const,
    amountCents: income - summary.expenseCents - planned - doneThisMonth,
    incomingCents: income,
    outgoingCents: summary.expenseCents,
    reservedCents: planned + doneThisMonth,
  };
}

/** Projeção do saldo no último dia do mês, sem considerar metas. */
export function endOfMonthProjection(balanceCents: number | null, monthlyIncomeCents: number | null, movements: Movement[], month: string) {
  if (balanceCents !== null) {
    const end = lastDayOfMonth(month);
    return movements
      .filter((movement) => movement.status !== "paid" && movement.date <= end)
      .reduce((total, movement) => total + (movement.kind === "income" ? movement.amountCents : -movement.amountCents), balanceCents);
  }
  const summary = summarizeMonth(movements, month);
  const income = summary.incomeCents || monthlyIncomeCents;
  return income ? income - summary.expenseCents : null;
}

export type BudgetLevel = "ok" | "warning" | "over";

export function budgetUsage(budgets: BudgetLike[], movements: Movement[], month: string) {
  return budgets.map((budget) => {
    const spentCents = sum(movements
      .filter((movement) => movement.kind === "expense" && movement.category === budget.category && inMonth(movement.date, month))
      .map((movement) => movement.amountCents));
    const ratio = budget.limitCents > 0 ? spentCents / budget.limitCents : 0;
    const level: BudgetLevel = ratio > 1 ? "over" : ratio >= 0.8 ? "warning" : "ok";
    return { ...budget, spentCents, remainingCents: budget.limitCents - spentCents, ratio, level };
  }).sort((left, right) => right.ratio - left.ratio);
}

function monthIndex(date: string) {
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  return year * 12 + month - 1;
}

export function goalProgress(goal: GoalLike, today: string) {
  const savedCents = sum(goal.contributions.filter((item) => item.status === "done").map((item) => item.amountCents));
  const plannedCents = sum(goal.contributions.filter((item) => item.status === "planned").map((item) => item.amountCents));
  const remainingCents = Math.max(0, goal.targetCents - savedCents);
  const ratio = goal.targetCents > 0 ? Math.min(1, savedCents / goal.targetCents) : 0;
  const monthsLeft = goal.deadline
    ? goal.deadline < today ? 0 : monthIndex(goal.deadline) - monthIndex(today) + 1
    : null;
  const monthlyNeededCents = monthsLeft === null
    ? null
    : monthsLeft === 0 ? remainingCents : Math.ceil(remainingCents / monthsLeft);
  return { savedCents, plannedCents, remainingCents, ratio, monthsLeft, monthlyNeededCents, isComplete: savedCents >= goal.targetCents };
}

export function monthlySeries(movements: Movement[], endMonth: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const month = shiftMonth(endMonth, index - count + 1);
    const summary = summarizeMonth(movements, month);
    return { month, incomeCents: summary.incomeCents, expenseCents: summary.expenseCents, netCents: summary.incomeCents - summary.expenseCents };
  });
}

export function expensesByCategory(movements: Movement[], month: string) {
  const totals = new Map<string, number>();
  for (const movement of movements) {
    if (movement.kind !== "expense" || !inMonth(movement.date, month)) continue;
    totals.set(movement.category, (totals.get(movement.category) ?? 0) + movement.amountCents);
  }
  return [...totals.entries()]
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((left, right) => right.amountCents - left.amountCents);
}

/** Categorias cujo gasto no mês supera em 30% (e ao menos R$ 50) a média dos três meses anteriores. */
export function unusualIncreases(movements: Movement[], month: string) {
  const previousMonths = [1, 2, 3].map((offset) => shiftMonth(month, -offset));
  const history = previousMonths.map((item) => new Map(expensesByCategory(movements, item).map((entry) => [entry.category, entry.amountCents])));
  return expensesByCategory(movements, month)
    .map(({ category, amountCents }) => {
      const averageCents = Math.round(sum(history.map((totals) => totals.get(category) ?? 0)) / previousMonths.length);
      return { category, currentCents: amountCents, averageCents, increaseCents: amountCents - averageCents };
    })
    .filter((entry) => entry.averageCents > 0 && entry.currentCents >= entry.averageCents * 1.3 && entry.increaseCents >= 5000)
    .sort((left, right) => right.increaseCents - left.increaseCents);
}

export function fixedVariableSplit(movements: Movement[], month: string) {
  const expenses = movements.filter((movement) => movement.kind === "expense" && inMonth(movement.date, month));
  return {
    fixedCents: sum(expenses.filter((movement) => movement.recurringRuleId !== null).map((movement) => movement.amountCents)),
    variableCents: sum(expenses.filter((movement) => movement.recurringRuleId === null).map((movement) => movement.amountCents)),
  };
}

/** Variação percentual arredondada; null quando não há base de comparação. */
export function percentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
