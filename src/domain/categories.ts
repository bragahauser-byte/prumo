/**
 * expense: gasto · income: entrada · transfer: movimentação interna (transferência entre contas próprias
 * ou pagamento de fatura do cartão). Movimentações internas não são gasto nem entrada e não mexem no saldo:
 * as compras do cartão já foram registradas uma a uma.
 */
export type TransactionKind = "expense" | "income" | "transfer";

export const expenseCategories = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Contas",
  "Assinaturas",
  "Lazer",
  "Compras",
  "Educação",
  "Outros",
] as const;

export const incomeCategories = [
  "Salário",
  "Freelance",
  "Reembolso",
  "Rendimentos",
  "Outras receitas",
] as const;

export const transferCategories = [
  "Pagamento de fatura",
  "Transferência entre contas",
] as const;

export function categoriesFor(kind: TransactionKind): readonly string[] {
  return kind === "income" ? incomeCategories : kind === "transfer" ? transferCategories : expenseCategories;
}

export function isTransferCategory(category: string) {
  return (transferCategories as readonly string[]).includes(category);
}

const keywords: Record<string, string[]> = {
  Moradia: ["aluguel", "condominio", "iptu", "reforma", "moveis"],
  Alimentação: ["mercado", "supermercado", "ifood", "restaurante", "padaria", "lanche", "almoco", "jantar", "cafe", "feira", "acougue", "pizza"],
  Transporte: ["uber", "99", "gasolina", "combustivel", "onibus", "metro", "estacionamento", "pedagio", "ipva", "oficina", "carro"],
  Saúde: ["farmacia", "remedio", "medico", "consulta", "dentista", "exame", "plano de saude", "academia", "terapia"],
  Contas: ["luz", "energia", "agua", "internet", "telefone", "celular", "gas", "fatura", "boleto"],
  Assinaturas: ["netflix", "spotify", "prime", "disney", "hbo", "max", "youtube", "icloud", "assinatura", "apple"],
  Lazer: ["cinema", "show", "bar", "viagem", "hotel", "passeio", "ingresso", "jogo"],
  Compras: ["roupa", "loja", "shopping", "presente", "amazon", "mercado livre", "shopee", "tenis"],
  Educação: ["curso", "faculdade", "escola", "livro", "mensalidade", "aula"],
  Salário: ["salario", "pagamento", "holerite", "adiantamento", "13o", "ferias"],
  Freelance: ["freela", "freelance", "projeto", "cliente", "job"],
  Reembolso: ["reembolso", "estorno", "devolucao", "pix de volta"],
  Rendimentos: ["rendimento", "juros", "dividendo", "cdb", "poupanca"],
  "Pagamento de fatura": ["fatura do cartao", "fatura cartao", "pagamento da fatura", "pagamento de fatura", "cartao de credito"],
  "Transferência entre contas": ["transferencia", "entre contas", "minha conta", "para mim", "ted", "doc"],
};

function normalize(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Sugere uma categoria pelas palavras da descrição; retorna null quando não há correspondência. */
export function suggestCategory(description: string, kind: TransactionKind): string | null {
  const text = ` ${normalize(description)} `;
  if (!text.trim()) return null;
  for (const category of categoriesFor(kind)) {
    const words = keywords[category] ?? [];
    if (words.some((word) => new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(text))) return category;
  }
  return null;
}

/** Quando a descrição parece uma movimentação interna (fatura do cartão, transferência própria). */
export function suggestTransfer(description: string): string | null {
  return suggestCategory(description, "transfer");
}
