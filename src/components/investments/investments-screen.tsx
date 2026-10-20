"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { bankShades } from "@/components/accounts/bank-breakdown";
import { useFinance } from "@/components/finance-provider";
import { usePrivacy } from "@/components/privacy";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { BankLogo } from "@/components/ui/bank-logo";
import { Illustration } from "@/components/ui/illustration";
import { MoneyInput } from "@/components/ui/money-input";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { Card, SectionHeader, dangerButton, fieldClass, focusRing, inkButton, labelClass, primaryButton } from "@/components/ui/primitives";
import { bankIdFromName, banks } from "@/domain/banks";
import { investmentTypeName, investmentTypes, investmentsByInstitution, summarizeInvestments, type InvestmentType } from "@/domain/investments";
import { todayISO } from "@/lib/dates";
import { createFinanceId, type FinanceInvestment } from "@/lib/finance/repository";
import { formatCurrency, formatShortDate } from "@/lib/formatting";

/** Cores neutras e secundárias da paleta (nunca vermelho nem laranja). */
export const investmentColors: Record<InvestmentType, string> = {
  poupanca: "#9FE870",
  cdb_rdb: "#163300",
  tesouro: "#A0E1E1",
  acoes: "#260A2F",
  fiis: "#FFEB69",
  fundos_etfs: "#6A6C6A",
  lci_lca: "#FFD7EF",
  cripto: "#3A341C",
};

