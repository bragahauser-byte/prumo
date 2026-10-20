/**
 * Entendimento de linguagem do assistente, sem modelo de IA: regras em português que reconhecem
 * a intenção do pedido e extraem valores, datas, períodos, categorias, bancos e metas.
 * Tudo roda no aparelho; nenhum texto sai do navegador e não há custo por pergunta.
 */
import { bankIdFromName, bankName } from "../banks";
import { expenseCategories, incomeCategories, suggestCategory } from "../categories";
import { currencyCodes, type CurrencyCode } from "../currencies";
import { investmentTypes, type InvestmentType } from "../investments";
import { lastDayOfMonth, shiftMonth } from "../planning";
import type { PeriodPreset } from "./calculations";

export type Intent =
  | "greeting" | "thanks" | "help" | "affirm" | "deny" | "smalltalk"
  | "add_expense" | "add_income" | "create_goal" | "goal_contribution" | "set_budget" | "set_balance" | "add_investment"
  | "spending" | "income" | "compare" | "balance" | "recurring" | "simulate_goal"
  | "investments" | "investment_explain" | "convert" | "goals_status" | "budgets_status" | "banks"
  | "tips" | "biggest" | "navigate" | "upcoming" | "unknown";

export type FeatureId = "goals" | "budgets" | "bills" | "reports" | "investments" | "learn" | "transactions" | "accounts" | "add" | "notifications" | "profile" | "categories";

export type PeriodSpec = { preset: PeriodPreset; from?: string; to?: string; label: string };

export type Understanding = {
  intent: Intent;
  normalized: string;
  /** Valores em unidades da moeda (150.5 = R$ 150,50), na ordem em que aparecem. */
  amounts: number[];
  period: PeriodSpec | null;
  /** Segundo período, quando o texto cita dois (comparações). */
  otherPeriod: PeriodSpec | null;
  date: string | null;
  deadline: string | null;
  months: number | null;
  category: string | null;
  incomeCategory: string | null;
  accountId: string | null;
  goalId: string | null;
  currencies: CurrencyCode[];
  investmentType: InvestmentType | null;
  feature: FeatureId | null;
  groupByBank: boolean;
  description: string | null;
  goalName: string | null;
  goalIcon: string;
};

export type UnderstandContext = {
  today: string;
  accounts: { id: string; name: string; bank: string }[];
  goals: { id: string; name: string }[];
};

/** Minúsculas, sem acentos e com espaços simples. */
export function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const has = (text: string, pattern: RegExp) => pattern.test(text);

const monthNames = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const pad = (value: number) => String(value).padStart(2, "0");

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function shiftDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * Remove do texto o que não é valor monetário (datas, dias, prazos, percentuais, horários)
 * para que "dia 15" ou "em 12 meses" não virem dinheiro.
 */
function stripNonMoney(text: string) {
  return text
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\bdia\s+\d{1,2}\b/g, " ")
    .replace(/\b\d+\s*(meses|mes|anos|ano|dias|semanas|semana|vezes|x)\b/g, " ")
    .replace(/\b\d+(,\d+)?\s*%/g, " ")
    .replace(/\b\d{1,2}h(\d{2})?\b/g, " ")
    .replace(/\b(ate|em|ano de|fim de|final de)\s+(o fim de |o final de )?(19|20)\d{2}\b(?!\s*(reais|real|mil|k|dolares|euros|,\d))/g, " ");
}

/** Valores monetários em pt-BR: "R$ 1.234,56", "50 reais", "49,90", "2 mil", "1,5k", "mil reais", "1 milhão". */
export function parseAmounts(text: string): number[] {
  const source = stripNonMoney(normalizeText(text));
  const values: number[] = [];
  const pattern = /(?:r\$|us\$|\$|€|£)?\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:([.,])(\d{1,2}))?(?!\d)\s*(mil\b|k\b|milhao\b|milhoes\b)?/g;
  for (const match of source.matchAll(pattern)) {
    const [, whole, separator, fraction, multiplier] = match;
    let value = Number(whole.replace(/\./g, ""));
    if (fraction) {
      // "49.90" (ponto com 2 casas) também é decimal; "1.500" já foi tratado como milhar.
      if (separator === "," || fraction.length === 2) value += Number(fraction.padEnd(2, "0")) / 100;
    }
    if (multiplier === "mil" || multiplier === "k") value *= 1000;
    if (multiplier === "milhao" || multiplier === "milhoes") value *= 1_000_000;
    if (value > 0 && value <= 100_000_000) values.push(Math.round(value * 100) / 100);
  }
  if (!values.length && /\bmil (reais|real|conto|pila)\b|\b(de|com|uns?) mil\b/.test(source)) values.push(1000);
  return values;
}

