/**
 * Cálculos determinísticos usados pelas ferramentas do assistente: toda soma, comparação
 * e projeção sai destas funções, e o assistente só explica o resultado.
 * Todos os valores estão em centésimos da moeda-base.
 */
import { lastDayOfMonth, shiftMonth, signedAmount, type Movement } from "../planning";

export type PeriodPreset = "este_mes" | "mes_passado" | "ultimos_30_dias" | "ultimos_3_meses" | "este_ano" | "personalizado";

export type Period = { from: string; to: string };

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Converte um período nomeado em datas; "personalizado" exige as duas datas. */
export function resolvePeriod(preset: PeriodPreset, today: string, from?: string | null, to?: string | null): Period | null {
  const month = today.slice(0, 7);
  switch (preset) {
    case "este_mes":
      return { from: `${month}-01`, to: lastDayOfMonth(month) };
    case "mes_passado": {
      const previous = shiftMonth(month, -1);
      return { from: `${previous}-01`, to: lastDayOfMonth(previous) };
    }
    case "ultimos_30_dias":
      return { from: addDays(today, -29), to: today };
    case "ultimos_3_meses":
      return { from: `${shiftMonth(month, -2)}-01`, to: today };
    case "este_ano":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "personalizado":
      if (!from || !to || from > to) return null;
      return { from, to };
  }
}

export type AssistantMovement = Movement & { description: string; accountId: string | null };
export type NamedAccount = { id: string; name: string };

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function share(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

export type GroupBy = "categoria" | "banco" | "nenhum";

/** Gastos (ou receitas) de um período, agrupados por categoria ou por banco/conta. */
export function spendingInPeriod(
  movements: AssistantMovement[],
  accounts: NamedAccount[],
  { period, groupBy, kind = "expense", category, accountId }: { period: Period; groupBy: GroupBy; kind?: "expense" | "income"; category?: string | null; accountId?: string | null },
) {
  const selected = movements.filter((movement) => movement.kind === kind
    && movement.date >= period.from && movement.date <= period.to
    && (!category || movement.category === category)
    && (!accountId || movement.accountId === accountId));
  const totalCents = sum(selected.map((movement) => movement.amountCents));
  const groups = new Map<string, { cents: number; count: number }>();
  if (groupBy !== "nenhum") {
    for (const movement of selected) {
      const key = groupBy === "categoria"
        ? movement.category
        : accounts.find((account) => account.id === movement.accountId)?.name ?? "Sem conta";
      const entry = groups.get(key) ?? { cents: 0, count: 0 };
      entry.cents += movement.amountCents;
      entry.count += 1;
      groups.set(key, entry);
    }
  }
  const largest = [...selected].sort((left, right) => right.amountCents - left.amountCents).slice(0, 5);
  return {
    period,
    totalCents,
    count: selected.length,
    paidCents: sum(selected.filter((movement) => movement.status === "paid").map((movement) => movement.amountCents)),
    pendingCents: sum(selected.filter((movement) => movement.status !== "paid").map((movement) => movement.amountCents)),
    groups: [...groups.entries()]
      .map(([label, entry]) => ({ label, cents: entry.cents, count: entry.count, sharePercent: share(entry.cents, totalCents) }))
      .sort((left, right) => right.cents - left.cents),
    largest: largest.map((movement) => ({ description: movement.description, category: movement.category, date: movement.date, cents: movement.amountCents })),
  };
}

/** Compara dois períodos, no total e por categoria. A variação percentual é null quando não há base. */
export function comparePeriods(movements: AssistantMovement[], first: Period, second: Period, kind: "expense" | "income" = "expense") {
  const total = (period: Period) => spendingInPeriod(movements, [], { period, groupBy: "categoria", kind });
  const a = total(first);
  const b = total(second);
  const categories = [...new Set([...a.groups.map((item) => item.label), ...b.groups.map((item) => item.label)])];
  const percent = (from: number, to: number) => (from === 0 ? null : Math.round(((to - from) / from) * 1000) / 10);
  return {
    first: { period: first, totalCents: a.totalCents, count: a.count },
    second: { period: second, totalCents: b.totalCents, count: b.count },
    differenceCents: b.totalCents - a.totalCents,
    changePercent: percent(a.totalCents, b.totalCents),
    byCategory: categories
      .map((label) => {
        const firstCents = a.groups.find((item) => item.label === label)?.cents ?? 0;
        const secondCents = b.groups.find((item) => item.label === label)?.cents ?? 0;
        return { label, firstCents, secondCents, differenceCents: secondCents - firstCents, changePercent: percent(firstCents, secondCents) };
      })
      .sort((left, right) => Math.abs(right.differenceCents) - Math.abs(left.differenceCents)),
  };
}

/** Saldo do mês por mês (receitas − despesas) nos meses fechados anteriores a `month`. */
export function averageMonthlySurplus(movements: Movement[], month: string, months = 3) {
  const values = Array.from({ length: months }, (_, index) => {
    const target = shiftMonth(month, -(index + 1));
    const current = movements.filter((movement) => movement.date.startsWith(`${target}-`));
    return {
      month: target,
      netCents: sum(current.map((movement) => signedAmount(movement))),
      hasData: current.length > 0,
    };
  });
  const withData = values.filter((item) => item.hasData);
  return {
    months: values,
    monthsWithData: withData.length,
    averageCents: withData.length ? Math.round(sum(withData.map((item) => item.netCents)) / withData.length) : null,
  };
}

export type RecurringRuleLike = {
  id: string;
  kind: Movement["kind"];
  name: string;
  amountCents: number;
  category: string;
  frequency: "weekly" | "monthly" | "yearly";
  interval: number;
  isActive: boolean;
  isVariable: boolean;
};

/** Custo mensal equivalente de uma recorrência (semanal × 52/12, anual ÷ 12, respeitando o intervalo). */
export function monthlyEquivalent(rule: Pick<RecurringRuleLike, "amountCents" | "frequency" | "interval">) {
  const perYear = rule.frequency === "weekly" ? 52 / rule.interval : rule.frequency === "monthly" ? 12 / rule.interval : 1 / rule.interval;
  return Math.round((rule.amountCents * perYear) / 12);
}

function normalize(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Cobranças recorrentes ativas e pontos para conferir: duas recorrências com o mesmo valor e nome
 * parecido, ou gastos avulsos que repetem o valor de uma assinatura no mesmo mês. São apenas
 * indícios para a pessoa verificar, nunca uma afirmação de cobrança indevida.
 */
export function recurringCharges(rules: RecurringRuleLike[], movements: AssistantMovement[], month: string) {
  const active = rules.filter((rule) => rule.isActive && rule.kind === "expense");
  const items = active
    .map((rule) => ({ id: rule.id, name: rule.name, category: rule.category, amountCents: rule.amountCents, frequency: rule.frequency, interval: rule.interval, isVariable: rule.isVariable, monthlyCents: monthlyEquivalent(rule) }))
    .sort((left, right) => right.monthlyCents - left.monthlyCents);
  const toCheck: { reason: string; items: string[] }[] = [];
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const left = active[i];
      const right = active[j];
      const sameName = normalize(left.name) === normalize(right.name) || normalize(left.name).split(" ")[0] === normalize(right.name).split(" ")[0];
      if (left.amountCents === right.amountCents && sameName) toCheck.push({ reason: "Duas recorrências com o mesmo valor e nome parecido", items: [left.name, right.name] });
    }
  }
  for (const rule of active) {
    const looseRepeat = movements.filter((movement) => movement.kind === "expense" && movement.recurringRuleId === null
      && movement.date.startsWith(`${month}-`) && movement.amountCents === rule.amountCents
      && normalize(movement.description).includes(normalize(rule.name).split(" ")[0] ?? ""));
    if (looseRepeat.length) toCheck.push({ reason: "Gasto avulso no mês com o mesmo valor de uma recorrência", items: [rule.name, ...looseRepeat.map((movement) => `${movement.description} (${movement.date})`)] });
  }
  return {
    items,
    totalMonthlyCents: sum(items.map((item) => item.monthlyCents)),
    toCheck,
  };
}

