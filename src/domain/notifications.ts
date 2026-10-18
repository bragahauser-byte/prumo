import { budgetUsage, goalPace, inMonth, unusualIncreases, type BudgetLike, type GoalLike, type Movement } from "./planning";

/**
 * Sistema de notificações do Prumo em quatro níveis:
 * 1. alertas importantes — prazo ou situação relevante, sempre com uma ação útil;
 * 2. lembretes programados — o usuário escolhe frequência e horário (todos desligados por padrão);
 * 3. insights — poucos e relevantes, com contexto e próximo passo;
 * 4. confirmações — ficam na interface (toast), nunca viram notificação; por isso não aparecem aqui.
 */
export type NotificationLevel = "alert" | "reminder" | "insight";

export type AppNotification = {
  /** Estável entre execuções: usado para não repetir a mesma notificação. */
  id: string;
  level: NotificationLevel;
  title: string;
  body: string;
  href: string;
  action: string;
};

export type ReminderInput = {
  weeklyReview: { enabled: boolean; weekday: number; time: string };
  monthlyBudget: { enabled: boolean; time: string };
  billsAhead: { enabled: boolean; daysBefore: number; time: string };
};

export type NotificationInput = {
  /** Data e hora locais no momento do cálculo. */
  now: Date;
  movements: (Movement & { description: string })[];
  budgets: BudgetLike[];
  goals: (GoalLike & { id: string; name: string; createdOn: string })[];
  projectionCents: number | null;
  reminders: ReminderInput;
  formatMoney: (cents: number) => string;
};

export const maxInsights = 3;

const weekdays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function weekdayName(index: number) {
  return weekdays[index] ?? weekdays[0];
}

