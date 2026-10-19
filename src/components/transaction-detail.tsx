"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ChevronLeft, Repeat } from "lucide-react";
import { CategoryPicker } from "@/components/category-picker";
import { useFinance } from "@/components/finance-provider";
import { CategoryIcon } from "@/components/ui/category-icon";
import { MoneyKeypad } from "@/components/ui/money-keypad";
import { Card, Segmented, dangerButton, fieldClass, focusRing, labelClass, primaryButton, softButton, textButton } from "@/components/ui/primitives";
import { StatusChip } from "@/components/ui/status-chip";
import { categoriesFor, type TransactionKind } from "@/domain/categories";
import { displayStatus } from "@/domain/planning";
import { todayISO } from "@/lib/dates";
import type { FinanceExpense } from "@/lib/finance/repository";
import { formatCalendarDate, formatCurrency } from "@/lib/formatting";

export function TransactionDetail() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { expenses, recurringRules, preferences, accounts, setExpenseStatus, deleteExpense, isSaving } = useFinance();
  const transaction = expenses.find((item) => item.id === id);
  const accountName = transaction?.accountId ? accounts.find((item) => item.id === transaction.accountId)?.name ?? null : null;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const currency = preferences?.currency ?? "BRL";
  const today = todayISO();

  if (!transaction) {
    return (
      <Card className="flex flex-col items-center py-12 text-center">
        <h2 className="text-xl font-semibold">Transação não encontrada</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Ela pode ter sido excluída.</p>
        <Link href="/transactions" className={`${primaryButton} mt-6`}>Voltar às transações</Link>
      </Card>
    );
  }

  const rule = transaction.recurringRuleId ? recurringRules.find((item) => item.id === transaction.recurringRuleId) : undefined;
  const isIncome = transaction.kind === "income";
  const isTransfer = transaction.kind === "transfer";
  const status = displayStatus(transaction, today);

  async function toggleSettled() {
    if (!transaction) return;
    setMessage(null);
    try {
      if (transaction.status === "paid") {
        await setExpenseStatus(transaction.id, transaction.date > today ? "scheduled" : "pending", null);
        setMessage({ text: "Status desfeito.", failed: false });
      } else {
        await setExpenseStatus(transaction.id, "paid", today);
        setMessage({ text: isIncome ? "Marcada como recebida." : "Marcada como paga.", failed: false });
      }
    } catch {
      setMessage({ text: "Não foi possível atualizar. Tente novamente.", failed: true });
    }
  }

  async function remove() {
    if (!transaction) return;
    try {
      await deleteExpense(transaction.id);
      router.replace("/transactions");
    } catch {
      setMessage({ text: "Não foi possível excluir. Tente novamente.", failed: true });
    }
  }

  return (
    <div className="mx-auto max-w-[640px] space-y-4">
      <Link href="/transactions" className={`${textButton} -ml-3`}><ChevronLeft size={18} aria-hidden="true" /> Transações</Link>

      {editing ? (
        <TransactionEditForm transaction={transaction} currency={currency} onDone={() => setEditing(false)} />
      ) : (
        <>
          <Card className="flex flex-col items-center text-center">
            <CategoryIcon category={transaction.category} kind={transaction.kind} size={64} />
            <h2 className="mt-4 text-xl font-semibold">{transaction.description}</h2>
            <p className={`tabular mt-2 text-4xl font-semibold ${isIncome ? "text-[var(--color-income)]" : isTransfer ? "" : "text-[var(--color-expense)]"}`}>{isIncome ? "+" : isTransfer ? "" : "−"}{formatCurrency(transaction.amountCents, currency)}</p>
            {transaction.original && transaction.original.currency !== currency ? <p className="tabular mt-1 text-sm text-[var(--color-tertiary)]">Original {formatCurrency(transaction.original.amountCents, transaction.original.currency)} · 1 {transaction.original.currency} = {formatCurrency(Math.round(transaction.original.rate * 100), currency)}{transaction.original.rateDate ? ` (${formatCalendarDate(transaction.original.rateDate)}${transaction.original.manual ? ", taxa informada" : ""})` : ""}</p> : null}
            <div className="mt-3"><StatusChip status={status} /></div>
          </Card>

          <Card>
            <dl className="divide-y divide-[var(--color-border)] text-base">
              <div className="flex justify-between gap-4 py-3"><dt className="text-[var(--color-muted)]">Tipo</dt><dd className="font-medium">{isIncome ? "Receita" : isTransfer ? "Movimentação interna" : "Despesa"} · {isTransfer ? "não conta como gasto" : rule ? "fixa" : "variável"}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-[var(--color-muted)]">Categoria</dt><dd className="font-medium">{transaction.category}</dd></div>
              {accountName ? <div className="flex justify-between gap-4 py-3"><dt className="text-[var(--color-muted)]">Conta</dt><dd className="font-medium">{accountName}</dd></div> : null}
              <div className="flex justify-between gap-4 py-3"><dt className="text-[var(--color-muted)]">{isIncome ? "Previsão" : "Vencimento"}</dt><dd className="font-medium">{formatCalendarDate(transaction.date)}</dd></div>
              {transaction.paidOn ? <div className="flex justify-between gap-4 py-3"><dt className="text-[var(--color-muted)]">{isIncome ? "Recebido em" : "Pago em"}</dt><dd className="font-medium">{formatCalendarDate(transaction.paidOn)}</dd></div> : null}
              {transaction.notes ? <div className="py-3"><dt className="text-[var(--color-muted)]">Observação</dt><dd className="mt-1">{transaction.notes}</dd></div> : null}
            </dl>
            {rule ? (
              <Link href="/bills" className={`mt-2 flex items-center gap-3 rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm ${focusRing}`}>
                <Repeat size={18} className="text-[var(--color-action)]" aria-hidden="true" />
                <span className="flex-1">Parte da recorrência <strong>{rule.name}</strong>. Gerencie a regra na Agenda.</span>
              </Link>
            ) : null}
          </Card>

          {message ? <p className={`text-sm ${message.failed ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}`} role={message.failed ? "alert" : "status"}>{message.text}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={isSaving} onClick={() => void toggleSettled()} className={transaction.status === "paid" ? softButton : primaryButton}>
              {transaction.status === "paid" ? "Desfazer status" : isIncome ? "Marcar como recebida" : "Marcar como paga"}
            </button>
            <button type="button" onClick={() => setEditing(true)} className={softButton}>Editar</button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {confirmDelete ? (
              <>
                <span className="text-sm text-[var(--color-muted)]">Excluir definitivamente?</span>
                <button type="button" disabled={isSaving} onClick={() => void remove()} className={dangerButton}>Sim, excluir</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className={textButton}>Cancelar</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className={dangerButton}>Excluir transação</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TransactionEditForm({ transaction, currency, onDone }: { transaction: FinanceExpense; currency: string; onDone: () => void }) {
  const { saveExpense, isSaving } = useFinance();
  const [kind, setKind] = useState<TransactionKind>(transaction.kind);
  const [description, setDescription] = useState(transaction.description);
  const [amountCents, setAmountCents] = useState(transaction.amountCents);
  const [category, setCategory] = useState(transaction.category);
  const [date, setDate] = useState(transaction.date);
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [editingAmount, setEditingAmount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!description.trim()) return setError("Informe uma descrição.");
    if (!categoriesFor(kind).includes(category)) return setError("Escolha uma categoria.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Confira a data.");
    const status = transaction.status === "paid" ? "paid" : date > today ? "scheduled" : "pending";
    try {
      await saveExpense({ ...transaction, kind, description: description.trim(), amountCents, category, date, status, notes: notes.trim() || null, original: amountCents === transaction.amountCents ? transaction.original : null });
      onDone();
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    }
  }

  return (
    <Card>
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <h2 className="text-xl font-semibold">Editar transação</h2>
        <Segmented className="flex w-full" label="Tipo" value={kind} onChange={(value) => { setKind(value); if (!categoriesFor(value).includes(category)) setCategory(""); }} options={[{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }, { value: "transfer", label: "Interna" }]} />
        <label className={labelClass}>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} className={fieldClass} /></label>
        <div>
          <span className="text-sm font-medium">Valor</span>
          <button type="button" onClick={() => setEditingAmount(true)} className={`mt-2 flex min-h-12 w-full items-center justify-between rounded-2xl border border-[var(--color-border)] px-4 text-left ${focusRing}`}>
            <span className="tabular text-base font-semibold">{formatCurrency(amountCents, currency)}</span>
            <span className="text-sm font-semibold text-[var(--color-action)]">Alterar</span>
          </button>
        </div>
        <CategoryPicker kind={kind} value={category} onChange={setCategory} />
        <label className={labelClass}>{kind === "income" ? "Data prevista" : "Vencimento"}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} /></label>
        <label className={labelClass}>Observação (opcional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={500} className={`${fieldClass} py-3`} /></label>
        {error ? <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onDone} className={softButton}>Cancelar</button>
          <button disabled={isSaving} className={primaryButton}>{isSaving ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
      {editingAmount ? (
        <MoneyKeypad title="Alterar valor" currency={currency} tone={kind === "income" ? "success" : "action"} initialCents={amountCents} submitLabel="Confirmar" closeVariant="back" onSubmit={(cents) => { setAmountCents(cents); setEditingAmount(false); }} onClose={() => setEditingAmount(false)} />
      ) : null}
    </Card>
  );
}
