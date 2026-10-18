import { budgetLevel, type BudgetLevel, type BudgetLike, type Movement } from "./planning";

/** Período inclusivo, em datas AAAA-MM-DD. */
export type DateRange = { from: string; to: string };

export type CategoryTotal = {
  category: string;
  amountCents: number;
  /** Parte do total de gastos do período (0 a 1). */
  share: number;
  count: number;
  previousCents: number;
  /** Variação em relação ao período anterior; null quando não havia gasto antes. */
  change: number | null;
  budget: { limitCents: number; remainingCents: number; ratio: number; level: BudgetLevel } | null;
};

export type CategoryAnalysis = {
  range: DateRange;
  previousRange: DateRange;
  totalCents: number;
  previousTotalCents: number;
  change: number | null;
  count: number;
  categories: CategoryTotal[];
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function toDay(date: string) {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000;
}

function fromDay(day: number) {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

export function lastDayOf(month: string) {
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return `${month}-${String(days).padStart(2, "0")}`;
}

/** O mês inteiro como período (respeita meses de 28 a 31 dias). */
export function monthRange(month: string): DateRange {
  return { from: `${month}-01`, to: lastDayOf(month) };
}

/** Quando o período é exatamente um mês do calendário, devolve esse mês (AAAA-MM). */
export function rangeMonth(range: DateRange) {
  const month = range.from.slice(0, 7);
  return range.from === `${month}-01` && range.to === lastDayOf(month) ? month : null;
}

/**
 * Período anterior de mesmo tamanho. Para um mês inteiro, é o mês anterior inteiro
 * (assim março é comparado com fevereiro completo, mesmo tendo dias a mais).
 */
export function previousRange(range: DateRange): DateRange {
  const month = rangeMonth(range);
  if (month) {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return monthRange(date.toISOString().slice(0, 7));
  }
  const length = toDay(range.to) - toDay(range.from) + 1;
  return { from: fromDay(toDay(range.from) - length), to: fromDay(toDay(range.from) - 1) };
}

/**
 * Gasto válido: despesa com valor positivo. Entradas e movimentações internas (transferência entre
 * contas próprias e pagamento de fatura, cujas compras já foram registradas) nunca contam como gasto.
 */
export function isSpending(movement: Pick<Movement, "kind" | "amountCents">) {
  return movement.kind === "expense" && movement.amountCents > 0;
}

export function inRange(date: string, range: DateRange) {
  return date >= range.from && date <= range.to;
}

/** Lançamentos de gasto do período (e, opcionalmente, de uma categoria), do mais recente ao mais antigo. */
export function spendingEntries<T extends Movement>(movements: T[], range: DateRange, category?: string) {
  return movements
    .filter((movement) => isSpending(movement) && inRange(movement.date, range) && (!category || movement.category === category))
    .sort((left, right) => right.date.localeCompare(left.date));
}

function totalsByCategory(movements: Movement[], range: DateRange) {
  const totals = new Map<string, { amountCents: number; count: number }>();
  for (const movement of movements) {
    if (!isSpending(movement) || !inRange(movement.date, range)) continue;
    const current = totals.get(movement.category) ?? { amountCents: 0, count: 0 };
    totals.set(movement.category, { amountCents: current.amountCents + movement.amountCents, count: current.count + 1 });
  }
  return totals;
}

const change = (current: number, previous: number) => previous > 0 ? (current - previous) / previous : null;

/**
 * Consolida os gastos por categoria somando os lançamentos existentes — nenhum total é gravado como transação.
 * Categorias com e sem orçamento aparecem; as que só tiveram gasto no período anterior entram com zero,
 * para a queda ficar visível. O orçamento só é avaliado quando o período é um mês inteiro.
 */
export function analyzeCategories(movements: Movement[], range: DateRange, budgets: BudgetLike[] = []): CategoryAnalysis {
  const previous = previousRange(range);
  const current = totalsByCategory(movements, range);
  const before = totalsByCategory(movements, previous);
  const totalCents = sum([...current.values()].map((item) => item.amountCents));
  const previousTotalCents = sum([...before.values()].map((item) => item.amountCents));
  const isMonth = rangeMonth(range) !== null;

  const names = new Set([...current.keys(), ...before.keys()]);
  const categories = [...names].map((category): CategoryTotal => {
    const amountCents = current.get(category)?.amountCents ?? 0;
    const previousCents = before.get(category)?.amountCents ?? 0;
    const budget = isMonth ? budgets.find((item) => item.category === category) : undefined;
    return {
      category,
      amountCents,
      share: totalCents ? amountCents / totalCents : 0,
      count: current.get(category)?.count ?? 0,
      previousCents,
      change: change(amountCents, previousCents),
      budget: budget ? {
        limitCents: budget.limitCents,
        remainingCents: budget.limitCents - amountCents,
        ratio: budget.limitCents > 0 ? amountCents / budget.limitCents : 0,
        level: budgetLevel(amountCents, budget.limitCents, budget.alertAt),
      } : null,
    };
  }).sort((left, right) => right.amountCents - left.amountCents || left.category.localeCompare(right.category, "pt-BR"));

  return {
    range,
    previousRange: previous,
    totalCents,
    previousTotalCents,
    change: change(totalCents, previousTotalCents),
    count: sum([...current.values()].map((item) => item.count)),
    categories,
  };
}

/** Situação de um orçamento depois de registrar um novo gasto: quanto sobra ou quanto passou. */
export function budgetAfterExpense(movements: Movement[], budget: BudgetLike, month: string, newExpenseCents: number) {
  const spentCents = sum(spendingEntries(movements, monthRange(month), budget.category).map((item) => item.amountCents)) + newExpenseCents;
  return {
    spentCents,
    remainingCents: budget.limitCents - spentCents,
    excessCents: Math.max(0, spentCents - budget.limitCents),
    level: budgetLevel(spentCents, budget.limitCents, budget.alertAt),
  };
}
