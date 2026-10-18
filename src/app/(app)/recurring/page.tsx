"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { RecurringForm } from "@/components/recurring-form";
import { RecurringRuleControls } from "@/components/recurring-rule-controls";
import { useFinance } from "@/components/finance-provider";
import { generateOccurrenceDates } from "@/domain/recurrence";
import { formatCalendarDate, formatCurrency } from "@/lib/formatting";
import type { FinanceRecurringRule } from "@/lib/finance/repository";

const frequencies = { weekly: "Semanal", monthly: "Mensal", yearly: "Anual" };

export default function RecurringPage() {
  const { recurringRules, expenses, preferences } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<FinanceRecurringRule | null>(null);
  const currency = preferences?.currency ?? "BRL";

  function getNextDate(rule: FinanceRecurringRule) {
    const today = new Date().toISOString().slice(0, 10);
    const generated = expenses
      .filter((expense) => expense.recurringRuleId === rule.id && expense.date >= today && expense.status !== "paid")
      .map((expense) => expense.date)
      .sort((left, right) => left.localeCompare(right));
    if (generated[0]) return generated[0];
    const through = new Date();
    through.setUTCDate(through.getUTCDate() + 365);
    return generateOccurrenceDates({ frequency: rule.frequency, startsOn: rule.startsOn, dueDay: rule.dueDay, endsOn: rule.endsOn }, through.toISOString().slice(0, 10), today)
      .find((date) => date >= today) ?? null;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-[var(--color-muted)]">As regras geram vencimentos para os próximos 90 dias sem duplicar ocorrências. Pausar impede novas gerações e mantém o histórico.</p>
        {!showForm && !editingRule ? <button onClick={() => setShowForm(true)} className="min-h-11 rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white">Adicionar recorrência</button> : null}
      </div>

      {showForm ? <section className="mb-8"><RecurringForm onSaved={() => setShowForm(false)} onCancel={() => setShowForm(false)} /></section> : null}
      {editingRule ? <section className="mb-8"><RecurringForm rule={editingRule} onSaved={() => setEditingRule(null)} onCancel={() => setEditingRule(null)} /></section> : null}

      {recurringRules.length ? (
        <ul className="divide-y divide-[var(--color-border)]">
          {recurringRules.map((rule) => {
            const nextDate = getNextDate(rule);
            return (
              <li key={rule.id} className="py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{rule.name}</h2>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      {rule.category} · {frequencies[rule.frequency]} · {rule.isVariable ? "valor variável" : "valor fixo"} · {rule.isActive ? "Ativa" : "Pausada"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{nextDate ? `Próxima ocorrência: ${formatCalendarDate(nextDate)}` : "Sem próximas ocorrências dentro do período configurado."}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span className="font-semibold">{formatCurrency(rule.amountCents, currency)}</span>
                    <RecurringRuleControls id={rule.id} isActive={rule.isActive} />
                    <button onClick={() => { setShowForm(false); setEditingRule(rule); }} className="min-h-10 px-2 text-sm underline underline-offset-4">Editar regra</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="Organize suas contas recorrentes"
          description="Cadastre aluguel, assinaturas ou contas que se repetem. Cada ocorrência pode ter seu próprio valor e pagamento."
          action={!showForm ? <button onClick={() => setShowForm(true)} className="min-h-[52px] w-full rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white">Adicionar recorrência</button> : null}
        />
      )}
    </div>
  );
}
