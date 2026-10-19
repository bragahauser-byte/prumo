import { z } from "zod";
import { generateOccurrenceDates, type RecurringFrequency } from "../../domain/recurrence";
import type { ExpenseStatus } from "../../domain/financial";
import type { TransactionKind } from "../../domain/categories";
import { currencyCodes, type CurrencyCode } from "../../domain/currencies";
import { bankIds, type BankId } from "../../domain/banks";
import { investmentTypeIds, type InvestmentType } from "../../domain/investments";

export type { CurrencyCode } from "../../domain/currencies";
export type FinanceGoal = "control_expenses" | "remember_bills" | "understand_categories" | "track_available_balance";

/** Lembretes programados: o usuário escolhe frequência e horário; todos começam desligados. */
export type ReminderSettings = {
  weeklyReview: { enabled: boolean; weekday: number; time: string };
  monthlyBudget: { enabled: boolean; time: string };
  billsAhead: { enabled: boolean; daysBefore: number; time: string };
};

export type NotificationSettings = {
  /** Alertas importantes também como notificação do sistema (vencimentos, orçamento, metas fora do ritmo). */
  alertsPush: boolean;
  /** Insights como notificação do sistema: no máximo um por semana. */
  insightsPush: boolean;
  reminders: ReminderSettings;
};

export const defaultNotificationSettings: NotificationSettings = {
  alertsPush: true,
  insightsPush: false,
  reminders: {
    weeklyReview: { enabled: false, weekday: 0, time: "19:00" },
    monthlyBudget: { enabled: false, time: "09:00" },
    billsAhead: { enabled: false, daysBefore: 2, time: "09:00" },
  },
};

export type FinancePreferences = {
  displayName: string | null;
  monthlyIncomeCents: number | null;
  reportedBalanceCents: number | null;
  /** Data (AAAA-MM-DD) em que o saldo foi informado; movimentações pagas depois ajustam o saldo exibido. */
  balanceReportedOn: string | null;
  payday: number | null;
  currency: CurrencyCode;
  goals: FinanceGoal[];
  termsAccepted: boolean;
  notificationsEnabled: boolean;
  onboardingCompleted: boolean;
  /** Foto de perfil reduzida (JPEG em data URL, até ~60 KB). */
  avatarDataUrl: string | null;
  notificationSettings: NotificationSettings;
  /** Taxas manuais (1 unidade da moeda = X na moeda-base), usadas quando a cotação automática falha ou a pessoa prefere. */
  manualRates: Record<string, number>;
};

/** Conta em um banco ou instituição; o saldo fica na moeda da conta. */
export type FinanceAccount = {
  id: string;
  name: string;
  bank: BankId;
  currency: CurrencyCode;
  balanceCents: number | null;
  /** Data (AAAA-MM-DD) em que o saldo foi informado; movimentações pagas depois, nesta conta, ajustam o saldo. */
  balanceReportedOn: string | null;
  createdOn: string;
};

/** Valor original quando a movimentação foi registrada em outra moeda; amountCents guarda o valor convertido. */
export type FinanceOriginalAmount = {
  currency: CurrencyCode;
  amountCents: number;
  /** Quanto vale 1 unidade da moeda original na moeda-base no momento do registro. */
  rate: number;
  rateDate: string | null;
  manual: boolean;
};

export type FinanceInvestment = {
  id: string;
  type: InvestmentType;
  institution: string;
  description: string | null;
  appliedCents: number;
  /** Valor atual informado pela pessoa; null quando não informado (o Prumo não estima rendimento). */
  currentCents: number | null;
  date: string;
  updatedOn: string | null;
};

export type FinanceExpense = {
  id: string;
  kind: TransactionKind;
  description: string;
  amountCents: number;
  category: string;
  date: string;
  status: ExpenseStatus;
  paidOn: string | null;
  notes: string | null;
  recurringRuleId: string | null;
  occurrenceDate: string | null;
  accountId: string | null;
  original: FinanceOriginalAmount | null;
};

export type FinanceRecurringRule = {
  id: string;
  kind: TransactionKind;
  name: string;
  amountCents: number;
  category: string;
  frequency: RecurringFrequency;
  interval: number;
  startsOn: string;
  dueDay: number | null;
  endsOn: string | null;
  isActive: boolean;
  isVariable: boolean;
  notes: string | null;
};

