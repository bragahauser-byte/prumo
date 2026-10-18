import { describe, expect, it } from "vitest";
import {
  estimateBalanceAfterCommitments,
  formatCentsAsDecimal,
  formatSignedCentsAsDecimal,
  getUpcomingExpenses,
  parseCurrencyToCents,
  parseSignedCurrencyToCents,
  sumExpenses,
  sumByCategory,
  sumPaid,
  sumPending,
  type ExpenseLike,
} from "./financial";
import { formatCalendarDate, formatCurrency, formatMonth } from "../lib/formatting";

describe("financial domain", () => {
  it("aggregates monthly expenses by status", () => {
    const expenses: ExpenseLike[] = [
      { id: "1", amountCents: 50000, status: "paid", date: "2026-10-02" },
      { id: "2", amountCents: 32000, status: "pending", date: "2026-10-05" },
      { id: "3", amountCents: 14000, status: "scheduled", date: "2026-10-10" },
      { id: "4", amountCents: 21000, status: "paid", date: "2026-10-18" },
    ];

    expect(sumExpenses(expenses)).toBe(117000);
    expect(sumPaid(expenses)).toBe(71000);
    expect(sumPending(expenses)).toBe(46000);
  });

  it("aggregates category totals in descending amount order", () => {
    const expenses: ExpenseLike[] = [
      { id: "1", amountCents: 4000, status: "paid", date: "2026-10-01", category: "Saúde" },
      { id: "2", amountCents: 9000, status: "pending", date: "2026-10-02", category: "Moradia" },
      { id: "3", amountCents: 3000, status: "pending", date: "2026-10-03", category: "Saúde" },
    ];

    expect(sumByCategory(expenses)).toEqual([
      { category: "Moradia", amountCents: 9000 },
      { category: "Saúde", amountCents: 7000 },
    ]);
  });

  it("estimates a reported bank balance after unpaid known commitments", () => {
    const expenses: ExpenseLike[] = [
      { id: "1", amountCents: 45000, status: "paid", date: "2026-10-02" },
      { id: "2", amountCents: 60000, status: "pending", date: "2026-10-05" },
      { id: "3", amountCents: 22000, status: "scheduled", date: "2026-10-12" },
    ];

    expect(estimateBalanceAfterCommitments(520000, expenses)).toBe(438000);
  });

  it("returns upcoming payments within the selected window sorted by date", () => {
    const expenses: ExpenseLike[] = [
      { id: "1", amountCents: 20000, status: "scheduled", date: "2026-10-15" },
      { id: "2", amountCents: 40000, status: "pending", date: "2026-10-04" },
      { id: "3", amountCents: 30000, status: "paid", date: "2026-10-06" },
      { id: "4", amountCents: 10000, status: "pending", date: "2026-10-08" },
    ];

    expect(getUpcomingExpenses(expenses, 7, "2026-10-01").map((expense) => expense.id)).toEqual(["2", "4"]);
  });

  it("parses Brazilian currency strings into integer cents", () => {
    expect(parseCurrencyToCents("R$ 1.234,56")).toBe(123456);
    expect(parseCurrencyToCents("75,5")).toBe(7550);
    expect(parseCurrencyToCents("1,234.56")).toBe(123456);
    expect(parseCurrencyToCents("0,01")).toBe(1);
    expect(parseCurrencyToCents("0,00", true)).toBe(0);
    expect(parseCurrencyToCents("-12,00")).toBeNull();
    expect(parseCurrencyToCents("12,345")).toBeNull();
    expect(parseCurrencyToCents("1.2.3")).toBeNull();
    expect(parseCurrencyToCents("12.34,56")).toBeNull();
  });

  it("serializes cents without floating-point arithmetic", () => {
    expect(formatCentsAsDecimal(123456)).toBe("1234.56");
    expect(formatCentsAsDecimal(1)).toBe("0.01");
    expect(() => formatCentsAsDecimal(-1)).toThrow(RangeError);
    expect(formatSignedCentsAsDecimal(-125)).toBe("-1.25");
    expect(parseSignedCurrencyToCents("-1,25")).toBe(-125);
  });

  it("formats currency and calendar dates for Brazilian users", () => {
    expect(formatCurrency(123456)).toBe("R$ 1.234,56");
    expect(formatCalendarDate("2026-02-01")).toBe("1 de fev. de 2026");
    expect(formatMonth(new Date("2026-02-01T00:00:00Z"))).toBe("fevereiro de 2026");
  });
});
