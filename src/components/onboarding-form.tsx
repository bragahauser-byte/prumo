"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { parseCurrencyToCents, parseSignedCurrencyToCents } from "@/domain/financial";
import type { CurrencyCode, FinanceGoal, FinancePreferences } from "@/lib/finance/repository";
import { todayISO } from "@/lib/dates";
import { asset } from "@/lib/base-path";

const totalSteps = 8;
const currencies: { value: CurrencyCode; name: string; symbol: string }[] = [
  { value: "BRL", name: "Real brasileiro", symbol: "R$" },
  { value: "USD", name: "Dólar americano", symbol: "US$" },
  { value: "EUR", name: "Euro", symbol: "€" },
];
const goals: { value: FinanceGoal; title: string; description: string }[] = [
  { value: "control_expenses", title: "Controlar meus gastos", description: "Registrar e acompanhar despesas" },
  { value: "remember_bills", title: "Não esquecer contas e vencimentos", description: "Organizar o que vence em breve" },
  { value: "understand_categories", title: "Entender para onde meu dinheiro vai", description: "Ver categorias e tendências" },
  { value: "track_available_balance", title: "Acompanhar quanto tenho disponível", description: "Comparar saldo informado e compromissos" },
];

function centsToInput(cents: number | null) {
  if (cents === null) return "";
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, "0")}`;
}

export function OnboardingForm({
  editing = false,
  returnTo,
}: {
  editing?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const { preferences, savePreferences, isSaving } = useFinance();
  const [step, setStep] = useState(editing ? 0 : -1);
  const [displayName, setDisplayName] = useState(preferences?.displayName ?? "");
  const [monthlyIncome, setMonthlyIncome] = useState(centsToInput(preferences?.monthlyIncomeCents ?? null));
  const [reportedBalance, setReportedBalance] = useState(centsToInput(preferences?.reportedBalanceCents ?? null));
  const [payday, setPayday] = useState(preferences?.payday == null ? "" : String(preferences.payday));
  const [currency, setCurrency] = useState<CurrencyCode>(preferences?.currency ?? "BRL");
  const [selectedGoals, setSelectedGoals] = useState<FinanceGoal[]>(preferences?.goals ?? []);
  const [termsAccepted, setTermsAccepted] = useState(preferences?.termsAccepted ?? false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(preferences?.notificationsEnabled ?? false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== -1) return;
    const timer = window.setTimeout(() => setStep(0), 850);
    return () => window.clearTimeout(timer);
  }, [step]);

  async function finish(skipNotifications = false) {
    setError(null);
    const name = displayName.trim();
    const incomeCents = monthlyIncome.trim() ? parseCurrencyToCents(monthlyIncome, true) : null;
    const balanceCents = reportedBalance.trim() ? parseSignedCurrencyToCents(reportedBalance) : null;
    const receivedDay = payday.trim() ? Number(payday) : null;

    if (name.length > 80) return setError("O nome deve ter até 80 caracteres.");
    if (monthlyIncome.trim() && incomeCents === null) return setError("Confira o valor da renda mensal.");
    if (reportedBalance.trim() && balanceCents === null) return setError("Confira o saldo informado.");
    if (payday.trim() && (!Number.isInteger(receivedDay) || receivedDay! < 1 || receivedDay! > 31)) return setError("Escolha um dia entre 1 e 31.");
    if (!termsAccepted) return setError("Aceite os termos para continuar.");

    const nextPreferences: FinancePreferences = {
      displayName: name || null,
      monthlyIncomeCents: incomeCents,
      reportedBalanceCents: balanceCents,
      balanceReportedOn: balanceCents === null
        ? null
        : balanceCents === preferences?.reportedBalanceCents && preferences.balanceReportedOn
          ? preferences.balanceReportedOn
          : todayISO(),
      payday: receivedDay,
      currency,
      goals: selectedGoals,
      termsAccepted: true,
      notificationsEnabled: skipNotifications ? false : notificationsEnabled,
      onboardingCompleted: true,
    };

    try {
      await savePreferences(nextPreferences);
      router.replace(returnTo ?? (editing ? "/settings" : "/overview"));
    } catch {
      setError("Não foi possível salvar agora. Seus campos continuam preenchidos; tente novamente.");
    }
  }

  async function requestNotifications() {
    setNotice(null);
    if (!("Notification" in window)) {
      setNotificationsEnabled(false);
      setNotice("Este navegador não oferece notificações. Você pode continuar sem elas.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
      setNotice(permission === "granted"
        ? "Lembretes ativados neste navegador quando o app estiver aberto no dia do vencimento."
        : "Permissão não concedida. Você pode continuar sem lembretes.");
    } catch {
      setNotificationsEnabled(false);
      setNotice("Não foi possível pedir permissão agora. Você pode continuar sem lembretes.");
    }
  }

  function toggleGoal(goal: FinanceGoal) {
    setSelectedGoals((current) => current.includes(goal)
      ? current.filter((value) => value !== goal)
      : [...current, goal]);
  }

  if (step === -1) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white px-6 text-center" aria-label="Preparando o aplicativo">
        <Image src={asset("/app-icon.png")} alt="Prumo" width={72} height={72} priority />
        <LoaderCircle size={24} className="animate-spin text-[var(--color-action)] motion-reduce:animate-none" aria-label="Carregando" />
      </div>
    );
  }

  const title = [
    "Como podemos te chamar?",
    "Qual moeda você utiliza?",
    "Renda mensal líquida",
    "Dia habitual de recebimento",
    "Saldo disponível hoje",
    "O que você mais quer organizar?",
    "Termos de uso",
    "Quer receber lembretes?",
  ][step];
  const description = [
    "Seu nome é opcional e pode ser alterado depois.",
    "Você pode mudar esta preferência quando quiser.",
    "Opcional. Usada para estimar quanto ainda pode gastar no mês.",
    "Opcional. Por exemplo, dia 5.",
    "Opcional. É um valor informado por você, não consultado no banco. Depois, o que você pagar ou receber ajusta esse saldo.",
    "Escolha uma ou mais opções para personalizar suas prioridades.",
    "Leia como seus dados são tratados antes de continuar.",
    "Opcional. Os avisos aparecem quando você abre o app no dia do vencimento.",
  ][step];
  const canContinue = step !== 6 || termsAccepted;

  return (
    <div className="flex min-h-dvh w-full flex-col bg-white">
      <div className="flex h-[132px] shrink-0 items-end justify-between px-6 pb-6 pt-16">
        <button
          type="button"
          aria-label={step === 0 && !editing ? "Início do onboarding" : "Voltar"}
          disabled={step === 0 && !editing}
          onClick={() => step > 0 ? setStep(step - 1) : router.replace(returnTo ?? "/settings")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F1F1F1] text-black disabled:cursor-default disabled:opacity-70"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <span className="text-xs font-semibold text-[var(--color-muted)]">{step + 1} / {totalSteps}</span>
      </div>

      <div className="px-6 pb-4">
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#E8E8E8]" aria-label={`Etapa ${step + 1} de ${totalSteps}`} role="progressbar" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step + 1}>
          <div className="h-full rounded-full bg-[var(--color-action)] transition-[width]" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
        </div>
      </div>

      <header className="shrink-0 px-6 pb-5 pt-4">
        <h2 className="max-w-[345px] text-3xl font-semibold text-black">{title}</h2>
        <p className="mt-3 max-w-[345px] text-base leading-6 text-[#777B80]">{description}</p>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {step === 0 ? (
          <label className="block border-b border-black py-2 text-xs font-bold text-[#777B80]">
            Nome
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="given-name" maxLength={80} autoFocus className="mt-1 min-h-8 w-full border-0 bg-transparent p-0 text-xl font-semibold text-black outline-none focus:ring-0" placeholder="Seu nome ou apelido" />
          </label>
        ) : null}

        {step === 1 ? (
          <fieldset className="divide-y divide-[#E8E8E8]">
            <legend className="sr-only">Escolha sua moeda</legend>
            {currencies.map((item) => (
              <label key={item.value} className="flex min-h-[76px] cursor-pointer items-center justify-between gap-4 py-4">
                <span><span className="block text-base text-black">{item.name}</span><span className="mt-1 block text-sm text-[#777B80]">{item.value} · {item.symbol}</span></span>
                <input type="radio" name="currency" value={item.value} checked={currency === item.value} onChange={() => setCurrency(item.value)} className="h-5 w-5 accent-[var(--color-action)]" />
              </label>
            ))}
          </fieldset>
        ) : null}

        {step === 2 ? (
          <label className="block border-b border-black py-2 text-xs font-bold text-[#777B80]">
            Valor líquido mensal
            <input value={monthlyIncome} onChange={(event) => setMonthlyIncome(event.target.value)} inputMode="decimal" placeholder="Ex.: 3.500,00" className="mt-1 min-h-9 w-full border-0 bg-transparent p-0 text-xl font-semibold text-black outline-none focus:ring-0" />
          </label>
        ) : null}

        {step === 3 ? (
          <label className="block border-b border-black py-2 text-xs font-bold text-[#777B80]">
            Dia do mês
            <input value={payday} onChange={(event) => setPayday(event.target.value)} type="number" min={1} max={31} inputMode="numeric" placeholder="Dia 5" className="mt-1 min-h-9 w-full border-0 bg-transparent p-0 text-xl font-semibold text-black outline-none focus:ring-0" />
          </label>
        ) : null}

        {step === 4 ? (
          <label className="block border-b border-black py-2 text-xs font-bold text-[#777B80]">
            Saldo informado
            <input value={reportedBalance} onChange={(event) => setReportedBalance(event.target.value)} inputMode="decimal" placeholder="Ex.: 1.200,00" className="mt-1 min-h-9 w-full border-0 bg-transparent p-0 text-xl font-semibold text-black outline-none focus:ring-0" />
          </label>
        ) : null}

        {step === 5 ? (
          <fieldset className="divide-y divide-[#E8E8E8]">
            <legend className="sr-only">O que deseja organizar?</legend>
            {goals.map((goal) => {
              const selected = selectedGoals.includes(goal.value);
              return (
                <label key={goal.value} className="flex min-h-[76px] cursor-pointer items-center gap-4 py-4">
                  <span className="min-w-0 flex-1"><span className="block text-base text-black">{goal.title}</span><span className="mt-1 block text-sm text-[#777B80]">{goal.description}</span></span>
                  <input type="checkbox" checked={selected} onChange={() => toggleGoal(goal.value)} className="h-5 w-5 accent-[var(--color-action)]" />
                </label>
              );
            })}
          </fieldset>
        ) : null}

        {step === 6 ? (
          <div className="space-y-5">
            <ul className="divide-y divide-[#E8E8E8] border-y border-[#E8E8E8]">
              <li className="flex gap-3 py-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-white"><Check size={17} /></span><div><h3 className="text-base font-medium">Seus registros são seus</h3><p className="mt-1 text-sm leading-5 text-[#777B80]">No modo local ficam neste navegador. Com Supabase, ficam vinculados à sua conta.</p></div></li>
              <li className="flex gap-3 py-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-white"><Check size={17} /></span><div><h3 className="text-base font-medium">Sem conexão bancária</h3><p className="mt-1 text-sm leading-5 text-[#777B80]">Renda e saldo são informados por você; não pedimos senha ou dados bancários.</p></div></li>
              <li className="flex gap-3 py-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-white"><Check size={17} /></span><div><h3 className="text-base font-medium">Estimativas transparentes</h3><p className="mt-1 text-sm leading-5 text-[#777B80]">Totais usam apenas o que você registra e não confirmam saldo bancário.</p></div></li>
            </ul>
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-action)]" />
              <span>Li e aceito os <Link href="/terms" target="_blank" className="font-semibold underline underline-offset-4">termos de uso</Link>.</span>
            </label>
          </div>
        ) : null}

        {step === 7 ? (
          <div className="space-y-5">
            <button type="button" onClick={() => void requestNotifications()} className={`flex min-h-[76px] w-full items-center justify-between gap-4 border-b border-[#E8E8E8] py-4 text-left ${notificationsEnabled ? "text-[var(--color-action)]" : "text-black"}`}>
              <span><span className="block text-base font-medium">{notificationsEnabled ? "Lembretes ativados" : "Ativar neste navegador"}</span><span className="mt-1 block text-sm text-[#777B80]">Avisos para despesas não pagas com vencimento hoje, ao abrir o app.</span></span>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${notificationsEnabled ? "border-[var(--color-action)] bg-[var(--color-action)] text-white" : "border-[#D5D7DA]"}`}>{notificationsEnabled ? <Check size={13} /> : null}</span>
            </button>
            {notice ? <p role="status" className="text-sm leading-5 text-[#777B80]">{notice}</p> : null}
          </div>
        ) : null}

        {error ? <p role="alert" className="mt-5 text-sm text-[var(--color-error)]">{error}</p> : null}
      </main>

      <footer className="mt-auto shrink-0 bg-white px-6 pb-[max(env(safe-area-inset-bottom),32px)] pt-3">
        {step < totalSteps - 1 ? (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => { setError(null); setStep(step + 1); }} disabled={!canContinue} className="min-h-14 w-full rounded-full bg-[var(--color-action)] px-5 text-base font-semibold text-white disabled:opacity-35">Continuar</button>
            {[2, 3, 4, 5].includes(step) ? <button type="button" onClick={() => { if (step === 2) setMonthlyIncome(""); if (step === 3) setPayday(""); if (step === 4) setReportedBalance(""); setError(null); setStep(step + 1); }} className="min-h-10 text-sm font-medium text-[var(--color-muted)] underline underline-offset-4">Pular esta etapa</button> : null}
            {step === 6 && !canContinue ? <span className="sr-only">Aceite os termos para continuar</span> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => void finish()} disabled={isSaving} className="min-h-14 w-full rounded-full bg-[var(--color-action)] px-5 text-base font-semibold text-white disabled:opacity-50">{isSaving ? "Salvando..." : "Concluir e começar"}</button>
            <button type="button" onClick={() => void finish(true)} disabled={isSaving} className="min-h-10 text-sm font-medium text-[var(--color-muted)] underline underline-offset-4">Agora não</button>
          </div>
        )}
      </footer>
    </div>
  );
}