/** Data mencionada ("hoje", "ontem", "amanhã", "dia 15", "15/10", "segunda") em AAAA-MM-DD. */
export function parseDate(text: string, today: string): string | null {
  const source = normalizeText(text);
  if (/\banteontem\b/.test(source)) return shiftDays(today, -2);
  if (/\bontem\b/.test(source)) return shiftDays(today, -1);
  if (/\bamanha\b/.test(source)) return shiftDays(today, 1);
  if (/\bhoje\b/.test(source)) return today;
  const [year, month] = today.split("-").map(Number);
  const full = source.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (full) {
    const day = Number(full[1]);
    const monthNumber = Number(full[2]);
    const yearNumber = full[3] ? Number(full[3].length === 2 ? `20${full[3]}` : full[3]) : year;
    if (validDate(yearNumber, monthNumber, day)) return `${yearNumber}-${pad(monthNumber)}-${pad(day)}`;
  }
  const named = source.match(/\b(?:dia )?(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/);
  if (named) {
    const monthNumber = monthNames.indexOf(named[2]) + 1;
    const day = Number(named[1]);
    if (validDate(year, monthNumber, day)) return `${year}-${pad(monthNumber)}-${pad(day)}`;
  }
  const dayOnly = source.match(/\bdia (\d{1,2})\b/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (validDate(year, month, day)) return `${year}-${pad(month)}-${pad(day)}`;
  }
  const weekdays = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  const weekday = weekdays.findIndex((name) => new RegExp(`\\b(na |no |nessa |nesse |ultima |ultimo )?${name}(-feira)?\\b`).test(source));
  if (weekday >= 0) {
    const current = new Date(`${today}T12:00:00Z`).getUTCDay();
    const back = (current - weekday + 7) % 7 || 7;
    return shiftDays(today, -back);
  }
  return null;
}

function monthPeriod(monthKey: string, label: string): PeriodSpec {
  return { preset: "personalizado", from: `${monthKey}-01`, to: lastDayOfMonth(monthKey), label };
}

/** Períodos citados no texto, na ordem em que aparecem. */
export function parsePeriods(text: string, today: string): PeriodSpec[] {
  const source = normalizeText(text);
  const month = today.slice(0, 7);
  const found: { index: number; period: PeriodSpec }[] = [];
  const add = (pattern: RegExp, period: PeriodSpec) => {
    const match = source.match(pattern);
    if (match?.index !== undefined && !found.some((item) => item.period.label === period.label)) found.push({ index: match.index, period });
  };
  add(/\b(mes passado|ultimo mes|mes anterior)\b/, { preset: "mes_passado", label: "no mês passado" });
  add(/\b(este|esse|neste|nesse|desse|deste) mes\b|\b(do|no) mes\b(?! (passado|anterior|que vem))|\bmes atual\b/, { preset: "este_mes", label: "neste mês" });
  add(/\b(ultimos|nos) 30 dias\b|\bultimo(s)? (um )?mes(es)? corrido/, { preset: "ultimos_30_dias", label: "nos últimos 30 dias" });
  add(/\b(ultimos|nos) (3|tres) meses\b|\btrimestre\b/, { preset: "ultimos_3_meses", label: "nos últimos 3 meses" });
  add(/\b(este|esse|neste|nesse|no) ano\b|\bdo ano\b/, { preset: "este_ano", label: "neste ano" });
  add(/\bhoje\b/, { preset: "personalizado", from: today, to: today, label: "hoje" });
  add(/\bontem\b/, { preset: "personalizado", from: shiftDays(today, -1), to: shiftDays(today, -1), label: "ontem" });
  add(/\b(esta|essa|nesta|nessa) semana\b|\bna semana\b|\bultimos 7 dias\b/, { preset: "personalizado", from: shiftDays(today, -6), to: today, label: "nos últimos 7 dias" });
  add(/\bsemana passada\b/, { preset: "personalizado", from: shiftDays(today, -13), to: shiftDays(today, -7), label: "na semana passada" });
  monthNames.forEach((name, index) => {
    const match = source.match(new RegExp(`\\b(em|de|no mes de|do mes de)? ?${name}\\b(?! de \\d)`));
    if (match?.index === undefined || /\b\d{1,2} de $/.test(source.slice(0, match.index + 1))) return;
    let key = `${month.slice(0, 4)}-${pad(index + 1)}`;
    if (key > month) key = shiftMonth(key, -12);
    const label = `em ${name === "marco" ? "março" : name}`;
    if (!found.some((item) => item.period.label === label)) found.push({ index: match.index, period: monthPeriod(key, label) });
  });
  return found.sort((left, right) => left.index - right.index).map((item) => item.period);
}

/** Prazo de meta: "até dezembro", "em 12 meses", "em 2 anos", "até 2027", "até 10/2027". */
export function parseDeadline(text: string, today: string): { deadline: string | null; months: number | null } {
  const source = normalizeText(text);
  const month = today.slice(0, 7);
  const inMonths = source.match(/\b(?:em|daqui a|por|durante|de|ate) (\d{1,3}) (meses|mes)\b/);
  if (inMonths) {
    const months = Number(inMonths[1]);
    return { deadline: lastDayOfMonth(shiftMonth(month, months)), months };
  }
  const inYears = source.match(/\b(?:em|daqui a|por|durante|de|ate) (\d{1,2}|um|dois|tres) anos?\b/);
  if (inYears) {
    const words: Record<string, number> = { um: 1, dois: 2, tres: 3 };
    const months = (words[inYears[1]] ?? Number(inYears[1])) * 12;
    return { deadline: lastDayOfMonth(shiftMonth(month, months)), months };
  }
  const monthYear = source.match(/\bate (\d{1,2})\/(\d{4})\b/);
  if (monthYear) {
    const key = `${monthYear[2]}-${pad(Number(monthYear[1]))}`;
    return { deadline: lastDayOfMonth(key), months: monthsBetween(month, key) };
  }
  const named = source.match(/\bate (o fim de |o final de |fim de )?(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?: de (\d{4}))?\b/);
  if (named) {
    let key = `${named[3] ?? month.slice(0, 4)}-${pad(monthNames.indexOf(named[2]) + 1)}`;
    if (!named[3] && key <= month) key = shiftMonth(key, 12);
    return { deadline: lastDayOfMonth(key), months: monthsBetween(month, key) };
  }
  const year = source.match(/\bate (o fim de |o final de )?(20\d{2})\b/);
  if (year) {
    const key = `${year[2]}-12`;
    return { deadline: lastDayOfMonth(key), months: monthsBetween(month, key) };
  }
  return { deadline: null, months: null };
}

function monthsBetween(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return Math.max(1, (toYear - fromYear) * 12 + (toMonth - fromMonth));
}

/** Sinônimos que o `suggestCategory` não cobre (nomes de categoria e palavras do dia a dia). */
const categoryWords: Record<string, string[]> = {
  Moradia: ["moradia", "casa", "apartamento", "luz da casa"],
  Alimentação: ["alimentacao", "comida", "delivery", "rappi", "lanchonete", "hamburguer", "sushi", "acai", "doceria", "mercadinho", "hortifruti", "almocei", "jantei"],
  Transporte: ["transporte", "taxi", "corrida", "posto", "bilhete unico", "passagem de onibus", "trem"],
  Saúde: ["saude", "drogaria", "hospital", "psicologo", "vacina", "otica"],
  Contas: ["contas", "conta de luz", "conta de agua", "conta de internet", "conta de celular"],
  Assinaturas: ["assinaturas", "streaming", "chatgpt", "gympass", "deezer", "globoplay"],
  Lazer: ["lazer", "balada", "festa", "praia", "parque", "teatro", "museu", "boliche", "happy hour"],
  Compras: ["compras", "magalu", "shein", "camisa", "calca", "sapato", "maquiagem", "perfume", "eletronico", "celular novo"],
  Educação: ["educacao", "estudo", "material escolar", "apostila", "ingles"],
  Outros: ["outros", "diversos"],
};

/** Categoria de gasto citada no texto (nome, sinônimo ou palavra-chave da descrição). */
export function matchCategory(text: string): string | null {
  const source = ` ${normalizeText(text)} `;
  for (const category of expenseCategories) {
    if ((categoryWords[category] ?? []).some((word) => source.includes(` ${word} `) || source.includes(` ${word}s `))) return category;
  }
  return suggestCategory(source, "expense");
}

function matchIncomeCategory(text: string): string | null {
  const source = normalizeText(text);
  if (/\b(salario|holerite|pagamento do trabalho|caiu o pagamento)\b/.test(source)) return "Salário";
  if (/\b(freela|freelance|cliente|job|projeto)\b/.test(source)) return "Freelance";
  if (/\b(reembolso|estorno|devolu)/.test(source)) return "Reembolso";
  if (/\b(rendimento|dividendo|juros)\b/.test(source)) return "Rendimentos";
  return suggestCategory(source, "income") ?? (incomeCategories as readonly string[]).find((item) => source.includes(normalizeText(item))) ?? null;
}

/** Conta cadastrada citada pelo nome ("no Nubank", "pelo itaú", "na conta do inter"). */
export function matchAccount(text: string, accounts: UnderstandContext["accounts"]): string | null {
  const source = ` ${normalizeText(text).replace(/[^a-z0-9 ]/g, " ")} `;
  const byName = accounts.find((account) => {
    const name = normalizeText(account.name).replace(/[^a-z0-9 ]/g, " ").trim();
    return name.length > 1 && source.includes(` ${name} `);
  });
  if (byName) return byName.id;
  const bank = bankIdFromName(source);
  if (bank !== "other") return accounts.find((account) => account.bank === bank)?.id ?? null;
  const byBankName = accounts.find((account) => source.includes(` ${normalizeText(bankName(account.bank))} `));
  return byBankName?.id ?? null;
}

function matchGoal(text: string, goals: UnderstandContext["goals"]): string | null {
  const source = ` ${normalizeText(text)} `;
  const exact = goals.find((goal) => source.includes(` ${normalizeText(goal.name)} `));
  if (exact) return exact.id;
  // Palavra significativa do nome da meta ("viagem" em "Viagem para o Japão").
  const scored = goals
    .map((goal) => ({ goal, hits: normalizeText(goal.name).split(" ").filter((word) => word.length > 3 && source.includes(` ${word} `)).length }))
    .filter((item) => item.hits > 0)
    .sort((left, right) => right.hits - left.hits);
  return scored[0]?.goal.id ?? null;
}

const currencyWords: [CurrencyCode, RegExp][] = [
  ["USD", /\b(dolar(es)?( americano)?s?|usd|us\$)\b/],
  ["EUR", /\b(euros?|eur|€)\b/],
  ["GBP", /\b(libras?|gbp)\b/],
  ["JPY", /\b(ienes?|yen|jpy)\b/],
  ["CNY", /\b(yuan|cny)\b/],
  ["AUD", /\b(dolar(es)? australianos?|aud)\b/],
  ["CAD", /\b(dolar(es)? canadenses?|cad)\b/],
  ["CHF", /\b(francos?( suicos?)?|chf)\b/],
  ["HKD", /\b(hkd)\b/],
  ["NZD", /\b(nzd)\b/],
  ["BRL", /\b(reais|real|brl|r\$)\b/],
];

function matchCurrencies(text: string): CurrencyCode[] {
  const source = normalizeText(text);
  const found = currencyWords
    .map(([code, pattern]) => ({ code, index: source.search(pattern) }))
    .filter((item) => item.index >= 0 && currencyCodes.includes(item.code))
    .sort((left, right) => left.index - right.index)
    .map((item) => item.code);
  // "dólar australiano" também casa "dólar": fica só o mais específico.
  if (found.includes("AUD") || found.includes("CAD")) return found.filter((code) => code !== "USD");
  return found;
}

const investmentWords: [InvestmentType, RegExp][] = [
  ["poupanca", /\bpoupanca\b/],
  ["cdb_rdb", /\b(cdb|rdb|caixinha|cofrinho do banco)s?\b/],
  ["tesouro", /\b(tesouro( direto| selic| ipca| prefixado)?)\b/],
  ["lci_lca", /\b(lci|lca|lci\/lca)\b/],
  ["fiis", /\b(fii|fiis|fundos? imobiliarios?)\b/],
  ["fundos_etfs", /\b(etf|etfs|fundos? de investimento|fundo multimercado|fundos?(?! imobiliarios?))\b/],
  ["acoes", /\b(acao|acoes|bolsa|b3|dividendos)\b/],
  ["cripto", /\b(cripto|criptomoedas?|bitcoin|btc|ethereum|eth)\b/],
];

/** Todos os tipos de investimento citados, na ordem da lista de tipos. */
export function matchInvestmentTypes(text: string): InvestmentType[] {
  const source = normalizeText(text);
  return investmentWords.filter(([, pattern]) => pattern.test(source)).map(([type]) => type);
}

function matchInvestmentType(text: string): InvestmentType | null {
  return matchInvestmentTypes(text)[0] ?? null;
}

const featureWords: [FeatureId, RegExp][] = [
  ["learn", /\b(tipos de investimento|guia de investimento|aprender (sobre )?investir)\b/],
  ["categories", /\b(analise (por|de) categoria|gastos por categoria)\b/],
  ["goals", /\b(metas?|objetivos?|cofrinho)\b/],
  ["budgets", /\b(orcamentos?|limites?)\b/],
  ["bills", /\b(agenda|vencimentos?|contas a pagar|boletos?)\b/],
  ["reports", /\b(relatorios?|graficos?|evolucao)\b/],
  ["investments", /\b(investimentos?|aplicacoes|aplicacao|carteira)\b/],
  ["transactions", /\b(extrato|transacoes|lancamentos|historico)\b/],
  ["accounts", /\b(bancos?|contas? bancarias?|bancos e contas|cotacao|cotacoes)\b/],
  ["notifications", /\b(notificac(ao|oes)|lembretes?|alertas?)\b/],
  ["profile", /\b(perfil|foto|meu nome|ajustes|configurac(ao|oes))\b/],
  ["add", /\b(novo registro|registrar|lancar)\b/],
];

function matchFeature(text: string): FeatureId | null {
  const source = normalizeText(text);
  return featureWords.find(([, pattern]) => pattern.test(source))?.[0] ?? null;
}

const goalIconWords: [string, RegExp][] = [
  ["travel", /\b(viage(m|ns)|viajar|ferias|intercambio|europa|japao|disney|eua|praia)\b/],
  ["emergency", /\b(emergencia|reserva|imprevistos?|colchao)\b/],
  ["car", /\b(carro|moto|veiculo|automovel)\b/],
  ["house", /\b(casa|apartamento|ape|imovel|entrada do|reforma|mudanca)\b/],
  ["education", /\b(estudos?|curso|faculdade|pos|mestrado|intercambio|livros?|educacao)\b/],
  ["electronics", /\b(celular|iphone|notebook|computador|pc|videogame|playstation|xbox|tv|eletronicos?)\b/],
  ["health", /\b(saude|cirurgia|tratamento|dentista|academia)\b/],
  ["family", /\b(casamento|familia|filhos?|bebe|noivado)\b/],
  ["ticket", /\b(show|ingressos?|festival|copa|jogo)\b/],
  ["gift", /\b(presentes?|natal|aniversario)\b/],
  ["adventure", /\b(aventura|trilha|mochilao|camping|bike)\b/],
];

function guessGoalIcon(text: string) {
  const source = normalizeText(text);
  return goalIconWords.find(([, pattern]) => pattern.test(source))?.[0] ?? "other";
}

const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);