export type FinanceBudget = {
  category: string;
  limitCents: number;
  /** Percentual do limite em que o alerta "perto do limite" dispara; null desliga os alertas desta categoria. */
  alertAt: number | null;
};

export type FinanceGoalContribution = {
  id: string;
  amountCents: number;
  date: string;
  status: "planned" | "done";
};

export type FinanceSavingsGoal = {
  id: string;
  name: string;
  icon: string;
  targetCents: number;
  deadline: string | null;
  createdOn: string;
  contributions: FinanceGoalContribution[];
};

export type FinanceSnapshot = {
  preferences: FinancePreferences | null;
  expenses: FinanceExpense[];
  recurringRules: FinanceRecurringRule[];
  budgets: FinanceBudget[];
  savingsGoals: FinanceSavingsGoal[];
  accounts: FinanceAccount[];
  investments: FinanceInvestment[];
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
  saveBudget(budget: FinanceBudget): Promise<void>;
  deleteBudget(category: string): Promise<void>;
  saveSavingsGoal(goal: FinanceSavingsGoal): Promise<void>;
  deleteSavingsGoal(id: string): Promise<void>;
  saveAccount(account: FinanceAccount): Promise<void>;
  /** Remove a conta; as movimentações dela continuam, sem conta vinculada. */
  deleteAccount(id: string): Promise<void>;
  saveInvestment(investment: FinanceInvestment): Promise<void>;
  deleteInvestment(id: string): Promise<void>;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const avatarSchema = z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(200_000);

export const notificationSettingsSchema = z.object({
  alertsPush: z.boolean(),
  insightsPush: z.boolean(),
  reminders: z.object({
    weeklyReview: z.object({ enabled: z.boolean(), weekday: z.number().int().min(0).max(6), time: timeSchema }),
    monthlyBudget: z.object({ enabled: z.boolean(), time: timeSchema }),
    billsAhead: z.object({ enabled: z.boolean(), daysBefore: z.number().int().min(1).max(7), time: timeSchema }),
  }),
});

const preferencesSchema = z.object({
  displayName: z.string().nullable(),
  monthlyIncomeCents: z.number().int().nonnegative().nullable(),
  reportedBalanceCents: z.number().int().nullable(),
  balanceReportedOn: dateSchema.nullable().default(null),
  payday: z.number().int().min(1).max(31).nullable(),
  currency: z.enum(currencyCodes),
  goals: z.array(z.enum(["control_expenses", "remember_bills", "understand_categories", "track_available_balance"])),
  termsAccepted: z.boolean(),
  notificationsEnabled: z.boolean(),
  onboardingCompleted: z.boolean(),
  avatarDataUrl: avatarSchema.nullable().default(null),
  notificationSettings: notificationSettingsSchema.default(defaultNotificationSettings),
  manualRates: z.record(z.string(), z.number().positive()).default({}),
});

const originalAmountSchema = z.object({
  currency: z.enum(currencyCodes),
  amountCents: z.number().int().positive(),
  rate: z.number().positive(),
  rateDate: dateSchema.nullable(),
  manual: z.boolean(),
});

const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  bank: z.enum(bankIds),
  currency: z.enum(currencyCodes),
  balanceCents: z.number().int().nullable(),
  balanceReportedOn: dateSchema.nullable(),
  createdOn: dateSchema,
});

const investmentSchema = z.object({
  id: z.string().min(1),
  type: z.enum(investmentTypeIds),
  institution: z.string().min(1).max(60),
  description: z.string().max(80).nullable(),
  appliedCents: z.number().int().positive(),
  currentCents: z.number().int().nonnegative().nullable(),
  date: dateSchema,
  updatedOn: dateSchema.nullable(),
});

const kindSchema = z.enum(["expense", "income", "transfer"]);

const expenseSchema = z.object({
  id: z.string().min(1),
  kind: kindSchema.default("expense"),
  description: z.string().min(1).max(120),
  amountCents: z.number().int().positive(),
  category: z.string().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["paid", "pending", "scheduled"]),
  paidOn: z.string().nullable(),
  notes: z.string().nullable(),
  recurringRuleId: z.string().nullable(),
  occurrenceDate: z.string().nullable(),
  accountId: z.string().nullable().default(null),
  original: originalAmountSchema.nullable().default(null),
});

