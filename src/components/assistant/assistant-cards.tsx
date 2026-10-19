"use client";

import { Check, X } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { useFinance } from "@/components/finance-provider";
import { GoalIcon } from "@/components/ui/category-icon";
import { focusRing } from "@/components/ui/primitives";
import { createFinanceId } from "@/lib/finance/repository";
import { formatCurrency, formatShortDate } from "@/lib/formatting";
import { todayISO } from "@/lib/dates";
import type { AssistantCard, AssistantProposal, ProposalStatus } from "./types";

const cardClass = "rounded-[20px] border border-black/[0.04] bg-white p-4 shadow-[0_1px_2px_rgba(14,15,12,0.04),0_6px_20px_rgba(14,15,12,0.05)]";

/** Texto do assistente: parágrafos, listas com "- " e **negrito**, sem renderizar HTML. */
export function AssistantText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="space-y-3 text-base leading-6 text-[var(--color-text)]">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*[-•]\s+/.test(line))) {
          return (
            <ul key={index} className="space-y-1.5 pl-1">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="flex gap-2"><span aria-hidden="true" className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-[var(--color-tertiary)]" /><span>{inline(line.replace(/^\s*[-•]\s+/, ""))}</span></li>
              ))}
            </ul>
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

export function AssistantCardView({ card }: { card: AssistantCard }) {
  return (
    <section className={cardClass} aria-label={card.title}>
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{card.title}</h3>
      {card.subtitle ? <p className="mt-0.5 text-xs text-[var(--color-tertiary)]">{card.subtitle}</p> : null}

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
                  <div className="h-full rounded-full bg-[#3d3f3c]" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} />
                </div>
              </li>
            );
          })}
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

/** Ação proposta pela IA: só executa quando a pessoa toca em Confirmar. */
export function ProposalCard({ proposal, status, onStatus }: { proposal: AssistantProposal; status: ProposalStatus; onStatus: (status: ProposalStatus) => void }) {
  const { preferences, saveSavingsGoal, saveBudget, saveExpense, budgets } = useFinance();
  const [busy, setBusy] = useState(false);
  const currency = preferences?.currency ?? "BRL";
  const money = (cents: number) => formatCurrency(cents, currency);

  const view = proposal.kind === "create_goal"
    ? { title: "Criar meta", lines: [["Meta", proposal.name], ["Objetivo", money(proposal.targetCents)], ["Prazo", proposal.deadline ? formatShortDate(proposal.deadline) : "Sem prazo"]] }
    : proposal.kind === "set_budget"
      ? { title: proposal.previousCents === null ? "Criar orçamento" : "Ajustar orçamento", lines: [["Categoria", proposal.category], ["Limite mensal", money(proposal.limitCents)], ...(proposal.previousCents !== null ? [["Limite atual", money(proposal.previousCents)]] : [])] }
      : { title: "Registrar gasto", lines: [["Descrição", proposal.description], ["Valor", money(proposal.amountCents)], ["Categoria", proposal.category], ["Data", proposal.date === todayISO() ? "Hoje" : formatShortDate(proposal.date)], ...(proposal.accountName ? [["Conta", proposal.accountName]] : []), ["Situação", proposal.paid ? "Pago" : "A pagar"]] };

  async function confirm() {
    setBusy(true);
    try {
      const today = todayISO();
      if (proposal.kind === "create_goal") {
        await saveSavingsGoal({ id: createFinanceId(), name: proposal.name, icon: proposal.icon, targetCents: proposal.targetCents, deadline: proposal.deadline, createdOn: today, contributions: [] });
      } else if (proposal.kind === "set_budget") {
        const existing = budgets.find((budget) => budget.category === proposal.category);
        await saveBudget({ category: proposal.category, limitCents: proposal.limitCents, alertAt: existing?.alertAt ?? 80 });
      } else {
        await saveExpense({
          id: createFinanceId(), kind: "expense", description: proposal.description, amountCents: proposal.amountCents, category: proposal.category,
          date: proposal.date, status: proposal.paid ? "paid" : proposal.date > today ? "scheduled" : "pending", paidOn: proposal.paid ? proposal.date : null,
          notes: null, recurringRuleId: null, occurrenceDate: null, accountId: proposal.accountId, original: null,
        });
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
        {proposal.kind === "create_goal" ? <GoalIcon icon={proposal.icon} size={36} /> : null}
        <div>
          <p className="text-xs font-medium text-[var(--color-tertiary)]">Proposta do assistente</p>
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
          <button type="button" disabled={busy} onClick={() => void confirm()} className={`min-h-11 rounded-full bg-[var(--color-text)] text-sm font-semibold text-white transition-opacity disabled:opacity-50 ${focusRing}`}>{busy ? "Salvando..." : "Confirmar"}</button>
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
