import { describe, expect, it } from "vitest";
import { buildAlerts, buildInsights, buildNotifications, buildReminders, maxInsights, type NotificationInput } from "./notifications";
import { goalPace } from "./planning";

const off = {
  weeklyReview: { enabled: false, weekday: 0, time: "19:00" },
  monthlyBudget: { enabled: false, time: "09:00" },
  billsAhead: { enabled: false, daysBefore: 2, time: "09:00" },
};

function movement(id: string, overrides: Partial<NotificationInput["movements"][number]> = {}): NotificationInput["movements"][number] {
  return { id, kind: "expense", description: id, amountCents: 10000, status: "paid", date: "2026-10-10", paidOn: "2026-10-10", category: "Outros", recurringRuleId: null, ...overrides };
}

function input(overrides: Partial<NotificationInput> = {}): NotificationInput {
  return {
    now: new Date(2026, 9, 18, 10, 0),
    movements: [],
    budgets: [],
    goals: [],
    projectionCents: null,
    reminders: off,
    formatMoney: (cents) => `R$ ${(cents / 100).toFixed(2)}`,
    ...overrides,
  };
}

describe("alertas importantes", () => {
  it("avisa contas que vencem hoje, amanhã e as atrasadas, mas não as pagas", () => {
    const alerts = buildAlerts(input({ movements: [
      movement("Luz", { status: "pending", date: "2026-10-19", paidOn: null }),
      movement("Água", { status: "pending", date: "2026-10-18", paidOn: null }),
      movement("Internet", { status: "pending", date: "2026-10-12", paidOn: null }),
      movement("Aluguel", { status: "paid", date: "2026-10-19" }),
      movement("Salário", { kind: "income", status: "pending", date: "2026-10-19", paidOn: null }),
    ] }));
    expect(alerts.map((alert) => alert.title)).toEqual(["Internet está atrasada", "Vence hoje: Água", "Vence amanhã: Luz"]);
  });

  it("avisa orçamento a partir de 80% e quando passa do limite", () => {
    const alerts = buildAlerts(input({
      budgets: [{ category: "Alimentação", limitCents: 50000 }, { category: "Lazer", limitCents: 10000 }, { category: "Transporte", limitCents: 100000 }],
      movements: [
        movement("Mercado", { category: "Alimentação", amountCents: 42000 }),
        movement("Show", { category: "Lazer", amountCents: 15000 }),
        movement("Uber", { category: "Transporte", amountCents: 10000 }),
      ],
    }));
    expect(alerts.map((alert) => alert.title)).toEqual(["Lazer passou do limite", "Alimentação perto do limite"]);
    expect(alerts[1].body).toContain("84%");
  });

  it("avisa meta com prazo próximo e ritmo abaixo do planejado", () => {
    const goal = { id: "g", name: "Viagem", targetCents: 600000, deadline: "2026-12-20", createdOn: "2026-04-01", contributions: [{ amountCents: 100000, date: "2026-05-01", status: "done" as const }] };
    const alerts = buildAlerts(input({ goals: [goal] }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe("Viagem fora do ritmo");
    expect(alerts[0].body).toContain("3 meses");
  });

  it("não avisa meta fora do ritmo quando o prazo ainda está longe", () => {
    const goal = { id: "g", name: "Casa", targetCents: 6000000, deadline: "2028-12-20", createdOn: "2026-01-01", contributions: [] };
    expect(buildAlerts(input({ goals: [goal] }))).toHaveLength(0);
  });
});

describe("lembretes programados", () => {
  it("ficam desligados por padrão", () => {
    expect(buildReminders(input({ movements: [movement("Luz", { status: "pending", date: "2026-10-20", paidOn: null })] }))).toEqual([]);
  });

  it("revisão semanal só no dia e depois do horário escolhidos", () => {
    const reminders = { ...off, weeklyReview: { enabled: true, weekday: 0, time: "19:00" } };
    // 18/10/2026 é domingo.
    expect(buildReminders(input({ reminders, now: new Date(2026, 9, 18, 18, 59) }))).toHaveLength(0);
    expect(buildReminders(input({ reminders, now: new Date(2026, 9, 18, 19, 0) }))[0].title).toBe("Hora de revisar a semana");
    expect(buildReminders(input({ reminders, now: new Date(2026, 9, 19, 20, 0) }))).toHaveLength(0);
  });

  it("orçamento no início do mês e conta com antecedência escolhida", () => {
    const reminders = { ...off, monthlyBudget: { enabled: true, time: "09:00" }, billsAhead: { enabled: true, daysBefore: 2, time: "08:00" } };
    const result = buildReminders(input({
      reminders,
      now: new Date(2026, 10, 1, 9, 30),
      movements: [movement("Aluguel", { status: "scheduled", date: "2026-11-03", paidOn: null })],
    }));
    expect(result.map((item) => item.title)).toEqual(["Comece o mês pelo orçamento", "Aluguel vence em 2 dias"]);
    expect(buildReminders(input({ reminders, now: new Date(2026, 10, 10, 9, 30) }))).toHaveLength(0);
  });
});

describe("insights", () => {
  it("compara com o mesmo período do mês anterior e limita a quantidade", () => {
    const goal = { id: "g", name: "Viagem", targetCents: 100000, deadline: null, createdOn: "2026-01-01", contributions: [{ amountCents: 90000, date: "2026-09-01", status: "done" as const }] };
    const insights = buildInsights(input({
      projectionCents: 65000,
      goals: [goal],
      movements: [
        movement("Delivery set", { category: "Alimentação", amountCents: 20000, date: "2026-09-05" }),
        movement("Delivery fim", { category: "Alimentação", amountCents: 90000, date: "2026-09-28" }),
        movement("Delivery out", { category: "Alimentação", amountCents: 16400, date: "2026-10-05" }),
      ],
    }));
    expect(insights.length).toBeLessThanOrEqual(maxInsights);
    expect(insights.map((item) => item.title)).toEqual([
      "Você está perto de completar Viagem",
      "Você gastou 18% menos com Alimentação",
      "Fim do mês com R$ 650.00 disponíveis",
    ]);
  });

  it("nenhuma notificação vira confirmação de ação", () => {
    expect(buildNotifications(input()).every((item) => item.level !== ("confirmation" as string))).toBe(true);
  });
});

describe("ritmo da meta", () => {
  it("compara o guardado com o esperado para a data", () => {
    const base = { targetCents: 120000, deadline: "2027-01-01", createdOn: "2026-01-01" };
    expect(goalPace({ ...base, contributions: [{ amountCents: 30000, date: "2026-03-01", status: "done" }] }, "2026-07-02").status).toBe("behind");
    expect(goalPace({ ...base, contributions: [{ amountCents: 60000, date: "2026-03-01", status: "done" }] }, "2026-07-02").status).toBe("on_track");
    expect(goalPace({ ...base, contributions: [{ amountCents: 90000, date: "2026-03-01", status: "done" }] }, "2026-07-02").status).toBe("ahead");
    expect(goalPace({ ...base, deadline: null, contributions: [] }, "2026-07-02").status).toBe("no_deadline");
  });
});
