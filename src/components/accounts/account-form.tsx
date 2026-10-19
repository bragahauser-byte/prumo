"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { BankLogo } from "@/components/ui/bank-logo";
import { MoneyInput } from "@/components/ui/money-input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { dangerButton, fieldClass, focusRing, labelClass, primaryButton } from "@/components/ui/primitives";
import { banks, bankName, type BankId } from "@/domain/banks";
import { currencies, type CurrencyCode } from "@/domain/currencies";
import { todayISO } from "@/lib/dates";
import { createFinanceId, type FinanceAccount } from "@/lib/finance/repository";

/** Cadastro e edição de conta: banco (com logo), apelido, moeda e saldo atual opcional. */
export function AccountForm({ account, onClose }: { account: FinanceAccount | null; onClose: () => void }) {
  const { preferences, saveAccount, deleteAccount, isSaving } = useFinance();
  const toast = useToast();
  const [bank, setBank] = useState<BankId>(account?.bank ?? "nubank");
  const [name, setName] = useState(account?.name ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>(account?.currency ?? preferences?.currency ?? "BRL");
  const [balanceCents, setBalanceCents] = useState<number | null>(account?.balanceCents ?? null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setError(null);
    const finalName = (name.trim() || bankName(bank)).slice(0, 60);
    const balanceChanged = balanceCents !== (account?.balanceCents ?? null) || currency !== account?.currency;
    try {
      await saveAccount({
        id: account?.id ?? createFinanceId(),
        name: finalName,
        bank,
        currency,
        balanceCents,
        balanceReportedOn: balanceCents === null ? null : balanceChanged ? todayISO() : account?.balanceReportedOn ?? todayISO(),
        createdOn: account?.createdOn ?? todayISO(),
      });
      toast(account ? "Conta atualizada" : "Conta adicionada");
      onClose();
    } catch {
      setError("Não foi possível salvar a conta. Tente novamente.");
    }
  }

  async function remove() {
    if (!account) return;
    try {
      await deleteAccount(account.id);
      toast("Conta removida");
      onClose();
    } catch {
      setError("Não foi possível remover a conta.");
    }
  }

  return (
    <Sheet
      title={account ? "Editar conta" : "Nova conta"}
      description="Organize saldos, receitas e gastos por banco. O Prumo não se conecta ao banco."
      onClose={onClose}
      footer={<button type="button" onClick={() => void save()} disabled={isSaving} className={`${primaryButton} w-full`}>{isSaving ? "Salvando..." : "Salvar conta"}</button>}
    >
      <div className="space-y-6">
        <fieldset>
          <legend className={labelClass}>Instituição</legend>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {banks.map((item) => {
              const selected = item.id === bank;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setBank(item.id); if (item.region === "global" && currency === "BRL") setCurrency("USD"); }}
                  aria-pressed={selected}
                  className={`relative flex min-h-[84px] flex-col items-center justify-start gap-1.5 rounded-2xl px-1 pt-2 text-center transition-colors ${selected ? "bg-[var(--color-soft)]" : "hover:bg-[var(--color-soft)]"} ${focusRing}`}
                >
                  <BankLogo bank={item.id} name={item.name} size={40} />
                  <span className="line-clamp-2 text-xs leading-4 text-[var(--color-muted)]">{item.name}</span>
                  {selected ? <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-text)] text-white"><Check size={12} strokeWidth={3} aria-hidden="true" /></span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className={labelClass}>Nome da conta
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder={bankName(bank)} className={fieldClass} />
        </label>

        <label className={labelClass}>Moeda da conta
          <select value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)} className={fieldClass}>
            {currencies.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
          </select>
        </label>

        <MoneyInput key={currency} label="Saldo atual (opcional)" value={balanceCents} onChange={setBalanceCents} currency={currency} hint="O que você pagar ou receber nesta conta a partir de hoje ajusta o saldo." />

        {error ? <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p> : null}

        {account ? (
          confirmDelete ? (
            <div className="rounded-2xl bg-[var(--color-soft)] p-4">
              <p className="text-sm text-[var(--color-muted)]">Remover {account.name}? As movimentações continuam no extrato, sem conta vinculada.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className={`min-h-11 flex-1 rounded-full bg-white text-sm font-semibold ${focusRing}`}>Manter</button>
                <button type="button" onClick={() => void remove()} className={`${dangerButton} flex-1 justify-center bg-white`}>Remover</button>
              </div>
            </div>
          ) : <button type="button" onClick={() => setConfirmDelete(true)} className={dangerButton}>Remover conta</button>
        ) : null}
      </div>
    </Sheet>
  );
}
