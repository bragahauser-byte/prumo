import { describe, expect, it } from "vitest";
import { suggestCategory } from "./categories";
import {
  budgetUsage,
  currentBalance,
  displayStatus,
  endOfMonthProjection,
  fixedVariableSplit,
  goalProgress,
  monthlySeries,
  percentChange,
  spendableThisMonth,
  summarizeMonth,
  unusualIncreases,
  type Movement,
} from "./planning";

let sequence = 0;
function movement(partial: Partial<Movement>): Movement {
  sequence += 1;
  return {
    id: `m${sequence}`,
    kind: "expense",
    amountCents: 10000,
    status: "paid",
    date: "2026-10-10",
    paidOn: "2026-10-10",
    category: "Alimentação",
    recurringRuleId: null,
    ...partial,
  };
}

describe("planning", () => {
  it("summarizes income and expenses of a month separately", () => {
    const summary = summarizeMonth([
      movement({ kind: "income", amountCents: 500000, category: "Salário" }),
      movement({ amountCents: 20000 }),
      movement({ amountCents: 5000, status: "pending", paidOn: null }),
      movement({ amountCents: 99900, date: "2026-09-30" }),
    ], "2026-10");
    expect(summary).toMatchObject({ incomeCents: 500000, expenseCents: 25000, expensePaidCents: 20000, expensePendingCents: 5000 });
  });

  it("adjusts the reported balance only by settled movements since the report date", () => {
    const movements = [
      movement({ amountCents: 3000, paidOn: "2026-10-09" }),
      movement({ amountCents: 2000, paidOn: "2026-10-10" }),
      movement({ kind: "income", amountCents: 10000, paidOn: "2026-10-12" }),
      movement({ amountCents: 7000, status: "pending", paidOn: null }),
    ];
    expect(currentBalance(100000, "2026-10-10", movements)).toBe(108000);
    expect(currentBalance(100000, null, movements)).toBe(100000);
    expect(currentBalance(null, "2026-10-10", movements)).toBeNull();
  });

  it("computes how much is still spendable from balance, bills, incomes and goals", () => {
    const goals = [{ targetCents: 100000, deadline: null, contributions: [
      { amountCents: 20000, date: "2026-10-01", status: "done" as const },
      { amountCents: 5000, date: "2026-10-25", status: "planned" as const },
      { amountCents: 9000, date: "2026-11-25", status: "planned" as const },
    ] }];
    const movements = [
      movement({ amountCents: 30000, status: "scheduled", paidOn: null, date: "2026-10-20" }),
      movement({ amountCents: 4000, status: "pending", paidOn: null, date: "2026-09-28" }),
      movement({ amountCents: 80000, status: "scheduled", paidOn: null, date: "2026-11-05" }),
      movement({ kind: "income", amountCents: 50000, status: "scheduled", paidOn: null, date: "2026-10-30" }),
    ];
    const result = spendableThisMonth({ balanceCents: 100000, monthlyIncomeCents: null, movements, goals, month: "2026-10" });
    expect(result).toMatchObject({ basis: "balance", amountCents: 100000 + 50000 - 34000 - 20000 - 5000 });

    const byIncome = spendableThisMonth({ balanceCents: null, monthlyIncomeCents: 300000, movements: [movement({ amountCents: 100000 })], goals: [], month: "2026-10" });
    expect(byIncome).toMatchObject({ basis: "income", amountCents: 200000 });
    expect(spendableThisMonth({ balanceCents: null, monthlyIncomeCents: null, movements: [], goals: [], month: "2026-10" })).toBeNull();
  });

  it("projects the end-of-month balance", () => {
    const movements = [
      movement({ amountCents: 30000, status: "scheduled", paidOn: null, date: "2026-10-20" }),
      movement({ kind: "income", amountCents: 10000, status: "scheduled", paidOn: null, date: "2026-10-30" }),
    ];
    expect(endOfMonthProjection(50000, null, movements, "2026-10")).toBe(30000);
    expect(endOfMonthProjection(null, 200000, movements, "2026-10")).toBe(10000 - 30000);
  });

  it("flags budgets at 80% and above the limit", () => {
    const usage = budgetUsage(
      [{ category: "Alimentação", limitCents: 10000 }, { category: "Lazer", limitCents: 10000 }, { category: "Saúde", limitCents: 10000 }],
      [movement({ amountCents: 8500 }), movement({ category: "Lazer", amountCents: 12000 }), movement({ category: "Saúde", amountCents: 1000 })],
      "2026-10",
    );
    expect(usage.map((item) => [item.category, item.level])).toEqual([["Lazer", "over"], ["Alimentação", "warning"], ["Saúde", "ok"]]);
    expect(usage[0].remainingCents).toBe(-2000);
  });

  it("calculates goal progress and the monthly amount needed", () => {
    const goal = { targetCents: 120000, deadline: "2027-03-15", contributions: [{ amountCents: 20000, date: "2026-10-01", status: "done" as const }] };
    expect(goalProgress(goal, "2026-10-18")).toMatchObject({ savedCents: 20000, remainingCents: 100000, monthsLeft: 6, monthlyNeededCents: 16667, isComplete: false });
    expect(goalProgress({ ...goal, deadline: "2026-01-01" }, "2026-10-18")).toMatchObject({ monthsLeft: 0, monthlyNeededCents: 100000 });
    expect(goalProgress({ ...goal, deadline: null }, "2026-10-18").monthlyNeededCents).toBeNull();
  });

  it("detects unusual category increases against the previous three months", () => {
    const history = ["2026-07-10", "2026-08-10", "2026-09-10"].map((date) => movement({ category: "Lazer", amountCents: 10000, date }));
    const result = unusualIncreases([...history, movement({ category: "Lazer", amountCents: 25000 }), movement({ category: "Saúde", amountCents: 9000 })], "2026-10");
    expect(result).toEqual([{ category: "Lazer", currentCents: 25000, averageCents: 10000, increaseCents: 15000 }]);
  });

  it("builds monthly series, fixed/variable split, statuses and percent change", () => {
    const series = monthlySeries([movement({ kind: "income", amountCents: 1000 }), movement({ amountCents: 400, date: "2026-09-02" })], "2026-10", 3);
    expect(series.map((item) => [item.month, item.netCents])).toEqual([["2026-08", 0], ["2026-09", -400], ["2026-10", 1000]]);
    expect(fixedVariableSplit([movement({ recurringRuleId: "r" }), movement({ amountCents: 500 })], "2026-10")).toEqual({ fixedCents: 10000, variableCents: 500 });
    expect(displayStatus({ kind: "income", status: "paid", date: "2026-10-01" }, "2026-10-18")).toBe("received");
    expect(displayStatus({ kind: "expense", status: "pending", date: "2026-10-01" }, "2026-10-18")).toBe("overdue");
    expect(displayStatus({ kind: "expense", status: "pending", date: "2026-10-18" }, "2026-10-18")).toBe("due_today");
    expect(displayStatus({ kind: "expense", status: "scheduled", date: "2026-10-30" }, "2026-10-18")).toBe("scheduled");
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(5, 0)).toBeNull();
  });

  it("suggests categories from the description", () => {
    expect(suggestCategory("Supermercado Pão de Açúcar", "expense")).toBe("Alimentação");
    expect(suggestCategory("Uber para o trabalho", "expense")).toBe("Transporte");
    expect(suggestCategory("Netflix", "expense")).toBe("Assinaturas");
    expect(suggestCategory("Internet de casa", "expense")).toBe("Contas");
    expect(suggestCategory("Salário outubro", "income")).toBe("Salário");
    expect(suggestCategory("Algo aleatório", "expense")).toBeNull();
  });
});
