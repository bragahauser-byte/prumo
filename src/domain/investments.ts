/**
 * Tipos de aplicação e textos educativos. O Prumo só registra o que a pessoa informa:
 * não consulta corretoras, não estima rendimento e não recomenda produtos.
 */
export const investmentTypes = [
  {
    id: "poupanca",
    name: "Poupança",
    short: "Poupança",
    description: "Dinheiro guardado no banco que rende juros. É simples e popular, mas pode render menos que outras alternativas.",
  },
  {
    id: "cdb_rdb",
    name: "CDB e RDB",
    short: "CDB/RDB",
    description: "Você empresta dinheiro ao banco e recebe juros. Alguns permitem resgate imediato; outros exigem que o dinheiro fique aplicado até um prazo.",
  },
  {
    id: "tesouro",
    name: "Tesouro Direto",
    short: "Tesouro",
    description: "Você empresta dinheiro ao governo federal. Há títulos pensados para reserva, para objetivos de longo prazo e para proteção contra a inflação.",
  },
  {
    id: "acoes",
    name: "Ações",
    short: "Ações",
    description: "Pequenas participações em empresas. O ganho pode vir da valorização ou de dividendos, e há risco de perda.",
  },
  {
    id: "fiis",
    name: "Fundos imobiliários (FIIs)",
    short: "FIIs",
    description: "Fundos ligados a imóveis ou a títulos imobiliários, com rendimentos periódicos, sem precisar comprar um imóvel inteiro.",
  },
  {
    id: "fundos_etfs",
    name: "Fundos de investimento e ETFs",
    short: "Fundos/ETFs",
    description: "Reúnem diferentes ativos em uma carteira. ETFs são negociados na bolsa e podem acompanhar índices.",
  },
  {
    id: "lci_lca",
    name: "LCI e LCA",
    short: "LCI/LCA",
    description: "Títulos bancários ligados aos setores imobiliário e do agronegócio. Para pessoas físicas, costumam ter isenção de IR, conforme as regras aplicáveis.",
  },
  {
    id: "cripto",
    name: "Criptomoedas",
    short: "Cripto",
    description: "Bitcoin e outros ativos digitais. Têm grandes oscilações de preço e riscos elevados.",
  },
] as const;

export type InvestmentType = (typeof investmentTypes)[number]["id"];

export const investmentTypeIds = investmentTypes.map((item) => item.id) as [InvestmentType, ...InvestmentType[]];

export function investmentTypeName(type: string, variant: "name" | "short" = "name") {
  const found = investmentTypes.find((item) => item.id === type);
  return found ? found[variant] : "Outro";
}

export type InvestmentLike = {
  type: string;
  institution: string;
  appliedCents: number;
  currentCents: number | null;
  date: string;
};

/**
 * Totais da carteira. O valor atual usa o que a pessoa informou; quando não há valor atual,
 * conta o valor aplicado (sem estimar rendimento).
 */
export function summarizeInvestments(investments: InvestmentLike[]) {
  const byType = new Map<string, { appliedCents: number; currentCents: number; count: number }>();
  let appliedCents = 0;
  let currentCents = 0;
  let withCurrentValue = 0;
  for (const item of investments) {
    const current = item.currentCents ?? item.appliedCents;
    appliedCents += item.appliedCents;
    currentCents += current;
    if (item.currentCents !== null) withCurrentValue += 1;
    const entry = byType.get(item.type) ?? { appliedCents: 0, currentCents: 0, count: 0 };
    entry.appliedCents += item.appliedCents;
    entry.currentCents += current;
    entry.count += 1;
    byType.set(item.type, entry);
  }
  const distribution = [...byType.entries()]
    .map(([type, entry]) => ({ type, ...entry, share: currentCents > 0 ? entry.currentCents / currentCents : 0 }))
    .sort((left, right) => right.currentCents - left.currentCents);
  return {
    appliedCents,
    currentCents,
    differenceCents: currentCents - appliedCents,
    count: investments.length,
    withCurrentValue,
    distribution,
  };
}

/**
 * Carteira agrupada por instituição (nome sem diferença de maiúsculas e acentos), da maior para a menor.
 * Mesmo critério de valor do resumo: valor atual informado ou, sem ele, o aplicado.
 */
export function investmentsByInstitution<T extends InvestmentLike>(investments: T[]) {
  const key = (name: string) => name.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const groups = new Map<string, { name: string; appliedCents: number; currentCents: number; items: T[] }>();
  let total = 0;
  for (const item of investments) {
    const current = item.currentCents ?? item.appliedCents;
    total += current;
    const id = key(item.institution) || "-";
    const entry = groups.get(id) ?? { name: item.institution.trim() || "Sem instituição", appliedCents: 0, currentCents: 0, items: [] };
    entry.appliedCents += item.appliedCents;
    entry.currentCents += current;
    entry.items.push(item);
    groups.set(id, entry);
  }
  return [...groups.entries()]
    .map(([id, entry]) => ({ id, ...entry, count: entry.items.length, share: total > 0 ? entry.currentCents / total : 0 }))
    .sort((left, right) => right.currentCents - left.currentCents);
}
