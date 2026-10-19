"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { usePrivacy } from "@/components/privacy";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { MoneyInput } from "@/components/ui/money-input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { Card, SectionHeader, dangerButton, fieldClass, focusRing, labelClass, primaryButton, textButton } from "@/components/ui/primitives";
import { banks } from "@/domain/banks";
import { investmentTypeName, investmentTypes, summarizeInvestments, type InvestmentType } from "@/domain/investments";
import { todayISO } from "@/lib/dates";
import { createFinanceId, type FinanceInvestment } from "@/lib/finance/repository";
import { formatCurrency, formatShortDate } from "@/lib/formatting";

/** Cores neutras e secundárias da paleta (nunca vermelho nem o laranja de destaque). */
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
export function InvestmentDistribution({ investments, compact = false }: { investments: FinanceInvestment[]; compact?: boolean }) {
  const { currency } = useFinanceSummary();
  const { mask } = usePrivacy();
  const summary = summarizeInvestments(investments);
  if (!summary.count) return null;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--color-soft)]" role="img" aria-label={summary.distribution.map((item) => `${investmentTypeName(item.type)} ${Math.round(item.share * 100)}%`).join(", ")}>
        {summary.distribution.map((item) => <div key={item.type} className="h-full border-r-2 border-white last:border-r-0" style={{ width: `${item.share * 100}%`, backgroundColor: investmentColors[item.type as InvestmentType] }} />)}
      </div>
      <ul className={`mt-3 grid gap-x-4 gap-y-2 ${compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>
        {summary.distribution.slice(0, compact ? 4 : undefined).map((item) => (
          <li key={item.type} className="flex min-w-0 items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: investmentColors[item.type as InvestmentType] }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{investmentTypeName(item.type, "short")}</span>
            <span className="tabular shrink-0 font-medium">{compact ? `${Math.round(item.share * 100)}%` : mask(formatCurrency(item.currentCents, currency))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InvestmentsScreen() {
  const { investments } = useFinance();
  const { currency } = useFinanceSummary();
  const { mask } = usePrivacy();
  const [editing, setEditing] = useState<FinanceInvestment | "new" | null>(null);
  const summary = summarizeInvestments(investments);
  const sorted = [...investments].sort((left, right) => right.date.localeCompare(left.date));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card aria-labelledby="investments-total">
          <h2 id="investments-total" className="text-sm font-medium text-[var(--color-muted)]">Total aplicado</h2>
          <p className="tabular mt-2 text-4xl font-semibold">{mask(formatCurrency(summary.appliedCents, currency))}</p>
          {summary.withCurrentValue ? (
            <p className="mt-1 text-sm text-[var(--color-tertiary)]">Valor atual informado: <span className="tabular font-medium text-[var(--color-text)]">{mask(formatCurrency(summary.currentCents, currency))}</span></p>
          ) : <p className="mt-1 text-sm text-[var(--color-tertiary)]">{summary.count ? "Informe o valor atual de cada aplicação para acompanhar a diferença." : "Cadastre o que você já tem aplicado."}</p>}
          <div className="mt-5"><InvestmentDistribution investments={investments} /></div>
          <button type="button" onClick={() => setEditing("new")} className={`${primaryButton} mt-6 w-full`}><Plus size={18} aria-hidden="true" /> Nova aplicação</button>
        </Card>

        <Link href="/investments/learn" className={`group flex flex-col rounded-[20px] bg-[var(--color-soft)] p-5 transition-colors hover:bg-[var(--color-border)] sm:p-6 ${focusRing}`}>
          <BookOpen size={24} strokeWidth={1.75} className="text-[var(--color-muted)]" aria-hidden="true" />
          <span className="mt-4 text-xl font-semibold">Conheça os tipos de investimento</span>
          <span className="mt-1 text-sm leading-5 text-[var(--color-muted)]">Poupança, CDB, Tesouro, ações, FIIs, fundos, LCI/LCA e cripto em linguagem simples.</span>
          <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold">Ler agora <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
        </Link>
      </div>

      <Card>
        <SectionHeader title="Suas aplicações" action={sorted.length ? <button type="button" onClick={() => setEditing("new")} className={textButton}><Plus size={16} aria-hidden="true" /> Adicionar</button> : undefined} />
        {sorted.length ? (
          <ul className="-my-1 divide-y divide-[var(--color-border)]">
            {sorted.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setEditing(item)} className={`flex min-h-16 w-full items-center gap-3 rounded-2xl py-3 text-left ${focusRing}`}>
                  <span className="h-10 w-10 shrink-0 rounded-full" style={{ backgroundColor: investmentColors[item.type] }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium">{item.description || investmentTypeName(item.type)}</span>
                    <span className="block truncate text-sm text-[var(--color-tertiary)]">{investmentTypeName(item.type, "short")} · {item.institution} · {formatShortDate(item.date)}</span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="tabular text-base font-semibold">{mask(formatCurrency(item.currentCents ?? item.appliedCents, currency))}</span>
                    {item.currentCents !== null ? <span className="tabular text-xs text-[var(--color-tertiary)]">aplicado {mask(formatCurrency(item.appliedCents, currency))}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="py-4 text-sm text-[var(--color-tertiary)]">Nenhuma aplicação cadastrada. Registre tipo, instituição, valor aplicado e data; o valor atual é opcional.</p>}
      </Card>

      <p className="px-1 text-xs leading-5 text-[var(--color-tertiary)]">O Prumo registra o que você informa. Não consulta corretoras, não estima rendimento e não recomenda investimentos.</p>

      {editing ? <InvestmentForm investment={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function InvestmentForm({ investment, onClose }: { investment: FinanceInvestment | null; onClose: () => void }) {
  const { saveInvestment, deleteInvestment, isSaving } = useFinance();
  const { currency } = useFinanceSummary();
  const toast = useToast();
  const [type, setType] = useState<InvestmentType>(investment?.type ?? "cdb_rdb");
  const [institution, setInstitution] = useState(investment?.institution ?? "");
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
            {[...banks.filter((bank) => bank.id !== "other").map((bank) => bank.name), "Tesouro Direto", "XP", "BTG Pactual", "Rico", "Clear"].map((name) => <option key={name} value={name} />)}
          </datalist>
        </label>
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
