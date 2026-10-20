import { describe, expect, it } from "vitest";
import { parseAmounts, parseDate, parseDeadline, parsePeriods, understand, type UnderstandContext } from "./understand";

const context: UnderstandContext = {
  today: "2026-10-19",
  accounts: [
    { id: "nu", name: "Nubank", bank: "nubank" },
    { id: "it", name: "Itaú", bank: "itau" },
    { id: "wi", name: "Wise USD", bank: "wise" },
  ],
  goals: [{ id: "g1", name: "Viagem para o Japão" }],
};

describe("parseAmounts", () => {
  it("reads Brazilian money formats", () => {
    expect(parseAmounts("R$ 1.234,56")).toEqual([1234.56]);
    expect(parseAmounts("gastei 50 reais")).toEqual([50]);
    expect(parseAmounts("49,90 no ifood")).toEqual([49.9]);
    expect(parseAmounts("49.90 no ifood")).toEqual([49.9]);
    expect(parseAmounts("meta de 10 mil")).toEqual([10000]);
    expect(parseAmounts("1,5k")).toEqual([1500]);
    expect(parseAmounts("guardar mil reais")).toEqual([1000]);
  });

  it("ignores dates, days and durations", () => {
    expect(parseAmounts("paguei 80 dia 15")).toEqual([80]);
    expect(parseAmounts("juntar 5000 em 12 meses")).toEqual([5000]);
    expect(parseAmounts("gastei 30 em 15/10")).toEqual([30]);
    expect(parseAmounts("até 2027")).toEqual([]);
  });
});

describe("dates and periods", () => {
  it("parses relative dates", () => {
    expect(parseDate("ontem", "2026-10-19")).toBe("2026-10-18");
    expect(parseDate("dia 5", "2026-10-19")).toBe("2026-10-05");
    expect(parseDate("15/09", "2026-10-19")).toBe("2026-09-15");
  });

  it("parses periods in order", () => {
    expect(parsePeriods("mês passado vs este mês", "2026-10-19").map((item) => item.preset)).toEqual(["mes_passado", "este_mes"]);
    expect(parsePeriods("quanto gastei em setembro", "2026-10-19")[0]).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(parsePeriods("em dezembro", "2026-10-19")[0]).toMatchObject({ from: "2025-12-01" });
  });

  it("parses goal deadlines", () => {
    expect(parseDeadline("em 12 meses", "2026-10-19")).toEqual({ deadline: "2027-10-31", months: 12 });
    expect(parseDeadline("até dezembro", "2026-10-19").deadline).toBe("2026-12-31");
    expect(parseDeadline("até março", "2026-10-19").deadline).toBe("2027-03-31");
  });
});

describe("understand", () => {
  it("recognizes an expense with account, category and description", () => {
    const result = understand("gastei 50 no mercado ontem pelo nubank", context);
    expect(result).toMatchObject({ intent: "add_expense", amounts: [50], category: "Alimentação", accountId: "nu", date: "2026-10-18", description: "Mercado" });
  });

  it("recognizes income", () => {
    expect(understand("recebi 3500 de salário no itaú", context)).toMatchObject({ intent: "add_income", amounts: [3500], incomeCategory: "Salário", accountId: "it" });
  });

  it("recognizes goal creation with deadline", () => {
    const result = understand("criar meta para comprar um carro de 40 mil em 24 meses", context);
    expect(result).toMatchObject({ intent: "create_goal", amounts: [40000], months: 24, goalIcon: "car" });
    expect(result.goalName?.toLowerCase()).toContain("carro");
    expect(understand("criar meta de viagem para o japão de 15 mil em 18 meses", context).goalName).toBe("Viagem para o japão");
  });

  it("recognizes a contribution to an existing goal", () => {
    expect(understand("guardei 200 na viagem", context)).toMatchObject({ intent: "goal_contribution", goalId: "g1", amounts: [200] });
  });

  it("recognizes budget changes", () => {
    expect(understand("define o limite de alimentação para 800", context)).toMatchObject({ intent: "set_budget", category: "Alimentação", amounts: [800] });
  });

  it("recognizes balance updates per bank", () => {
    expect(understand("tenho 1200 no nubank", context)).toMatchObject({ intent: "set_balance", accountId: "nu", amounts: [1200] });
  });

  it("separates questions from actions", () => {
    expect(understand("quanto gastei com transporte mês passado?", context)).toMatchObject({ intent: "spending", category: "Transporte" });
    expect(understand("onde estou gastando mais?", context).intent).toBe("biggest");
    expect(understand("compare meus gastos deste mês com o mês passado", context).intent).toBe("compare");
    expect(understand("quanto ainda posso gastar?", context).intent).toBe("balance");
    expect(understand("quanto pago em assinaturas?", context).intent).toBe("recurring");
    expect(understand("consigo guardar 500 por mês?", context).intent).toBe("simulate_goal");
    expect(understand("o que é CDB?", context)).toMatchObject({ intent: "investment_explain", investmentType: "cdb_rdb" });
    expect(understand("quanto é 100 dólares em reais", context)).toMatchObject({ intent: "convert", currencies: ["USD", "BRL"] });
    expect(understand("quanto tenho em cada banco?", context).intent).toBe("banks");
    expect(understand("como economizar este mês?", context).intent).toBe("tips");
    expect(understand("abrir metas", context)).toMatchObject({ intent: "navigate", feature: "goals" });
    expect(understand("apliquei 1000 no cdb do nubank", context)).toMatchObject({ intent: "add_investment", investmentType: "cdb_rdb", accountId: "nu" });
  });

  it("treats a bare amount with a short note as an expense", () => {
    expect(understand("35 uber", context)).toMatchObject({ intent: "add_expense", category: "Transporte" });
  });
});

describe("regressions", () => {
  it("keeps round amounts that look like years and strips accented bank names", () => {
    expect(parseAmounts("investi 2000 no tesouro")).toEqual([2000]);
    expect(parseAmounts("meta de 5000 até 2027")).toEqual([5000]);
    expect(understand("paguei 1200 de aluguel hoje no itaú", context).description).toBe("Aluguel");
  });
});