const recurringRuleSchema = z.object({
  id: z.string().min(1),
  kind: kindSchema.default("expense"),
  name: z.string().min(1).max(120),
  amountCents: z.number().int().positive(),
  category: z.string().min(1).max(80),
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(12).default(1),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDay: z.number().int().min(1).max(31).nullable(),
  endsOn: z.string().nullable(),
  isActive: z.boolean(),
  isVariable: z.boolean(),
  notes: z.string().nullable(),
});

const budgetSchema = z.object({
  category: z.string().min(1).max(80),
  limitCents: z.number().int().positive(),
  alertAt: z.number().int().min(1).max(100).nullable().default(80),
});

const savingsGoalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(40),
  targetCents: z.number().int().positive(),
  deadline: dateSchema.nullable(),
  createdOn: dateSchema,
  contributions: z.array(z.object({
    id: z.string().min(1),
    amountCents: z.number().int().positive(),
    date: dateSchema,
    status: z.enum(["planned", "done"]),
  })),
});

const snapshotSchema = z.object({
  preferences: preferencesSchema.nullable(),
  expenses: z.array(expenseSchema),
  recurringRules: z.array(recurringRuleSchema),
  budgets: z.array(budgetSchema).default([]),
  savingsGoals: z.array(savingsGoalSchema).default([]),
  accounts: z.array(accountSchema).default([]),
  investments: z.array(investmentSchema).default([]),
});

const storageKey = "personal-finance:data:v1";

function emptySnapshot(): FinanceSnapshot {
  return { preferences: null, expenses: [], recurringRules: [], budgets: [], savingsGoals: [], accounts: [], investments: [] };
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
        interval: rule.interval,
      }, throughDate, new Date().toISOString().slice(0, 10));
      const existing = new Set(snapshot.expenses
        .filter((expense) => expense.recurringRuleId === rule.id)
        .map((expense) => expense.occurrenceDate));
      const today = new Date().toISOString().slice(0, 10);
      const generated = occurrences
        .filter((date) => !existing.has(date))
        .map((date): FinanceExpense => ({
          id: createId(),
          kind: rule.kind,
          description: rule.name,
          amountCents: rule.amountCents,
          category: rule.category,
          date,
          status: date <= today ? "pending" : "scheduled",
          paidOn: null,
          notes: rule.notes,
          recurringRuleId: rule.id,
          occurrenceDate: date,
          accountId: null,
          original: null,
        }));
      write({ ...snapshot, expenses: [...generated, ...snapshot.expenses] });
      return generated.length;
    },
    async saveBudget(budget) {
      const snapshot = read();
      write({ ...snapshot, budgets: [...snapshot.budgets.filter((item) => item.category !== budget.category), budget] });
    },
    async deleteBudget(category) {
      const snapshot = read();
      write({ ...snapshot, budgets: snapshot.budgets.filter((item) => item.category !== category) });
    },
    async saveSavingsGoal(goal) {
      const snapshot = read();
      const existingIndex = snapshot.savingsGoals.findIndex((item) => item.id === goal.id);
      if (existingIndex >= 0) snapshot.savingsGoals[existingIndex] = goal;
      else snapshot.savingsGoals.push(goal);
      write(snapshot);
    },
    async deleteSavingsGoal(id) {
      const snapshot = read();
      write({ ...snapshot, savingsGoals: snapshot.savingsGoals.filter((goal) => goal.id !== id) });
    },
    async saveAccount(account) {
      const snapshot = read();
      const existingIndex = snapshot.accounts.findIndex((item) => item.id === account.id);
      if (existingIndex >= 0) snapshot.accounts[existingIndex] = account;
      else snapshot.accounts.push(account);
      write(snapshot);
    },
    async deleteAccount(id) {
      const snapshot = read();
      write({
        ...snapshot,
        accounts: snapshot.accounts.filter((account) => account.id !== id),
        expenses: snapshot.expenses.map((expense) => expense.accountId === id ? { ...expense, accountId: null } : expense),
      });
    },
    async saveInvestment(investment) {
      const snapshot = read();
      const existingIndex = snapshot.investments.findIndex((item) => item.id === investment.id);
      if (existingIndex >= 0) snapshot.investments[existingIndex] = investment;
      else snapshot.investments.push(investment);
      write(snapshot);
    },
    async deleteInvestment(id) {
      const snapshot = read();
      write({ ...snapshot, investments: snapshot.investments.filter((item) => item.id !== id) });
    },
  };
}

export function createFinanceId() {
  return createId();
}