/**
 * Simulação de meta sem juros nem rendimento (premissa explícita): com prazo, calcula o aporte
 * mensal; com aporte, calcula em quantos meses chega. Compara com a sobra média recente.
 */
export function simulateGoal({ targetCents, initialCents = 0, months = null, monthlyCents = null, averageSurplusCents = null }: {
  targetCents: number;
  initialCents?: number;
  months?: number | null;
  monthlyCents?: number | null;
  averageSurplusCents?: number | null;
}) {
  const remainingCents = Math.max(0, targetCents - initialCents);
  if (remainingCents === 0) {
    return { remainingCents, monthlyCents: 0, months: 0, fitsAverageSurplus: true as boolean | null, assumptions: ["Valor inicial já cobre o objetivo."] };
  }
  let resolvedMonths: number | null = null;
  let resolvedMonthly: number | null = null;
  if (months && months > 0) {
    resolvedMonths = Math.ceil(months);
    resolvedMonthly = Math.ceil(remainingCents / resolvedMonths);
  } else if (monthlyCents && monthlyCents > 0) {
    resolvedMonthly = monthlyCents;
    resolvedMonths = Math.ceil(remainingCents / monthlyCents);
  }
  return {
    remainingCents,
    monthlyCents: resolvedMonthly,
    months: resolvedMonths,
    fitsAverageSurplus: resolvedMonthly === null || averageSurplusCents === null ? null : resolvedMonthly <= averageSurplusCents,
    assumptions: [
      "Aportes iguais todo mês, sem juros, rendimento ou inflação.",
      averageSurplusCents === null ? "Sem meses anteriores registrados para comparar com a sobra média." : "Sobra média = receitas − despesas registradas nos últimos meses fechados.",
    ],
  };
}

/** Data mais recente entre os registros, para citar até quando os dados vão. */
export function latestRecordDate(movements: Pick<Movement, "date">[], today: string) {
  const past = movements.map((movement) => movement.date).filter((date) => date <= today).sort();
  return past.at(-1) ?? null;
}