/** Limpa valores, datas, bancos e palavras de comando para sobrar o "o quê" ("gastei 50 no mercado" → "Mercado"). */
function extractSubject(original: string, removals: RegExp[]) {
  let text = ` ${original.toLocaleLowerCase("pt-BR")} `;
  const cleanup = [
    /(r\$|us\$|€|£)\s*[\d.,]+\s*(mil|k)?/g,
    /\b\d+([.,]\d+)?\s*(mil|k|reais|real|conto|pila|dolares|dólares|euros)?\b/g,
    /\b(hoje|ontem|anteontem|amanhã|amanha)\b/g,
    /\bdia \d{1,2}\b|\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g,
    /\b(no|na|pelo|pela|do|da|com o|com a|usando o|usando a|via)\s+(cartão|cartao|conta|pix|débito|debito|crédito|credito)\b.*$/g,
  ];
  // Remoções específicas primeiro: prazos como "em 18 meses" saem inteiros, antes de os números serem limpos.
  for (const pattern of removals) text = text.replace(pattern, " ");
  for (const pattern of cleanup) text = text.replace(pattern, " ");
  text = text
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(com|no|na|nos|nas|em|de|do|da|pra|para|pro|um|uma|o|a|os|as)\s+/i, "")
    .replace(/\s+(no|na|em|de|do|da|com|pelo|pela|e|que|pra|para)$/i, "")
    .trim();
  return text.length >= 2 ? capitalize(text.slice(0, 80)) : null;
}

