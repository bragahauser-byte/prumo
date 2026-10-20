"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useFinance } from "@/components/finance-provider";
import { SplashScreen } from "@/components/splash-screen";
import { BankLogo } from "@/components/ui/bank-logo";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { focusRing, inkButton, outlineButton } from "@/components/ui/primitives";
import { banks, bankName, type BankId } from "@/domain/banks";
import { currencies, type CurrencyCode } from "@/domain/currencies";
import { createFinanceId, defaultNotificationSettings, type FinanceGoal, type FinancePreferences } from "@/lib/finance/repository";
import { asset } from "@/lib/base-path";
import { todayISO } from "@/lib/dates";

const totalSteps = 9;
/** Etapas: 0 nome · 1 moeda · 2 renda · 3 dia do pagamento · 4 bancos · 5 saldo · 6 objetivos · 7 termos · 8 lembretes. */
const stepIndex = { name: 0, currency: 1, income: 2, payday: 3, banks: 4, balance: 5, goals: 6, terms: 7, reminders: 8 } as const;

/** Banco escolhido no onboarding; vira uma conta em "Bancos e contas" ao concluir. */
type BankEntry = { key: string; accountId: string | null; bank: BankId; name: string; currency: CurrencyCode; cents: number | null };
const goals: { value: FinanceGoal; title: string; description: string }[] = [
  { value: "control_expenses", title: "Controlar meus gastos", description: "Registrar e acompanhar despesas." },
  { value: "remember_bills", title: "Não esquecer contas", description: "Saber o que vence e quando." },
  { value: "understand_categories", title: "Entender para onde vai o dinheiro", description: "Ver categorias e tendências." },
  { value: "track_available_balance", title: "Saber quanto ainda posso gastar", description: "Comparar saldo e compromissos." },
];

const titles = [
  "Como podemos te chamar?",
  "Boas-vindas ao Prumo",
  "Quanto você recebe por mês?",
  "Em que dia você costuma receber?",
  "Quais bancos você usa?",
  "Quanto você tem disponível hoje?",
  "O que você mais quer organizar?",
  "Termos de uso",
  "Quer receber lembretes?",
];
const subtitles = [
  null,
  "Escolha a moeda que você usa.",
  "Opcional — usamos para estimar quanto ainda cabe no mês.",
  "Opcional — por exemplo, dia 5.",
  "Opcional — escolha quantos quiser. Dá para adicionar ou mudar depois em Ajustes.",
  "Opcional — é o que você informa, não consultamos o banco.",
  "Escolha uma ou mais opções.",
  "Leia e aceite para continuar.",
  "Só avisos úteis: contas perto do vencimento, orçamento no limite e metas fora do ritmo. Lembretes você liga depois, em Ajustes.",
];

function Radio({ checked }: { checked: boolean }) {
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${checked ? "border-[var(--color-ink)]" : "border-[var(--color-border-overlay)]"}`} aria-hidden="true">
      {checked ? <span className="h-3 w-3 rounded-full bg-[var(--color-ink)]" /> : null}
    </span>
  );
}

function SquareCheck({ checked }: { checked: boolean }) {
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${checked ? "bg-[var(--color-ink)] text-white" : "border-2 border-[var(--color-border-overlay)] bg-white"}`} aria-hidden="true">
      {checked ? <Check size={16} strokeWidth={3} /> : null}
    </span>
  );
}

function UnderlineField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block border-b border-[var(--color-ink)] pb-2 focus-within:border-[var(--color-action)]">
      <span className="block text-xs font-semibold text-[var(--color-tertiary)]">{label}</span>
      {children}
    </label>
  );
}

