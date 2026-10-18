import { beforeEach, describe, expect, it } from "vitest";
import { analyzeCategories, budgetAfterExpense, monthRange, previousRange, rangeMonth, spendingEntries } from "./category-analysis";
import { budgetLevel, currentBalance, summarizeMonth, type Movement } from "./planning";
import { createLocalFinanceRepository, type FinanceExpense } from "../lib/finance/repository";

function expense(id: string, amountCents: number, category: string, date = "2026-10-10", overrides: Partial<Movement> = {}): Movement {
  return { id, kind: "expense", amountCents, category, date, status: "paid", paidOn: date, recurringRuleId: null, ...overrides };
}

const october = monthRange("2026-10");
const foodBudget = { category: "Alimentação", limitCents: 40000, alertAt: 80 };

describe("consolidação de gastos por categoria", () => {
  it("soma as despesas da mesma categoria sem criar transação nova (critério 1)", () => {
    const movements = [expense("japones", 10000, "Alimentação"), expense("arabe", 20000, "Alimentação")];
    const analysis = analyzeCategories(movements, october);
    expect(analysis.categories).toEqual([expect.objectContaining({ category: "Alimentação", amountCents: 30000, count: 2, share: 1 })]);
    expect(movements).toHaveLength(2);
    expect(spendingEntries(movements, october, "Alimentação").map((item) => item.id)).toEqual(["japones", "arabe"]);
  });

  it("mantém outra categoria separada e calcula a participação (critério 2)", () => {
    const analysis = analyzeCategories([expense("j", 10000, "Alimentação"), expense("a", 20000, "Alimentação"), expense("farmacia", 5000, "Saúde")], october);
    expect(analysis.totalCents).toBe(35000);
    expect(analysis.categories.map((item) => [item.category, item.amountCents])).toEqual([["Alimentação", 30000], ["Saúde", 5000]]);
    expect(analysis.categories[1].share).toBeCloseTo(5000 / 35000);
  });

  it("mostra uso do orçamento, restante e excedente (critérios 3 e 4)", () => {
    const movements = [expense("j", 10000, "Alimentação"), expense("a", 20000, "Alimentação")];
    const before = analyzeCategories(movements, october, [foodBudget]).categories[0].budget!;
    expect(before.ratio).toBe(0.75);
    expect(before.remainingCents).toBe(10000);
    expect(before.level).toBe("ok");

    const after = analyzeCategories([...movements, expense("mercado", 15000, "Alimentação")], october, [foodBudget]).categories[0];
    expect(after.amountCents).toBe(45000);
    expect(after.budget).toMatchObject({ remainingCents: -5000, level: "over" });
    expect(budgetAfterExpense(movements, foodBudget, "2026-10", 15000)).toMatchObject({ spentCents: 45000, excessCents: 5000, level: "over" });
  });

  it("recalcula ao editar ou excluir lançamentos (critério 5)", async () => {
    localStorage.clear();
    const repository = createLocalFinanceRepository();
    const base = { kind: "expense" as const, status: "paid" as const, notes: null, recurringRuleId: null, occurrenceDate: null };
    const first: FinanceExpense = { ...base, id: "japones", description: "Restaurante japonês", amountCents: 10000, category: "Alimentação", date: "2026-10-05", paidOn: "2026-10-05" };
    await repository.saveExpense(first);
    await repository.saveExpense({ ...base, id: "arabe", description: "Restaurante árabe", amountCents: 20000, category: "Alimentação", date: "2026-10-06", paidOn: "2026-10-06" });
    const total = async () => analyzeCategories((await repository.load()).expenses, october).categories.find((item) => item.category === "Alimentação")?.amountCents ?? 0;
    expect(await total()).toBe(30000);
    await repository.saveExpense({ ...first, amountCents: 12000 });
    expect(await total()).toBe(32000);
    await repository.saveExpense({ ...first, amountCents: 12000, category: "Lazer" });
    expect(await total()).toBe(20000);
    await repository.deleteExpense("arabe");
    expect(await total()).toBe(0);
  });

  it("não mistura despesas de meses diferentes (critério 6)", () => {
    const movements = [expense("set", 9000, "Alimentação", "2026-09-30"), expense("out", 10000, "Alimentação", "2026-10-01"), expense("nov", 7000, "Alimentação", "2026-11-01")];
    expect(analyzeCategories(movements, october).totalCents).toBe(10000);
    expect(analyzeCategories(movements, monthRange("2026-09")).totalCents).toBe(9000);
    expect(analyzeCategories(movements, { from: "2026-09-30", to: "2026-10-01" }).totalCents).toBe(19000);
    expect(analyzeCategories(movements, october).previousTotalCents).toBe(9000);
  });
});

describe("regras de consistência", () => {
  const transferBase = { status: "paid" as const, recurringRuleId: null };

  it("transferência entre contas próprias e pagamento de fatura não são gasto nem mudam o saldo", () => {
    const movements: Movement[] = [
      expense("compra-cartao", 30000, "Compras"),
      { ...transferBase, id: "fatura", kind: "transfer", amountCents: 30000, category: "Pagamento de fatura", date: "2026-10-15", paidOn: "2026-10-15" },
      { ...transferBase, id: "poupanca", kind: "transfer", amountCents: 50000, category: "Transferência entre contas", date: "2026-10-16", paidOn: "2026-10-16" },
    ];
    expect(analyzeCategories(movements, october).totalCents).toBe(30000);
    expect(summarizeMonth(movements, "2026-10").expenseCents).toBe(30000);
    expect(currentBalance(100000, "2026-10-01", movements)).toBe(70000);
  });

  it("categorias sem orçamento também aparecem; orçamento só vale para mês inteiro", () => {
    const movements = [expense("a", 10000, "Alimentação"), expense("b", 8000, "Transporte")];
    const analysis = analyzeCategories(movements, october, [foodBudget]);
    expect(analysis.categories.find((item) => item.category === "Transporte")?.budget).toBeNull();
    expect(analyzeCategories(movements, { from: "2026-10-01", to: "2026-10-15" }, [foodBudget]).categories[0].budget).toBeNull();
  });

  it("categoria que só teve gasto no período anterior aparece com zero", () => {
    const analysis = analyzeCategories([expense("set", 5000, "Lazer", "2026-09-10")], october);
    expect(analysis.categories).toEqual([expect.objectContaining({ category: "Lazer", amountCents: 0, previousCents: 5000, change: -1 })]);
  });

  it("período anterior respeita o tamanho de cada mês e de intervalos livres", () => {
    expect(previousRange(monthRange("2026-03"))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(previousRange(monthRange("2028-03"))).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(previousRange(monthRange("2026-01"))).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(previousRange({ from: "2026-10-11", to: "2026-10-20" })).toEqual({ from: "2026-10-01", to: "2026-10-10" });
    expect(rangeMonth({ from: "2026-10-01", to: "2026-10-30" })).toBeNull();
  });

  it("estados do orçamento: normal, próximo, atingido e ultrapassado, com alerta configurável", () => {
    expect(budgetLevel(30000, 40000, 80)).toBe("ok");
    expect(budgetLevel(32000, 40000, 80)).toBe("warning");
    expect(budgetLevel(30000, 40000, 70)).toBe("warning");
    expect(budgetLevel(40000, 40000, 80)).toBe("reached");
    expect(budgetLevel(40001, 40000, 80)).toBe("over");
    expect(budgetLevel(39000, 40000, 100)).toBe("ok");
  });
});

beforeEach(() => localStorage.clear());