/** Barra empilhada com a participação de cada tipo na carteira. */
export function InvestmentDistribution({ investments, compact = false, bar = false }: { investments: FinanceInvestment[]; compact?: boolean; bar?: boolean }) {
  const { currency } = useFinanceSummary();
  const { mask } = usePrivacy();
  const summary = summarizeInvestments(investments);
  if (!summary.count) return null;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--color-soft)]" role="img" aria-label={summary.distribution.map((item) => `${investmentTypeName(item.type)} ${Math.round(item.share * 100)}%`).join(", ")}>
        {summary.distribution.map((item) => <div key={item.type} className="h-full border-r-2 border-white last:border-r-0" style={{ width: `${item.share * 100}%`, backgroundColor: investmentColors[item.type as InvestmentType] }} />)}
      </div>
      {bar ? null : <ul className={`mt-3 grid gap-x-4 gap-y-2 ${compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>
        {summary.distribution.slice(0, compact ? 4 : undefined).map((item) => (
          <li key={item.type} className="flex min-w-0 items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: investmentColors[item.type as InvestmentType] }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{investmentTypeName(item.type, "short")}</span>
            <span className="tabular shrink-0 font-medium">{compact ? `${Math.round(item.share * 100)}%` : mask(formatCurrency(item.currentCents, currency))}</span>
          </li>
        ))}
      </ul>}
    </div>
  );
}

const guideLink = (
  <Link href="/investments/learn" className={`group flex flex-col rounded-[20px] bg-[var(--color-soft)] p-5 transition-colors hover:bg-[var(--color-border)] sm:p-6 ${focusRing}`}>
    <BookOpen size={24} strokeWidth={1.75} className="text-[var(--color-muted)]" aria-hidden="true" />
    <span className="mt-4 text-xl font-semibold">Conheça os tipos de investimento</span>
    <span className="mt-1 text-sm leading-5 text-[var(--color-muted)]">Poupança, CDB, Tesouro, ações, FIIs, fundos, LCI/LCA e cripto em linguagem simples.</span>
    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold">Ler agora <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
  </Link>
);

type Editing = { investment: FinanceInvestment | null; institution?: string };

/**
 * Investimentos no mesmo formato de Metas: anel dividido por instituição (onde o dinheiro está),
 * cartões por banco ou corretora com as aplicações de cada um e o guia dos tipos.
 */
export function InvestmentsScreen() {
  const { investments } = useFinance();
  const { currency } = useFinanceSummary();
  const { mask } = usePrivacy();
  const [editing, setEditing] = useState<Editing | null>(null);
  const summary = summarizeInvestments(investments);
  const places = investmentsByInstitution(investments).map((place, index) => ({ ...place, color: bankShades[index % bankShades.length], bank: bankIdFromName(place.name) }));
  const money = (cents: number) => mask(formatCurrency(cents, currency));
  const difference = summary.differenceCents;

  if (!summary.count) {
    return (
      <div className="space-y-6">
        <section className="mx-auto flex max-w-[420px] flex-col items-center px-2 py-6 text-center">
          <Illustration name="investments" size={200} priority />
          <h2 className="mt-6 text-2xl font-semibold tracking-[-0.01em]">Onde seu dinheiro trabalha?</h2>
          <p className="mt-3 text-base leading-6 text-[var(--color-muted)]">Cadastre suas aplicações em cada banco ou corretora. O Prumo mostra quanto você tem, onde está e como se divide — sem estimar rendimento.</p>
          <button type="button" onClick={() => setEditing({ investment: null })} className={`${inkButton} mt-8 w-full`}><Plus size={20} aria-hidden="true" /> Cadastrar primeira aplicação</button>
        </section>
        {guideLink}
        {editing ? <InvestmentForm investment={editing.investment} initialInstitution={editing.institution} onClose={() => setEditing(null)} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card aria-labelledby="investments-summary" className="p-6 sm:p-8">
        <h2 id="investments-summary" className="sr-only">Resumo dos investimentos</h2>
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-12">
          <ProgressRing
            size={240}
            stroke={14}
            segments={places.map((place) => ({ value: place.share, color: place.color, label: place.name }))}
            label={`Total investido ${formatCurrency(summary.currentCents, currency)}, em ${places.length} ${places.length === 1 ? "instituição" : "instituições"}`}
          >
            <span className="text-sm text-[var(--color-muted)]">Total investido</span>
            <span className="tabular mt-1 text-3xl font-semibold tracking-[-0.02em]">{money(summary.currentCents)}</span>
            {summary.withCurrentValue && difference !== 0 ? (
              <span className={`tabular mt-1 text-xs font-semibold ${difference > 0 ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"}`}>{difference > 0 ? "+" : "−"}{money(Math.abs(difference))} sobre o aplicado</span>
            ) : <span className="tabular mt-1 text-xs text-[var(--color-tertiary)]">aplicado {money(summary.appliedCents)}</span>}
          </ProgressRing>

          <div className="w-full min-w-0 flex-1">
            <dl className="grid grid-cols-2 gap-4 border-b border-[var(--color-border)] pb-4">
              <div className="min-w-0">
                <dt className="text-sm text-[var(--color-muted)]">Aplicações</dt>
                <dd className="tabular text-xl font-semibold">{summary.count}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-[var(--color-muted)]">{places.length === 1 ? "Instituição" : "Instituições"}</dt>
                <dd className="tabular text-xl font-semibold">{places.length}</dd>
              </div>
            </dl>
            <ul className="mt-2 divide-y divide-[var(--color-border)]" aria-label="Parte de cada instituição no anel">
              {places.map((place) => (
                <li key={place.id}>
                  <a href={`#place-${place.id}`} className={`flex min-h-12 items-center gap-3 rounded-xl py-2 ${focusRing}`}>
                    <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5" style={{ backgroundColor: place.color }} aria-hidden="true" />
                    <BankLogo bank={place.bank} name={place.name} size={24} />
                    <span className="min-w-0 flex-1 truncate text-base">{place.name}</span>
                    <span className="tabular shrink-0 text-sm font-semibold">{Math.round(place.share * 100)}%</span>
                  </a>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setEditing({ investment: null })} className={`${inkButton} mt-4 w-full`}><Plus size={20} aria-hidden="true" /> Nova aplicação</button>
          </div>
        </div>
      </Card>

      <section aria-labelledby="places-title">
        <SectionHeader id="places-title" title="Onde você investe" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {places.map((place) => (
            <Card key={place.id} id={`place-${place.id}`} className="flex scroll-mt-24 flex-col p-5 sm:p-5">
              <div className="flex items-center gap-3">
                <BankLogo bank={place.bank} name={place.name} size={56} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-base font-semibold leading-5 [overflow-wrap:anywhere]">{place.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: place.color }} aria-hidden="true" />
                    {place.count} {place.count === 1 ? "aplicação" : "aplicações"}
                  </span>
                </span>
              </div>

              <div className="mt-5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="tabular truncate text-xl font-semibold">{money(place.currentCents)}</p>
                  <p className="tabular truncate text-sm text-[var(--color-muted)]">aplicado {money(place.appliedCents)}</p>
                </div>
                <p className="tabular shrink-0 text-xl font-semibold">{Math.round(place.share * 100)}%</p>
              </div>
              <div className="mt-2"><InvestmentDistribution investments={place.items} bar /></div>

              <ul className="mt-3 divide-y divide-[var(--color-border)]">
                {[...place.items].sort((left, right) => right.date.localeCompare(left.date)).map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => setEditing({ investment: item })} className={`flex min-h-12 w-full items-center gap-3 rounded-xl py-2 text-left ${focusRing}`}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: investmentColors[item.type] }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.description || investmentTypeName(item.type)}</span>
                        <span className="block truncate text-xs text-[var(--color-tertiary)]">{investmentTypeName(item.type, "short")} · {formatShortDate(item.date)}</span>
                      </span>
                      <span className="tabular shrink-0 text-sm font-semibold">{money(item.currentCents ?? item.appliedCents)}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <button type="button" onClick={() => setEditing({ investment: null, institution: place.name })} className={`mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-soft)] px-4 text-sm font-semibold transition-colors hover:bg-[var(--color-border)] ${focusRing}`}>
                <Plus size={16} aria-hidden="true" /> Aplicar aqui
              </button>
            </Card>
          ))}
        </div>
      </section>

      <Card aria-labelledby="types-title">
        <SectionHeader id="types-title" title="Por tipo" />
        <InvestmentDistribution investments={investments} />
      </Card>

      {guideLink}

      <p className="px-1 text-xs leading-5 text-[var(--color-tertiary)]">O Prumo registra o que você informa. Não consulta corretoras, não estima rendimento e não recomenda investimentos.</p>

      {editing ? <InvestmentForm investment={editing.investment} initialInstitution={editing.institution} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function InvestmentForm({ investment, initialInstitution, onClose }: { investment: FinanceInvestment | null; initialInstitution?: string; onClose: () => void }) {
  const { saveInvestment, deleteInvestment, isSaving, accounts } = useFinance();
  const { currency } = useFinanceSummary();
  const toast = useToast();
  const [type, setType] = useState<InvestmentType>(investment?.type ?? "cdb_rdb");
  const [institution, setInstitution] = useState(investment?.institution ?? initialInstitution ?? "");
  const [description, setDescription] = useState(investment?.description ?? "");
  const [appliedCents, setAppliedCents] = useState<number | null>(investment?.appliedCents ?? null);
  const [currentCents, setCurrentCents] = useState<number | null>(investment?.currentCents ?? null);
  const [date, setDate] = useState(investment?.date ?? todayISO());
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!appliedCents) return setError("Informe o valor aplicado.");
    if (!institution.trim()) return setError("Informe a instituição.");
    if (!date) return setError("Informe a data da aplicação.");
    try {
      await saveInvestment({
        id: investment?.id ?? createFinanceId(),
        type,
        institution: institution.trim().slice(0, 60),
        description: description.trim() ? description.trim().slice(0, 80) : null,
        appliedCents,
        currentCents,
        date,
        updatedOn: currentCents !== null && currentCents !== investment?.currentCents ? todayISO() : investment?.updatedOn ?? null,
      });
      toast(investment ? "Aplicação atualizada" : "Aplicação registrada");
      onClose();
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    }
  }

  async function remove() {
    if (!investment) return;
    try {
      await deleteInvestment(investment.id);
      toast("Aplicação removida");
      onClose();
    } catch {
      setError("Não foi possível remover.");
    }
  }

  return (
    <Sheet
      title={investment ? "Editar aplicação" : "Nova aplicação"}
      onClose={onClose}
      footer={<button type="button" onClick={() => void save()} disabled={isSaving} className={`${primaryButton} w-full`}>{isSaving ? "Salvando..." : "Salvar aplicação"}</button>}
    >
      <div className="space-y-6">
        <fieldset>
          <legend className={labelClass}>Tipo</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {investmentTypes.map((item) => (
              <button key={item.id} type="button" aria-pressed={type === item.id} onClick={() => setType(item.id)} className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${type === item.id ? "bg-[var(--color-text)] text-white" : "bg-[var(--color-soft)] text-[var(--color-muted)] hover:bg-[var(--color-border)]"} ${focusRing}`}>{item.short}</button>
            ))}
          </div>
        </fieldset>
        <label className={labelClass}>Instituição
          <input value={institution} onChange={(event) => setInstitution(event.target.value)} list="investment-institutions" maxLength={60} placeholder="Ex.: Nubank, Tesouro Direto, corretora" className={fieldClass} />
          <datalist id="investment-institutions">
            {[...new Set([...accounts.map((account) => account.name), ...banks.filter((bank) => bank.id !== "other").map((bank) => bank.name), "Tesouro Direto", "XP", "BTG Pactual", "Rico", "Clear"])].map((name) => <option key={name} value={name} />)}
          </datalist>
        </label>
          {accounts.length && !investment ? (
            <div className="-mt-3 flex flex-wrap gap-2" aria-label="Suas contas">
              {accounts.map((account) => (
                <button key={account.id} type="button" onClick={() => setInstitution(account.name)} aria-pressed={institution === account.name} className={`inline-flex min-h-10 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition-colors ${institution === account.name ? "bg-[var(--color-text)] text-white" : "bg-[var(--color-soft)] text-[var(--color-muted)] hover:bg-[var(--color-border)]"} ${focusRing}`}>
                  <BankLogo bank={account.bank} name={account.name} size={28} /> {account.name}
                </button>
              ))}
            </div>
          ) : null}
        <label className={labelClass}>Nome (opcional)
          <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={80} placeholder="Ex.: Reserva de emergência" className={fieldClass} />
        </label>
        <MoneyInput label="Valor aplicado" value={appliedCents} onChange={setAppliedCents} currency={currency} />
        <MoneyInput label="Valor atual (opcional)" value={currentCents} onChange={setCurrentCents} currency={currency} hint="Consulte no app da instituição. O Prumo não estima rendimento." />
        <label className={labelClass}>Data da aplicação
          <input type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
        </label>
        {error ? <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p> : null}
        {investment ? <button type="button" onClick={() => void remove()} className={dangerButton}>Remover aplicação</button> : null}
      </div>
    </Sheet>
  );
}
