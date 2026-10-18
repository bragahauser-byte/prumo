import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatCentsAsDecimal,
  formatSignedCentsAsDecimal,
  parseCurrencyToCents,
  parseSignedCurrencyToCents,
} from "../../domain/financial";
import type {
  FinanceExpense,
  FinancePreferences,
  FinanceRecurringRule,
  FinanceRepository,
  FinanceSnapshot,
} from "./repository";

function amountToCents(value: string | number) {
  const cents = parseCurrencyToCents(String(value), true);
  if (cents === null) throw new Error("O valor retornado pelo Supabase não é válido.");
  return cents;
}

function balanceToCents(value: string | number | null) {
  if (value === null) return null;
  const cents = parseSignedCurrencyToCents(String(value));
  if (cents === null) throw new Error("O saldo retornado pelo Supabase não é válido.");
  return cents;
}

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error("Não foi possível sincronizar os dados financeiros.");
}

export function createSupabaseFinanceRepository(client: SupabaseClient): FinanceRepository {
  let userId: string | null = null;

  async function requireUserId() {
    if (userId) return userId;
    const { data, error } = await client.auth.getUser();
    throwOnError(error);
    if (!data.user) throw new Error("Sua sessão expirou. Entre novamente.");
    userId = data.user.id;
    return userId;
  }

  return {
    mode: "supabase",
    async load(): Promise<FinanceSnapshot> {
      const ownerId = await requireUserId();
      const [profileResult, expenseResult, ruleResult] = await Promise.all([
        client.from("profiles").select("display_name, monthly_income, reported_balance, payday, currency, focus_areas, terms_accepted_at, notifications_enabled, onboarding_completed").eq("user_id", ownerId).maybeSingle(),
        client.from("expenses").select("id, description, amount, category, due_date, status, paid_on, notes, recurring_rule_id, occurrence_date").order("due_date", { ascending: true }),
        client.from("recurring_rules").select("id, name, amount, category, frequency, starts_on, due_day, ends_on, is_active, is_variable, notes").order("created_at", { ascending: false }),
      ]);
      throwOnError(profileResult.error);
      throwOnError(expenseResult.error);
      throwOnError(ruleResult.error);

      const preferences: FinancePreferences | null = profileResult.data ? {
        displayName: profileResult.data.display_name,
        monthlyIncomeCents: profileResult.data.monthly_income === null
          ? null
          : amountToCents(profileResult.data.monthly_income),
        reportedBalanceCents: balanceToCents(profileResult.data.reported_balance),
        payday: profileResult.data.payday,
        currency: profileResult.data.currency,
        goals: profileResult.data.focus_areas,
        termsAccepted: profileResult.data.terms_accepted_at !== null,
        notificationsEnabled: profileResult.data.notifications_enabled,
        onboardingCompleted: profileResult.data.onboarding_completed,
      } : null;

      return {
        preferences,
        expenses: (expenseResult.data ?? []).map((expense): FinanceExpense => ({
          id: expense.id,
          description: expense.description,
          amountCents: amountToCents(expense.amount),
          category: expense.category,
          date: expense.due_date,
          status: expense.status,
          paidOn: expense.paid_on,
          notes: expense.notes,
          recurringRuleId: expense.recurring_rule_id,
          occurrenceDate: expense.occurrence_date,
        })),
        recurringRules: (ruleResult.data ?? []).map((rule): FinanceRecurringRule => ({
          id: rule.id,
          name: rule.name,
          amountCents: amountToCents(rule.amount),
          category: rule.category,
          frequency: rule.frequency,
          startsOn: rule.starts_on,
          dueDay: rule.due_day,
          endsOn: rule.ends_on,
          isActive: rule.is_active,
          isVariable: rule.is_variable,
          notes: rule.notes,
        })),
      };
    },
    async savePreferences(preferences) {
      const ownerId = await requireUserId();
      const { data, error } = await client.from("profiles").update({
        display_name: preferences.displayName,
        monthly_income: preferences.monthlyIncomeCents === null ? null : formatCentsAsDecimal(preferences.monthlyIncomeCents),
        reported_balance: preferences.reportedBalanceCents === null ? null : formatSignedCentsAsDecimal(preferences.reportedBalanceCents),
        payday: preferences.payday,
        currency: preferences.currency,
        focus_areas: preferences.goals,
        terms_accepted_at: preferences.termsAccepted ? new Date().toISOString() : null,
        notifications_enabled: preferences.notificationsEnabled,
        onboarding_completed: preferences.onboardingCompleted,
      }).eq("user_id", ownerId).select("user_id").maybeSingle();
      throwOnError(error);
      if (!data) throw new Error("Não foi possível salvar as preferências da conta.");
    },
    async saveExpense(expense) {
      const ownerId = await requireUserId();
      const { error } = await client.from("expenses").upsert({
        id: expense.id,
        user_id: ownerId,
        description: expense.description,
        amount: formatCentsAsDecimal(expense.amountCents),
        category: expense.category,
        due_date: expense.date,
        status: expense.status,
        paid_on: expense.status === "paid" ? expense.paidOn : null,
        notes: expense.notes,
        recurring_rule_id: expense.recurringRuleId,
        occurrence_date: expense.occurrenceDate,
      });
      throwOnError(error);
    },
    async deleteExpense(id) {
      const ownerId = await requireUserId();
      const { data, error } = await client.from("expenses").delete().eq("id", id).eq("user_id", ownerId).select("id").maybeSingle();
      throwOnError(error);
      if (!data) throw new Error("A despesa não foi encontrada.");
    },
    async setExpenseStatus(id, status, paidOn) {
      const ownerId = await requireUserId();
      const { data, error } = await client.from("expenses").update({
        status,
        paid_on: status === "paid" ? paidOn : null,
      }).eq("id", id).eq("user_id", ownerId).select("id").maybeSingle();
      throwOnError(error);
      if (!data) throw new Error("A despesa não foi encontrada.");
    },
    async saveRecurringRule(rule) {
      const ownerId = await requireUserId();
      const { error } = await client.from("recurring_rules").upsert({
        id: rule.id,
        user_id: ownerId,
        name: rule.name,
        amount: formatCentsAsDecimal(rule.amountCents),
        category: rule.category,
        frequency: rule.frequency,
        starts_on: rule.startsOn,
        due_day: rule.dueDay,
        ends_on: rule.endsOn,
        is_active: rule.isActive,
        is_variable: rule.isVariable,
        notes: rule.notes,
      });
      throwOnError(error);
    },
    async setRecurringRuleActive(id, isActive) {
      const ownerId = await requireUserId();
      const { data, error } = await client.from("recurring_rules").update({ is_active: isActive }).eq("id", id).eq("user_id", ownerId).select("id").maybeSingle();
      throwOnError(error);
      if (!data) throw new Error("A recorrência não foi encontrada.");
    },
    async generateOccurrences(ruleId, throughDate) {
      const { data, error } = await client.rpc("generate_recurring_expenses", {
        p_rule_id: ruleId,
        p_through_date: throughDate,
      });
      throwOnError(error);
      return Number(data ?? 0);
    },
  };
}
