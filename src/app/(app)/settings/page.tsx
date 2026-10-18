"use client";

import Link from "next/link";
import { ChevronRight, KeyRound, LogOut, ShieldCheck, SlidersHorizontal, Wallet } from "lucide-react";
import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { MoneyKeypad } from "@/components/ui/money-keypad";
import { Card, focusRing } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/formatting";
import { signOutAction } from "../actions";

const rowClass = `flex min-h-14 w-full items-center gap-4 rounded-2xl px-2 text-left text-base transition-colors hover:bg-[var(--color-soft)] ${focusRing}`;

export default function SettingsPage() {
  const { mode, preferences, expenses, savingsGoals, recurringRules, savePreferences } = useFinance();
  const { today, currency, balanceCents } = useFinanceSummary();
  const [editingBalance, setEditingBalance] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const name = preferences?.displayName?.trim();

  async function saveBalance(cents: number) {
    if (!preferences) return;
    try {
      await savePreferences({ ...preferences, reportedBalanceCents: cents, balanceReportedOn: today });
      setEditingBalance(false);
      setMessage({ text: "Saldo atualizado.", failed: false });
    } catch {
      setMessage({ text: "Não foi possível salvar o saldo.", failed: true });
    }
  }

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      <Card className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center text-center sm:w-1/2">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[linear-gradient(145deg,#dfe9f5,#c9d8ea)] text-3xl font-semibold text-[var(--color-action)]">{name?.charAt(0).toLocaleUpperCase("pt-BR") ?? "P"}</span>
          <h2 className="mt-3 text-2xl font-semibold">{name || "Seu perfil"}</h2>
          <p className="text-sm text-[var(--color-muted)]">{mode === "local" ? "Dados neste navegador" : "Conta sincronizada"}</p>
        </div>
        <dl className="w-full divide-y divide-[var(--color-border)] sm:w-1/2">
          <div className="py-3"><dt className="text-xs text-[var(--color-muted)]">Transações</dt><dd className="text-2xl font-semibold">{expenses.length}</dd></div>
          <div className="py-3"><dt className="text-xs text-[var(--color-muted)]">Metas</dt><dd className="text-2xl font-semibold">{savingsGoals.length}</dd></div>
          <div className="py-3"><dt className="text-xs text-[var(--color-muted)]">Recorrências</dt><dd className="text-2xl font-semibold">{recurringRules.length}</dd></div>
        </dl>
      </Card>

      {message ? <p className={`text-sm ${message.failed ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}`} role={message.failed ? "alert" : "status"}>{message.text}</p> : null}

      <Card className="p-3 sm:p-3">
        <Link href="/onboarding/edit" className={rowClass}>
          <SlidersHorizontal size={20} className="text-[var(--color-action)]" aria-hidden="true" />
          <span className="flex-1"><span className="block font-medium">Perfil e preferências</span><span className="block text-sm text-[var(--color-muted)]">Nome, moeda, renda, dia de recebimento e lembretes</span></span>
          <ChevronRight size={18} className="text-[var(--color-muted)]" aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => setEditingBalance(true)} className={rowClass}>
          <Wallet size={20} className="text-[var(--color-action)]" aria-hidden="true" />
          <span className="flex-1"><span className="block font-medium">Saldo disponível</span><span className="tabular block text-sm text-[var(--color-muted)]">{balanceCents === null ? "Não informado" : formatCurrency(balanceCents, currency)}</span></span>
          <ChevronRight size={18} className="text-[var(--color-muted)]" aria-hidden="true" />
        </button>
        {mode === "supabase" ? (
          <>
            <Link href="/settings/password" className={rowClass}>
              <KeyRound size={20} className="text-[var(--color-action)]" aria-hidden="true" />
              <span className="flex-1 font-medium">Alterar senha</span>
              <ChevronRight size={18} className="text-[var(--color-muted)]" aria-hidden="true" />
            </Link>
            <form action={signOutAction}>
              <button className={rowClass}>
                <LogOut size={20} className="text-[var(--color-error)]" aria-hidden="true" />
                <span className="flex-1 font-medium text-[var(--color-error)]">Encerrar sessão</span>
              </button>
            </form>
          </>
        ) : null}
      </Card>

      <Card className="flex gap-4">
        <ShieldCheck size={24} className="shrink-0 text-[var(--color-success)]" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">Seus dados</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--color-muted)]">
            {mode === "local"
              ? "Tudo fica salvo neste navegador e neste dispositivo. Nada é enviado para a nuvem nem sincronizado com outros aparelhos."
              : "Suas preferências e registros ficam vinculados à sua conta, protegidos por regras de acesso por usuário."}
            {" "}O Prumo não se conecta ao banco e não movimenta dinheiro.
          </p>
          <Link href="/terms" className="mt-2 inline-block text-sm font-semibold text-[var(--color-action)]">Termos de uso</Link>
        </div>
      </Card>

      {editingBalance ? (
        <MoneyKeypad
          title="Atualizar saldo"
          currency={currency}
          allowZero
          initialCents={balanceCents !== null && balanceCents > 0 ? balanceCents : null}
          submitLabel="Salvar saldo"
          helper="Quanto há na sua conta agora? O que você pagar ou receber a partir de hoje ajusta este valor."
          onSubmit={(cents) => void saveBalance(cents)}
          onClose={() => setEditingBalance(false)}
        />
      ) : null}
    </div>
  );
}
