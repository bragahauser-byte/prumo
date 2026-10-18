import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatCentsAsDecimal,
  formatSignedCentsAsDecimal,
  parseCurrencyToCents,
  parseSignedCurrencyToCents,
} from "../../domain/financial";
import type {
  FinanceBudget,
  FinanceExpense,
  FinancePreferences,
  FinanceRecurringRule,
  FinanceRepository,
  FinanceSavingsGoal,
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
      const [profileResult, expenseResult, ruleResult, budgetResult, goalResult, contributionResult] = await Promise.all([
        client.from("profiles").select("display_name, monthly_income, reported_balance, balance_reported_on, payday, currency, focus_areas, terms_accepted_at, notifications_enabled, onboarding_completed").eq("user_id", ownerId).maybeSingle(),
        client.from("expenses").select("id, kind, description, amount, category, due_date, status, paid_on, notes, recurring_rule_id, occurrence_date").order("due_date", { ascending: true }),
        client.from("recurring_rules").select("id, kind, name, amount, category, frequency, interval_count, starts_on, due_day, ends_on, is_active, is_variable, notes").order("created_at", { ascending: false }),
        client.from("budgets").select("category, limit_amount").order("category"),
        client.from("savings_goals").select("id, name, icon, target_amount, deadline, created_on").order("created_at"),
        client.from("goal_contributions").select("id, goal_id, amount, contributed_on, status").order("contributed_on"),
      ]);
      throwOnError(profileResult.error);
      throwOnError(expenseResult.error);
      throwOnError(ruleResult.error);
      throwOnError(budgetResult.error);
      throwOnError(goalResult.error);
      throwOnError(contributionResult.error);

      const preferences: FinancePreferences | null = profileResult.data ? {
        displayName: profileResult.data.display_name,
        monthlyIncomeCents: profileResult.data.monthly_income === null
          ? null
          : amountToCents(profileResult.data.monthly_income),
        reportedBalanceCents: balanceToCents(profileResult.data.reported_balance),
        balanceReportedOn: profileResult.data.balance_reported_on,
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
          kind: expense.kind,
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
          kind: rule.kind,
          name: rule.name,
          amountCents: amountToCents(rule.amount),
          category: rule.category,
          frequency: rule.frequency,
          interval: rule.interval_count,
          startsOn: rule.starts_on,
          dueDay: rule.due_day,
          endsOn: rule.ends_on,
          isActive: rule.is_active,
          isVariable: rule.is_variable,
          notes: rule.notes,
        })),
        budgets: (budgetResult.data ?? []).map((budget): FinanceBudget => ({
          category: budget.category,
          limitCents: amountToCents(budget.limit_amount),
        })),
        savingsGoals: (goalResult.data ?? []).map((goal): FinanceSavingsGoal => ({
          id: goal.id,
          name: goal.name,
          icon: goal.icon,
          targetCents: amountToCents(goal.target_amount),
          deadline: goal.deadline,
          createdOn: goal.created_on,
          contributions: (contributionResult.data ?? [])
            .filter((contribution) => contribution.goal_id === goal.id)
            .map((contribution) => ({
              id: contribution.id,
              amountCents: amountToCents(contribution.amount),
              date: contribution.contributed_on,
              status: contribution.status,
            })),
        })),
      };
    },
    async savePreferences(preferences) {
      const ownerId = await requireUserId();
      const { data, error } = await client.from("profiles").update({
        display_name: preferences.displayName,
        monthly_income: preferences.monthlyIncomeCents === null ? null : formatCentsAsDecimal(preferences.monthlyIncomeCents),
        reported_balance: preferences.reportedBalanceCents === null ? null : formatSignedCentsAsDecimal(preferences.reportedBalanceCents),
        balance_reported_on: preferences.balanceReportedOn,
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
        kind: expense.kind,
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
        kind: rule.kind,
        interval_count: rule.interval,
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
    async saveBudget(budget) {
      const ownerId = await requireUserId();
      const { error } = await client.from("budgets").upsert({
        user_id: ownerId,
        category: budget.category,
        limit_amount: formatCentsAsDecimal(budget.limitCents),
      });
      throwOnError(error);
    },
    async deleteBudget(category) {
      const ownerId = await requireUserId();
      const { error } = await client.from("budgets").delete().eq("user_id", ownerId).eq("category", category);
      throwOnError(error);
    },
    async saveSavingsGoal(goal) {
      const ownerId = await requireUserId();
      const { error } = await client.from("savings_goals").upsert({
        id: goal.id,
        user_id: ownerId,
        name: goal.name,
        icon: goal.icon,
        target_amount: formatCentsAsDecimal(goal.targetCents),
        deadline: goal.deadline,
        created_on: goal.createdOn,
      });
      throwOnError(error);
      const keptIds = goal.contributions.map((contribution) => contribution.id);
      const removal = client.from("goal_contributions").delete().eq("user_id", ownerId).eq("goal_id", goal.id);
      const { error: removalError } = keptIds.length
        ? await removal.not("id", "in", `(${keptIds.join(",")})`)
        : await removal;
      throwOnError(removalError);
      if (goal.contributions.length) {
        const { error: contributionError } = await client.from("goal_contributions").upsert(goal.contributions.map((contribution) => ({
          id: contribution.id,
          user_id: ownerId,
          goal_id: goal.id,
          amount: formatCentsAsDecimal(contribution.amountCents),
          contributed_on: contribution.date,
          status: contribution.status,
        })));
        throwOnError(contributionError);
      }
    },
    async deleteSavingsGoal(id) {
      const ownerId = await requireUserId();
      const { error } = await client.from("savings_goals").delete().eq("id", id).eq("user_id", ownerId);
      throwOnError(error);
    },
  };
}
