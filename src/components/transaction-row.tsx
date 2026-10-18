"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { CategoryIcon } from "@/components/ui/category-icon";
import { focusRing } from "@/components/ui/primitives";
import { StatusChip } from "@/components/ui/status-chip";
import { displayStatus } from "@/domain/planning";
import { todayISO } from "@/lib/dates";
import type { FinanceExpense } from "@/lib/finance/repository";
import { formatCurrency, formatShortDate } from "@/lib/formatting";

export function SettleButton({ transaction }: { transaction: FinanceExpense }) {
  const { setExpenseStatus, isSaving } = useFinance();
  const [failed, setFailed] = useState(false);
  const isIncome = transaction.kind === "income";
  if (transaction.status === "paid") return null;

  async function settle() {
    setFailed(false);
    try {
      await setExpenseStatus(transaction.id, "paid", todayISO());
    } catch {
      setFailed(true);
    }
  }

  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        disabled={isSaving}
        onClick={() => void settle()}
        aria-label={`${isIncome ? "Marcar como recebida" : "Marcar como paga"}: ${transaction.description}`}
        className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-full px-3 text-xs max-sm:w-9 max-sm:px-0 font-semibold transition-colors disabled:opacity-50 ${focusRing} ${isIncome ? "bg-[var(--color-success-soft)] text-[var(--color-success)] hover:bg-[#d6ecdf]" : "bg-[var(--color-action-soft)] text-[var(--color-action)] hover:bg-[#d7e7f8]"}`}
      >
        <Check size={14} strokeWidth={2.5} aria-hidden="true" />
        <span className="hidden sm:inline">{isIncome ? "Recebi" : "Paguei"}</span>
      </button>
      {failed ? <span className="mt-1 text-xs text-[var(--color-error)]" role="alert">Tente novamente</span> : null}
    </span>
  );
}

export function TransactionRow({
  transaction,
  currency,
  showSettle = false,
  showDate = true,
}: {
  transaction: FinanceExpense;
  currency: string;
  showSettle?: boolean;
  showDate?: boolean;
}) {
  const today = todayISO();
  const status = displayStatus(transaction, today);
  const isIncome = transaction.kind === "income";
  const meta = [transaction.category, showDate ? formatShortDate(transaction.date) : null, transaction.recurringRuleId ? "Fixo" : null].filter(Boolean).join(" · ");

  return (
    <li className="flex items-center gap-3 py-3">
      <Link href={`/transactions/${transaction.id}`} className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl ${focusRing}`}>
        <CategoryIcon category={transaction.category} kind={transaction.kind} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium">{transaction.description}</span>
          <span className="mt-0.5 block truncate text-sm text-[var(--color-muted)]">{meta}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`tabular text-base font-semibold ${isIncome ? "text-[var(--color-success)]" : ""}`}>{isIncome ? "+" : "−"}{formatCurrency(transaction.amountCents, currency)}</span>
          {status === "paid" || status === "received" ? null : <StatusChip status={status} />}
        </span>
      </Link>
      {showSettle ? <SettleButton transaction={transaction} /> : null}
    </li>
  );
}
