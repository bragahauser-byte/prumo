"use client";

import Link from "next/link";
import { Check, ChevronRight, X } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { useFinance } from "@/components/finance-provider";
import { BankLogo } from "@/components/ui/bank-logo";
import { CategoryIcon, GoalIcon } from "@/components/ui/category-icon";
import { Illustration, type IllustrationName } from "@/components/ui/illustration";
import { focusRing } from "@/components/ui/primitives";
import type { FeatureId } from "@/domain/assistant/understand";
import { bankIdFromName, type BankId } from "@/domain/banks";
import type { CurrencyCode } from "@/domain/currencies";
import { investmentTypeName, type InvestmentType } from "@/domain/investments";
import { createFinanceId } from "@/lib/finance/repository";
import { formatCurrency, formatShortDate } from "@/lib/formatting";
import { todayISO } from "@/lib/dates";
import { useAssistant } from "./assistant-context";
import type { AssistantCard, AssistantProposal, ProposalStatus } from "./types";

const cardClass = "rounded-[20px] border border-black/[0.04] bg-white p-4 shadow-[0_1px_2px_rgba(14,15,12,0.04),0_6px_20px_rgba(14,15,12,0.05)]";

/** Texto do assistente: parágrafos, listas com "- " e **negrito**, sem renderizar HTML. */
export function AssistantText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="space-y-3 text-base leading-6 text-[var(--color-text)]">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const firstIsIntro = lines.length > 1 && !/^\s*[-•]\s+/.test(lines[0]) && lines.slice(1).every((line) => /^\s*[-•]\s+/.test(line));
        const listLines = firstIsIntro ? lines.slice(1) : lines;
        if (listLines.every((line) => /^\s*[-•]\s+/.test(line))) {
          return (
            <div key={index}>
              {firstIsIntro ? <p className="mb-1.5">{inline(lines[0])}</p> : null}
              <ul className="space-y-1.5 pl-1">
                {listLines.map((line, lineIndex) => (
                  <li key={lineIndex} className="flex gap-2"><span aria-hidden="true" className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-[var(--color-ai-teal)]" /><span>{inline(line.replace(/^\s*[-•]\s+/, ""))}</span></li>
                ))}
              </ul>
            </div>
          );
        }
        return <p key={index}>{lines.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex ? <br /> : null}{inline(line)}</Fragment>)}</p>;
      })}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
    part.startsWith("**") && part.endsWith("**") ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong> : <Fragment key={index}>{part.replace(/^#+\s*/, "")}</Fragment>
  ));
}

/** Ilustração 3D de cada tela do app (as que não têm ilustração usam a mais próxima). */
const featureArt: Record<FeatureId, IllustrationName> = {
  goals: "goals", budgets: "budgets", bills: "bills", reports: "reports", investments: "investments", learn: "investments",
  transactions: "reports", accounts: "journey", add: "journey", notifications: "bills", profile: "journey", categories: "budgets",
};

/** Atalho para uma tela do app, no estilo dos cartões do Início. */
function FeatureCardView({ card }: { card: Extract<AssistantCard, { kind: "feature" }> }) {
  const { closeAssistant } = useAssistant();
  return (
    <Link href={card.href} onClick={closeAssistant} className={`${cardClass} group flex items-center gap-4 transition-shadow hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_12px_32px_rgba(0,0,0,0.08)] ${focusRing}`}>
      <Illustration name={featureArt[card.feature]} size={72} className="-my-1" />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{card.title}</span>
        <span className="mt-0.5 block text-sm leading-5 text-[var(--color-muted)]">{card.description}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-link)]">{card.cta} <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
      </span>
    </Link>
  );
}

const toneColor = { ok: "bg-[var(--color-forest-green)]", warning: "bg-[var(--color-warning-fill)]", over: "bg-[var(--color-over)]" } as const;

