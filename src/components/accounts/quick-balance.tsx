"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { usePrivacy } from "@/components/privacy";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { BankLogo } from "@/components/ui/bank-logo";
import { MoneyKeypad } from "@/components/ui/money-keypad";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { focusRing } from "@/components/ui/primitives";
import { todayISO } from "@/lib/dates";
import type { FinanceAccount } from "@/lib/finance/repository";
import { formatCurrency } from "@/lib/formatting";

type Target = { kind: "profile" } | { kind: "account"; account: FinanceAccount };

/**
 * Atualização rápida do saldo, sem sair da tela: sem contas, abre direto o teclado (1 toque);
 * com contas, escolhe a conta e digita o valor (2 toques).
 */
export function QuickBalanceUpdate({ onClose }: { onClose: () => void }) {
  const { preferences, accounts, savePreferences, saveAccount } = useFinance();
  const { currency, balanceCents, accountBalances } = useFinanceSummary();
  const { mask } = usePrivacy();
  const toast = useToast();
  const [target, setTarget] = useState<Target | null>(accounts.length ? null : { kind: "profile" });
  const [error, setError] = useState<string | null>(null);

  async function save(cents: number) {
    if (!target) return;
    setError(null);
    const today = todayISO();
    try {
      if (target.kind === "profile") {
        if (!preferences) return;
        await savePreferences({ ...preferences, reportedBalanceCents: cents, balanceReportedOn: today });
      } else {
        await saveAccount({ ...target.account, balanceCents: cents, balanceReportedOn: today });
      }
      toast("Saldo atualizado");
      onClose();
    } catch {
      setError("Não foi possível salvar o saldo. Tente novamente.");
    }
  }

  if (target) {
    const isAccount = target.kind === "account";
    const current = isAccount ? accountBalances.items.find((item) => item.account.id === target.account.id)?.balanceCents ?? null : balanceCents;
    return (
      <MoneyKeypad
        title={isAccount ? `Saldo em ${target.account.name}` : "Atualizar saldo"}
        currency={isAccount ? target.account.currency : currency}
        allowZero
        initialCents={current !== null && current > 0 ? current : null}
        submitLabel="Salvar saldo"
        helper={error ?? "Quanto há na conta agora? O que você pagar ou receber a partir de hoje ajusta este valor."}
        onSubmit={(cents) => void save(cents)}
        onClose={() => (accounts.length ? setTarget(null) : onClose())}
        closeVariant={accounts.length ? "back" : "close"}
      />
    );
  }

  return (
    <Sheet title="Atualizar saldo" description="Escolha a conta e digite quanto há nela agora." onClose={onClose}>
      <ul className="-mt-1 divide-y divide-[var(--color-border)]">
        {accountBalances.items.map(({ account, balanceCents: value }) => (
          <li key={account.id}>
            <button type="button" onClick={() => setTarget({ kind: "account", account })} className={`flex min-h-16 w-full items-center gap-3 rounded-2xl py-2 text-left ${focusRing}`}>
              <BankLogo bank={account.bank} name={account.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">{account.name}</span>
                <span className="tabular block text-sm text-[var(--color-tertiary)]">{value === null ? "Sem saldo informado" : mask(formatCurrency(value, account.currency))}</span>
              </span>
              <ChevronRight size={18} className="text-[var(--color-quaternary)]" aria-hidden="true" />
            </button>
          </li>
        ))}
        {!accountBalances.hasBalances ? (
          <li>
            <button type="button" onClick={() => setTarget({ kind: "profile" })} className={`flex min-h-16 w-full items-center gap-3 rounded-2xl py-2 text-left ${focusRing}`}>
              <BankLogo bank={null} name="Saldo" size={40} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium">Saldo geral</span>
                <span className="tabular block text-sm text-[var(--color-tertiary)]">{balanceCents === null ? "Não informado" : mask(formatCurrency(balanceCents, currency))}</span>
              </span>
              <ChevronRight size={18} className="text-[var(--color-quaternary)]" aria-hidden="true" />
            </button>
          </li>
        ) : null}
      </ul>
      <p className="mt-3 text-xs leading-4 text-[var(--color-tertiary)]">Com saldo informado por conta, o saldo disponível passa a ser a soma das contas. <Link href="/settings/accounts" onClick={onClose} className="font-semibold text-[var(--color-link)] underline underline-offset-4">Gerenciar contas</Link></p>
    </Sheet>
  );
}
