"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { usePrivacy } from "@/components/privacy";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { BankLogo } from "@/components/ui/bank-logo";
import { focusRing } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/formatting";

/** Tons da paleta para separar os bancos na barra (escuros e claros alternados, sem vermelho nem laranja). */
export const bankShades = ["#163300", "#9FE870", "#00A88F", "#003E3A", "#A0E1E1", "#3A341C", "#FFEB69", "#6A6C6A"];

/**
 * De onde vem o dinheiro: barra com a participação de cada banco no saldo e a lista com logo,
 * valor e porcentagem. Sem contas com saldo, convida a cadastrar os bancos.
 */
export function BankBreakdown({ compact = false }: { compact?: boolean }) {
  const { currency, accountBalances } = useFinanceSummary();
  const { mask } = usePrivacy();
  const items = accountBalances.items
    .map((item, index) => ({ ...item, color: bankShades[index % bankShades.length] }))
    .sort((left, right) => (right.convertedCents ?? -1) - (left.convertedCents ?? -1));
  const positiveTotal = items.reduce((total, item) => total + Math.max(0, item.convertedCents ?? 0), 0);

  if (!items.length) {
    return (
      <Link href="/settings/accounts" className={`flex min-h-14 items-center gap-3 rounded-2xl bg-[var(--color-soft)] px-4 py-3 transition-colors hover:bg-[var(--color-border)] ${focusRing}`}>
        <span className="flex -space-x-2" aria-hidden="true">
          {(["nubank", "itau", "inter"] as const).map((bank) => <BankLogo key={bank} bank={bank} size={28} />)}
        </span>
        <span className="min-w-0 flex-1 text-sm text-[var(--color-muted)]">Adicione seus bancos para ver de onde vem seu dinheiro</span>
        <Plus size={18} className="shrink-0 text-[var(--color-text)]" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div>
      {positiveTotal > 0 ? (
        <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--color-soft)]" role="img" aria-label={items.map((item) => `${item.account.name} ${Math.round((Math.max(0, item.convertedCents ?? 0) / positiveTotal) * 100)}%`).join(", ")}>
          {items.map((item) => (
            <div key={item.account.id} className="h-full border-r-2 border-white last:border-r-0" style={{ width: `${(Math.max(0, item.convertedCents ?? 0) / positiveTotal) * 100}%`, backgroundColor: item.color }} />
          ))}
        </div>
      ) : null}
      <ul className={`mt-3 ${compact ? "space-y-2" : "divide-y divide-[var(--color-border)]"}`}>
        {items.map(({ account, balanceCents, convertedCents, color }) => {
          const share = positiveTotal > 0 && convertedCents !== null ? Math.round((Math.max(0, convertedCents) / positiveTotal) * 100) : null;
          return (
            <li key={account.id} className={`flex items-center gap-3 text-sm ${compact ? "" : "py-2.5"}`}>
              <span className="relative">
                <BankLogo bank={account.bank} name={account.name} size={compact ? 28 : 36} />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: color }} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--color-text)]">{account.name}</span>
                {!compact && account.currency !== currency ? <span className="tabular block text-xs text-[var(--color-tertiary)]">{convertedCents === null ? "sem cotação" : `≈ ${mask(formatCurrency(convertedCents, currency))}`}</span> : null}
              </span>
              {balanceCents === null ? <span className="shrink-0 text-xs text-[var(--color-tertiary)]">sem saldo</span> : <span className="tabular shrink-0 font-semibold">{mask(formatCurrency(balanceCents, account.currency))}</span>}
              {share !== null ? <span className="tabular w-10 shrink-0 text-right text-xs text-[var(--color-tertiary)]">{share}%</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
