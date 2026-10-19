import { describe, expect, it } from "vitest";
import {
  averageMonthlySurplus,
  comparePeriods,
  latestRecordDate,
  monthlyEquivalent,
  recurringCharges,
  resolvePeriod,
  simulateGoal,
  spendingInPeriod,
  type AssistantMovement,
} from "./calculations";

let counter = 0;
function movement(overrides: Partial<AssistantMovement>): AssistantMovement {
  counter += 1;
  return {
    id: `m${counter}`,
    kind: "expense",
    amountCents: 1000,
    status: "paid",
    date: "2026-10-05",
    paidOn: "2026-10-05",
    category: "Alimentação",
    recurringRuleId: null,
    description: "Mercado",
    accountId: null,
    ...overrides,
  };
}

describe("resolvePeriod", () => {
  it("resolves named periods from today", () => {
    expect(resolvePeriod("este_mes", "2026-10-19")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolvePeriod("mes_passado", "2026-01-10")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(resolvePeriod("ultimos_30_dias", "2026-10-19")).toEqual({ from: "2026-09-20", to: "2026-10-19" });
    expect(resolvePeriod("ultimos_3_meses", "2026-10-19")).toEqual({ from: "2026-08-01", to: "2026-10-19" });
    expect(resolvePeriod("este_ano", "2026-10-19")).toEqual({ from: "2026-01-01", to: "2026-10-19" });
  });

  it("requires a valid custom range", () => {
    expect(resolvePeriod("personalizado", "2026-10-19", "2026-10-01", "2026-10-10")).toEqual({ from: "2026-10-01", to: "2026-10-10" });
    expect(resolvePeriod("personalizado", "2026-10-19", "2026-10-10", "2026-10-01")).toBeNull();
    expect(resolvePeriod("personalizado", "2026-10-19")).toBeNull();
  });
});

describe("spendingInPeriod", () => {
  const accounts = [{ id: "nu", name: "Nubank" }];
  const movements = [
    movement({ amountCents: 30_000, category: "Moradia", accountId: "nu", description: "Aluguel" }),
    movement({ amountCents: 10_000, category: "Alimentação", accountId: "nu" }),
    movement({ amountCents: 10_000, category: "Alimentação", status: "pending", paidOn: null }),
    movement({ kind: "income", amountCents: 500_000, category: "Salário" }),
    movement({ amountCents: 99_999, date: "2026-09-30" }),
    movement({ kind: "transfer", amountCents: 5_000, category: "Pagamento de fatura" }),
  ];
  const period = { from: "2026-10-01", to: "2026-10-31" };

  it("groups expenses by category with shares", () => {
    const result = spendingInPeriod(movements, accounts, { period, groupBy: "categoria" });
    expect(result.totalCents).toBe(50_000);
    expect(result.count).toBe(3);
    expect(result.paidCents).toBe(40_000);
    expect(result.pendingCents).toBe(10_000);
    expect(result.groups).toEqual([
      { label: "Moradia", cents: 30_000, count: 1, sharePercent: 60 },
      { label: "Alimentação", cents: 20_000, count: 2, sharePercent: 40 },
    ]);
    expect(result.largest[0]).toMatchObject({ description: "Aluguel", cents: 30_000 });
  });

  it("groups by bank and filters by category or income", () => {
    expect(spendingInPeriod(movements, accounts, { period, groupBy: "banco" }).groups).toEqual([
      { label: "Nubank", cents: 40_000, count: 2, sharePercent: 80 },
      { label: "Sem conta", cents: 10_000, count: 1, sharePercent: 20 },
    ]);
    expect(spendingInPeriod(movements, accounts, { period, groupBy: "nenhum", category: "Alimentação" }).totalCents).toBe(20_000);
    expect(spendingInPeriod(movements, accounts, { period, groupBy: "nenhum", kind: "income" }).totalCents).toBe(500_000);
  });
});

describe("comparePeriods", () => {
  it("compares totals and categories, with null change when there is no base", () => {
    const result = comparePeriods([
      movement({ date: "2026-09-10", amountCents: 20_000, category: "Lazer" }),
      movement({ date: "2026-10-10", amountCents: 30_000, category: "Lazer" }),
      movement({ date: "2026-10-11", amountCents: 5_000, category: "Saúde" }),
    ], { from: "2026-09-01", to: "2026-09-30" }, { from: "2026-10-01", to: "2026-10-31" });
    expect(result.first.totalCents).toBe(20_000);
    expect(result.second.totalCents).toBe(35_000);
    expect(result.differenceCents).toBe(15_000);
    expect(result.changePercent).toBe(75);
    expect(result.byCategory).toEqual([
      { label: "Lazer", firstCents: 20_000, secondCents: 30_000, differenceCents: 10_000, changePercent: 50 },
      { label: "Saúde", firstCents: 0, secondCents: 5_000, differenceCents: 5_000, changePercent: null },
    ]);
  });
});

describe("averageMonthlySurplus", () => {
  it("averages only closed months with records", () => {
    const result = averageMonthlySurplus([
      movement({ kind: "income", amountCents: 300_000, date: "2026-09-05" }),
      movement({ amountCents: 200_000, date: "2026-09-06" }),
      movement({ kind: "income", amountCents: 300_000, date: "2026-08-05" }),
      movement({ amountCents: 260_000, date: "2026-08-06" }),
      movement({ amountCents: 999_999, date: "2026-10-01" }),
    ], "2026-10");
    expect(result.monthsWithData).toBe(2);
    expect(result.averageCents).toBe(70_000);
  });

  it("returns null without history", () => {
    expect(averageMonthlySurplus([], "2026-10").averageCents).toBeNull();
  });
});

describe("recurringCharges", () => {
  const base = { kind: "expense" as const, category: "Assinaturas", interval: 1, isActive: true, isVariable: false };

  it("computes monthly equivalents", () => {
    expect(monthlyEquivalent({ amountCents: 1200, frequency: "yearly", interval: 1 })).toBe(100);
    expect(monthlyEquivalent({ amountCents: 1000, frequency: "weekly", interval: 1 })).toBe(4333);
    expect(monthlyEquivalent({ amountCents: 6000, frequency: "monthly", interval: 2 })).toBe(3000);
  });

  it("lists active charges and points out items to verify without judging them", () => {
    const result = recurringCharges([
      { ...base, id: "r1", name: "Netflix", amountCents: 5590, frequency: "monthly" },
      { ...base, id: "r2", name: "Netflix Família", amountCents: 5590, frequency: "monthly" },
      { ...base, id: "r3", name: "Academia", amountCents: 12000, frequency: "monthly", isActive: false },
      { ...base, id: "r4", name: "Spotify", amountCents: 2190, frequency: "monthly" },
    ], [movement({ description: "Spotify premium", amountCents: 2190, category: "Assinaturas" })], "2026-10");
    expect(result.items.map((item) => item.name)).toEqual(["Netflix", "Netflix Família", "Spotify"]);
    expect(result.totalMonthlyCents).toBe(5590 * 2 + 2190);
    expect(result.toCheck).toHaveLength(2);
    expect(result.toCheck[0].items).toEqual(["Netflix", "Netflix Família"]);
    expect(result.toCheck[1].reason).toContain("mesmo valor");
  });
});

describe("simulateGoal", () => {
  it("computes the monthly contribution for a deadline", () => {
    const result = simulateGoal({ targetCents: 600_000, initialCents: 100_000, months: 10, averageSurplusCents: 40_000 });
    expect(result).toMatchObject({ remainingCents: 500_000, monthlyCents: 50_000, months: 10, fitsAverageSurplus: false });
    expect(result.assumptions[0]).toContain("sem juros");
  });

  it("computes how many months a contribution takes", () => {
    expect(simulateGoal({ targetCents: 100_000, monthlyCents: 30_000, averageSurplusCents: 50_000 })).toMatchObject({ months: 4, monthlyCents: 30_000, fitsAverageSurplus: true });
  });

  it("handles a goal already covered and missing history", () => {
    expect(simulateGoal({ targetCents: 1000, initialCents: 2000 })).toMatchObject({ remainingCents: 0, months: 0 });
    expect(simulateGoal({ targetCents: 1000, months: 2 }).fitsAverageSurplus).toBeNull();
  });
});

describe("latestRecordDate", () => {
  it("ignores future records", () => {
    expect(latestRecordDate([{ date: "2026-10-01" }, { date: "2026-10-30" }, { date: "2026-10-18" }], "2026-10-19")).toBe("2026-10-18");
    expect(latestRecordDate([], "2026-10-19")).toBeNull();
  });
});