export function AssistantCardView({ card }: { card: AssistantCard }) {
  const { closeAssistant } = useAssistant();
  if (card.kind === "feature") return <FeatureCardView card={card} />;
  return (
    <section className={cardClass} aria-label={card.title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{card.title}</h3>
          {card.subtitle ? <p className="mt-0.5 text-xs text-[var(--color-tertiary)]">{card.subtitle}</p> : null}
        </div>
        {card.kind === "progress" && card.href ? <Link href={card.href} onClick={closeAssistant} className={`-mr-2 -mt-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-3 text-xs font-semibold text-[var(--color-link)] hover:bg-[var(--color-soft)] ${focusRing}`}>Abrir <ChevronRight size={14} aria-hidden="true" /></Link> : null}
      </div>

      {card.kind === "bars" ? (
        <ul className="mt-3 space-y-3">
          {card.items.map((item) => {
            const max = Math.max(...card.items.map((entry) => entry.value), 1);
            return (
              <li key={item.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-[var(--color-muted)]">{item.label}</span>
                  <span className="tabular shrink-0 font-semibold">{item.display}{item.note ? <span className="ml-1.5 text-xs font-normal text-[var(--color-tertiary)]">{item.note}</span> : null}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-soft)]">
                  <div className="h-full rounded-full bg-[var(--color-forest-green)]" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {card.kind === "accounts" ? (
        <ul className="mt-2 divide-y divide-[var(--color-border)]">
          {card.items.map((item) => (
            <li key={item.name} className="flex items-center gap-3 py-2.5 text-sm">
              <BankLogo bank={item.bank} name={item.name} size={32} />
              <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
              <span className="tabular shrink-0 font-semibold">{item.display}</span>
              {item.note ? <span className="tabular w-9 shrink-0 text-right text-xs text-[var(--color-tertiary)]">{item.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {card.kind === "progress" ? (
        <ul className="mt-3 space-y-3.5">
          {card.items.map((item) => (
            <li key={item.label} className="flex items-center gap-3">
              {item.icon ? <GoalIcon icon={item.icon} size={36} /> : <CategoryIcon category={item.label} size={36} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{item.label}</span>
                  {item.note ? <span className="tabular shrink-0 font-semibold">{item.note}</span> : null}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-soft)]">
                  <div className={`h-full rounded-full ${toneColor[item.tone ?? "ok"]}`} style={{ width: `${Math.max(item.ratio > 0 ? 3 : 0, item.ratio * 100)}%` }} />
                </div>
                <p className="tabular mt-1 truncate text-xs text-[var(--color-tertiary)]">{item.display}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {card.kind === "table" ? (
        <div className="-mx-1 mt-3 overflow-x-auto">
          <table className="w-full min-w-[260px] text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-tertiary)]">
                {card.columns.map((column, index) => <th key={column} className={`px-1 pb-2 font-medium ${index ? "text-right" : ""}`}>{column}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {card.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => <td key={index} className={`px-1 py-2 ${index ? "tabular text-right" : "font-medium text-[var(--color-muted)]"}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
            {card.footer ? (
              <tfoot>
                <tr className="border-t border-[var(--color-border-overlay)] font-semibold">
                  {card.footer.map((cell, index) => <td key={index} className={`px-1 pt-2 ${index ? "tabular text-right" : ""}`}>{cell}</td>)}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}

      {card.kind === "plan" ? (
        <>
          <dl className="mt-3 divide-y divide-[var(--color-border)] text-sm">
            {card.lines.map((line) => (
              <div key={line.label} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-[var(--color-muted)]">{line.label}</dt>
                <dd className="tabular font-semibold">{line.value}</dd>
              </div>
            ))}
          </dl>
          {card.note ? <p className="mt-2 text-xs leading-4 text-[var(--color-tertiary)]">{card.note}</p> : null}
        </>
      ) : null}
    </section>
  );
}

const statusText: Record<Exclude<ProposalStatus, "pending">, string> = {
  confirmed: "Feito",
  declined: "Cancelado",
  failed: "Não foi possível salvar. Tente de novo pelo app.",
};

const dayLabel = (date: string) => (date === todayISO() ? "Hoje" : formatShortDate(date));

/** Ação proposta pelo assistente: só executa quando a pessoa toca em Confirmar. */
export function ProposalCard({ proposal, status, onStatus }: { proposal: AssistantProposal; status: ProposalStatus; onStatus: (status: ProposalStatus) => void }) {
  const { preferences, accounts, savingsGoals, budgets, saveSavingsGoal, saveBudget, saveExpense, saveAccount, savePreferences, saveInvestment } = useFinance();
  const [busy, setBusy] = useState(false);
  const currency = preferences?.currency ?? "BRL";
  const money = (cents: number) => formatCurrency(cents, currency);

  const view: { title: string; icon: ReactNode; lines: string[][] } = (() => {
    switch (proposal.kind) {
      case "create_goal":
        return { title: "Criar meta", icon: <GoalIcon icon={proposal.icon} size={40} />, lines: [["Meta", proposal.name], ["Objetivo", money(proposal.targetCents)], ["Prazo", proposal.deadline ? formatShortDate(proposal.deadline) : "Sem prazo"]] };
      case "set_budget":
        return { title: proposal.previousCents === null ? "Criar orçamento" : "Ajustar orçamento", icon: <CategoryIcon category={proposal.category} size={40} />, lines: [["Categoria", proposal.category], ["Limite mensal", money(proposal.limitCents)], ...(proposal.previousCents !== null ? [["Limite atual", money(proposal.previousCents)]] : [])] };
      case "add_expense":
        return { title: "Registrar gasto", icon: <CategoryIcon category={proposal.category} size={40} />, lines: [["Descrição", proposal.description], ["Valor", money(proposal.amountCents)], ["Categoria", proposal.category], ["Data", dayLabel(proposal.date)], ...(proposal.accountName ? [["Conta", proposal.accountName]] : []), ["Situação", proposal.paid ? "Pago" : "A pagar"]] };
      case "add_income":
        return { title: "Registrar receita", icon: <CategoryIcon category={proposal.category} kind="income" size={40} />, lines: [["Descrição", proposal.description], ["Valor", money(proposal.amountCents)], ["Categoria", proposal.category], ["Data", dayLabel(proposal.date)], ...(proposal.accountName ? [["Conta", proposal.accountName]] : []), ["Situação", proposal.received ? "Recebido" : "A receber"]] };
      case "goal_contribution":
        return { title: "Guardar na meta", icon: <GoalIcon icon={proposal.goalIcon} size={40} />, lines: [["Meta", proposal.goalName], ["Valor", money(proposal.amountCents)], ["Data", dayLabel(proposal.date)]] };
      case "set_balance":
        return { title: proposal.accountId || !proposal.bank ? "Atualizar saldo" : "Adicionar banco", icon: <BankLogo bank={proposal.bank} name={proposal.accountName} size={40} />, lines: [["Conta", proposal.accountName], ["Saldo", formatCurrency(proposal.balanceCents, proposal.currency)], ...(proposal.previousCents !== null ? [["Antes", formatCurrency(proposal.previousCents, proposal.currency)]] : [])] };
      case "add_investment":
        return { title: "Cadastrar aplicação", icon: <BankLogo bank={bankIdFromName(proposal.institution)} name={proposal.institution} size={40} />, lines: [["Tipo", investmentTypeName(proposal.type)], ["Instituição", proposal.institution], ["Aplicado", money(proposal.appliedCents)], ["Data", dayLabel(proposal.date)]] };
    }
  })();

  async function confirm() {
    setBusy(true);
    try {
      const today = todayISO();
      switch (proposal.kind) {
        case "create_goal":
          await saveSavingsGoal({ id: createFinanceId(), name: proposal.name, icon: proposal.icon, targetCents: proposal.targetCents, deadline: proposal.deadline, createdOn: today, contributions: [] });
          break;
        case "set_budget": {
          const existing = budgets.find((budget) => budget.category === proposal.category);
          await saveBudget({ category: proposal.category, limitCents: proposal.limitCents, alertAt: existing?.alertAt ?? 80 });
          break;
        }
        case "add_expense":
        case "add_income": {
          const settled = proposal.kind === "add_expense" ? proposal.paid : proposal.received;
          await saveExpense({
            id: createFinanceId(), kind: proposal.kind === "add_expense" ? "expense" : "income", description: proposal.description, amountCents: proposal.amountCents, category: proposal.category,
            date: proposal.date, status: settled ? "paid" : proposal.date > today ? "scheduled" : "pending", paidOn: settled ? proposal.date : null,
            notes: null, recurringRuleId: null, occurrenceDate: null, accountId: proposal.accountId, original: null,
          });
          break;
        }
        case "goal_contribution": {
          const goal = savingsGoals.find((item) => item.id === proposal.goalId);
          if (!goal) throw new Error("Meta não encontrada");
          await saveSavingsGoal({ ...goal, contributions: [...goal.contributions, { id: createFinanceId(), amountCents: proposal.amountCents, date: proposal.date, status: "done" }] });
          break;
        }
        case "set_balance": {
          const account = accounts.find((item) => item.id === proposal.accountId);
          if (account) await saveAccount({ ...account, balanceCents: proposal.balanceCents, balanceReportedOn: today });
          else if (proposal.bank) await saveAccount({ id: createFinanceId(), name: proposal.accountName, bank: proposal.bank as BankId, currency: proposal.currency as CurrencyCode, balanceCents: proposal.balanceCents, balanceReportedOn: today, createdOn: today });
          else if (preferences) await savePreferences({ ...preferences, reportedBalanceCents: proposal.balanceCents, balanceReportedOn: today });
          break;
        }
        case "add_investment":
          await saveInvestment({ id: createFinanceId(), type: proposal.type as InvestmentType, institution: proposal.institution.slice(0, 60), description: null, appliedCents: proposal.appliedCents, currentCents: null, date: proposal.date, updatedOn: null });
          break;
      }
      onStatus("confirmed");
    } catch {
      onStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardClass} aria-label={view.title}>
      <div className="flex items-center gap-3">
        {view.icon}
        <div>
          <p className="text-xs font-medium text-[var(--color-tertiary)]">Para você confirmar</p>
          <h3 className="text-base font-semibold">{view.title}</h3>
        </div>
      </div>
      <dl className="mt-3 divide-y divide-[var(--color-border)] text-sm">
        {view.lines.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 py-2"><dt className="text-[var(--color-muted)]">{label}</dt><dd className="tabular text-right font-medium">{value}</dd></div>
        ))}
      </dl>
      {status === "pending" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => onStatus("declined")} className={`min-h-11 rounded-full bg-[var(--color-soft)] text-sm font-semibold transition-colors hover:bg-[var(--color-border)] disabled:opacity-50 ${focusRing}`}>Cancelar</button>
          <button type="button" disabled={busy} onClick={() => void confirm()} className={`min-h-11 rounded-full bg-[var(--color-accent)] text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-pressed)] disabled:opacity-50 ${focusRing}`}>{busy ? "Salvando..." : "Confirmar"}</button>
        </div>
      ) : (
        <p role="status" className={`mt-3 inline-flex items-center gap-1.5 text-sm font-medium ${status === "confirmed" ? "text-[var(--color-success)]" : "text-[var(--color-tertiary)]"}`}>
          {status === "confirmed" ? <Check size={16} aria-hidden="true" /> : status === "declined" ? <X size={16} aria-hidden="true" /> : null}
          {statusText[status]}
        </p>
      )}
    </section>
  );
}
