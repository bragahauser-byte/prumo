"use client";

import { useMemo, useState } from "react";
import { Pause, Play, Plus, RefreshCw } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { RecurringForm, describeSchedule } from "@/components/recurring-form";
import { TransactionRow } from "@/components/transaction-row";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Illustration } from "@/components/ui/illustration";
import { Sheet } from "@/components/ui/sheet";
import { Card, Segmented, SectionHeader, primaryButton, textButton } from "@/components/ui/primitives";
import type { TransactionKind } from "@/domain/categories";
import { lastDayOfMonth } from "@/domain/planning";
import { addDays } from "@/lib/dates";
import type { FinanceExpense, FinanceRecurringRule } from "@/lib/finance/repository";
import { formatCurrency } from "@/lib/formatting";

export function BillsScreen() {
  const { expenses, recurringRules, setRecurringRuleActive, generateOccurrences, isSaving } = useFinance();
  const { today, month, currency, summary, spendable } = useFinanceSummary();
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [formRule, setFormRule] = useState<FinanceRecurringRule | "new" | null>(null);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const monthEnd = lastDayOfMonth(month);
  const weekAhead = addDays(today, 7);
  const horizon = addDays(today, 90);

  const groups = useMemo(() => {
    const open = expenses
      .filter((item) => item.kind === kind && item.status !== "paid" && item.date <= horizon)
      .sort((left, right) => left.date.localeCompare(right.date));
    const paidThisMonth = expenses
      .filter((item) => item.kind === kind && item.status === "paid" && item.date.startsWith(month))
      .sort((left, right) => right.date.localeCompare(left.date));
    return [
      { id: "overdue", title: kind === "income" ? "Atrasados" : "Atrasadas", items: open.filter((item) => item.date < today) },
      { id: "week", title: "Próximos 7 dias", items: open.filter((item) => item.date >= today && item.date <= weekAhead) },
      { id: "later", title: "Mais adiante", items: open.filter((item) => item.date > weekAhead) },
      { id: "done", title: kind === "income" ? "Recebidos neste mês" : "Pagas neste mês", items: paidThisMonth },
    ].filter((group) => group.items.length);
  }, [expenses, horizon, kind, month, today, weekAhead]);

  const unpaidUntilEnd = (target: TransactionKind) => expenses
    .filter((item) => item.kind === target && item.status !== "paid" && item.date <= monthEnd)
    .reduce((total, item) => total + item.amountCents, 0);
  const toPay = unpaidUntilEnd("expense");
  const toReceive = unpaidUntilEnd("income");
  const overdue = expenses.filter((item) => item.kind === "expense" && item.status !== "paid" && item.date < today);
  const incomeBase = spendable?.basis === "income" ? spendable.incomingCents : summary.incomeCents;
  const committedShare = incomeBase > 0 ? Math.round((summary.expenseCents / incomeBase) * 100) : null;
  const rules = recurringRules.filter((rule) => rule.kind === kind);

  async function toggleRule(rule: FinanceRecurringRule) {
    setMessage(null);
    try {
      await setRecurringRuleActive(rule.id, !rule.isActive);
      setMessage({ text: rule.isActive ? `${rule.name} pausada. As ocorrências já criadas foram mantidas.` : `${rule.name} retomada.`, failed: false });
    } catch {
      setMessage({ text: "Não foi possível atualizar a recorrência.", failed: true });
    }
  }

  async function generate(rule: FinanceRecurringRule) {
    setMessage(null);
    try {
      const count = await generateOccurrences(rule.id, horizon);
      setMessage({ text: count ? `${count} ${count === 1 ? "ocorrência criada" : "ocorrências criadas"} para ${rule.name}.` : `As próximas ocorrências de ${rule.name} já existem.`, failed: false });
    } catch {
      setMessage({ text: "Não foi possível gerar as ocorrências.", failed: true });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-5"><p className="text-sm text-[var(--color-muted)]">A pagar até o fim do mês</p><p className="tabular mt-1 text-2xl font-semibold">{formatCurrency(toPay, currency)}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--color-muted)]">A receber até o fim do mês</p><p className="tabular mt-1 text-2xl font-semibold text-[var(--color-success)]">{formatCurrency(toReceive, currency)}</p></Card>
        <Card className={`p-5 ${overdue.length ? "bg-[var(--color-error-soft)]" : ""}`}><p className={`text-sm ${overdue.length ? "text-[var(--color-error)]" : "text-[var(--color-muted)]"}`}>Contas atrasadas</p><p className={`tabular mt-1 text-2xl font-semibold ${overdue.length ? "text-[var(--color-error)]" : ""}`}>{overdue.length ? formatCurrency(overdue.reduce((total, item) => total + item.amountCents, 0), currency) : "Nenhuma"}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--color-muted)]">Renda comprometida</p><p className="tabular mt-1 text-2xl font-semibold">{committedShare === null ? "—" : `${committedShare}%`}</p><p className="mt-0.5 text-xs text-[var(--color-muted)]">despesas do mês ÷ receitas</p></Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented label="Tipo de compromisso" value={kind} onChange={setKind} options={[{ value: "expense", label: "A pagar" }, { value: "income", label: "A receber" }]} className="w-full sm:w-auto" />
        <button type="button" onClick={() => setFormRule("new")} className={`${primaryButton} min-h-12`}><Plus size={20} aria-hidden="true" /> Nova recorrência</button>
      </div>

      {message ? <p className={`text-sm ${message.failed ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}`} role={message.failed ? "alert" : "status"}>{message.text}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          {groups.length ? groups.map((group) => (
            <section key={group.id} aria-labelledby={`group-${group.id}`} className="mb-4 last:mb-0">
              <h2 id={`group-${group.id}`} className={`text-xs font-semibold uppercase tracking-[0.04em] ${group.id === "overdue" ? "text-[var(--color-error)]" : "text-[var(--color-muted)]"}`}>{group.title}</h2>
              <ul className="divide-y divide-[var(--color-border)]">
                {group.items.map((item: FinanceExpense) => <TransactionRow key={item.id} transaction={item} currency={currency} showSettle />)}
              </ul>
            </section>
          )) : (
            <div className="flex flex-col items-center py-10 text-center">
              <Illustration name="calendar" size={96} />
              <h2 className="mt-5 text-xl font-semibold">{kind === "income" ? "Nada a receber por enquanto" : "Nenhuma conta pendente"}</h2>
              <p className="mt-1 max-w-[300px] text-sm text-[var(--color-muted)]">{kind === "income" ? "Cadastre salário, reembolsos ou freelas para saber quando o dinheiro entra." : "Cadastre aluguel, assinaturas e mensalidades para não esquecer nenhum vencimento."}</p>
            </div>
          )}
        </Card>

        <Card aria-labelledby="rules-title">
          <SectionHeader id="rules-title" title="Recorrências" />
          {rules.length ? (
            <ul className="divide-y divide-[var(--color-border)]">
              {rules.map((rule) => (
                <li key={rule.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <CategoryIcon category={rule.category} kind={rule.kind} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium">{rule.name}</p>
                      <p className="truncate text-sm text-[var(--color-muted)]">{describeSchedule(rule)}{rule.isVariable ? " · valor variável" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-base font-semibold">{formatCurrency(rule.amountCents, currency)}</p>
                      {rule.isActive ? null : <span className="text-xs font-semibold text-[var(--color-warning)]">Pausada</span>}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 pl-[52px]">
                    <button type="button" onClick={() => setFormRule(rule)} className={textButton}>Editar</button>
                    <button type="button" disabled={isSaving} onClick={() => void toggleRule(rule)} className={textButton}>
                      {rule.isActive ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} {rule.isActive ? "Pausar" : "Retomar"}
                    </button>
                    {rule.isActive ? <button type="button" disabled={isSaving} onClick={() => void generate(rule)} className={textButton}><RefreshCw size={14} aria-hidden="true" /> Gerar próximas</button> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="py-2 text-sm text-[var(--color-muted)]">Nenhuma recorrência de {kind === "income" ? "recebimento" : "pagamento"}. Elas criam os próximos vencimentos automaticamente.</p>}
        </Card>
      </div>

      {formRule ? (
        <Sheet title={formRule === "new" ? "Nova recorrência" : "Editar recorrência"} description="Mensal, semanal, anual ou personalizada (a cada N períodos)." onClose={() => setFormRule(null)}>
          <RecurringForm
            rule={formRule === "new" ? undefined : formRule}
            defaultKind={kind}
            currency={currency}
            onCancel={() => setFormRule(null)}
            onSaved={(text) => { setFormRule(null); setMessage({ text, failed: false }); }}
          />
        </Sheet>
      ) : null}
    </div>
  );
}
