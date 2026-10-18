export type ExpenseStatus = "paid" | "pending" | "scheduled";

export type ExpenseLike = {
  id: string;
  amountCents: number;
  status: ExpenseStatus;
  date: string;
  category?: string;
};

export function sumExpenses(expenses: ExpenseLike[]) {
  return expenses.reduce((total, expense) => total + expense.amountCents, 0);
}

export function sumPaid(expenses: ExpenseLike[]) {
  return expenses
    .filter((expense) => expense.status === "paid")
    .reduce((total, expense) => total + expense.amountCents, 0);
}

export function sumPending(expenses: ExpenseLike[]) {
  return expenses
    .filter((expense) => expense.status !== "paid")
    .reduce((total, expense) => total + expense.amountCents, 0);
}

export function sumByCategory(expenses: ExpenseLike[]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const category = expense.category ?? "Sem categoria";
    totals.set(category, (totals.get(category) ?? 0) + expense.amountCents);
  }
  return [...totals.entries()]
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((left, right) => right.amountCents - left.amountCents);
}

export function estimateBalanceAfterCommitments(
  reportedBalanceCents: number,
  expenses: ExpenseLike[],
) {
  return reportedBalanceCents - sumPending(expenses);
}

export function getUpcomingExpenses(
  expenses: ExpenseLike[],
  daysAhead: number,
  today: string,
) {
  const todayDate = new Date(`${today}T00:00:00Z`);
  const upperBoundDate = new Date(todayDate);
  upperBoundDate.setUTCDate(upperBoundDate.getUTCDate() + daysAhead);
  const upperBound = upperBoundDate.toISOString().slice(0, 10);

  return [...expenses]
    .filter((expense) => {
      return expense.status !== "paid" && expense.date >= today && expense.date <= upperBound;
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function parseCurrencyToCents(value: string, allowZero = false): number | null {
  const normalized = value.trim().replace(/^R\$\s*/i, "");
  if (!normalized || normalized.startsWith("-") || !/^[\d.,\s]+$/.test(normalized)) {
    return null;
  }

  const compact = normalized.replace(/\s/g, "");
  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;
  let integerPart = compact;
  let fractionPart = "";

  if (commaCount && dotCount) {
    const decimalSeparator = compact.lastIndexOf(",") > compact.lastIndexOf(".") ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    if ((decimalSeparator === "," ? commaCount : dotCount) !== 1) return null;
    const separatorIndex = compact.lastIndexOf(decimalSeparator);
    integerPart = compact.slice(0, separatorIndex);
    fractionPart = compact.slice(separatorIndex + 1);
    const groupingPattern = new RegExp(`^\\d{1,3}(?:\\${groupingSeparator}\\d{3})+$`);
    if (!groupingPattern.test(integerPart)) return null;
  } else if (commaCount || dotCount) {
    if (commaCount + dotCount !== 1) return null;
    const separator = commaCount ? "," : ".";
    const separatorIndex = compact.indexOf(separator);
    integerPart = compact.slice(0, separatorIndex);
    fractionPart = compact.slice(separatorIndex + 1);
  }

  const integerDigits = integerPart.replace(/[.,]/g, "");

  if (!/^\d+$/.test(integerDigits) || !/^\d{0,2}$/.test(fractionPart)) {
    return null;
  }

  const cents = Number(integerDigits) * 100 + Number(fractionPart.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && (cents > 0 || (allowZero && cents === 0)) ? cents : null;
}

export function parseSignedCurrencyToCents(value: string): number | null {
  const normalized = value.trim().replace(/^R\$\s*/i, "");
  const isNegative = normalized.startsWith("-");
  const amount = parseCurrencyToCents(isNegative ? normalized.slice(1) : normalized, true);
  return amount === null ? null : isNegative ? -amount : amount;
}

export function formatCentsAsDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError("Money must be a non-negative integer number of cents.");
  }

  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function formatSignedCentsAsDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}${formatCentsAsDecimal(Math.abs(cents))}`;
}