export function OnboardingForm({
  editing = false,
  returnTo,
}: {
  editing?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { preferences, accounts, savePreferences, saveAccount, isSaving, mode } = useFinance();
  const [step, setStep] = useState(editing ? 0 : -1);
  const [displayName, setDisplayName] = useState(preferences?.displayName ?? "");
  const [incomeCents, setIncomeCents] = useState<number | null>(preferences?.monthlyIncomeCents ?? null);
  const [balanceCents, setBalanceCents] = useState<number | null>(preferences?.reportedBalanceCents ?? null);
  const [payday, setPayday] = useState(preferences?.payday == null ? "" : String(preferences.payday));
  const [currency, setCurrency] = useState<CurrencyCode>(preferences?.currency ?? "BRL");
  const [selectedGoals, setSelectedGoals] = useState<FinanceGoal[]>(preferences?.goals ?? []);
  const [termsChecked, setTermsChecked] = useState(preferences?.termsAccepted ?? false);
  const [privacyChecked, setPrivacyChecked] = useState(preferences?.termsAccepted ?? false);
  const [bankEntries, setBankEntries] = useState<BankEntry[]>(() => accounts.map((account) => ({ key: account.id, accountId: account.id, bank: account.bank, name: account.name, currency: account.currency, cents: account.balanceCents })));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const termsAccepted = termsChecked && privacyChecked;

  async function finish(notificationsEnabled: boolean) {
    setError(null);
    const name = displayName.trim();
    const receivedDay = payday.trim() ? Number(payday) : null;
    if (name.length > 80) return setError("O nome deve ter até 80 caracteres.");
    if (payday.trim() && (!Number.isInteger(receivedDay) || receivedDay! < 1 || receivedDay! > 31)) return setError("Escolha um dia entre 1 e 31.");
    if (!termsAccepted) return setError("Aceite os termos para continuar.");

    const useBanks = bankEntries.length > 0;
    const nextPreferences: FinancePreferences = {
      displayName: name || null,
      monthlyIncomeCents: incomeCents,
      reportedBalanceCents: useBanks ? preferences?.reportedBalanceCents ?? null : balanceCents,
      balanceReportedOn: useBanks ? preferences?.balanceReportedOn ?? null : balanceCents === null
        ? null
        : balanceCents === preferences?.reportedBalanceCents && preferences.balanceReportedOn
          ? preferences.balanceReportedOn
          : todayISO(),
      payday: receivedDay,
      currency,
      goals: selectedGoals,
      termsAccepted: true,
      notificationsEnabled,
      onboardingCompleted: true,
      avatarDataUrl: preferences?.avatarDataUrl ?? null,
      notificationSettings: preferences?.notificationSettings ?? defaultNotificationSettings,
      manualRates: preferences?.manualRates ?? {},
    };

    try {
      // Contas antes das preferências: concluir o onboarding troca de tela.
      const today = todayISO();
      for (const entry of bankEntries) {
        const existing = accounts.find((account) => account.id === entry.accountId);
        const balanceChanged = entry.cents !== (existing?.balanceCents ?? null);
        await saveAccount({
          id: existing?.id ?? createFinanceId(),
          name: (entry.name.trim() || bankName(entry.bank)).slice(0, 60),
          bank: entry.bank,
          currency: entry.currency,
          balanceCents: entry.cents,
          balanceReportedOn: entry.cents === null ? null : balanceChanged ? today : existing?.balanceReportedOn ?? today,
          createdOn: existing?.createdOn ?? today,
        });
      }
      await savePreferences(nextPreferences);
      if (editing) toast("Preferências atualizadas");
      router.replace(returnTo ?? (editing ? "/settings" : "/overview"));
    } catch {
      setError("Não foi possível salvar agora. Seus dados continuam aqui; tente novamente.");
    }
  }

  async function allowNotifications() {
    setNotice(null);
    if (!("Notification" in window)) {
      setNotice("Este navegador não oferece notificações. Você pode continuar sem elas.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") await finish(true);
      else setNotice("Permissão não concedida. Toque em “Agora não” para continuar sem lembretes.");
    } catch {
      setNotice("Não foi possível pedir permissão agora. Você pode continuar sem lembretes.");
    }
  }

  function next() {
    setError(null);
    if (step === stepIndex.payday && payday.trim() && (Number(payday) < 1 || Number(payday) > 31 || !Number.isInteger(Number(payday)))) return setError("Escolha um dia entre 1 e 31.");
    if (step === stepIndex.terms && !termsAccepted) return setError("Aceite os termos para continuar.");
    setStep(step + 1);
  }

  function skip() {
    if (step === stepIndex.income) setIncomeCents(null);
    if (step === stepIndex.payday) setPayday("");
    if (step === stepIndex.banks) setBankEntries((entries) => entries.filter((entry) => entry.accountId));
    if (step === stepIndex.balance) {
      setBalanceCents(null);
      setBankEntries((entries) => entries.map((entry) => (entry.accountId ? entry : { ...entry, cents: null })));
    }
    setError(null);
    setStep(step + 1);
  }

  if (step === -1) {
    const secondary = "flex min-h-14 w-full items-center justify-center rounded-full border border-[var(--color-forest-green)] text-base font-semibold text-[var(--color-forest-green)] transition-colors hover:bg-[var(--color-soft)] " + focusRing;
    return (
      <div className="flex min-h-dvh flex-col bg-white px-6 pb-[max(env(safe-area-inset-bottom),32px)] pt-20">
        <SplashScreen />
        <h1 className="text-4xl font-semibold leading-[38px] tracking-[-0.02em] text-[#0F0F0F]">Seu próximo passo começa aqui.</h1>
        <div className="flex flex-1 items-center justify-center py-8">
          <Image src={asset("/illustrations/welcome.png")} alt="" width={313} height={313} priority draggable={false} className="h-auto w-full max-w-[313px] select-none" />
        </div>
        <div className="flex flex-col gap-4">
          {mode === "supabase" ? (
            <>
              <Link href="/register" className={`${inkButton} w-full`}>Criar uma conta</Link>
              <Link href="/login" className={secondary}>Faça login</Link>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setStep(0)} className={`${inkButton} w-full`}>Criar meu perfil</button>
              <Link href="/terms" className={secondary}>Como seus dados são guardados</Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const optionalStep = ([stepIndex.income, stepIndex.payday, stepIndex.banks, stepIndex.balance] as number[]).includes(step);
  const subtitle = step === stepIndex.balance && bankEntries.length ? "Opcional — informe quanto tem em cada banco. Não consultamos o banco." : subtitles[step];

  /** Bancos da lista entram uma vez (tocar de novo tira); "Outra" adiciona uma instituição nova a cada toque. */
  function toggleBank(bank: BankId) {
    setBankEntries((entries) => {
      if (bank !== "other") {
        const found = entries.find((entry) => entry.bank === bank && !entry.accountId);
        if (found) return entries.filter((entry) => entry !== found);
        if (entries.some((entry) => entry.bank === bank)) return entries;
      }
      const global = banks.find((item) => item.id === bank)?.region === "global";
      return [...entries, { key: createFinanceId(), accountId: null, bank, name: bank === "other" ? "" : bankName(bank), currency: global && currency === "BRL" ? "USD" : currency, cents: null }];
    });
  }

  function updateEntry(key: string, change: Partial<BankEntry>) {
    setBankEntries((entries) => entries.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)));
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-white">
      <div className="px-6 pt-16">
        <button
          type="button"
          aria-label={step === 0 && editing ? "Voltar aos ajustes" : "Voltar"}
          onClick={() => step > 0 ? setStep(step - 1) : editing ? router.replace(returnTo ?? "/settings") : setStep(-1)}
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] text-[var(--color-ink)] ${focusRing}`}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <p className="sr-only" aria-live="polite">Etapa {step + 1} de {totalSteps}</p>
      </div>

      <header className="px-6 pt-10">
        <h1 className="text-4xl font-semibold leading-tight tracking-[-0.02em] text-[var(--color-ink)]">{titles[step]}</h1>
        {subtitle ? <p className="mt-3 text-base leading-6 text-[var(--color-placeholder)]">{subtitle}</p> : null}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-10">
        {step === stepIndex.name ? (
          <UnderlineField label="Nome">
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="given-name" maxLength={80} autoFocus placeholder="Seu nome ou apelido" className="mt-1 w-full bg-transparent text-2xl font-medium text-[var(--color-ink)] outline-none placeholder:text-[var(--color-placeholder)]" />
          </UnderlineField>
        ) : null}

        {step === stepIndex.currency ? (
          <fieldset>
            <legend className="sr-only">Moeda de exibição</legend>
            <ul className="divide-y divide-[var(--color-border)]">
              {currencies.map((item) => (
                <li key={item.code}>
                  <label className="flex min-h-[72px] cursor-pointer items-center gap-4 py-3">
                    <input type="radio" name="currency" value={item.code} checked={currency === item.code} onChange={() => setCurrency(item.code)} className="sr-only" aria-label={`${item.name} (${item.code})`} />
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px]" aria-hidden="true">
                      <Image src={asset(`/flags/${item.flag}.png`)} alt="" width={40} height={40} className="h-10 w-10 scale-[1.55] object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xl text-[var(--color-ink)]">{item.name}</span>
                      <span className="block text-sm text-[var(--color-placeholder)]">{item.code}</span>
                    </span>
                    <Radio checked={currency === item.code} />
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-[var(--color-placeholder)]">Muda só a exibição dos valores. Nada é convertido.</p>
          </fieldset>
        ) : null}

        {step === stepIndex.income ? <MoneyInput label="Valor líquido mensal" value={incomeCents} onChange={setIncomeCents} currency={currency} autoFocus /> : null}

        {step === stepIndex.payday ? (
          <UnderlineField label="Dia do mês">
            <input value={payday} onChange={(event) => setPayday(event.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" autoFocus placeholder="5" className="mt-1 w-full bg-transparent text-2xl font-medium text-[var(--color-ink)] outline-none placeholder:text-[var(--color-placeholder)]" />
          </UnderlineField>
        ) : null}

        {step === stepIndex.banks ? (
          <fieldset>
            <legend className="sr-only">Bancos que você usa</legend>
            <ul className="grid grid-cols-3 gap-x-2 gap-y-4">
              {banks.map((item) => {
                const count = bankEntries.filter((entry) => entry.bank === item.id).length;
                const selected = count > 0;
                const locked = bankEntries.some((entry) => entry.bank === item.id && entry.accountId);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleBank(item.id)}
                      aria-pressed={item.id === "other" ? undefined : selected}
                      aria-label={item.id === "other" ? "Adicionar outra instituição" : item.name}
                      className={`relative flex w-full flex-col items-center gap-2 rounded-2xl px-1 py-3 text-center transition-colors ${selected ? "bg-[var(--color-soft)]" : "hover:bg-[var(--color-soft)]"} ${focusRing}`}
                    >
                      {item.id === "other" ? (
                        <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-[var(--color-border-overlay)] text-[var(--color-ink)]" aria-hidden="true"><Plus size={20} /></span>
                      ) : <BankLogo bank={item.id} name={item.name} size={48} />}
                      <span className="line-clamp-2 text-sm leading-4 text-[var(--color-ink)]">{item.id === "other" ? (count ? `Outra (${count})` : "Outra") : item.name}</span>
                      {selected && item.id !== "other" ? <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white ${locked ? "bg-[var(--color-tertiary)]" : "bg-[var(--color-ink)]"}`}><Check size={12} strokeWidth={3} aria-hidden="true" /></span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 text-sm text-[var(--color-placeholder)]">{bankEntries.length ? `${bankEntries.length} ${bankEntries.length === 1 ? "banco escolhido" : "bancos escolhidos"}.` : "Nenhum banco escolhido."} O Prumo não se conecta ao banco: você informa os valores.</p>
          </fieldset>
        ) : null}

        {step === stepIndex.balance ? (
          bankEntries.length ? (
            <ul className="space-y-8">
              {bankEntries.map((entry) => (
                <li key={entry.key}>
                  <div className="mb-3 flex items-center gap-3">
                    <BankLogo bank={entry.bank} name={entry.name || bankName(entry.bank)} size={40} />
                    {entry.bank === "other" && !entry.accountId ? (
                      <input value={entry.name} onChange={(event) => updateEntry(entry.key, { name: event.target.value })} maxLength={60} placeholder="Nome da instituição" aria-label="Nome da instituição" className="min-w-0 flex-1 border-b border-[var(--color-border)] bg-transparent py-1 text-xl text-[var(--color-ink)] outline-none placeholder:text-[var(--color-placeholder)] focus:border-[var(--color-ink)]" />
                    ) : <span className="min-w-0 flex-1 truncate text-xl text-[var(--color-ink)]">{entry.name}</span>}
                    {!entry.accountId ? (
                      <button type="button" onClick={() => setBankEntries((entries) => entries.filter((item) => item.key !== entry.key))} aria-label={`Remover ${entry.name || "instituição"}`} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-tertiary)] hover:bg-[var(--color-soft)] ${focusRing}`}><X size={18} aria-hidden="true" /></button>
                    ) : null}
                  </div>
                  <MoneyInput label={`Saldo em ${entry.currency}`} value={entry.cents} onChange={(cents) => updateEntry(entry.key, { cents })} currency={entry.currency} />
                </li>
              ))}
              <li>
                <button type="button" onClick={() => setStep(stepIndex.banks)} className={`inline-flex min-h-11 items-center gap-2 rounded-full text-base font-semibold text-[var(--color-ink)] ${focusRing}`}><Plus size={18} aria-hidden="true" /> Adicionar outro banco</button>
              </li>
            </ul>
          ) : <MoneyInput label="Saldo informado" value={balanceCents} onChange={setBalanceCents} currency={currency} autoFocus />
        ) : null}

        {step === stepIndex.goals ? (
          <fieldset>
            <legend className="sr-only">O que deseja organizar?</legend>
            <ul className="divide-y divide-[var(--color-border)]">
              {goals.map((goal) => {
                const selected = selectedGoals.includes(goal.value);
                return (
                  <li key={goal.value}>
                    <label className="flex min-h-[84px] cursor-pointer items-center gap-4 py-4">
                      <input type="checkbox" checked={selected} onChange={() => setSelectedGoals((current) => selected ? current.filter((value) => value !== goal.value) : [...current, goal.value])} className="sr-only" aria-label={goal.title} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xl text-[var(--color-ink)]">{goal.title}</span>
                        <span className="mt-1 block text-base text-[var(--color-placeholder)]">{goal.description}</span>
                      </span>
                      <Radio checked={selected} />
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : null}

        {step === stepIndex.terms ? (
          <div>
            <label className="flex min-h-14 cursor-pointer items-center gap-4 border-b border-[var(--color-border)] pb-5">
              <input type="checkbox" checked={termsAccepted} onChange={(event) => { setTermsChecked(event.target.checked); setPrivacyChecked(event.target.checked); }} className="sr-only" aria-label="Aceitar tudo" />
              <SquareCheck checked={termsAccepted} />
              <span className="text-xl text-[var(--color-ink)]">Aceitar tudo</span>
            </label>
            <div className="flex gap-4 border-b border-[var(--color-border)] py-6">
              <label className="flex cursor-pointer gap-4">
                <input type="checkbox" checked={termsChecked} onChange={(event) => setTermsChecked(event.target.checked)} className="sr-only" aria-label="Termos e condições" />
                <SquareCheck checked={termsChecked} />
                <span>
                  <span className="block text-xl text-[var(--color-ink)]">Termos e condições</span>
                  <span className="mt-2 block text-base leading-6 text-[var(--color-placeholder)]">Entendo que o Prumo organiza o que eu registro e não movimenta dinheiro.</span>
                </span>
              </label>
              <Link href="/terms" target="_blank" aria-label="Ler os termos e condições" className={`ml-auto self-start rounded-full p-1 ${focusRing}`}><ChevronRight size={22} aria-hidden="true" /></Link>
            </div>
            <div className="flex gap-4 py-6">
              <label className="flex cursor-pointer gap-4">
                <input type="checkbox" checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} className="sr-only" aria-label="Política de privacidade" />
                <SquareCheck checked={privacyChecked} />
                <span>
                  <span className="block text-xl text-[var(--color-ink)]">Política de privacidade</span>
                  <span className="mt-2 block text-base leading-6 text-[var(--color-placeholder)]">{mode === "local" ? "Meus dados ficam neste navegador e não são enviados para a nuvem." : "Meus dados ficam na minha conta, protegidos por regras de acesso."}</span>
                </span>
              </label>
              <Link href="/terms#privacidade" target="_blank" aria-label="Ler a política de privacidade" className={`ml-auto self-start rounded-full p-1 ${focusRing}`}><ChevronRight size={22} aria-hidden="true" /></Link>
            </div>
          </div>
        ) : null}

        {notice ? <p role="status" className="mt-5 text-sm text-[var(--color-muted)]">{notice}</p> : null}
        {error ? <p role="alert" className="mt-5 text-sm text-[var(--color-error)]">{error}</p> : null}
      </main>

      <footer className="sticky bottom-0 bg-white px-6 pb-[max(env(safe-area-inset-bottom),32px)] pt-3">
        {step === stepIndex.reminders ? (
          <div className="flex flex-col gap-4">
            <button type="button" onClick={() => void allowNotifications()} disabled={isSaving} className={`${inkButton} w-full`}>Permitir notificações</button>
            <button type="button" onClick={() => void finish(false)} disabled={isSaving} className={`${outlineButton} w-full`}>{isSaving ? "Salvando..." : "Agora não"}</button>
          </div>
        ) : optionalStep ? (
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={skip} className={outlineButton}>Pular</button>
            <button type="button" onClick={next} className={inkButton}>Continuar</button>
          </div>
        ) : (
          <button type="button" onClick={next} disabled={step === stepIndex.terms && !termsAccepted} className={`${inkButton} w-full`}>
            {step === stepIndex.terms ? "Concordar e continuar" : "Continuar"}
          </button>
        )}
      </footer>
    </div>
  );
}
