import { describe, expect, it } from "vitest";
import type { FinanceSnapshot } from "@/lib/finance/repository";
import { runAssistantTool, type ToolContext } from "./run-tool";
import { splitSuggestions } from "./use-assistant-chat";

const snapshot: FinanceSnapshot = {
  preferences: null,
  expenses: [
    { id: "1", kind: "expense", description: "Aluguel", amountCents: 150000, category: "Moradia", date: "2026-10-05", status: "paid", paidOn: "2026-10-05", notes: null, recurringRuleId: null, occurrenceDate: null, accountId: "nu", original: null },
    { id: "2", kind: "expense", description: "Mercado", amountCents: 50000, category: "Alimentação", date: "2026-10-08", status: "paid", paidOn: "2026-10-08", notes: null, recurringRuleId: null, occurrenceDate: null, accountId: null, original: null },
  ],
  recurringRules: [],
  budgets: [{ category: "Alimentação", limitCents: 80000, alertAt: 80 }],
  savingsGoals: [],
  accounts: [{ id: "nu", name: "Nubank", bank: "nubank", currency: "BRL", balanceCents: 300000, balanceReportedOn: "2026-10-01", createdOn: "2026-10-01" }],
  investments: [],
};

/** Intl usa espaço não separável depois de "R$". */
const parse = (content: string) => JSON.parse(content.replace(/ /g, " "));

const context: ToolContext = { snapshot, today: "2026-10-19", rates: { base: "BRL", date: "2026-10-17", rates: { USD: 0.2 } }, manualRates: {}, mode: "local" };

describe("runAssistantTool", () => {
  it("returns computed totals and a card, citing the data source", () => {
    const outcome = runAssistantTool("gastos_por_periodo", { periodo: "este_mes", agrupar_por: "categoria" }, context);
    const data = parse(outcome.content);
    expect(data.total).toBe("R$ 2.000,00");
    expect(data.grupos[0]).toMatchObject({ nome: "Moradia", participacao: "75%" });
    expect(data.registros_ate).toBe("2026-10-08");
    expect(outcome.card?.kind).toBe("bars");
  });

  it("filters by bank name and reports unknown accounts as errors", () => {
    expect(parse(runAssistantTool("gastos_por_periodo", { periodo: "este_mes", conta: "nubank" }, context).content).total).toBe("R$ 1.500,00");
    expect(runAssistantTool("gastos_por_periodo", { periodo: "este_mes", conta: "Itaú" }, context).isError).toBe(true);
  });

  it("uses the account balances for the balance forecast", () => {
    const data = parse(runAssistantTool("saldo_e_previsao", {}, context).content);
    expect(data.saldo_disponivel).toBe("R$ 1.500,00");
    expect(data.premissas.length).toBeGreaterThan(0);
  });

  it("converts currencies with the quote date", () => {
    const data = parse(runAssistantTool("converter_moeda", { valor: 100, de: "USD", para: "BRL" }, context).content);
    expect(data.convertido).toBe("R$ 500,00");
    expect(data.data_da_cotacao).toBe("2026-10-17");
  });

  it("validates inputs and never executes proposals", () => {
    expect(runAssistantTool("simular_meta", { valor_alvo: -1 }, context).isError).toBe(true);
    expect(runAssistantTool("nao_existe", {}, context).isError).toBe(true);
    const outcome = runAssistantTool("propor_ajustar_orcamento", { categoria: "Alimentação", limite: 900 }, context);
    expect(outcome.proposal).toEqual({ kind: "set_budget", category: "Alimentação", limitCents: 90000, previousCents: 80000 });
    expect(snapshot.budgets[0].limitCents).toBe(80000);
  });
});

describe("splitSuggestions", () => {
  it("separates quick replies from the text, also while streaming", () => {
    expect(splitSuggestions("Tudo certo.\n<sugestoes>A|B|C</sugestoes>")).toEqual({ text: "Tudo certo.", suggestions: ["A", "B", "C"] });
    expect(splitSuggestions("Parcial <sug").text).toBe("Parcial");
    expect(splitSuggestions("Sem sugestões").suggestions).toEqual([]);
  });
});