type Rule = { intent: Intent; pattern: RegExp; weight: number };

/**
 * Regras de intenção. Cada uma soma pontos quando casa; ganha a de maior pontuação.
 * Ações (registrar, criar, ajustar) pesam mais que consultas quando há verbo de ação explícito.
 */
const rules: Rule[] = [
  { intent: "greeting", pattern: /^(oi+|ola|opa|e ai|eai|bom dia|boa tarde|boa noite|hey|salve|tudo bem|como vai)\b/, weight: 2 },
  { intent: "thanks", pattern: /\b(obrigad[oa]|valeu|vlw|brigad[oa]|show de bola|perfeito|otimo|massa)\b/, weight: 2 },
  { intent: "help", pattern: /\b(o que (voce|vc) (faz|sabe|consegue)|como (voce|vc) funciona|ajuda|me ajuda|help|quem e voce|o que posso (te )?(pedir|perguntar)|comandos)\b/, weight: 2 },
  { intent: "affirm", pattern: /^(sim|isso|pode|pode ser|confirmo|confirmar|ok|beleza|bora|claro|uhum|s)$/, weight: 3 },
  { intent: "deny", pattern: /^(nao|n|cancela|cancelar|deixa|deixa pra la|esquece)$/, weight: 3 },

  { intent: "add_expense", pattern: /\b(gastei|paguei|comprei|torrei|desembolsei|saiu|sairam|debitou|debitaram|cobraram|passei no cartao)\b/, weight: 4 },
  { intent: "add_expense", pattern: /\b(registr(ar|a|e)|anot(ar|a|e)|lanc(ar|a|e)|adicion(ar|a|e)|inclui(r)?|coloc(ar|a|e)|bot(ar|a|e))\b.*\b(gasto|despesa|compra|pagamento|saida)\b/, weight: 5 },
  { intent: "add_income", pattern: /\b(recebi|ganhei|caiu|entrou|entraram|me pagaram|depositaram|vendi)\b/, weight: 4 },
  { intent: "add_income", pattern: /\b(registr(ar|a|e)|anot(ar|a|e)|lanc(ar|a|e)|adicion(ar|a|e))\b.*\b(receita|entrada|salario|renda|ganho)\b/, weight: 5 },
  { intent: "create_goal", pattern: /\b(cri(ar|a|e)|nova|fazer|fa(ca|z)|montar|comecar)\b.*\b(meta|objetivo|cofrinho)\b/, weight: 5 },
  { intent: "create_goal", pattern: /\b(quero|preciso|gostaria de|vou) (juntar|guardar|economizar|poupar)\b.*\b(para|pra|pro)\b/, weight: 4 },
  { intent: "goal_contribution", pattern: /\b(guardei|separei|poupei|depositei|coloquei|juntei|economizei|aportei)\b/, weight: 4 },
  { intent: "goal_contribution", pattern: /\b(guardar|colocar|adicionar|depositar)\b.*\bna meta\b/, weight: 5 },
  { intent: "set_budget", pattern: /\b(orcamento|limite|teto)\b.*\b(\d|para|de|em)\b/, weight: 3 },
  { intent: "set_budget", pattern: /\b(cri(ar|a|e)|defin(ir|a|e)|ajust(ar|a|e)|mud(ar|a|e)|coloc(ar|a|e)|aument(ar|a|e)|diminu(ir|a)|baix(ar|a|e)|subi(r)?)\b.*\b(orcamento|limite|teto)\b/, weight: 5 },
  { intent: "set_balance", pattern: /\b(meu saldo|saldo (no|na|do|da)|tenho|estou com|to com|tô com)\b.*\b(no|na|em)\b/, weight: 3 },
  { intent: "set_balance", pattern: /\b(atualiz(ar|a|e)|ajust(ar|a|e)|corrig(ir|e)|mud(ar|a|e)|informar)\b.*\bsaldo\b/, weight: 5 },
  { intent: "add_investment", pattern: /\b(apliquei|investi|comprei (acoes|cotas|bitcoin|tesouro|cdb)|coloquei no (cdb|tesouro)|aportei no)\b/, weight: 5 },
  { intent: "add_investment", pattern: /\b(registr(ar|a|e)|cadastr(ar|a|e)|adicion(ar|a|e))\b.*\b(aplicacao|investimento)\b/, weight: 5 },

  { intent: "spending", pattern: /\b(quanto|quantos) (eu )?(gastei|paguei|saiu|foi|torrei)\b|\bgastos?\b|\bdespesas?\b|\bonde (estou|to|eu) gastando\b|\bpra onde (vai|foi|esta indo)\b/, weight: 2 },
  { intent: "biggest", pattern: /\b(maior(es)? (gastos?|despesas?|compras?)|mais caro|gastei mais|gastando mais|gasto mais|onde mais gasto|categoria que mais)\b/, weight: 3 },
  { intent: "income", pattern: /\b(quanto (eu )?(recebi|ganhei|entrou)|receitas?|entradas?|minha renda)\b/, weight: 2 },
  { intent: "compare", pattern: /\b(compar(ar|a|e|ado|ando|acao)|versus|vs|em relacao ao|diferenca entre|que nem|melhor ou pior|aumentou|diminuiu|subiu|caiu em relacao)\b/, weight: 3 },
  { intent: "balance", pattern: /\b(saldo|quanto (eu )?tenho|quanto (ainda )?(posso|da pra|consigo) gastar|quanto sobra|sobra|previsao|fim do mes|disponivel|meu dinheiro)\b/, weight: 2 },
  { intent: "balance", pattern: /\b(resumo|visao geral|como (estou|to|esta|ta) (o |meu )?mes|como estou)\b/, weight: 2 },
  { intent: "recurring", pattern: /\b(assinaturas?|recorrentes?|recorrencias?|fix(as|os)|mensalidades?|cobrancas?)\b/, weight: 3 },
  { intent: "simulate_goal", pattern: /\b(consigo|da pra|dá pra|e possivel|seria possivel) (guardar|juntar|economizar|poupar)\b|\b(quanto tempo|em quantos meses|quantos meses)\b.*\b(juntar|junto|junta|guardar|guardo|chegar|chego|atingir)\b|\bsimul(ar|a|e|acao)\b|\bquanto (preciso|tenho que) guardar\b/, weight: 4 },
  { intent: "investments", pattern: /\b(meus investimentos|minhas aplicacoes|minha carteira|quanto (eu )?(tenho )?investido|resumo (dos|de) (meus )?investimentos|onde (eu )?invisto|investimentos)\b/, weight: 2 },
  { intent: "investment_explain", pattern: /\b(o que (e|sao)|como funciona(m)?|explica(r)?|me explique|diferenca entre|vale a pena|e seguro|rende)\b.*\b(poupanca|cdb|rdb|tesouro|lci|lca|fii|fiis|fundos?|etf|acoes|acao|cripto|bitcoin|investir|investimento)/, weight: 5 },
  { intent: "convert", pattern: /\b(convert(er|a|e)|cotacao|quanto (e|da|vale|sao|custa))\b.*\b(dolar|dolares|euros?|libras?|ienes?|yen|usd|eur|gbp|reais|real|francos?)\b/, weight: 5 },
  { intent: "goals_status", pattern: /\b(minhas metas|como (estao|esta|vao|vai) (as |minhas? )?metas?|progresso (das|da) metas?|metas?)\b/, weight: 1 },
  { intent: "budgets_status", pattern: /\b(meus orcamentos|como (estao|esta) (os |meus? )?orcamentos?|orcamentos?|estourei|estourando|passei do limite)\b/, weight: 1 },
  { intent: "banks", pattern: /\b(meus bancos|minhas contas|quanto (tenho )?(em|no|na) cada (banco|conta)|por banco|cada banco|de onde vem|qual banco|quais bancos)\b/, weight: 3 },
  { intent: "tips", pattern: /\b(economizar|dicas?|reduzir|cortar|gastar menos|poupar mais|sobrar mais|organizar (minhas|as) financas|me ajuda a guardar)\b/, weight: 2 },
  { intent: "upcoming", pattern: /\b(vence|vencem|vencendo|vencimentos?|a pagar|contas (da|desta|dessa|da proxima) semana|proximas contas|o que tenho (que|pra) pagar)\b/, weight: 3 },
  { intent: "navigate", pattern: /\b(abr(ir|a|e)|ir para|ir pra|vai pra|leva(r)? (pra|para)|mostr(ar|a|e) a tela|onde (fica|vejo|acho|encontro)|como (eu )?(fa(co|zer)|cri(o|ar)|uso|vejo|cadastro|adiciono))\b/, weight: 3 },
  { intent: "smalltalk", pattern: /\b(piada|quem te criou|voce e real|qual seu nome|seu nome)\b/, weight: 2 },
];

