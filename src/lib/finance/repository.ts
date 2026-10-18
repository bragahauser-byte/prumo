import { z } from "zod";
import { generateOccurrenceDates, type RecurringFrequency } from "../../domain/recurrence";
import type { ExpenseStatus } from "../../domain/financial";

export type CurrencyCode = "BRL" | "USD" | "EUR";
export type FinanceGoal = "control_expenses" | "remember_bills" | "understand_categories" | "track_available_balance";

export type FinancePreferences = {
  displayName: string | null;
  monthlyIncomeCents: number | null;
  reportedBalanceCents: number | null;
  payday: number | null;
  currency: CurrencyCode;
  goals: FinanceGoal[];
  termsAccepted: boolean;
  notificationsEnabled: boolean;
  onboardingCompleted: boolean;
};

export type FinanceExpense = {
  id: string;
  description: string;
  amountCents: number;
  category: string;
  date: string;
  status: ExpenseStatus;
  paidOn: string | null;
  notes: string | null;
  recurringRuleId: string | null;
  occurrenceDate: string | null;
};

export type FinanceRecurringRule = {
  id: string;
  name: string;
  amountCents: number;
  category: string;
  frequency: RecurringFrequency;
  startsOn: string;
  dueDay: number | null;
  endsOn: string | null;
  isActive: boolean;
  isVariable: boolean;
  notes: string | null;
};

export type FinanceSnapshot = {
  preferences: FinancePreferences | null;
  expenses: FinanceExpense[];
  recurringRules: FinanceRecurringRule[];
};

export interface FinanceRepository {
  readonly mode: "local" | "supabase";
  load(): Promise<FinanceSnapshot>;
  savePreferences(preferences: FinancePreferences): Promise<void>;
  saveExpense(expense: FinanceExpense): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  setExpenseStatus(id: string, status: ExpenseStatus, paidOn: string | null): Promise<void>;
  saveRecurringRule(rule: FinanceRecurringRule): Promise<void>;
  setRecurringRuleActive(id: string, isActive: boolean): Promise<void>;
  generateOccurrences(ruleId: string, throughDate: string): Promise<number>;
}

const preferencesSchema = z.object({
  displayName: z.string().nullable(),
  monthlyIncomeCents: z.number().int().nonnegative().nullable(),
  reportedBalanceCents: z.number().int().nullable(),
  payday: z.number().int().min(1).max(31).nullable(),
  currency: z.enum(["BRL", "USD", "EUR"]),
  goals: z.array(z.enum(["control_expenses", "remember_bills", "understand_categories", "track_available_balance"])),
  termsAccepted: z.boolean(),
  notificationsEnabled: z.boolean(),
  onboardingCompleted: z.boolean(),
});

const expenseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(120),
  amountCents: z.number().int().positive(),
  category: z.string().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["paid", "pending", "scheduled"]),
  paidOn: z.string().nullable(),
  notes: z.string().nullable(),
  recurringRuleId: z.string().nullable(),
  occurrenceDate: z.string().nullable(),
});

const recurringRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  amountCents: z.number().int().positive(),
  category: z.string().min(1).max(80),
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDay: z.number().int().min(1).max(31).nullable(),
  endsOn: z.string().nullable(),
  isActive: z.boolean(),
  isVariable: z.boolean(),
  notes: z.string().nullable(),
});

const snapshotSchema = z.object({
  preferences: preferencesSchema.nullable(),
  expenses: z.array(expenseSchema),
  recurringRules: z.array(recurringRuleSchema),
});

const storageKey = "personal-finance:data:v1";

function emptySnapshot(): FinanceSnapshot {
  return { preferences: null, expenses: [], recurringRules: [] };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createLocalFinanceRepository(
  storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage,
): FinanceRepository {
  const read = (): FinanceSnapshot => {
    const serialized = storage.getItem(storageKey);
    if (!serialized) return emptySnapshot();
    const result = snapshotSchema.safeParse(JSON.parse(serialized));
    if (!result.success) throw new Error("Os dados salvos neste navegador estão inválidos.");
    return result.data;
  };

  const write = (snapshot: FinanceSnapshot) => {
    const validated = snapshotSchema.parse(snapshot);
    storage.setItem(storageKey, JSON.stringify(validated));
  };

  return {
    mode: "local",
    async load() {
      return read();
    },
    async savePreferences(preferences) {
      write({ ...read(), preferences });
    },
    async saveExpense(expense) {
      const snapshot = read();
      const existingIndex = snapshot.expenses.findIndex((item) => item.id === expense.id);
      if (existingIndex >= 0) snapshot.expenses[existingIndex] = expense;
      else snapshot.expenses.unshift(expense);
      write(snapshot);
    },
    async deleteExpense(id) {
      const snapshot = read();
      write({ ...snapshot, expenses: snapshot.expenses.filter((expense) => expense.id !== id) });
    },
    async setExpenseStatus(id, status, paidOn) {
      const snapshot = read();
      const expense = snapshot.expenses.find((item) => item.id === id);
      if (!expense) throw new Error("A despesa não foi encontrada.");
      expense.status = status;
      expense.paidOn = status === "paid" ? paidOn : null;
      write(snapshot);
    },
    async saveRecurringRule(rule) {
      const snapshot = read();
      const existingIndex = snapshot.recurringRules.findIndex((item) => item.id === rule.id);
      if (existingIndex >= 0) snapshot.recurringRules[existingIndex] = rule;
      else snapshot.recurringRules.unshift(rule);
      write(snapshot);
    },
    async setRecurringRuleActive(id, isActive) {
      const snapshot = read();
      const rule = snapshot.recurringRules.find((item) => item.id === id);
      if (!rule) throw new Error("A recorrência não foi encontrada.");
      rule.isActive = isActive;
      write(snapshot);
    },
    async generateOccurrences(ruleId, throughDate) {
      const snapshot = read();
      const rule = snapshot.recurringRules.find((item) => item.id === ruleId);
      if (!rule || !rule.isActive) return 0;

      const occurrences = generateOccurrenceDates({
        frequency: rule.frequency,
        startsOn: rule.startsOn,
        dueDay: rule.dueDay,
        endsOn: rule.endsOn,
      }, throughDate, new Date().toISOString().slice(0, 10));
      const existing = new Set(snapshot.expenses
        .filter((expense) => expense.recurringRuleId === rule.id)
        .map((expense) => expense.occurrenceDate));
      const today = new Date().toISOString().slice(0, 10);
      const generated = occurrences
        .filter((date) => !existing.has(date))
        .map((date): FinanceExpense => ({
          id: createId(),
          description: rule.name,
          amountCents: rule.amountCents,
          category: rule.category,
          date,
          status: date <= today ? "pending" : "scheduled",
          paidOn: null,
          notes: rule.notes,
          recurringRuleId: rule.id,
          occurrenceDate: date,
        }));
      write({ ...snapshot, expenses: [...generated, ...snapshot.expenses] });
      return generated.length;
    },
  };
}

export function createFinanceId() {
  return createId();
}