function localDate(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function localTime(now: Date) {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function buildAlerts(input: NotificationInput): AppNotification[] {
  const today = localDate(input.now);
  const month = today.slice(0, 7);
  const tomorrow = shiftDate(today, 1);
  const { formatMoney } = input;
  const unpaidBills = input.movements.filter((movement) => movement.kind === "expense" && movement.status !== "paid");
  const alerts: AppNotification[] = [];

  const overdue = unpaidBills.filter((bill) => bill.date < today);
  if (overdue.length) {
    const total = overdue.reduce((sum, bill) => sum + bill.amountCents, 0);
    alerts.push({
      id: `overdue:${today}`,
      level: "alert",
      title: overdue.length === 1 ? `${overdue[0].description} está atrasada` : `${plural(overdue.length, "conta atrasada", "contas atrasadas")}`,
      body: `${formatMoney(total)} em aberto. Se já pagou, marque como paga para manter o saldo certo.`,
      href: "/bills",
      action: "Ver agenda",
    });
  }

  const dueSoon = unpaidBills.filter((item) => item.date === today || item.date === tomorrow).sort((left, right) => left.date.localeCompare(right.date));
  for (const bill of dueSoon) {
    const isToday = bill.date === today;
    alerts.push({
      id: `due:${bill.id}:${bill.date}:${isToday ? "today" : "tomorrow"}`,
      level: "alert",
      title: `${isToday ? "Vence hoje" : "Vence amanhã"}: ${bill.description}`,
      body: `${formatMoney(bill.amountCents)}. Pague no seu banco e marque aqui quando estiver feito.`,
      href: "/bills",
      action: "Ver conta",
    });
  }

  for (const budget of budgetUsage(input.budgets, input.movements, month)) {
    if (budget.level === "ok") continue;
    const over = budget.level === "over";
    alerts.push({
      id: `budget:${budget.category}:${month}:${budget.level}`,
      level: "alert",
      title: over ? `${budget.category} passou do limite` : `${budget.category} perto do limite`,
      body: over
        ? `${formatMoney(-budget.remainingCents)} acima do limite de ${formatMoney(budget.limitCents)}. Vale segurar os próximos gastos dessa categoria.`
        : `Você já usou ${Math.round(budget.ratio * 100)}% do limite. Restam ${formatMoney(budget.remainingCents)} até o fim do mês.`,
      href: "/budgets",
      action: "Ver orçamento",
    });
  }

  for (const goal of input.goals) {
    const pace = goalPace(goal, today);
    const { monthsLeft, monthlyNeededCents, remainingCents } = pace.progress;
    if (pace.status !== "behind" || monthsLeft === null || monthsLeft > 3 || monthlyNeededCents === null) continue;
    alerts.push({
      id: `goal-pace:${goal.id}:${month}`,
      level: "alert",
      title: `${goal.name} fora do ritmo`,
      body: `Faltam ${formatMoney(remainingCents)} e ${plural(monthsLeft, "mês", "meses")}. Para chegar no prazo, guarde ${formatMoney(monthlyNeededCents)} por mês.`,
      href: `/goals/detail?id=${goal.id}`,
      action: "Ver meta",
    });
  }

  return alerts;
}

export function buildReminders(input: NotificationInput): AppNotification[] {
  const today = localDate(input.now);
  const time = localTime(input.now);
  const { weeklyReview, monthlyBudget, billsAhead } = input.reminders;
  const { formatMoney } = input;
  const reminders: AppNotification[] = [];

  if (weeklyReview.enabled && input.now.getDay() === weeklyReview.weekday && time >= weeklyReview.time) {
    const weekStart = shiftDate(today, -6);
    const week = input.movements.filter((movement) => movement.kind === "expense" && movement.date >= weekStart && movement.date <= today);
    const total = week.reduce((sum, movement) => sum + movement.amountCents, 0);
    reminders.push({
      id: `weekly-review:${today}`,
      level: "reminder",
      title: "Hora de revisar a semana",
      body: week.length
        ? `${plural(week.length, "despesa", "despesas")} nos últimos 7 dias, somando ${formatMoney(total)}. Confira se falta registrar algo.`
        : "Nenhuma despesa nos últimos 7 dias. Faltou registrar alguma coisa?",
      href: "/transactions",
      action: "Revisar despesas",
    });
  }

  const dayOfMonth = Number(today.slice(8, 10));
  if (monthlyBudget.enabled && dayOfMonth <= 3 && (dayOfMonth > 1 || time >= monthlyBudget.time)) {
    reminders.push({
      id: `monthly-budget:${today.slice(0, 7)}`,
      level: "reminder",
      title: "Comece o mês pelo orçamento",
      body: input.budgets.length
        ? `Confira os ${plural(input.budgets.length, "limite", "limites")} antes dos primeiros gastos do mês.`
        : "Defina limites para as categorias que mais pesam e acompanhe ao longo do mês.",
      href: "/budgets",
      action: "Conferir orçamento",
    });
  }

  // Com 1 dia de antecedência, o alerta "vence amanhã" já cobre o aviso.
  if (billsAhead.enabled && billsAhead.daysBefore > 1 && time >= billsAhead.time) {
    const target = shiftDate(today, billsAhead.daysBefore);
    for (const bill of input.movements.filter((movement) => movement.kind === "expense" && movement.status !== "paid" && movement.date === target)) {
      reminders.push({
        id: `bill-ahead:${bill.id}:${bill.date}`,
        level: "reminder",
        title: `${bill.description} vence em ${billsAhead.daysBefore} dias`,
        body: `${formatMoney(bill.amountCents)}. Separe o valor para pagar em dia.`,
        href: "/bills",
        action: "Ver conta",
      });
    }
  }

  return reminders;
}

export function buildInsights(input: NotificationInput): AppNotification[] {
  const today = localDate(input.now);
  const month = today.slice(0, 7);
  const day = today.slice(8, 10);
  const { formatMoney } = input;
  const ranked: { score: number; item: AppNotification }[] = [];

  if (input.projectionCents !== null && input.projectionCents < 0) {
    ranked.push({ score: 100, item: {
      id: `projection-negative:${month}`,
      level: "insight",
      title: "O mês pode fechar no negativo",
      body: `Com as contas previstas, faltariam ${formatMoney(-input.projectionCents)} no fim do mês. Veja onde dá para ajustar.`,
      href: "/reports",
      action: "Ver relatório",
    } });
  }

  for (const goal of input.goals) {
    const pace = goalPace(goal, today);
    if (pace.status === "complete" || pace.progress.ratio < 0.8) continue;
    ranked.push({ score: 80 + pace.progress.ratio * 10, item: {
      id: `goal-near:${goal.id}`,
      level: "insight",
      title: `Você está perto de completar ${goal.name}`,
      body: `${Math.round(pace.progress.ratio * 100)}% guardado. Faltam só ${formatMoney(pace.progress.remainingCents)}.`,
      href: `/goals/detail?id=${goal.id}`,
      action: "Guardar agora",
    } });
  }

  // Compara o mês até hoje com o mesmo período do mês anterior, para não confundir mês parcial com mês fechado.
  const previousMonth = (() => {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return date.toISOString().slice(0, 7);
  })();
  const totals = (target: string) => {
    const map = new Map<string, number>();
    for (const movement of input.movements) {
      if (movement.kind !== "expense" || !inMonth(movement.date, target) || movement.date.slice(8, 10) > day) continue;
      map.set(movement.category, (map.get(movement.category) ?? 0) + movement.amountCents);
    }
    return map;
  };
  const current = totals(month);
  const previous = totals(previousMonth);
  const savings = [...previous.entries()]
    .map(([category, before]) => ({ category, before, now: current.get(category) ?? 0 }))
    .filter((entry) => entry.before >= 5000 && entry.now <= entry.before * 0.85)
    .sort((left, right) => (right.before - right.now) - (left.before - left.now));
  if (savings[0]) {
    const { category, before, now } = savings[0];
    const percent = Math.round((1 - now / before) * 100);
    ranked.push({ score: 60, item: {
      id: `less-spending:${category}:${month}`,
      level: "insight",
      title: `Você gastou ${percent}% menos com ${category}`,
      body: `${formatMoney(now)} até agora, contra ${formatMoney(before)} no mesmo período do mês passado. Bom ritmo.`,
      href: "/reports",
      action: "Ver categorias",
    } });
  }

  const increase = unusualIncreases(input.movements, month)[0];
  if (increase) {
    ranked.push({ score: 70, item: {
      id: `unusual:${increase.category}:${month}`,
      level: "insight",
      title: `${increase.category} acima do normal`,
      body: `${formatMoney(increase.currentCents)} neste mês, contra média de ${formatMoney(increase.averageCents)} nos três anteriores. Vale olhar os registros.`,
      href: "/reports",
      action: "Ver relatório",
    } });
  }

  if (input.projectionCents !== null && input.projectionCents >= 0) {
    ranked.push({ score: 40, item: {
      id: `projection:${month}`,
      level: "insight",
      title: `Fim do mês com ${formatMoney(input.projectionCents)} disponíveis`,
      body: "Mantendo o ritmo atual e com as contas previstas pagas. Que tal guardar parte disso numa meta?",
      href: "/goals",
      action: "Ver metas",
    } });
  }

  return ranked.sort((left, right) => right.score - left.score).slice(0, maxInsights).map((entry) => entry.item);
}

export function buildNotifications(input: NotificationInput): AppNotification[] {
  return [...buildAlerts(input), ...buildReminders(input), ...buildInsights(input)];
}
