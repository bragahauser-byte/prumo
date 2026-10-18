"use client";

import { useMemo, useState } from "react";
import { DeleteExpenseButton } from "@/components/delete-expense-button";
import { EmptyState } from "@/components/empty-state";
import { ExpenseForm } from "@/components/expense-form";
import { ExpensePaymentButton } from "@/components/expense-payment-button";
import { useFinance } from "@/components/finance-provider";
import { formatCalendarDate, formatCurrency } from "@/lib/formatting";
import type { ExpenseStatus } from "@/domain/financial";
import type { FinanceExpense } from "@/lib/finance/repository";

const pageSize = 50;
const categories = ["Moradia", "Alimentação", "Transporte", "Saúde", "Contas", "Assinaturas", "Outros"];

export default function ExpensesPage() {
  const { expenses, preferences } = useFinance();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<ExpenseStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FinanceExpense | null>(null);

  const filteredExpenses = useMemo(() => expenses
    .filter((expense) => expense.description.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")))
    .filter((expense) => !category || expense.category === category)
    .filter((expense) => !status || expense.status === status)
    .filter((expense) => !from || expense.date >= from)
    .filter((expense) => !to || expense.date <= to)
    .sort((left, right) => order === "asc" ? left.date.localeCompare(right.date) : right.date.localeCompare(left.date)),
  [category, expenses, from, order, search, status, to]);
  const pageCount = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleExpenses = filteredExpenses.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = Boolean(search || category || status || from || to);

  function clearFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-[var(--color-muted)]">Despesas registradas: {expenses.length}. Os valores refletem somente os dados salvos.</p>
        {!showForm ? <button onClick={() => setShowForm(true)} className="min-h-11 rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white">Adicionar despesa</button> : null}
      </div>

      {showForm ? <section aria-label="Nova despesa" className="mb-8"><ExpenseForm onSaved={() => setShowForm(false)} onCancel={() => setShowForm(false)} /></section> : null}
      {editing ? <section aria-label="Editar despesa" className="mb-8"><ExpenseForm expense={editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} /></section> : null}

      <form onSubmit={(event) => event.preventDefault()} className="my-5 grid gap-3 border-y border-[var(--color-border)] py-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">Buscar descrição<input value={search} onChange={(event) => { setSearch(event.target.value.slice(0, 80)); setPage(1); }} maxLength={80} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base" /></label>
        <label className="text-sm font-medium">Categoria<select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base"><option value="">Todas</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-sm font-medium">Status<select value={status} onChange={(event) => { setStatus(event.target.value as ExpenseStatus | ""); setPage(1); }} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base"><option value="">Todos</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="scheduled">Previsto</option></select></label>
        <label className="text-sm font-medium">De<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base" /></label>
        <label className="text-sm font-medium">Até<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base" /></label>
        <label className="text-sm font-medium">Ordem de vencimento<select value={order} onChange={(event) => setOrder(event.target.value as "asc" | "desc")} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base"><option value="asc">Mais próximo</option><option value="desc">Mais distante</option></select></label>
        {hasFilters ? <button type="button" onClick={clearFilters} className="min-h-10 self-end text-left text-sm underline underline-offset-4 lg:col-span-3">Limpar filtros</button> : null}
      </form>

      {visibleExpenses.length ? (
        <ul className="divide-y divide-[var(--color-border)]">
          {visibleExpenses.map((expense) => (
            <li key={expense.id} className="py-5">
              {editing?.id === expense.id ? null : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{expense.description}</h2>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{expense.category} · vence {formatCalendarDate(expense.date)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span className="text-base font-semibold">{formatCurrency(expense.amountCents, preferences?.currency)}</span>
                    <span className="rounded-full bg-[var(--color-soft)] px-2.5 py-1 text-xs font-medium">{expense.status === "paid" ? "Paga" : expense.status === "scheduled" ? "Prevista" : "Pendente"}</span>
                    {expense.status === "paid" && expense.paidOn ? <span className="text-xs text-[var(--color-muted)]">Pago em {formatCalendarDate(expense.paidOn)}</span> : null}
                    <ExpensePaymentButton id={expense.id} currentStatus={expense.status} correctionStatus={expense.date < new Date().toISOString().slice(0, 10) ? "pending" : "scheduled"} />
                    <button onClick={() => { setShowForm(false); setEditing(expense); }} className="min-h-10 px-2 text-sm underline underline-offset-4">Editar</button>
                    <DeleteExpenseButton id={expense.id} description={expense.description} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={hasFilters ? "Nenhum resultado encontrado" : "Seu mês começa aqui"}
          description={hasFilters ? "Tente ajustar ou remover os filtros." : "Registre uma conta, compra ou compromisso para acompanhar vencimentos e pagamentos."}
          action={hasFilters
            ? <button onClick={clearFilters} className="min-h-[52px] w-full rounded-full border border-[var(--color-border)] px-5 text-sm font-semibold">Limpar filtros</button>
            : <button onClick={() => setShowForm(true)} className="min-h-[52px] w-full rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">Adicionar despesa</button>}
        />
      )}

      {filteredExpenses.length > pageSize ? (
        <nav aria-label="Paginação" className="flex items-center justify-between border-t border-[var(--color-border)] py-4 text-sm">
          <button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="min-h-10 underline underline-offset-4 disabled:opacity-40">Página anterior</button>
          <span>Página {currentPage} de {pageCount}</span>
          <button disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} className="min-h-10 underline underline-offset-4 disabled:opacity-40">Próxima página</button>
        </nav>
      ) : null}
    </div>
  );
}
