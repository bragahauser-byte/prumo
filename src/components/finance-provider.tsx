"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  createLocalFinanceRepository,
  type FinanceExpense,
  type FinancePreferences,
  type FinanceRecurringRule,
  type FinanceRepository,
  type FinanceSnapshot,
} from "@/lib/finance/repository";
import { createSupabaseFinanceRepository } from "@/lib/finance/supabase-repository";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ExpenseStatus } from "@/domain/financial";

export type FinanceContextValue = FinanceSnapshot & {
  mode: "local" | "supabase";
  isLoading: boolean;
  isSaving: boolean;
  hasLoaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  savePreferences: (preferences: FinancePreferences) => Promise<void>;
  saveExpense: (expense: FinanceExpense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  setExpenseStatus: (id: string, status: ExpenseStatus, paidOn: string | null) => Promise<void>;
  saveRecurringRule: (rule: FinanceRecurringRule) => Promise<void>;
  setRecurringRuleActive: (id: string, isActive: boolean) => Promise<void>;
  generateOccurrences: (ruleId: string, throughDate: string) => Promise<number>;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);
const emptySnapshot: FinanceSnapshot = { preferences: null, expenses: [], recurringRules: [] };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível acessar os dados financeiros.";
}

export function FinanceProvider({
  mode,
  children,
}: {
  mode: "local" | "supabase";
  children: ReactNode;
}) {
  const repositoryRef = useRef<FinanceRepository | null>(null);
  const [snapshot, setSnapshot] = useState<FinanceSnapshot>(emptySnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!repositoryRef.current) return;
    setIsLoading(true);
    try {
      setSnapshot(await repositoryRef.current.load());
      setHasLoaded(true);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    try {
      repositoryRef.current = mode === "local"
        ? createLocalFinanceRepository()
        : createSupabaseFinanceRepository(createSupabaseBrowserClient());
      repositoryRef.current.load().then((loadedSnapshot) => {
        if (cancelled) return;
        setSnapshot(loadedSnapshot);
        setHasLoaded(true);
        setError(null);
      }).catch((loadError: unknown) => {
        if (!cancelled) setError(errorMessage(loadError));
      }).finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (!hasLoaded || !snapshot.preferences?.notificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
    const today = new Date().toISOString().slice(0, 10);
    const dueToday = snapshot.expenses.filter((expense) => expense.status !== "paid" && expense.date === today);
    const key = `personal-finance:notifications:shown:${today}`;
    const notifiedIds = new Set<string>(JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[]);
    const newDueToday = dueToday.filter((expense) => !notifiedIds.has(expense.id));

    for (const expense of newDueToday) {
      new Notification(`Vence hoje: ${expense.description}`, {
        body: "Abra Finanças pessoais para atualizar o pagamento.",
        icon: "/app-icon.png",
        tag: `expense-${expense.id}-${today}`,
      });
      notifiedIds.add(expense.id);
    }

    if (newDueToday.length) window.localStorage.setItem(key, JSON.stringify([...notifiedIds]));
  }, [hasLoaded, snapshot.expenses, snapshot.preferences?.notificationsEnabled]);

  const mutate = async <T,>(operation: (repository: FinanceRepository) => Promise<T>) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Os dados ainda estão carregando.");
    setIsSaving(true);
    setError(null);
    try {
      const result = await operation(repository);
      setSnapshot(await repository.load());
      return result;
    } catch (mutationError) {
      setError(errorMessage(mutationError));
      throw mutationError;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FinanceContext.Provider value={{
      ...snapshot,
      mode,
      isLoading,
      isSaving,
      hasLoaded,
      error,
      refresh,
      savePreferences: (preferences) => mutate((repository) => repository.savePreferences(preferences)),
      saveExpense: (expense) => mutate((repository) => repository.saveExpense(expense)),
      deleteExpense: (id) => mutate((repository) => repository.deleteExpense(id)),
      setExpenseStatus: (id, status, paidOn) => mutate((repository) => repository.setExpenseStatus(id, status, paidOn)),
      saveRecurringRule: (rule) => mutate((repository) => repository.saveRecurringRule(rule)),
      setRecurringRuleActive: (id, isActive) => mutate((repository) => repository.setRecurringRuleActive(id, isActive)),
      generateOccurrences: (ruleId, throughDate) => mutate((repository) => repository.generateOccurrences(ruleId, throughDate)),
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance precisa estar dentro de FinanceProvider.");
  return context;
}
