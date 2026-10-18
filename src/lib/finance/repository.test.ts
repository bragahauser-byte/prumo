import { beforeEach, describe, expect, it } from "vitest";
import {
  createLocalFinanceRepository,
  defaultNotificationSettings,
  type FinanceExpense,
  type FinancePreferences,
  type FinanceRecurringRule,
} from "./repository";

describe("local finance repository", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty and persists onboarding preferences after a new repository is created", async () => {
    const first = createLocalFinanceRepository();
    expect(await first.load()).toEqual({ preferences: null, expenses: [], recurringRules: [], budgets: [], savingsGoals: [] });

    const preferences: FinancePreferences = {
      displayName: "Ana",
      monthlyIncomeCents: 350000,
      reportedBalanceCents: 120000,
      balanceReportedOn: "2026-10-10",
      payday: 5,
      currency: "BRL",
      goals: ["control_expenses"],
      termsAccepted: true,
      notificationsEnabled: false,
      onboardingCompleted: true,
      avatarDataUrl: "data:image/jpeg;base64,AAAA",
      notificationSettings: defaultNotificationSettings,
    };
    await first.savePreferences(preferences);

    const reloaded = createLocalFinanceRepository();
    expect((await reloaded.load()).preferences).toEqual(preferences);
  });

  it("persists expense creation, payment state, edits, and deletion", async () => {
    const repository = createLocalFinanceRepository();
    const expense: FinanceExpense = {
      id: "expense-1",
      kind: "expense",
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
      kind: "expense",
      name: "Conta de energia",
      amountCents: 18000,
      category: "Contas",
      frequency: "monthly",
      interval: 1,
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

  it("reads data saved before receitas, orçamentos e metas existed", async () => {
    localStorage.setItem("personal-finance:data:v1", JSON.stringify({
      preferences: null,
      expenses: [{ id: "old", description: "Internet", amountCents: 9990, category: "Contas", date: "2026-10-01", status: "paid", paidOn: "2026-10-01", notes: null, recurringRuleId: null, occurrenceDate: null }],
      recurringRules: [{ id: "rule-old", name: "Aluguel", amountCents: 150000, category: "Moradia", frequency: "monthly", startsOn: "2026-10-05", dueDay: 5, endsOn: null, isActive: true, isVariable: false, notes: null }],
    }));
    const snapshot = await createLocalFinanceRepository().load();
    expect(snapshot.expenses[0].kind).toBe("expense");
    expect(snapshot.recurringRules[0]).toMatchObject({ kind: "expense", interval: 1 });
    expect(snapshot.budgets).toEqual([]);
    expect(snapshot.savingsGoals).toEqual([]);
  });

  it("persists income occurrences, budgets and savings goals", async () => {
    const repository = createLocalFinanceRepository();
    await repository.saveRecurringRule({
      id: "salary",
      kind: "income",
      name: "Salário",
      amountCents: 500000,
      category: "Salário",
      frequency: "monthly",
      interval: 2,
      startsOn: "2028-01-05",
      dueDay: 5,
      endsOn: null,
      isActive: true,
      isVariable: false,
      notes: null,
    });
    expect(await repository.generateOccurrences("salary", "2028-06-30")).toBe(3);
    const incomes = (await repository.load()).expenses;
    expect(incomes.every((item) => item.kind === "income")).toBe(true);
    expect(incomes.map((item) => item.date).sort()).toEqual(["2028-01-05", "2028-03-05", "2028-05-05"]);

    await repository.saveBudget({ category: "Lazer", limitCents: 30000 });
    await repository.saveBudget({ category: "Lazer", limitCents: 40000 });
    expect((await repository.load()).budgets).toEqual([{ category: "Lazer", limitCents: 40000 }]);
    await repository.deleteBudget("Lazer");
    expect((await repository.load()).budgets).toEqual([]);

    const goal = { id: "goal", name: "Viagem", icon: "travel", targetCents: 600000, deadline: "2028-12-31", createdOn: "2028-01-01", contributions: [] };
    await repository.saveSavingsGoal(goal);
    await repository.saveSavingsGoal({ ...goal, contributions: [{ id: "c1", amountCents: 50000, date: "2028-01-10", status: "done" }] });
    expect((await createLocalFinanceRepository().load()).savingsGoals[0].contributions).toHaveLength(1);
    await repository.deleteSavingsGoal("goal");
    expect((await repository.load()).savingsGoals).toEqual([]);
  });

  it("reads preferences saved before profile photos and reminders existed, with everything off", async () => {
    localStorage.setItem("personal-finance:data:v1", JSON.stringify({
      preferences: { displayName: "Bia", monthlyIncomeCents: null, reportedBalanceCents: null, payday: null, currency: "BRL", goals: [], termsAccepted: true, notificationsEnabled: false, onboardingCompleted: true },
      expenses: [],
      recurringRules: [],
    }));
    const { preferences } = await createLocalFinanceRepository().load();
    expect(preferences?.avatarDataUrl).toBeNull();
    expect(preferences?.notificationSettings.reminders.weeklyReview.enabled).toBe(false);
    expect(preferences?.notificationSettings.reminders.monthlyBudget.enabled).toBe(false);
    expect(preferences?.notificationSettings.reminders.billsAhead.enabled).toBe(false);
  });
});
