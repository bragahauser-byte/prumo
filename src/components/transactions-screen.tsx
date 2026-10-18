"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { TransactionRow } from "@/components/transaction-row";
import { Illustration } from "@/components/ui/illustration";
import { Sheet } from "@/components/ui/sheet";
import { Card, Segmented, fieldClass, focusRing, labelClass, primaryButton, softButton } from "@/components/ui/primitives";
import { expenseCategories, incomeCategories, type TransactionKind } from "@/domain/categories";
import { displayStatus, type DisplayStatus } from "@/domain/planning";
import { todayISO } from "@/lib/dates";
import { formatCurrency, formatWeekdayDate } from "@/lib/formatting";

const pageSize = 60;
type KindFilter = "all" | TransactionKind;
type NatureFilter = "" | "fixed" | "variable";

export function TransactionsScreen() {
  const { expenses, preferences } = useFinance();
  const currency = preferences?.currency ?? "BRL";
  const today = todayISO();
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<DisplayStatus | "">("");
  const [nature, setNature] = useState<NatureFilter>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [visible, setVisible] = useState(pageSize);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return expenses
      .filter((item) => kind === "all" || item.kind === kind)
      .filter((item) => !query || item.description.toLocaleLowerCase("pt-BR").includes(query) || item.category.toLocaleLowerCase("pt-BR").includes(query))
      .filter((item) => !category || item.category === category)
      .filter((item) => !status || displayStatus(item, today) === status)
      .filter((item) => !nature || (nature === "fixed" ? item.recurringRuleId !== null : item.recurringRuleId === null))
      .filter((item) => !from || item.date >= from)
      .filter((item) => !to || item.date <= to)
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [category, expenses, from, kind, nature, search, status, to, today]);

  const groups = useMemo(() => {
    const byDate = new Map<string, typeof filtered>();
    for (const item of filtered.slice(0, visible)) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
    return [...byDate.entries()];
  }, [filtered, visible]);

  const totals = filtered.reduce((acc, item) => {
    if (item.kind === "income") acc.income += item.amountCents;
    else acc.expense += item.amountCents;
    return acc;
  }, { income: 0, expense: 0 });
  const activeFilters = [category, status, nature, from, to].filter(Boolean).length;
  const hasFilters = Boolean(search || activeFilters || kind !== "all");

  function clearFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
    setNature("");
    setFrom("");
    setTo("");
    setKind("all");
  }

  if (expenses.length === 0) {
    return (
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <Illustration name="receipt" size={120} />
        <h2 className="mt-6 text-xl font-semibold">Nenhuma transação ainda</h2>
        <p className="mt-2 max-w-[320px] text-sm leading-5 text-[var(--color-muted)]">Registre entradas e saídas manualmente. Sugerimos a categoria pela descrição para acelerar.</p>
        <Link href="/add" className={`${primaryButton} mt-6 w-full max-w-[320px]`}><Plus size={20} aria-hidden="true" /> Novo registro</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented label="Tipo" value={kind} onChange={(value) => { setKind(value); setCategory(""); }} options={[{ value: "all", label: "Todas" }, { value: "income", label: "Entradas" }, { value: "expense", label: "Saídas" }]} className="w-full sm:w-auto" />
        <div className="flex flex-1 gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Buscar transações</span>
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value.slice(0, 80))} placeholder="Buscar por descrição ou categoria" className="min-h-12 w-full rounded-full border border-transparent bg-white pl-11 pr-4 text-base outline-none focus:border-[var(--color-action)] focus:ring-2 focus:ring-[var(--color-action-soft)]" />
          </label>
          <button type="button" onClick={() => setShowFilters(true)} className={`relative inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold ${focusRing}`}>
            <SlidersHorizontal size={18} aria-hidden="true" /> <span className="hidden sm:inline">Filtros</span>
            {activeFilters ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-action)] px-1 text-xs text-white">{activeFilters}</span> : null}
            <span className="sr-only">{activeFilters ? `${activeFilters} filtros ativos` : ""}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white px-4 py-3"><span className="text-[var(--color-muted)]">Entradas</span><span className="tabular mt-0.5 block text-xl font-semibold text-[var(--color-success)]">{formatCurrency(totals.income, currency)}</span></div>
        <div className="rounded-2xl bg-white px-4 py-3"><span className="text-[var(--color-muted)]">Saídas</span><span className="tabular mt-0.5 block text-xl font-semibold">{formatCurrency(totals.expense, currency)}</span></div>
      </div>

      {groups.length ? (
        <Card className="py-2 sm:py-3">
          {groups.map(([date, items]) => (
            <section key={date} aria-label={formatWeekdayDate(date)}>
              <h2 className="sticky top-0 z-10 -mx-1 bg-white px-1 pb-1 pt-4 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)] first-letter:uppercase">{date === today ? "Hoje" : formatWeekdayDate(date)}</h2>
              <ul className="divide-y divide-[var(--color-border)]">
                {items.map((item) => <TransactionRow key={item.id} transaction={item} currency={currency} showDate={false} />)}
              </ul>
            </section>
          ))}
          {filtered.length > visible ? (
            <div className="py-4 text-center"><button type="button" onClick={() => setVisible(visible + pageSize)} className={softButton}>Mostrar mais</button></div>
          ) : null}
        </Card>
      ) : (
        <Card className="flex flex-col items-center py-12 text-center">
          <h2 className="text-xl font-semibold">Nenhum resultado</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Ajuste a busca ou remova filtros.</p>
          {hasFilters ? <button type="button" onClick={clearFilters} className={`${softButton} mt-5`}>Limpar filtros</button> : null}
        </Card>
      )}

      {showFilters ? (
        <Sheet
          title="Filtros"
          onClose={() => setShowFilters(false)}
          footer={(
            <div className="flex gap-3">
              <button type="button" onClick={() => { clearFilters(); setShowFilters(false); }} className={`${softButton} flex-1`}>Limpar</button>
              <button type="button" onClick={() => setShowFilters(false)} className={`${primaryButton} flex-1`}>Ver {filtered.length}</button>
            </div>
          )}
        >
          <div className="space-y-5">
            <label className={labelClass}>Categoria
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>
                <option value="">Todas</option>
                {kind !== "income" ? <optgroup label="Saídas">{expenseCategories.map((item) => <option key={item}>{item}</option>)}</optgroup> : null}
                {kind !== "expense" ? <optgroup label="Entradas">{incomeCategories.map((item) => <option key={item}>{item}</option>)}</optgroup> : null}
              </select>
            </label>
            <label className={labelClass}>Status
              <select value={status} onChange={(event) => setStatus(event.target.value as DisplayStatus | "")} className={fieldClass}>
                <option value="">Todos</option>
                <option value="paid">Pago</option>
                <option value="received">Recebido</option>
                <option value="scheduled">Previsto</option>
                <option value="due_today">Vence hoje</option>
                <option value="overdue">Atrasado</option>
              </select>
            </label>
            <fieldset>
              <legend className="text-sm font-medium">Natureza</legend>
              <Segmented className="mt-2 flex w-full" label="Natureza" value={nature} onChange={setNature} options={[{ value: "", label: "Todos" }, { value: "fixed", label: "Fixos" }, { value: "variable", label: "Variáveis" }]} />
              <p className="mt-2 text-xs text-[var(--color-muted)]">Fixos são os que vêm de uma recorrência (aluguel, assinatura, salário).</p>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={fieldClass} /></label>
              <label className={labelClass}>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={fieldClass} /></label>
            </div>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
