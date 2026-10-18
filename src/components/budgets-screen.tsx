"use client";

import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Illustration } from "@/components/ui/illustration";
import { MoneyKeypad } from "@/components/ui/money-keypad";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, Meter, SectionHeader, dangerButton, focusRing, textButton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { expenseCategories } from "@/domain/categories";
import { expensesByCategory, shiftMonth } from "@/domain/planning";
import { currentMonth } from "@/lib/dates";
import { formatCurrency, formatMonthKey } from "@/lib/formatting";

export function BudgetsScreen() {
  const { expenses, saveBudget, deleteBudget, isSaving } = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const { currency, budgets } = useFinanceSummary(month);
  const [editing, setEditing] = useState<string | null>(null);
  const toast = useToast();
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  const spentByCategory = new Map(expensesByCategory(expenses, month).map((item) => [item.category, item.amountCents]));
  const averageByCategory = (category: string) => {
    const months = [1, 2, 3].map((offset) => shiftMonth(month, -offset));
    const total = months.reduce((sum, item) => sum + (expensesByCategory(expenses, item).find((entry) => entry.category === category)?.amountCents ?? 0), 0);
    return Math.round(total / months.length);
  };
  const unbudgeted = expenseCategories.filter((category) => !budgets.some((budget) => budget.category === category));
  const totalLimit = budgets.reduce((sum, item) => sum + item.limitCents, 0);
  const totalSpent = budgets.reduce((sum, item) => sum + item.spentCents, 0);
  const alerts = budgets.filter((item) => item.level !== "ok");
  const editingBudget = editing ? budgets.find((item) => item.category === editing) : undefined;
  const isCurrent = month === currentMonth();

  async function save(category: string, cents: number) {
    setMessage(null);
    try {
      await saveBudget({ category, limitCents: cents });
      setEditing(null);
      toast(`Limite de ${category} salvo: ${formatCurrency(cents, currency)} por mês.`);
    } catch {
      setMessage({ text: "Não foi possível salvar o limite.", failed: true });
    }
  }

  async function remove(category: string) {
    setMessage(null);
    try {
      await deleteBudget(category);
      toast(`Limite de ${category} removido.`);
    } catch {
      setMessage({ text: "Não foi possível remover o limite.", failed: true });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior" className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}><ChevronLeft size={20} aria-hidden="true" /></button>
        <p className="text-base font-semibold first-letter:uppercase" aria-live="polite">{formatMonthKey(month)}</p>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês" className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] ${focusRing}`}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>

      {budgets.length ? (
        <Card className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
          <ProgressRing
            size={200}
            stroke={14}
            value={totalLimit ? totalSpent / totalLimit : 0}
            color={totalSpent > totalLimit ? "var(--color-error)" : totalSpent >= totalLimit * 0.8 ? "var(--color-warning)" : "var(--color-action)"}
            track="var(--color-soft)"
            label={`${Math.round((totalSpent / Math.max(totalLimit, 1)) * 100)}% do orçamento total usado`}
          >
            <span className="text-3xl font-semibold">{Math.round((totalSpent / Math.max(totalLimit, 1)) * 100)}%</span>
            <span className="text-sm text-[var(--color-muted)]">usado</span>
          </ProgressRing>
          <div className="w-full flex-1 space-y-3 text-center sm:text-left">
            <p className="text-sm text-[var(--color-muted)]">{totalSpent > totalLimit ? "Acima do total planejado" : "Ainda cabe no orçamento"}</p>
            <p className={`tabular text-4xl font-semibold ${totalSpent > totalLimit ? "text-[var(--color-error)]" : ""}`}>{formatCurrency(Math.abs(totalLimit - totalSpent), currency)}</p>
            <p className="text-sm text-[var(--color-muted)]">{formatCurrency(totalSpent, currency)} gastos de {formatCurrency(totalLimit, currency)} planejados em {budgets.length} {budgets.length === 1 ? "categoria" : "categorias"}.</p>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center px-6 py-10 text-center">
          <Illustration name="budgets" size={144} />
          <h2 className="mt-5 text-xl font-semibold">Decida antes de gastar</h2>
          <p className="mt-1 max-w-[340px] text-sm leading-5 text-[var(--color-muted)]">Defina quanto quer gastar por categoria. Avisamos quando chegar a 80% e quando passar do limite.</p>
        </Card>
      )}

      {alerts.length && isCurrent ? (
        <div className="space-y-2" role="status">
          {alerts.map((item) => (
            <p key={item.category} className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${item.level === "over" ? "bg-[var(--color-error-soft)] text-[var(--color-error)]" : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"}`}>
              <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              {item.level === "over"
                ? `Você passou ${formatCurrency(item.spentCents - item.limitCents, currency)} do limite de ${item.category}.`
                : `${item.category} já usou ${Math.round(item.ratio * 100)}% do limite. Restam ${formatCurrency(item.remainingCents, currency)}.`}
            </p>
          ))}
        </div>
      ) : null}

      {message ? <p className={`text-sm ${message.failed ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}`} role={message.failed ? "alert" : "status"}>{message.text}</p> : null}

      {budgets.length ? (
        <Card aria-labelledby="budgets-title">
          <SectionHeader id="budgets-title" title="Limites por categoria" />
          <ul className="divide-y divide-[var(--color-border)]">
            {budgets.map((item) => (
              <li key={item.category} className="py-4">
                <div className="flex items-center gap-3">
                  <CategoryIcon category={item.category} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-base font-medium">{item.category}</p>
                      <p className={`tabular shrink-0 text-sm font-semibold ${item.level === "over" ? "text-[var(--color-error)]" : item.level === "warning" ? "text-[var(--color-warning)]" : ""}`}>{item.remainingCents >= 0 ? `Restam ${formatCurrency(item.remainingCents, currency)}` : `${formatCurrency(-item.remainingCents, currency)} acima`}</p>
                    </div>
                    <div className="mt-2"><Meter value={item.ratio} level={item.level} label={`${item.category}: ${Math.round(item.ratio * 100)}% do limite`} /></div>
                    <p className="tabular mt-1.5 text-xs text-[var(--color-muted)]">{formatCurrency(item.spentCents, currency)} de {formatCurrency(item.limitCents, currency)}</p>
                  </div>
                </div>
                <div className="mt-1 flex gap-1 pl-[52px]">
                  <button type="button" onClick={() => setEditing(item.category)} className={textButton}>Alterar limite</button>
                  <button type="button" disabled={isSaving} onClick={() => void remove(item.category)} className={dangerButton}>Remover</button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card aria-labelledby="unbudgeted-title">
        <SectionHeader id="unbudgeted-title" title={budgets.length ? "Sem limite definido" : "Escolha uma categoria"} />
        <ul className="grid divide-y divide-[var(--color-border)] sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
          {unbudgeted.map((category) => (
            <li key={category}>
              <button type="button" onClick={() => setEditing(category)} className={`flex w-full items-center gap-3 rounded-xl py-3 text-left transition-colors hover:bg-[var(--color-soft)] ${focusRing}`}>
                <CategoryIcon category={category} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium">{category}</span>
                  <span className="tabular block text-xs text-[var(--color-muted)]">{spentByCategory.get(category) ? `${formatCurrency(spentByCategory.get(category)!, currency)} gastos no mês` : "Nada gasto no mês"}</span>
                </span>
                <span className="text-sm font-semibold text-[var(--color-action)]">Definir</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {editing ? (
        <MoneyKeypad
          title={`Limite para ${editing}`}
          currency={currency}
          initialCents={editingBudget?.limitCents ?? null}
          submitLabel={isSaving ? "Salvando..." : "Salvar limite"}
          helper={averageByCategory(editing) > 0 ? `Média dos últimos 3 meses: ${formatCurrency(averageByCategory(editing), currency)}` : "Quanto você quer gastar por mês nesta categoria?"}
          onSubmit={(cents) => void save(editing, cents)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
