"use client";

import { ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { AccountForm } from "@/components/accounts/account-form";
import { useExchangeRates } from "@/components/exchange-rates";
import { useFinance } from "@/components/finance-provider";
import { usePrivacy } from "@/components/privacy";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { BankLogo } from "@/components/ui/bank-logo";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { Card, SectionHeader, focusRing, primaryButton, softButton, textButton } from "@/components/ui/primitives";
import { currencies } from "@/domain/currencies";
import { quote } from "@/domain/exchange";
import type { FinanceAccount } from "@/lib/finance/repository";
import { formatCurrency, formatShortDate } from "@/lib/formatting";

export function AccountsScreen() {
  const { accounts } = useFinance();
  const { currency, accountBalances } = useFinanceSummary();
  const { mask } = usePrivacy();
  const [editing, setEditing] = useState<FinanceAccount | "new" | null>(null);

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      <Card>
        <SectionHeader title="Suas contas" action={<button type="button" onClick={() => setEditing("new")} className={textButton}><Plus size={16} aria-hidden="true" /> Adicionar</button>} />
        {accounts.length ? (
          <ul className="-my-1 divide-y divide-[var(--color-border)]">
            {accountBalances.items.map(({ account, balanceCents, convertedCents, rateDate }) => (
              <li key={account.id}>
                <button type="button" onClick={() => setEditing(account)} className={`flex min-h-16 w-full items-center gap-3 rounded-2xl py-3 text-left ${focusRing}`}>
                  <BankLogo bank={account.bank} name={account.name} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium">{account.name}</span>
                    <span className="block truncate text-sm text-[var(--color-tertiary)]">
                      {account.currency}{account.balanceReportedOn ? ` · saldo informado em ${formatShortDate(account.balanceReportedOn)}` : " · sem saldo informado"}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="tabular text-base font-semibold">{balanceCents === null ? "—" : mask(formatCurrency(balanceCents, account.currency))}</span>
                    {balanceCents !== null && account.currency !== currency ? (
                      <span className="tabular text-xs text-[var(--color-tertiary)]">{convertedCents === null ? "sem cotação" : `≈ ${mask(formatCurrency(convertedCents, currency))}${rateDate ? ` · ${formatShortDate(rateDate)}` : ""}`}</span>
                    ) : null}
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-[var(--color-quaternary)]" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-4 text-center">
            <p className="text-base font-medium">Nenhuma conta ainda</p>
            <p className="mx-auto mt-1 max-w-[320px] text-sm text-[var(--color-tertiary)]">Cadastre seus bancos para ver saldos, receitas e gastos separados por conta, inclusive em outras moedas.</p>
            <button type="button" onClick={() => setEditing("new")} className={`${primaryButton} mt-4`}><Plus size={18} aria-hidden="true" /> Adicionar conta</button>
          </div>
        )}
        {accountBalances.hasBalances ? (
          <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-sm text-[var(--color-muted)]">
            Saldo disponível no Início: soma das contas em {currency} <span className="tabular font-semibold text-[var(--color-text)]">{mask(formatCurrency(accountBalances.totalCents, currency))}</span>
            {accountBalances.missingRates.length ? ` (sem cotação para ${accountBalances.missingRates.join(", ")}; informe uma taxa manual abaixo)` : ""}
          </p>
        ) : null}
      </Card>

      <RatesCard />

      {editing ? <AccountForm account={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

/** Cotações usadas nas conversões: data visível, atualização manual e taxa própria como alternativa. */
function RatesCard() {
  const { preferences, accounts, expenses, savePreferences } = useFinance();
  const { base, table, manualRates, status, fetchedAt, refresh } = useExchangeRates();
  const toast = useToast();
  const used = [...new Set([...accounts.map((account) => account.currency), ...expenses.flatMap((expense) => expense.original ? [expense.original.currency] : [])])].filter((code) => code !== base);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [rateCents, setRateCents] = useState<number | null>(null);
  const [extra, setExtra] = useState<string>("");
  const codes = [...new Set([...used, ...Object.keys(manualRates), ...(extra ? [extra] : [])])];

  async function saveRate(code: string, value: number | null) {
    if (!preferences) return;
    const next = { ...manualRates };
    if (value && value > 0) next[code] = value / 100;
    else delete next[code];
    try {
      await savePreferences({ ...preferences, manualRates: next });
      toast(value ? "Taxa manual salva" : "Taxa manual removida");
      setEditingCode(null);
    } catch {
      toast("Não foi possível salvar a taxa");
    }
  }

  return (
    <Card>
      <SectionHeader title="Cotações" action={<button type="button" onClick={refresh} className={textButton} aria-label="Atualizar cotações"><RefreshCw size={16} className={status === "loading" ? "animate-spin" : ""} aria-hidden="true" /> Atualizar</button>} />
      <p className="text-sm text-[var(--color-tertiary)]">
        {table ? `Cotação de referência do Banco Central Europeu de ${formatShortDate(table.date)}${fetchedAt ? `, consultada às ${new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}.` : status === "error" ? "Não foi possível buscar a cotação agora. Use uma taxa manual." : "A cotação é buscada quando há valores em outra moeda."} Taxas manuais têm prioridade.
      </p>
      {codes.length ? (
        <ul className="mt-3 divide-y divide-[var(--color-border)]">
          {codes.map((code) => {
            const current = quote(code, base, base, table, manualRates);
            return (
              <li key={code} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium">1 {code} = {current ? formatCurrency(Math.round(current.rate * 100), base) : "sem cotação"}</span>
                    <span className="block text-xs text-[var(--color-tertiary)]">{current?.source === "manual" ? "Taxa manual" : current?.date ? `Referência de ${formatShortDate(current.date)}` : "Informe uma taxa"}</span>
                  </span>
                  <button type="button" onClick={() => { setEditingCode(code); setRateCents(manualRates[code] ? Math.round(manualRates[code] * 100) : null); }} className={textButton}>{manualRates[code] ? "Editar" : "Taxa manual"}</button>
                </div>
                {editingCode === code ? (
                  <div className="mt-3 space-y-3 rounded-2xl bg-[var(--color-soft)] p-4">
                    <MoneyInput label={`Quanto vale 1 ${code} em ${base}`} value={rateCents} onChange={setRateCents} currency={base} autoFocus />
                    <div className="flex gap-2">
                      {manualRates[code] ? <button type="button" onClick={() => void saveRate(code, null)} className={`${softButton} min-h-11 flex-1 bg-white`}>Usar cotação automática</button> : null}
                      <button type="button" onClick={() => void saveRate(code, rateCents)} disabled={!rateCents} className={`${primaryButton} min-h-11 flex-1`}>Salvar taxa</button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-muted)]">
        Adicionar taxa para
        <select value="" onChange={(event) => { setExtra(event.target.value); setEditingCode(event.target.value); setRateCents(null); }} className="min-h-11 rounded-full bg-[var(--color-soft)] px-3 text-sm">
          <option value="">moeda…</option>
          {currencies.filter((item) => item.code !== base && !codes.includes(item.code)).map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
        </select>
      </label>
    </Card>
  );
}
