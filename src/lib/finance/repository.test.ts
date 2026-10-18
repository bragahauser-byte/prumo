import { beforeEach, describe, expect, it } from "vitest";
import {
  createLocalFinanceRepository,
  type FinanceExpense,
  type FinancePreferences,
  type FinanceRecurringRule,
} from "./repository";

describe("local finance repository", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty and persists onboarding preferences after a new repository is created", async () => {
    const first = createLocalFinanceRepository();
    expect(await first.load()).toEqual({ preferences: null, expenses: [], recurringRules: [] });

    const preferences: FinancePreferences = {
      displayName: "Ana",
      monthlyIncomeCents: 350000,
      reportedBalanceCents: 120000,
      payday: 5,
      currency: "BRL",
      goals: ["control_expenses"],
      termsAccepted: true,
      notificationsEnabled: false,
      onboardingCompleted: true,
    };
    await first.savePreferences(preferences);

    const reloaded = createLocalFinanceRepository();
    expect((await reloaded.load()).preferences).toEqual(preferences);
  });

  it("persists expense creation, payment state, edits, and deletion", async () => {
    const repository = createLocalFinanceRepository();
    const expense: FinanceExpense = {
      id: "expense-1",
      description: "Internet",
      amountCents: 12990,
      category: "Contas",
      date: "2026-10-12",
      status: "pending",
      paidOn: null,
      notes: null,
      recurringRuleId: null,
      occurrenceDate: null,
    };

    await repository.saveExpense(expense);
    await repository.setExpenseStatus(expense.id, "paid", "2026-10-10");
    const paid = (await createLocalFinanceRepository().load()).expenses[0];
    expect(paid.status).toBe("paid");
    expect(paid.paidOn).toBe("2026-10-10");

    await repository.saveExpense({ ...paid, amountCents: 13990 });
    expect((await repository.load()).expenses[0].amountCents).toBe(13990);
    await repository.deleteExpense(expense.id);
    expect((await repository.load()).expenses).toEqual([]);
  });

  it("generates recurring occurrences once and keeps edited occurrences independent", async () => {
    const repository = createLocalFinanceRepository();
    const rule: FinanceRecurringRule = {
      id: "rule-1",
      name: "Conta de energia",
      amountCents: 18000,
      category: "Contas",
      frequency: "monthly",
      startsOn: "2028-01-31",
      dueDay: 31,
      endsOn: null,
      isActive: true,
      isVariable: true,
      notes: null,
    };
    await repository.saveRecurringRule(rule);

    expect(await repository.generateOccurrences(rule.id, "2028-04-30")).toBe(4);
    const occurrences = (await repository.load()).expenses;
    expect(occurrences.map((expense) => expense.date).sort()).toEqual([
      "2028-01-31",
      "2028-02-29",
      "2028-03-31",
      "2028-04-30",
    ]);
    expect(await repository.generateOccurrences(rule.id, "2028-04-30")).toBe(0);

    const februaryOccurrence = occurrences.find((expense) => expense.date === "2028-02-29");
    if (!februaryOccurrence) throw new Error("Expected February occurrence.");
    await repository.saveExpense({ ...februaryOccurrence, amountCents: 19500 });
    await repository.generateOccurrences(rule.id, "2028-04-30");
    const reloaded = await repository.load();
    expect(reloaded.expenses.find((expense) => expense.id === februaryOccurrence.id)?.amountCents).toBe(19500);
  });
});
