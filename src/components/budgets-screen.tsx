"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Bell, BellOff, ChevronLeft, ChevronRight, PieChart } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Illustration } from "@/components/ui/illustration";
import { MoneyKeypad } from "@/components/ui/money-keypad";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, Meter, SectionHeader, dangerButton, focusRing, textButton } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { expenseCategories } from "@/domain/categories";
import { defaultBudgetAlertAt, expensesByCategory, shiftMonth, type BudgetLevel } from "@/domain/planning";
import { currentMonth } from "@/lib/dates";
import type { FinanceBudget } from "@/lib/finance/repository";
import { formatCurrency, formatMonthKey } from "@/lib/formatting";

export const budgetLevelLabels: Record<BudgetLevel, { label: string; className: string }> = {
  ok: { label: "Normal", className: "bg-[var(--color-success-soft)] text-[var(--color-success)]" },
  warning: { label: "Próximo do limite", className: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" },
  reached: { label: "Limite atingido", className: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" },
  over: { label: "Ultrapassado", className: "bg-[var(--color-error-soft)] text-[var(--color-error)]" },
};

const alertOptions: { value: number | null; label: string; description: string }[] = [
  { value: 50, label: "Em 50%", description: "Avisa cedo, na metade do limite" },
  { value: 70, label: "Em 70%", description: "Com folga para ajustar" },
  { value: 80, label: "Em 80%", description: "Padrão" },
  { value: 90, label: "Em 90%", description: "Só perto do fim" },
  { value: 100, label: "Só ao atingir ou passar", description: "Avisa no limite e no excedente" },
  { value: null, label: "Desligado", description: "Sem avisos para esta categoria" },
];

const percent = (ratio: number) => Math.floor(ratio * 100);

export function BudgetsScreen() {
  const { expenses, saveBudget, deleteBudget, isSaving } = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const { currency, budgets } = useFinanceSummary(month);
  const [editing, setEditing] = useState<string | null>(null);
  const [alertsFor, setAlertsFor] = useState<string | null>(null);
  const toast = useToast();
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  const spentByCategory = new Map(expensesByCategory(expenses, month).map((item) => [item.category, item.amountCents]));
  const averageByCategory = (category: string) => {
    const months = [1, 2, 3].map((offset) => shiftMonth(month, -offset));
    const total = months.reduce((sum, item) => sum + (expensesByCategory(expenses, item).find((entry) => entry.category === category)?.amountCents ?? 0), 0);
    return Math.round(total / months.length);
  };
  const unbudgeted = [...new Set([...expenseCategories, ...spentByCategory.keys()])].filter((category) => !budgets.some((budget) => budget.category === category));
  const totalLimit = budgets.reduce((sum, item) => sum + item.limitCents, 0);
  const totalSpent = budgets.reduce((sum, item) => sum + item.spentCents, 0);
  const alerts = budgets.filter((item) => item.level !== "ok" && item.alertAt !== null);
  const editingBudget = editing ? budgets.find((item) => item.category === editing) : undefined;
  const alertBudget = alertsFor ? budgets.find((item) => item.category === alertsFor) : undefined;
  const isCurrent = month === currentMonth();

  async function save(budget: FinanceBudget, confirmation: string) {
    setMessage(null);
    try {
      await saveBudget(budget);
      toast(confirmation);
      return true;
    } catch {
      setMessage({ text: "Não foi possível salvar o orçamento.", failed: true });
      return false;
    }
  }

  async function saveLimit(category: string, cents: number) {
    const alertAt = budgets.find((item) => item.category === category)?.alertAt;
    if (await save({ category, limitCents: cents, alertAt: alertAt === undefined ? defaultBudgetAlertAt : alertAt }, `Limite de ${category} salvo: ${formatCurrency(cents, currency)} por mês.`)) setEditing(null);
  }

  async function saveAlert(alertAt: number | null) {
    if (!alertBudget) return;
    if (await save({ category: alertBudget.category, limitCents: alertBudget.limitCents, alertAt }, alertAt === null ? `Alertas de ${alertBudget.category} desligados` : `Alerta de ${alertBudget.category} atualizado`)) setAlertsFor(null);
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
            label={`${percent(totalSpent / Math.max(totalLimit, 1))}% do orçamento total usado`}
          >
            <span className="tabular text-3xl font-semibold">{percent(totalSpent / Math.max(totalLimit, 1))}%</span>
            <span className="text-sm text-[var(--color-muted)]">usado</span>
          </ProgressRing>
          <div className="w-full flex-1 space-y-3 text-center sm:text-left">
            <p className="text-sm text-[var(--color-muted)]">{totalSpent > totalLimit ? "Acima do total planejado" : "Ainda cabe no orçamento"}</p>
            <p className={`tabular text-4xl font-semibold ${totalSpent > totalLimit ? "text-[var(--color-error)]" : ""}`}>{formatCurrency(Math.abs(totalLimit - totalSpent), currency)}</p>
            <p className="text-sm text-[var(--color-muted)]">{formatCurrency(totalSpent, currency)} gastos de {formatCurrency(totalLimit, currency)} planejados em {budgets.length} {budgets.length === 1 ? "categoria" : "categorias"}.</p>
            <Link href={`/reports/categories?month=${month}`} className={`${textButton} -ml-3`}><PieChart size={18} aria-hidden="true" /> Análise por categoria</Link>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center px-6 py-10 text-center">
          <Illustration name="budgets" size={144} />
          <h2 className="mt-5 text-xl font-semibold">Decida antes de gastar</h2>
          <p className="mt-1 max-w-[340px] text-sm leading-5 text-[var(--color-muted)]">Defina quanto quer gastar por categoria. Você escolhe quando ser avisado — e o registro de um gasto nunca é bloqueado pelo limite.</p>
        </Card>
      )}

      {alerts.length && isCurrent ? (
        <div className="space-y-2" role="status">
          {alerts.map((item) => (
            <p key={item.category} className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${item.level === "over" ? "bg-[var(--color-error-soft)] text-[var(--color-error)]" : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"}`}>
              <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              {item.level === "over"
                ? `${item.category} passou ${formatCurrency(item.spentCents - item.limitCents, currency)} do limite de ${formatCurrency(item.limitCents, currency)}.`
                : item.level === "reached"
                  ? `${item.category} atingiu o limite de ${formatCurrency(item.limitCents, currency)}.`
                  : `${item.category} já usou ${percent(item.ratio)}% do limite. Restam ${formatCurrency(item.remainingCents, currency)}.`}
            </p>
          ))}
        </div>
      ) : null}

      {message ? <p className={`text-sm ${message.failed ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}`} role={message.failed ? "alert" : "status"}>{message.text}</p> : null}

      {budgets.length ? (
        <Card aria-labelledby="budgets-title">
          <SectionHeader id="budgets-title" title="Limites por categoria" />
          <ul className="divide-y divide-[var(--color-border)]">
            {budgets.map((item) => {
              const state = budgetLevelLabels[item.level];
              return (
                <li key={item.category} className="py-4" aria-label={`${item.category}: ${state.label}`}>
                  <div className="flex items-start gap-3">
                    <CategoryIcon category={item.category} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-base font-semibold">{item.category}</p>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${state.className}`}>{state.label}</span>
                      </div>
                      <div className="mt-2"><Meter value={item.ratio} level={item.level} label={`${item.category}: ${percent(item.ratio)}% do limite`} /></div>
                      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div><dt className="text-[var(--color-muted)]">Gasto</dt><dd className="tabular text-sm font-semibold text-[var(--color-expense)]">{formatCurrency(item.spentCents, currency)}</dd></div>
                        <div><dt className="text-[var(--color-muted)]">Limite</dt><dd className="tabular text-sm font-semibold">{formatCurrency(item.limitCents, currency)}</dd></div>
                        <div className="text-right">
                          <dt className="text-[var(--color-muted)]">{item.remainingCents >= 0 ? "Restante" : "Excedente"}</dt>
                          <dd className={`tabular text-sm font-semibold ${item.remainingCents < 0 ? "text-[var(--color-error)]" : ""}`}>{formatCurrency(Math.abs(item.remainingCents), currency)}</dd>
                        </div>
                      </dl>
                      <p className="tabular mt-1 text-xs text-[var(--color-muted)]">{percent(item.ratio)}% do orçamento utilizado</p>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 pl-[52px]">
                    <button type="button" onClick={() => setEditing(item.category)} className={textButton}>Alterar limite</button>
                    <button type="button" onClick={() => setAlertsFor(item.category)} className={textButton} aria-label={`Alertas de ${item.category}: ${item.alertAt === null ? "desligados" : item.alertAt >= 100 ? "só ao atingir" : `em ${item.alertAt}%`}`}>
                      {item.alertAt === null ? <BellOff size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
                      {item.alertAt === null ? "Alertas desligados" : item.alertAt >= 100 ? "Alerta no limite" : `Alerta em ${item.alertAt}%`}
                    </button>
                    <button type="button" disabled={isSaving} onClick={() => void remove(item.category)} className={dangerButton}>Remover</button>
                  </div>
                </li>
              );
            })}
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
                <span className="text-sm font-semibold text-[var(--color-link)]">Definir</span>
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
          onSubmit={(cents) => void saveLimit(editing, cents)}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {alertBudget ? (
        <Sheet title={`Alertas de ${alertBudget.category}`} description="Quando avisar sobre este limite. O registro de gastos nunca é bloqueado." onClose={() => setAlertsFor(null)}>
          <ul role="radiogroup" aria-label={`Alertas de ${alertBudget.category}`} className="divide-y divide-[var(--color-border)]">
            {alertOptions.map((option) => {
              const active = alertBudget.alertAt === option.value;
              return (
                <li key={option.label}>
                  <button type="button" role="radio" aria-checked={active} disabled={isSaving} onClick={() => void saveAlert(option.value)} className={`flex min-h-14 w-full items-center gap-3 py-2 text-left ${focusRing}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-[var(--color-forest-green)]" : "border-[var(--color-border-overlay)]"}`} aria-hidden="true">
                      {active ? <span className="h-3 w-3 rounded-full bg-[var(--color-forest-green)]" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium">{option.label}</span>
                      <span className="block text-sm text-[var(--color-muted)]">{option.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
      ) : null}
    </div>
  );
}
