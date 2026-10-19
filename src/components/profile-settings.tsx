"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { Card, fieldClass, focusRing, labelClass, primaryButton } from "@/components/ui/primitives";
import { currencies, type CurrencyCode } from "@/domain/currencies";
import { todayISO } from "@/lib/dates";
import { defaultNotificationSettings, type FinanceGoal, type FinancePreferences } from "@/lib/finance/repository";
import { formatShortDate } from "@/lib/formatting";

const focusOptions: { value: FinanceGoal; title: string }[] = [
  { value: "control_expenses", title: "Controlar meus gastos" },
  { value: "remember_bills", title: "Não esquecer contas" },
  { value: "understand_categories", title: "Entender para onde vai o dinheiro" },
  { value: "track_available_balance", title: "Saber quanto ainda posso gastar" },
];

/** Todas as informações do onboarding em uma tela só, editáveis a qualquer momento. */
export function ProfileSettings() {
  const router = useRouter();
  const toast = useToast();
  const { preferences, accounts, savePreferences, isSaving } = useFinance();
  const [displayName, setDisplayName] = useState(preferences?.displayName ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>(preferences?.currency ?? "BRL");
  const [incomeCents, setIncomeCents] = useState<number | null>(preferences?.monthlyIncomeCents ?? null);
  const [payday, setPayday] = useState(preferences?.payday == null ? "" : String(preferences.payday));
  const [balanceCents, setBalanceCents] = useState<number | null>(preferences?.reportedBalanceCents ?? null);
  const [focus, setFocus] = useState<FinanceGoal[]>(preferences?.goals ?? []);
  const [error, setError] = useState<string | null>(null);
  const accountsWithBalance = accounts.filter((account) => account.balanceCents !== null).length;

  async function save() {
    setError(null);
    const name = displayName.trim();
    const day = payday.trim() ? Number(payday) : null;
    if (name.length > 80) return setError("O nome deve ter até 80 caracteres.");
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return setError("Escolha um dia de recebimento entre 1 e 31.");
    const next: FinancePreferences = {
      displayName: name || null,
      monthlyIncomeCents: incomeCents,
      reportedBalanceCents: balanceCents,
      balanceReportedOn: balanceCents === null ? null : balanceCents === preferences?.reportedBalanceCents && preferences.balanceReportedOn ? preferences.balanceReportedOn : todayISO(),
      payday: day,
      currency,
      goals: focus,
      termsAccepted: preferences?.termsAccepted ?? true,
      notificationsEnabled: preferences?.notificationsEnabled ?? false,
      onboardingCompleted: true,
      avatarDataUrl: preferences?.avatarDataUrl ?? null,
      notificationSettings: preferences?.notificationSettings ?? defaultNotificationSettings,
      manualRates: preferences?.manualRates ?? {},
    };
    try {
      await savePreferences(next);
      toast("Perfil atualizado");
      router.push("/settings");
    } catch {
      setError("Não foi possível salvar agora. Suas alterações continuam aqui; tente novamente.");
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mx-auto max-w-[720px] space-y-4">
      <Card className="space-y-6">
        <h2 className="text-base font-semibold">Sobre você</h2>
        <label className={labelClass}>Como podemos te chamar?
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} autoComplete="given-name" placeholder="Seu nome ou apelido" className={fieldClass} />
        </label>
        <label className={labelClass}>Moeda principal
          <select value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)} className={fieldClass}>
            {currencies.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
          </select>
          <span className="mt-1.5 block text-xs font-normal text-[var(--color-tertiary)]">É a moeda-base: totais e conversões aparecem nela. Valores já registrados não são convertidos.</span>
        </label>
      </Card>

      <Card className="space-y-6">
        <h2 className="text-base font-semibold">Renda e saldo</h2>
        <MoneyInput key={`income-${currency}`} label="Renda líquida mensal (opcional)" value={incomeCents} onChange={setIncomeCents} currency={currency} hint="Usada para estimar quanto ainda cabe no mês." />
        <label className={labelClass}>Dia em que costuma receber (opcional)
          <input value={payday} onChange={(event) => setPayday(event.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="5" className={fieldClass} />
        </label>
        <div>
          <MoneyInput key={`balance-${currency}`} label="Saldo disponível hoje (opcional)" value={balanceCents} onChange={setBalanceCents} currency={currency} hint={preferences?.balanceReportedOn ? `Informado em ${formatShortDate(preferences.balanceReportedOn)}. Ao mudar, vale a partir de hoje.` : "É o que você informa; não consultamos o banco."} />
          {accountsWithBalance ? <p className="mt-2 text-sm text-[var(--color-tertiary)]">Você informou saldo em {accountsWithBalance} {accountsWithBalance === 1 ? "conta" : "contas"}: o Início usa a soma delas. <Link href="/settings/accounts" className="font-semibold text-[var(--color-link)] underline underline-offset-4">Bancos e contas</Link></p> : null}
        </div>
      </Card>

      <Card>
        <fieldset>
          <legend className="text-base font-semibold">O que você mais quer organizar?</legend>
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {focusOptions.map((option) => {
              const selected = focus.includes(option.value);
              return (
                <li key={option.value}>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
                    <input type="checkbox" checked={selected} onChange={() => setFocus((current) => selected ? current.filter((value) => value !== option.value) : [...current, option.value])} className="sr-only" />
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${selected ? "bg-[var(--color-text)] text-white" : "border-2 border-[var(--color-border-overlay)]"}`} aria-hidden="true">{selected ? <Check size={14} strokeWidth={3} /> : null}</span>
                    <span className="text-base">{option.title}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      </Card>

      <Card className="p-3 sm:p-3">
        <Link href="/settings/notifications" className={`flex min-h-14 items-center gap-3 rounded-2xl px-2 ${focusRing}`}>
          <span className="flex-1"><span className="block font-medium">Notificações</span><span className="block text-sm text-[var(--color-tertiary)]">{preferences?.notificationsEnabled ? "Ligadas neste aparelho" : "Desligadas"}</span></span>
          <ChevronRight size={18} className="text-[var(--color-quaternary)]" aria-hidden="true" />
        </Link>
        <Link href="/terms" className={`flex min-h-14 items-center gap-3 rounded-2xl px-2 ${focusRing}`}>
          <span className="flex-1"><span className="block font-medium">Termos e privacidade</span><span className="block text-sm text-[var(--color-tertiary)]">{preferences?.termsAccepted ? "Aceitos" : "Pendentes"}</span></span>
          <ChevronRight size={18} className="text-[var(--color-quaternary)]" aria-hidden="true" />
        </Link>
      </Card>

      {error ? <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p> : null}
      <div className="sticky bottom-[calc(108px+env(safe-area-inset-bottom))] z-10 lg:bottom-6">
        <button type="submit" disabled={isSaving} className={`${primaryButton} w-full shadow-[0_8px_24px_rgba(14,15,12,0.12)]`}>{isSaving ? "Salvando..." : "Salvar alterações"}</button>
      </div>
    </form>
  );
}
