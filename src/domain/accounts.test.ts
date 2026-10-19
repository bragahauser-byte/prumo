import { describe, expect, it } from "vitest";
import { accountBalance, accountBalances, movementsByAccount, type AccountMovement } from "./accounts";
import { convertCents, quote } from "./exchange";
import { summarizeInvestments } from "./investments";

const table = { base: "BRL", date: "2026-10-17", rates: { USD: 0.2, EUR: 0.16 } };

function movement(overrides: Partial<AccountMovement>): AccountMovement {
  return {
    id: Math.random().toString(36),
    kind: "expense",
    amountCents: 1000,
    status: "paid",
    date: "2026-10-10",
    paidOn: "2026-10-10",
    category: "Alimentação",
    recurringRuleId: null,
    accountId: null,
    original: null,
    ...overrides,
  };
}

describe("exchange", () => {
  it("converts through the base currency using the published table", () => {
    expect(quote("USD", "BRL", "BRL", table)).toEqual({ rate: 5, date: "2026-10-17", source: "api" });
    expect(convertCents(1000, "USD", "BRL", "BRL", table)?.cents).toBe(5000);
    expect(convertCents(5000, "BRL", "USD", "BRL", table)?.cents).toBe(1000);
    expect(convertCents(1000, "USD", "EUR", "BRL", table)?.cents).toBe(800);
  });

  it("prefers a manual rate and returns null without any rate", () => {
    expect(convertCents(1000, "USD", "BRL", "BRL", table, { USD: 5.5 })).toMatchObject({ cents: 5500, source: "manual" });
    expect(convertCents(1000, "GBP", "BRL", "BRL", table)).toBeNull();
    expect(convertCents(1000, "USD", "BRL", "BRL", null)).toBeNull();
    expect(convertCents(1234, "BRL", "BRL", "BRL", null)).toMatchObject({ cents: 1234, source: "same" });
  });
});

describe("accounts", () => {
  const nubank = { id: "a1", name: "Nubank", bank: "nubank", currency: "BRL", balanceCents: 100_000, balanceReportedOn: "2026-10-05" };
  const wise = { id: "a2", name: "Wise", bank: "wise", currency: "USD", balanceCents: 20_000, balanceReportedOn: "2026-10-05" };

  it("adjusts an account balance only with paid movements of that account after the reported date", () => {
    const movements = [
      movement({ accountId: "a1", amountCents: 5_000 }),
      movement({ accountId: "a1", kind: "income", amountCents: 20_000 }),
      movement({ accountId: "a1", paidOn: "2026-10-01", date: "2026-10-01" }),
      movement({ accountId: "a1", status: "pending", paidOn: null }),
      movement({ accountId: "a2", amountCents: 9_999 }),
    ];
    expect(accountBalance(nubank, movements, "BRL")).toBe(115_000);
  });

  it("uses the original amount for movements of a foreign-currency account", () => {
    const movements = [movement({ accountId: "a2", amountCents: 5_000, original: { currency: "USD", amountCents: 1_000 } })];
    expect(accountBalance(wise, movements, "BRL")).toBe(19_000);
  });

  it("sums balances in the base currency and reports missing rates", () => {
    const result = accountBalances([nubank, wise], [], "BRL", table);
    expect(result.totalCents).toBe(100_000 + 100_000);
    expect(result.missingRates).toEqual([]);
    const withoutRates = accountBalances([nubank, wise], [], "BRL", null);
    expect(withoutRates.totalCents).toBe(100_000);
    expect(withoutRates.missingRates).toEqual(["USD"]);
  });

  it("groups income and expenses of the month by account", () => {
    const rows = movementsByAccount([nubank, wise], [
      movement({ accountId: "a1", amountCents: 3_000 }),
      movement({ accountId: "a1", kind: "income", amountCents: 10_000 }),
      movement({ accountId: null, amountCents: 2_000 }),
      movement({ accountId: "a2", kind: "transfer", category: "Transferência entre contas" }),
      movement({ accountId: "a1", date: "2026-09-30" }),
    ], "2026-10");
    expect(rows).toEqual([
      { accountId: "a1", name: "Nubank", bank: "nubank", incomeCents: 10_000, expenseCents: 3_000, count: 2, netCents: 7_000 },
      { accountId: null, name: "Sem conta", bank: null, incomeCents: 0, expenseCents: 2_000, count: 1, netCents: -2_000 },
    ]);
  });
});

describe("investments", () => {
  it("totals applied and current values without estimating returns", () => {
    const summary = summarizeInvestments([
      { type: "tesouro", institution: "Tesouro", appliedCents: 100_000, currentCents: 110_000, date: "2026-01-01" },
      { type: "cdb_rdb", institution: "Nubank", appliedCents: 50_000, currentCents: null, date: "2026-02-01" },
      { type: "tesouro", institution: "Tesouro", appliedCents: 40_000, currentCents: 40_000, date: "2026-03-01" },
    ]);
    expect(summary.appliedCents).toBe(190_000);
    expect(summary.currentCents).toBe(200_000);
    expect(summary.differenceCents).toBe(10_000);
    expect(summary.withCurrentValue).toBe(2);
    expect(summary.distribution[0]).toMatchObject({ type: "tesouro", currentCents: 150_000, count: 2, share: 0.75 });
  });
});