/** Interpreta o pedido. `context` dá as contas e metas cadastradas para reconhecer nomes. */
export function understand(text: string, context: UnderstandContext): Understanding {
  const normalized = normalizeText(text);
  const amounts = parseAmounts(text);
  const periods = parsePeriods(text, context.today);
  const { deadline, months } = parseDeadline(text, context.today);
  const currencies = matchCurrencies(text);
  const accountId = matchAccount(text, context.accounts);
  const goalId = matchGoal(text, context.goals);
  const investmentType = matchInvestmentType(text);

  const scores = new Map<Intent, number>();
  for (const rule of rules) {
    if (has(normalized, rule.pattern)) scores.set(rule.intent, (scores.get(rule.intent) ?? 0) + rule.weight);
  }
  // Ajustes por contexto: valor + verbo de ação favorece a ação; pergunta favorece consulta.
  const isQuestion = /\?$|^(quanto|quantos|quais|qual|como|onde|quando|por que|porque|sera|consigo|da pra|posso)\b/.test(normalized);
  if (isQuestion) for (const intent of ["add_expense", "add_income", "goal_contribution", "set_balance", "add_investment"] as Intent[]) if (scores.has(intent)) scores.set(intent, scores.get(intent)! - 3);
  if (amounts.length && scores.has("set_budget") && /\b(orcamento|limite|teto)\b/.test(normalized)) scores.set("set_budget", scores.get("set_budget")! + 2);
  if (goalId && scores.has("goal_contribution")) scores.set("goal_contribution", scores.get("goal_contribution")! + 2);
  if (/\bmeta\b/.test(normalized) && amounts.length && !goalId && /\b(cri|nova|quero|juntar)/.test(normalized)) scores.set("create_goal", (scores.get("create_goal") ?? 0) + 2);
  if (scores.has("compare") && periods.length >= 1) scores.set("compare", scores.get("compare")! + 1);
  if (scores.has("investment_explain") && !investmentType && !/\binvestir|investimento/.test(normalized)) scores.delete("investment_explain");
  if (scores.has("set_balance") && !amounts.length) scores.set("set_balance", scores.get("set_balance")! - 2);
  if (scores.has("add_investment") && scores.has("add_expense")) scores.set("add_expense", scores.get("add_expense")! - 3);
  if (scores.has("goal_contribution") && scores.has("add_investment") && investmentType) scores.set("goal_contribution", scores.get("goal_contribution")! - 3);
  if (scores.has("navigate") && !matchFeature(text)) scores.delete("navigate");
  if (scores.has("banks") && scores.has("spending")) scores.set("spending", scores.get("spending")! + 1);
  if (currencies.length >= 2 && amounts.length) scores.set("convert", (scores.get("convert") ?? 0) + 3);

  let intent: Intent = "unknown";
  let best = 0;
  for (const [candidate, score] of scores) {
    if (score > best) {
      best = score;
      intent = candidate;
    }
  }
  // Só valor e talvez uma descrição curta ("50 mercado"): trata como gasto.
  if (intent === "unknown" && amounts.length === 1 && normalized.split(" ").length <= 5 && !isQuestion) intent = "add_expense";

  const category = matchCategory(text);
  const groupByBank = /\b(por banco|cada banco|por conta|cada conta|qual banco|em qual conta)\b/.test(normalized);

  const subjectRemovals = [
    /\b(gastei|paguei|comprei|torrei|recebi|ganhei|caiu|entrou|me pagaram|depositaram|vendi|guardei|separei|apliquei|investi|registr\w*|anot\w*|lanç\w*|lanc\w*|adicion\w*|coloc\w*|um gasto|uma despesa|gasto|despesa|receita|entrada|de|reais|real)\b/g,
    ...context.accounts.map((account) => new RegExp(`\\b(no|na|pelo|pela|do|da|em)?\\s*${account.name.toLocaleLowerCase("pt-BR").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$|[.,!?])`, "g")),
    /\b(no|na|pelo|pela)\s+(nubank|nu|itaú|itau|inter|bradesco|santander|caixa|picpay|mercado pago|c6|bb|banco do brasil)(?=\s|$|[.,!?])/g,
  ];
  const description = intent === "add_expense" || intent === "add_income" ? extractSubject(text, subjectRemovals) : null;

  let goalName: string | null = null;
  if (intent === "create_goal") {
    const match = text.match(/(?:meta|objetivo|cofrinho)\s+(?:de |para |pra |pro |chamad[ao] )?(.+)$/i) ?? text.match(/(?:juntar|guardar|economizar|poupar)(?: dinheiro)?\s+(?:para|pra|pro)\s+(.+)$/i);
    if (match) {
      goalName = extractSubject(match[1], [/\b(at[eé]|em|daqui a|por)\s+(o fim de |o final de )?(\d+\s*(meses|m[eê]s|anos?)|janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{4}|\d{1,2}\/\d{4})(\s+de\s+\d{4})?/gi, /\b(de|com|no valor de|valor)\b/gi]);
    }
  }

  return {
    intent,
    normalized,
    amounts,
    period: periods[0] ?? null,
    otherPeriod: periods[1] ?? null,
    date: parseDate(text, context.today),
    deadline,
    months,
    category,
    incomeCategory: matchIncomeCategory(text),
    accountId,
    goalId,
    currencies,
    investmentType,
    feature: matchFeature(text),
    groupByBank,
    description,
    goalName,
    goalIcon: guessGoalIcon(text),
  };
}

export function investmentTypeInfo(type: InvestmentType) {
  return investmentTypes.find((item) => item.id === type)!;
}
