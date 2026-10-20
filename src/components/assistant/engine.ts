/**
 * Motor do assistente do Prumo: responde no próprio aparelho, sem chamar nenhum modelo de IA.
 * 1) `understand` reconhece a intenção e os dados do pedido; 2) as ferramentas deterministas
 * (`runAssistantTool` e as regras de domínio) fazem as contas sobre os registros da pessoa;
 * 3) aqui o resultado vira texto, cartões do app e propostas de ação (que só executam com confirmação).
 */
import { accountBalances } from "@/domain/accounts";
import { averageMonthlySurplus } from "@/domain/assistant/calculations";
import { matchInvestmentTypes, normalizeText, understand, type FeatureId, type Intent, type PeriodSpec, type Understanding } from "@/domain/assistant/understand";
import { bankIdFromName, bankName } from "@/domain/banks";
import { expenseCategories, suggestCategory } from "@/domain/categories";
import { investmentTypeName, investmentTypes, investmentsByInstitution, summarizeInvestments } from "@/domain/investments";
import { budgetUsage, expensesByCategory, goalProgress, lastDayOfMonth, shiftMonth, unusualIncreases } from "@/domain/planning";
import { addDays } from "@/lib/dates";
import { formatCurrency, formatMonthKey, formatShortDate } from "@/lib/formatting";
import { runAssistantTool, type ToolContext } from "./run-tool";
import type { AssistantCard, AssistantProposal, ConversationMemory } from "./types";

export type EngineBlock =
  | { type: "text"; text: string }
  | { type: "card"; card: AssistantCard }
  | { type: "proposal"; proposal: AssistantProposal };

export type EngineReply = { blocks: EngineBlock[]; suggestions: string[]; memory: ConversationMemory };

export const emptyMemory: ConversationMemory = { lastIntent: null, lastText: null, pending: null };

/** Telas do app que o assistente apresenta como cartão (ilustração, explicação e atalho). */
export const features: Record<FeatureId, { title: string; description: string; href: string; cta: string; howTo?: string }> = {
  goals: { title: "Metas", description: "Crie quantas metas quiser, com valor e prazo. O Prumo calcula quanto guardar por mês e mostra se você está no ritmo.", href: "/goals", cta: "Abrir metas", howTo: "Toque em **Nova meta**, escolha o destino (viagem, carro, reserva…), defina o valor e o prazo." },
  budgets: { title: "Orçamentos", description: "Defina um limite mensal por categoria e receba alerta quando estiver perto de estourar.", href: "/budgets", cta: "Abrir orçamentos", howTo: "Escolha a categoria, digite o limite do mês e, se quiser, em que porcentagem avisar." },
  bills: { title: "Agenda", description: "Contas do mês por data de vencimento, com o que já foi pago e o que falta.", href: "/bills", cta: "Abrir agenda", howTo: "Registre uma conta com data futura ou marque como recorrente para ela aparecer todo mês." },
  reports: { title: "Relatórios", description: "Evolução de receitas e despesas, saldo por banco, categorias que mais pesam e comparação com o mês anterior.", href: "/reports", cta: "Ver relatórios" },
  investments: { title: "Investimentos", description: "Onde seu dinheiro está aplicado: total, divisão por banco ou corretora e por tipo.", href: "/investments", cta: "Abrir investimentos", howTo: "Toque em **Nova aplicação**, escolha o tipo, a instituição e o valor aplicado." },
  learn: { title: "Tipos de investimento", description: "Poupança, CDB, Tesouro, ações, FIIs, fundos, LCI/LCA e cripto explicados em linguagem simples.", href: "/investments/learn", cta: "Ler o guia" },
  transactions: { title: "Extrato", description: "Todas as entradas e saídas, com busca, filtros e visão por banco.", href: "/transactions", cta: "Abrir extrato" },
  accounts: { title: "Bancos e contas", description: "Cadastre quantos bancos quiser e ajuste quanto há em cada um. O saldo do Início passa a ser a soma deles.", href: "/settings/accounts", cta: "Abrir bancos", howTo: "Toque em **Adicionar**, escolha o banco, a moeda e informe o saldo atual." },
  add: { title: "Novo registro", description: "Valor primeiro, num teclado em tela cheia; depois categoria, data e conta.", href: "/add", cta: "Registrar agora" },
  notifications: { title: "Notificações", description: "Alertas de vencimento, orçamento no limite, metas fora do ritmo e lembretes no seu horário.", href: "/settings/notifications", cta: "Ajustar avisos" },
  profile: { title: "Perfil e ajustes", description: "Nome, foto, moeda, renda, dia do pagamento e seus bancos.", href: "/settings", cta: "Abrir ajustes" },
  categories: { title: "Gastos por categoria", description: "Quanto cada categoria pesa no período, ordenada do maior para o menor gasto.", href: "/reports/categories", cta: "Ver análise" },
};

const goalIconLabels: Record<string, string> = {
  travel: "Viagem", emergency: "Reserva de emergência", car: "Carro", house: "Casa", education: "Estudos",
  electronics: "Eletrônicos", health: "Saúde", family: "Família", adventure: "Aventura", ticket: "Ingresso", gift: "Presente", other: "Minha meta",
};

/** Notas neutras sobre risco e liquidez de cada tipo (explicação, nunca recomendação). */
const investmentNotes: Record<string, string> = {
  poupanca: "Liquidez imediata e isenta de IR para pessoa física. Tem garantia do FGC dentro do limite.",
  cdb_rdb: "Muitos têm liquidez diária; outros só no vencimento. Costumam ter garantia do FGC dentro do limite e IR regressivo.",
  tesouro: "Títulos do governo federal. Dá para resgatar antes do vencimento, mas o preço pode oscilar até lá (menos no Selic).",
  acoes: "Renda variável: o preço sobe e desce todo dia. Faz mais sentido para prazos longos e com tolerância a oscilação.",
  fiis: "Pagam rendimentos periódicos e são negociados na bolsa, então a cota também oscila.",
  fundos_etfs: "Um gestor (ou um índice, no caso dos ETFs) define a carteira. Vale olhar taxas, risco e prazo de resgate.",
  lci_lca: "Costumam ter isenção de IR para pessoa física e garantia do FGC, mas geralmente exigem um prazo mínimo.",
  cripto: "Oscilação muito alta e sem garantia do FGC. Quem investe costuma usar uma parte pequena do patrimônio.",
};

const pick = <T,>(options: T[]) => options[Math.floor(Math.random() * options.length)];

const queryIntents: Intent[] = ["spending", "biggest", "income", "compare", "balance", "banks", "recurring", "investments", "goals_status", "budgets_status", "upcoming"];

function periodInput(period: PeriodSpec | null) {
  if (!period) return { periodo: "este_mes" as const };
  return { periodo: period.preset, de: period.from ?? null, ate: period.to ?? null };
}

function periodLabel(period: PeriodSpec | null) {
  return period?.label ?? "neste mês";
}

/** Primeiro valor que vem junto de "por mês" ("500 por mês", "R$ 300/mês"). */
function monthlyAmount(normalized: string) {
  const match = normalized.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(mil|k)?\s*(?:reais\s*)?(?:por mes|\/mes|mensais|mensal|todo mes|ao mes|cada mes)/);
  if (!match) return null;
  let value = Number(match[1].replace(/\./g, "")) + (match[2] ? Number(match[2].padEnd(2, "0")) / 100 : 0);
  if (match[3]) value *= 1000;
  return value > 0 ? value : null;
}

const toCents = (value: number) => Math.round(value * 100);

function featureCard(id: FeatureId): EngineBlock {
  const feature = features[id];
  return { type: "card", card: { kind: "feature", feature: id, title: feature.title, description: feature.description, href: feature.href, cta: feature.cta } };
}

/** Responde a uma mensagem. `memory` guarda o último assunto e o que ficou faltando. */
export function respond(text: string, memory: ConversationMemory, context: ToolContext): EngineReply {
  const { snapshot, today } = context;
  const understandContext = {
    today,
    accounts: snapshot.accounts.map((account) => ({ id: account.id, name: account.name, bank: account.bank })),
    goals: snapshot.savingsGoals.map((goal) => ({ id: goal.id, name: goal.name })),
  };
  let u = understand(text, understandContext);
  let effectiveText = text;

  // Resposta curta ao que ficou faltando ("150", "Nubank", "Alimentação").
  if (memory.pending) {
    if (u.intent === "deny") {
      return { blocks: [{ type: "text", text: "Tudo bem, deixei para lá. Posso ajudar com outra coisa?" }], suggestions: ["Onde estou gastando mais?", "Quanto ainda posso gastar?"], memory: emptyMemory };
    }
    const isNewRequest = u.intent !== "unknown" && u.intent !== memory.pending.intent && !(u.intent === "add_expense" && u.amounts.length && normalizeText(text).split(" ").length <= 3);
    if (!isNewRequest) {
      const joiner = memory.pending.missing === "account" ? " na " : " ";
      const merged = understand(`${memory.pending.text}${joiner}${text}`, understandContext);
      u = { ...merged, intent: memory.pending.intent };
      effectiveText = `${memory.pending.text}${joiner}${text}`;
      if (memory.pending.missing === "category" && !u.category) u.category = expenseCategories.find((category) => normalizeText(category) === normalizeText(text)) ?? null;
    }
  } else if ((u.intent === "unknown" || (u.intent === "spending" && normalizeText(text).split(" ").length <= 4)) && memory.lastIntent && queryIntents.includes(memory.lastIntent) && memory.lastText) {
    // Continuação: "e no mês passado?", "e com transporte?", "e no Nubank?".
    const previous = understand(memory.lastText, understandContext);
    const looksLikeFollowUp = /^(e|e o|e a|e no|e na|e em|e com|agora|e pro|e para)\b|\bpor (categoria|banco|conta)\b/.test(normalizeText(text)) || u.period || u.category || u.accountId;
    if (looksLikeFollowUp) {
      u = {
        ...previous,
        intent: memory.lastIntent,
        period: u.period ?? previous.period,
        otherPeriod: u.period ? null : previous.otherPeriod,
        category: u.category ?? (u.period || u.accountId ? previous.category : null),
        accountId: u.accountId ?? (u.period || u.category ? previous.accountId : null),
        groupByBank: /\bpor (banco|conta)\b/.test(u.normalized) ? true : /\bpor categoria\b/.test(u.normalized) ? false : previous.groupByBank,
      };
    }
  }

  const reply = handle(u, effectiveText, context);
  const pending = reply.pending ?? null;
  return {
    blocks: reply.blocks,
    suggestions: reply.suggestions,
    memory: {
      lastIntent: pending ? memory.lastIntent : u.intent === "unknown" ? memory.lastIntent : u.intent,
      lastText: pending ? memory.lastText : queryIntents.includes(u.intent) ? text : memory.lastText,
      pending,
    },
  };
}

type Handled = { blocks: EngineBlock[]; suggestions: string[]; pending?: ConversationMemory["pending"] };

function handle(u: Understanding, text: string, context: ToolContext): Handled {
  const { snapshot, today } = context;
  const currency = snapshot.preferences?.currency ?? "BRL";
  const money = (cents: number) => formatCurrency(cents, currency);
  const firstName = snapshot.preferences?.displayName?.trim().split(/\s+/)[0];
  const month = today.slice(0, 7);
  const account = snapshot.accounts.find((item) => item.id === u.accountId) ?? null;
  const say = (...paragraphs: (string | null | false | undefined)[]): EngineBlock => ({ type: "text", text: paragraphs.filter(Boolean).join("\n\n") });
  const ask = (missing: NonNullable<ConversationMemory["pending"]>["missing"], question: string, suggestions: string[]): Handled => ({
    blocks: [say(question)],
    suggestions,
    pending: { intent: u.intent, text, missing },
  });
  const tool = (name: string, input: unknown) => runAssistantTool(name, input, context);
  const cardOf = (outcome: ReturnType<typeof tool>): EngineBlock[] => (outcome.card ? [{ type: "card", card: outcome.card }] : []);
  const proposalOf = (outcome: ReturnType<typeof tool>): EngineBlock[] => (outcome.proposal ? [{ type: "proposal", proposal: outcome.proposal }] : []);
  const data = (outcome: ReturnType<typeof tool>) => JSON.parse(outcome.content) as Record<string, unknown>;
  const topCategories = expensesByCategory(snapshot.expenses, month).slice(0, 3).map((item) => item.category);

  switch (u.intent) {
    case "greeting":
      return {
        blocks: [say(`${pick(["Oi", "Olá", "Oi, tudo bem"])}${firstName ? `, ${firstName}` : ""}! ${pick(["Em que posso ajudar hoje?", "O que você quer ver ou fazer agora?", "Me conta o que precisa."])}`)],
        suggestions: ["Quanto ainda posso gastar?", "Onde estou gastando mais?", "O que você consegue fazer?"],
      };

    case "thanks":
      return { blocks: [say(pick(["Por nada! Estou por aqui quando precisar.", "Imagina! Qualquer coisa, é só chamar.", "Disponha! Bom saber que ajudou."]))], suggestions: ["Como estão minhas metas?", "Resumo do mês"] };

    case "smalltalk":
      return { blocks: [say("Sou a assistente do Prumo. Funciono aqui no seu aparelho, com as regras do app e os seus registros, sem enviar seus dados para fora e sem custo por pergunta.")], suggestions: ["O que você consegue fazer?", "Resumo do mês"] };

    case "help":
      return {
        blocks: [
          say(
            "Posso consultar, fazer e explicar coisas no Prumo:",
            "- **Consultar:** gastos por período, categoria ou banco, saldo e quanto ainda cabe no mês, assinaturas, metas, orçamentos e investimentos.\n- **Fazer por você:** registrar gasto ou receita, criar meta, guardar dinheiro numa meta, ajustar orçamento, atualizar o saldo de um banco e cadastrar aplicação. Sempre com um cartão para você confirmar.\n- **Explicar:** tipos de investimento e como usar cada tela do app.",
            "Pode escrever do seu jeito, por exemplo: \"gastei 45 no ifood ontem pelo nubank\" ou \"quanto gastei com transporte em setembro?\".",
          ),
        ],
        suggestions: ["Gastei 45 no ifood", "Criar meta de viagem de 8 mil", "Quanto tenho em cada banco?"],
      };

    case "affirm":
      return { blocks: [say("Certo! Se tiver um cartão de confirmação acima, é só tocar em **Confirmar**. Quer fazer mais alguma coisa?")], suggestions: ["Resumo do mês", "Como estão minhas metas?"] };

    case "deny":
      return { blocks: [say("Sem problemas. Posso ajudar com outra coisa?")], suggestions: ["Onde estou gastando mais?", "Quanto ainda posso gastar?"] };

    case "add_expense": {
      const amount = u.amounts[0];
      if (!amount) return ask("amount", pick(["Qual foi o valor?", "Quanto foi?"]), []);
      const category = u.category ?? (u.description ? suggestCategory(u.description, "expense") : null) ?? "Outros";
      const description = u.description ?? category;
      const outcome = tool("propor_registrar_gasto", { descricao: description, valor: amount, categoria: category, data: u.date ?? today, conta: account?.name ?? null });
      if (outcome.isError) return { blocks: [say("Não consegui montar esse registro. Tente algo como \"gastei 50 no mercado\".")], suggestions: [] };
      const accountHint = !account && snapshot.accounts.length > 1 ? `Se quiser, diga de qual banco saiu (${snapshot.accounts.slice(0, 3).map((item) => item.name).join(", ")}).` : null;
      return {
        blocks: [say(`${pick(["Prontinho para registrar", "Montei o registro", "Certo, anotei aqui"])}: **${description}**, ${money(toCents(amount))} em ${category}${account ? ` no ${account.name}` : ""}. Confira e toque em **Confirmar**.`, accountHint), ...proposalOf(outcome)],
        suggestions: ["Quanto gastei este mês?", `Quanto gastei com ${category}?`],
      };
    }

    case "add_income": {
      const amount = u.amounts[0];
      if (!amount) return ask("amount", "Qual foi o valor recebido?", []);
      const category = u.incomeCategory ?? "Outras receitas";
      const description = u.description && normalizeText(u.description) !== normalizeText(category) ? u.description : category;
      const date = u.date ?? today;
      const proposal: AssistantProposal = { kind: "add_income", description: description.slice(0, 120), amountCents: toCents(amount), category, date, accountId: account?.id ?? null, accountName: account?.name ?? null, received: date <= today };
      return {
        blocks: [say(`${pick(["Que bom!", "Boa!", "Ótimo!"])} Vou registrar **${description}**, ${money(proposal.amountCents)}${account ? ` no ${account.name}` : ""}. Confirme no cartão.`), { type: "proposal", proposal }],
        suggestions: ["Quanto ainda posso gastar?", "Como estão minhas metas?"],
      };
    }

    case "create_goal": {
      const amount = u.amounts[0];
      const name = (u.goalName ?? goalIconLabels[u.goalIcon]).slice(0, 80);
      if (!amount) return ask("amount", `Qual o valor da meta${name !== "Minha meta" ? ` **${name}**` : ""}?`, []);
      const outcome = tool("propor_criar_meta", { nome: name, valor_alvo: amount, prazo: u.deadline, icone: u.goalIcon });
      if (outcome.isError) return { blocks: [say("O prazo precisa ser uma data no futuro. Tente \"em 12 meses\" ou \"até dezembro\".")], suggestions: [] };
      const blocks: EngineBlock[] = [];
      if (u.months) {
        const plan = tool("simular_meta", { valor_alvo: amount, prazo_meses: u.months });
        const values = data(plan);
        blocks.push(say(`Criei a proposta da meta **${name}** de ${money(toCents(amount))}. Para chegar lá em ${u.months} ${u.months === 1 ? "mês" : "meses"}, seriam **${values.aporte_mensal}** por mês${values.cabe_na_sobra_media === false ? ", acima da sua sobra média recente" : values.cabe_na_sobra_media ? ", o que cabe na sua sobra média recente" : ""}.`));
      } else {
        blocks.push(say(`Criei a proposta da meta **${name}** de ${money(toCents(amount))}${u.deadline ? ` até ${formatShortDate(u.deadline)}` : ", sem prazo"}. Confirme no cartão para ela aparecer em Metas.`));
      }
      blocks.push(...proposalOf(outcome));
      return { blocks, suggestions: u.deadline ? ["Como estão minhas metas?", "Quanto ainda posso gastar?"] : [`Em quanto tempo junto ${money(toCents(amount))}?`, "Como estão minhas metas?"] };
    }

    case "goal_contribution": {
      const goals = snapshot.savingsGoals;
      if (!goals.length) {
        return { blocks: [say("Você ainda não tem metas. Que tal criar uma? Depois é só me dizer \"guardei 200 na meta\" que eu registro."), featureCard("goals")], suggestions: ["Criar meta de reserva de emergência", "Criar meta de viagem"] };
      }
      const goal = goals.find((item) => item.id === u.goalId) ?? (goals.length === 1 ? goals[0] : null);
      if (!goal) return ask("goal", "Em qual meta?", goals.slice(0, 4).map((item) => item.name));
      const amount = u.amounts[0];
      if (!amount) return ask("amount", `Quanto você guardou para **${goal.name}**?`, []);
      const progress = goalProgress(goal, today);
      const after = Math.min(1, (progress.savedCents + toCents(amount)) / goal.targetCents);
      const proposal: AssistantProposal = { kind: "goal_contribution", goalId: goal.id, goalName: goal.name, goalIcon: goal.icon, amountCents: toCents(amount), date: u.date ?? today };
      return {
        blocks: [say(`${pick(["Mandou bem!", "Isso aí!", "Boa!"])} Com ${money(proposal.amountCents)}, **${goal.name}** vai para **${Math.floor(after * 100)}%**${after >= 1 ? " — meta alcançada!" : ` (faltam ${money(Math.max(0, progress.remainingCents - proposal.amountCents))})`}. Confirme no cartão.`), { type: "proposal", proposal }],
        suggestions: ["Como estão minhas metas?", "Quanto ainda posso gastar?"],
      };
    }

    case "set_budget": {
      const category = u.category;
      if (!category) return ask("category", "Para qual categoria?", topCategories.length ? topCategories : ["Alimentação", "Lazer", "Transporte"]);
      const amount = u.amounts[0];
      const spent = expensesByCategory(snapshot.expenses, month).find((item) => item.category === category)?.amountCents ?? 0;
      if (!amount) return ask("amount", `Qual limite mensal para **${category}**? Neste mês você já gastou ${money(spent)} nela.`, spent ? [`${Math.ceil(spent / 10000) * 100} reais`] : []);
      const outcome = tool("propor_ajustar_orcamento", { categoria: category, limite: amount });
      if (outcome.isError) return { blocks: [say("Não reconheci essa categoria. As categorias são: " + expenseCategories.join(", ") + ".")], suggestions: [] };
      const over = spent > toCents(amount);
      return {
        blocks: [say(`Limite de **${money(toCents(amount))}** por mês para ${category}. Neste mês você já gastou ${money(spent)}${over ? ", então ele já começaria acima do limite" : ` (${Math.round((spent / toCents(amount)) * 100)}%)`}. Confirme no cartão.`), ...proposalOf(outcome)],
        suggestions: ["Como estão meus orçamentos?", "Como economizar este mês?"],
      };
    }

    case "set_balance": {
      const amount = u.amounts[0];
      const mentionedBank = bankIdFromName(text);
      const target = account ?? (snapshot.accounts.length === 1 && mentionedBank === "other" ? snapshot.accounts[0] : null);
      if (!target && snapshot.accounts.length > 1 && mentionedBank === "other") return ask("account", "Em qual banco?", snapshot.accounts.slice(0, 4).map((item) => item.name));
      if (!amount) return ask("amount", `Quanto há ${target ? `no ${target.name}` : "na conta"} agora?`, []);
      const balances = accountBalances(snapshot.accounts, snapshot.expenses, currency, context.rates, context.manualRates);
      const proposal: AssistantProposal = target
        ? { kind: "set_balance", accountId: target.id, accountName: target.name, bank: target.bank, currency: target.currency, balanceCents: toCents(amount), previousCents: balances.items.find((item) => item.account.id === target.id)?.balanceCents ?? null }
        : mentionedBank !== "other"
          ? { kind: "set_balance", accountId: null, accountName: bankName(mentionedBank), bank: mentionedBank, currency, balanceCents: toCents(amount), previousCents: null }
          : { kind: "set_balance", accountId: null, accountName: "Saldo geral", bank: null, currency, balanceCents: toCents(amount), previousCents: snapshot.preferences?.reportedBalanceCents ?? null };
      const isNewBank = !target && mentionedBank !== "other";
      return {
        blocks: [say(isNewBank ? `Você ainda não tem o ${proposal.accountName} cadastrado. Posso adicioná-lo com saldo de **${formatCurrency(proposal.balanceCents, proposal.currency)}**. Confirme no cartão.` : `Vou atualizar ${proposal.accountId ? `o saldo do **${proposal.accountName}**` : "o seu saldo"} para **${formatCurrency(proposal.balanceCents, proposal.currency)}**. O que você pagar ou receber a partir de hoje ajusta esse valor.`), { type: "proposal", proposal }],
        suggestions: ["Quanto tenho em cada banco?", "Quanto ainda posso gastar?"],
      };
    }

    case "add_investment": {
      const amount = u.amounts[0];
      const type = u.investmentType;
      if (!type) return ask("name", "Em que tipo de aplicação?", ["CDB", "Tesouro Direto", "Poupança", "Ações"]);
      if (!amount) return ask("amount", `Quanto você aplicou em ${investmentTypeName(type, "short")}?`, []);
      const mentioned = bankIdFromName(text);
      // Instituição fora da lista de bancos (corretoras etc.): o que vem depois de "no/na" no fim da frase.
      const named = text.match(/\b(?:no|na|pelo|pela)\s+([^\d,.!?]{2,40})$/i)?.[1].trim();
      const typed = named && !/^(tesouro|cdb|poupan|a[cç][oõ]es|fii|fundo|lci|lca|cripto|bitcoin)/i.test(named)
        ? named.split(/\s+/).map((word) => (word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))).join(" ")
        : null;
      const institution = account?.name ?? (mentioned !== "other" ? bankName(mentioned) : typed ?? (type === "tesouro" ? "Tesouro Direto" : null));
      if (!institution) return ask("account", "Em qual banco ou corretora?", [...snapshot.accounts.slice(0, 3).map((item) => item.name), "XP", "BTG Pactual"].slice(0, 4));
      const proposal: AssistantProposal = { kind: "add_investment", type, institution, appliedCents: toCents(amount), date: u.date ?? today };
      return {
        blocks: [say(`Vou cadastrar **${investmentTypeName(type)}** no ${institution}, ${money(proposal.appliedCents)} aplicados. Confirme no cartão; depois você pode informar o valor atual na tela de Investimentos.`), { type: "proposal", proposal }],
        suggestions: ["Resumo dos meus investimentos", `O que é ${investmentTypeName(type, "short")}?`],
      };
    }

    case "spending":
    case "income":
    case "biggest": {
      const kind = u.intent === "income" ? "receitas" : "gastos";
      const period = u.period;
      const outcome = tool("gastos_por_periodo", { ...periodInput(period), agrupar_por: u.groupByBank ? "banco" : "categoria", tipo: kind, categoria: u.intent === "income" ? null : u.category, conta: account?.name ?? null });
      if (outcome.isError) return { blocks: [say("Não consegui ler esse período. Tente \"este mês\", \"mês passado\" ou o nome de um mês.")], suggestions: [] };
      const values = data(outcome) as { total: string; lancamentos: number; pendente: string; grupos: { nome: string; valor: string; participacao: string }[]; maiores_lancamentos: { descricao: string; valor: string; data: string }[] };
      const where = `${u.category && u.intent !== "income" ? ` com **${u.category}**` : ""}${account ? ` no ${account.name}` : ""}`;
      if (!values.lancamentos) {
        return {
          blocks: [say(`Não encontrei ${kind}${where} ${periodLabel(period)}.`, kind === "gastos" ? "Quer registrar um agora? É só me dizer, por exemplo: \"gastei 30 na padaria\"." : null)],
          suggestions: [kind === "gastos" ? "Gastos do mês passado" : "Receitas do mês passado", "Resumo do mês"],
        };
      }
      const top = values.grupos.slice(0, u.intent === "biggest" ? 3 : 1);
      const lines = [
        `${kind === "receitas" ? "Você recebeu" : "Você gastou"} **${values.total}**${where} ${periodLabel(period)}, em ${values.lancamentos} ${values.lancamentos === 1 ? "lançamento" : "lançamentos"}.`,
        !u.category && top.length ? (u.intent === "biggest"
          ? `Onde mais pesa:\n${top.map((group) => `- **${group.nome}**: ${group.valor} (${group.participacao})`).join("\n")}`
          : `A maior parte foi ${u.groupByBank ? "no" : "em"} **${top[0].nome}** (${top[0].valor}, ${top[0].participacao}).`) : null,
        u.intent === "biggest" && values.maiores_lancamentos[0] ? `O maior lançamento foi **${values.maiores_lancamentos[0].descricao}**, ${values.maiores_lancamentos[0].valor} em ${formatShortDate(values.maiores_lancamentos[0].data)}.` : null,
        values.pendente && !/^R\$\s?0,00$/.test(values.pendente.replace(/ /g, " ")) ? `Desse total, ${values.pendente} ainda ${kind === "receitas" ? "está a receber" : "está a pagar"}.` : null,
      ];
      const suggestions = kind === "receitas"
        ? ["Quanto ainda posso gastar?", "Compare com o mês passado"]
        : [period?.preset === "mes_passado" ? "E neste mês?" : "E no mês passado?", u.groupByBank ? "Por categoria" : "Quanto gastei em cada banco?", top[0] && !u.category ? `Criar limite para ${top[0].nome}` : "Como economizar este mês?"];
      return { blocks: [say(...lines), ...cardOf(outcome)], suggestions };
    }

    case "compare": {
      let first: PeriodSpec;
      let second: PeriodSpec;
      if (u.period && u.otherPeriod) {
        [first, second] = (u.period.from ?? "") > (u.otherPeriod.from ?? "") || u.period.preset === "este_mes" ? [u.otherPeriod, u.period] : [u.period, u.otherPeriod];
      } else if (u.period && u.period.preset === "personalizado" && u.period.from) {
        const key = u.period.from.slice(0, 7);
        const previousKey = shiftMonth(key, -1);
        first = { preset: "personalizado", from: `${previousKey}-01`, to: lastDayOfMonth(previousKey), label: `em ${formatMonthKey(previousKey).split(" ")[0]}` };
        second = u.period;
      } else {
        first = { preset: "mes_passado", label: "no mês passado" };
        second = { preset: "este_mes", label: "neste mês" };
      }
      const kind = /\b(receita|recebi|entrada|renda)/.test(u.normalized) ? "receitas" : "gastos";
      const outcome = tool("comparar_periodos", { periodo_a: periodInput(first), periodo_b: periodInput(second), tipo: kind });
      if (outcome.isError) return { blocks: [say("Não consegui comparar esses períodos.")], suggestions: [] };
      const values = data(outcome) as { periodo_a: { total: string }; periodo_b: { total: string }; diferenca: string; variacao: string; por_categoria: { categoria: string; diferenca: string; variacao: string }[] };
      const diff = values.diferenca.replace(/ /g, " ");
      const up = !diff.startsWith("-") && !/^R\$ 0,00$/.test(diff);
      const same = /^-?R\$ 0,00$/.test(diff);
      const biggestChange = values.por_categoria[0];
      return {
        blocks: [
          say(
            `${kind === "receitas" ? "Receitas" : "Gastos"}: **${values.periodo_b.total}** ${second.label} contra **${values.periodo_a.total}** ${first.label}.`,
            same ? "Ficou igual." : `Foram **${diff.replace("-", "")} ${up ? "a mais" : "a menos"}** (${values.variacao}).${biggestChange && kind === "gastos" ? ` A maior mudança foi em **${biggestChange.categoria}** (${biggestChange.diferenca.replace(/ /g, " ")}).` : ""}`,
          ),
          ...cardOf(outcome),
        ],
        suggestions: ["Onde estou gastando mais?", "Como economizar este mês?"],
      };
    }

    case "balance": {
      const outcome = tool("saldo_e_previsao", {});
      const values = data(outcome) as { saldo_disponivel: string | null; ainda_pode_gastar: string | null; sobra_estimada_fim_do_mes: string | null; saldos_por_conta: unknown[] };
      if (values.saldo_disponivel === null && values.ainda_pode_gastar === null) {
        return {
          blocks: [say("Ainda não sei quanto você tem. Me diga o saldo, por exemplo \"tenho 1.200 no Nubank\", ou cadastre seus bancos."), featureCard("accounts")],
          suggestions: ["Tenho 1000 na conta", "O que você consegue fazer?"],
        };
      }
      const blocks: EngineBlock[] = [say(
        values.saldo_disponivel ? `Seu saldo disponível é **${values.saldo_disponivel}**${values.saldos_por_conta.length > 1 ? `, somando ${values.saldos_por_conta.length} bancos` : ""}.` : null,
        values.ainda_pode_gastar ? `Considerando o que ainda entra, as contas a pagar e o reservado para metas, você ainda pode gastar **${values.ainda_pode_gastar}** até o fim do mês.` : null,
        values.sobra_estimada_fim_do_mes ? `A sobra estimada no fim do mês é de ${values.sobra_estimada_fim_do_mes}.` : null,
      ), ...cardOf(outcome)];
      return { blocks, suggestions: ["Quanto tenho em cada banco?", "O que vence esta semana?", "Como economizar este mês?"] };
    }

    case "banks": {
      const balances = accountBalances(snapshot.accounts, snapshot.expenses, currency, context.rates, context.manualRates);
      if (!snapshot.accounts.length) {
        return { blocks: [say("Você ainda não cadastrou bancos. Adicione quantos quiser e informe o saldo de cada um: assim eu mostro de onde vem seu dinheiro."), featureCard("accounts")], suggestions: ["Tenho 1500 no Nubank", "O que você consegue fazer?"] };
      }
      const withBalance = balances.items.filter((item) => item.balanceCents !== null).sort((left, right) => (right.convertedCents ?? 0) - (left.convertedCents ?? 0));
      const total = balances.totalCents;
      const card: AssistantCard = {
        kind: "accounts",
        title: "Saldo por banco",
        subtitle: withBalance.length ? `Total ${money(total)}` : "Sem saldos informados",
        items: balances.items.map((item) => ({
          name: item.account.name,
          bank: item.account.bank,
          display: item.balanceCents === null ? "sem saldo" : formatCurrency(item.balanceCents, item.account.currency),
          note: item.convertedCents !== null && total > 0 ? `${Math.round((Math.max(0, item.convertedCents) / total) * 100)}%` : undefined,
        })),
      };
      const top = withBalance[0];
      return {
        blocks: [say(
          withBalance.length ? `Você tem **${money(total)}** em ${withBalance.length} ${withBalance.length === 1 ? "banco" : "bancos"}.${top && withBalance.length > 1 ? ` A maior parte está no **${top.account.name}**.` : ""}` : "Seus bancos estão cadastrados, mas sem saldo informado.",
          balances.missingRates.length ? `Sem cotação para ${balances.missingRates.join(", ")} agora; esses saldos ficaram fora do total.` : null,
          withBalance.length < balances.items.length ? "Para atualizar um saldo, é só me dizer: \"tenho 800 no Itaú\"." : null,
        ), { type: "card", card }],
        suggestions: ["Quanto gastei em cada banco?", `Atualizar saldo do ${snapshot.accounts[0].name}`],
      };
    }

    case "recurring": {
      const outcome = tool("cobrancas_recorrentes", {});
      const values = data(outcome) as { cobrancas_ativas: unknown[]; total_mensal_equivalente: string; para_conferir: { motivo: string; itens: string[] }[] };
      if (!values.cobrancas_ativas.length) {
        return { blocks: [say("Você não tem cobranças recorrentes cadastradas. Ao registrar uma conta, marque **Repetir** para ela aparecer todo mês na Agenda."), featureCard("bills")], suggestions: ["O que vence esta semana?", "Resumo do mês"] };
      }
      return {
        blocks: [say(
          `Suas ${values.cobrancas_ativas.length} cobranças recorrentes somam **${values.total_mensal_equivalente} por mês**.`,
          values.para_conferir.length ? `Vale conferir: ${values.para_conferir.map((item) => `${item.motivo.toLowerCase()} (${item.itens.slice(0, 2).join(" e ")})`).join("; ")}. Pode ser só coincidência.` : null,
        ), ...cardOf(outcome)],
        suggestions: ["Como economizar este mês?", "O que vence esta semana?"],
      };
    }

    case "simulate_goal": {
      const monthly = monthlyAmount(u.normalized);
      const goal = snapshot.savingsGoals.find((item) => item.id === u.goalId);
      const target = goal ? goalProgress(goal, today).remainingCents / 100 : u.amounts.find((value) => value !== monthly) ?? null;
      if (!target && monthly) {
        const surplus = averageMonthlySurplus(snapshot.expenses, month);
        const fits = surplus.averageCents === null ? null : toCents(monthly) <= surplus.averageCents;
        return {
          blocks: [
            say(
              surplus.averageCents === null
                ? `Ainda não tenho meses fechados registrados para comparar. Guardando ${money(toCents(monthly))} por mês, você junta ${money(toCents(monthly * 12))} em um ano.`
                : `Sua sobra média nos últimos ${surplus.monthsWithData} ${surplus.monthsWithData === 1 ? "mês" : "meses"} foi **${money(surplus.averageCents)}**. Guardar ${money(toCents(monthly))} por mês ${fits ? "**cabe** nessa sobra" : "**fica acima** dessa sobra — talvez precise ajustar alguns gastos"}.`,
              `Em 12 meses seriam ${money(toCents(monthly * 12))}; em 24, ${money(toCents(monthly * 24))}. (Sem contar rendimento.)`,
            ),
            { type: "card", card: { kind: "plan", title: "Guardando todo mês", subtitle: `${money(toCents(monthly))} por mês`, lines: [6, 12, 24].map((months) => ({ label: `${months} meses`, value: money(toCents(monthly * months)) })), note: "Simulação sem juros nem rendimento." } },
          ],
          suggestions: [`Criar meta de ${money(toCents(monthly * 12))}`, "Como economizar este mês?"],
        };
      }
      if (!target) return ask("amount", "Qual valor você quer juntar? Se quiser, diga também o prazo (ex.: \"10 mil em 12 meses\").", []);
      const months = u.months ?? null;
      if (!months && !monthly) {
        const lines = [6, 12, 24].map((count) => ({ label: `Em ${count} meses`, value: `${money(Math.ceil(toCents(target) / count))}/mês` }));
        return {
          blocks: [say(`Para juntar **${money(toCents(target))}**${goal ? ` e completar ${goal.name}` : ""}, veja quanto guardar por mês em cada prazo:`), { type: "card", card: { kind: "plan", title: "Quanto guardar por mês", subtitle: money(toCents(target)), lines, note: "Simulação sem juros nem rendimento." } }],
          suggestions: [`Criar meta de ${money(toCents(target))} em 12 meses`, "Consigo guardar 500 por mês?"],
        };
      }
      const outcome = tool("simular_meta", { valor_alvo: target, prazo_meses: months, aporte_mensal: monthly });
      const values = data(outcome) as { aporte_mensal: string | null; meses: number | null; cabe_na_sobra_media: boolean | null; sobra_media_mensal: string | null };
      return {
        blocks: [say(
          months ? `Para juntar ${money(toCents(target))} em ${months} meses, guarde **${values.aporte_mensal} por mês**.` : `Guardando ${money(toCents(monthly!))} por mês, você chega a ${money(toCents(target))} em **${values.meses} ${values.meses === 1 ? "mês" : "meses"}**.`,
          values.cabe_na_sobra_media === null ? null : values.cabe_na_sobra_media ? `Isso cabe na sua sobra média recente (${values.sobra_media_mensal}).` : `Fica acima da sua sobra média recente (${values.sobra_media_mensal}).`,
        ), ...cardOf(outcome)],
        suggestions: goal ? ["Como estão minhas metas?"] : [`Criar meta de ${money(toCents(target))}${months ? ` em ${months} meses` : ""}`, "Como economizar este mês?"],
      };
    }

    case "investments": {
      const summary = summarizeInvestments(snapshot.investments);
      if (!summary.count) {
        return { blocks: [say("Você ainda não cadastrou aplicações. Registre onde investe (banco ou corretora, tipo e valor) para ver o total e a divisão. Se quiser, me diga: \"apliquei 1000 em CDB no Nubank\"."), featureCard("investments"), featureCard("learn")], suggestions: ["Apliquei 1000 em CDB", "O que é Tesouro Direto?"] };
      }
      const places = investmentsByInstitution(snapshot.investments);
      const outcome = tool("resumo_investimentos", {});
      const placesCard: AssistantCard = { kind: "accounts", title: "Onde você investe", subtitle: `${places.length} ${places.length === 1 ? "instituição" : "instituições"}`, items: places.map((place) => ({ name: place.name, bank: bankIdFromName(place.name), display: money(place.currentCents), note: `${Math.round(place.share * 100)}%` })) };
      return {
        blocks: [say(
          `Você tem **${money(summary.currentCents)}** investidos em ${summary.count} ${summary.count === 1 ? "aplicação" : "aplicações"}, em ${places.length} ${places.length === 1 ? "instituição" : "instituições"}.`,
          `O tipo com mais peso é **${investmentTypeName(summary.distribution[0].type)}** (${Math.round(summary.distribution[0].share * 100)}%).${summary.withCurrentValue < summary.count ? " Algumas aplicações estão sem valor atual informado; nelas conto o valor aplicado." : ""}`,
        ), { type: "card", card: placesCard }, ...cardOf(outcome)],
        suggestions: ["O que é LCI/LCA?", "Abrir investimentos"],
      };
    }

    case "investment_explain": {
      const types = matchInvestmentTypes(text);
      const chosen = types.length ? types : investmentTypes.map((item) => item.id).slice(0, 3);
      const explanation = chosen.slice(0, 3).map((type) => {
        const info = investmentTypes.find((item) => item.id === type)!;
        return `**${info.name}:** ${info.description} ${investmentNotes[type] ?? ""}`;
      });
      return {
        blocks: [say(...explanation, "Isso é uma explicação geral, não uma recomendação. Para decidir, compare taxas, prazo, liquidez e garantia, e se precisar converse com um profissional habilitado."), featureCard("learn")],
        suggestions: ["Resumo dos meus investimentos", types.includes("tesouro") ? "O que é CDB?" : "O que é Tesouro Direto?"],
      };
    }

    case "convert": {
      const amount = u.amounts[0];
      if (!amount) return ask("amount", "Qual valor você quer converter?", []);
      const from = u.currencies[0] ?? "USD";
      const to = u.currencies[1] ?? (from === currency ? "USD" : currency);
      const outcome = tool("converter_moeda", { valor: amount, de: from, para: to });
      if (outcome.isError) return { blocks: [say(`Não tenho cotação de ${from} para ${to} agora (precisa de internet para buscar). Você pode informar uma taxa manual em Bancos e contas.`), featureCard("accounts")], suggestions: [] };
      const values = data(outcome) as { valor_original: string; convertido: string; taxa: string; data_da_cotacao: string | null; origem_da_cotacao: string };
      return {
        blocks: [say(`${values.valor_original} ≈ **${values.convertido}**.`, `Taxa: ${values.taxa}${values.data_da_cotacao ? `, ${values.origem_da_cotacao} de ${formatShortDate(values.data_da_cotacao)}` : ""}. É uma referência; bancos e casas de câmbio cobram spread e taxas.`)],
        suggestions: ["Quanto tenho em cada banco?"],
      };
    }

    case "goals_status": {
      const goals = snapshot.savingsGoals;
      if (!goals.length) return { blocks: [say("Você ainda não tem metas. Me diga algo como \"criar meta de viagem de 8 mil até julho\" e eu monto para você."), featureCard("goals")], suggestions: ["Criar meta de reserva de emergência", "Criar meta de viagem de 8 mil"] };
      const items = goals.map((goal) => ({ goal, progress: goalProgress(goal, today) }));
      const needed = items.reduce((total, item) => total + (item.progress.isComplete ? 0 : item.progress.monthlyNeededCents ?? 0), 0);
      const closest = [...items].filter((item) => !item.progress.isComplete).sort((left, right) => right.progress.ratio - left.progress.ratio)[0];
      const card: AssistantCard = {
        kind: "progress",
        title: "Suas metas",
        subtitle: `${goals.length} ${goals.length === 1 ? "meta" : "metas"}`,
        href: "/goals",
        items: items.map(({ goal, progress }) => ({ label: goal.name, ratio: progress.ratio, display: `${money(progress.savedCents)} de ${money(goal.targetCents)}`, note: `${Math.floor(progress.ratio * 100)}%`, icon: goal.icon, tone: "ok" as const })),
      };
      return {
        blocks: [say(
          closest ? `A mais perto de chegar é **${closest.goal.name}**, com ${Math.floor(closest.progress.ratio * 100)}%.` : "Todas as suas metas foram alcançadas. Parabéns!",
          needed ? `Para manter os prazos, o total a guardar é de **${money(needed)} por mês**.` : null,
        ), { type: "card", card }],
        suggestions: [closest ? `Guardei 100 na ${closest.goal.name}` : "Criar uma nova meta", "Consigo guardar 500 por mês?"],
      };
    }

    case "budgets_status": {
      const usage = budgetUsage(snapshot.budgets, snapshot.expenses, month);
      if (!usage.length) {
        const top = expensesByCategory(snapshot.expenses, month)[0];
        return { blocks: [say(`Você ainda não definiu orçamentos.${top ? ` Sua maior categoria neste mês é **${top.category}** (${money(top.amountCents)}): que tal começar por ela?` : ""}`), featureCard("budgets")], suggestions: top ? [`Limite de ${Math.ceil(top.amountCents / 10000) * 100} para ${top.category}`] : ["Limite de 800 para Alimentação"] };
      }
      const alert = usage.filter((item) => item.level !== "ok");
      const card: AssistantCard = {
        kind: "progress",
        title: "Orçamentos do mês",
        subtitle: formatMonthKey(month),
        href: "/budgets",
        items: usage.map((item) => ({ label: item.category, ratio: Math.min(1, item.ratio), display: `${money(item.spentCents)} de ${money(item.limitCents)}`, note: `${Math.round(item.ratio * 100)}%`, tone: item.level === "over" ? "over" as const : item.level === "ok" ? "ok" as const : "warning" as const })),
      };
      return {
        blocks: [say(alert.length ? `${alert.length === 1 ? "Uma categoria pede" : `${alert.length} categorias pedem`} atenção: ${alert.map((item) => `**${item.category}** (${Math.round(item.ratio * 100)}%)`).join(", ")}.` : "Todos os orçamentos estão dentro do limite. Muito bem!"), { type: "card", card }],
        suggestions: ["Como economizar este mês?", alert[0] ? `Aumentar limite de ${alert[0].category}` : "Onde estou gastando mais?"],
      };
    }

    case "upcoming": {
      const until = addDays(today, 7);
      const due = snapshot.expenses.filter((item) => item.kind === "expense" && item.status !== "paid" && item.date <= until).sort((left, right) => left.date.localeCompare(right.date));
      if (!due.length) return { blocks: [say("Nada vencendo nos próximos 7 dias. Tudo em dia!")], suggestions: ["Quanto ainda posso gastar?", "Quanto pago em assinaturas?"] };
      const overdue = due.filter((item) => item.date < today);
      const total = due.reduce((sum, item) => sum + item.amountCents, 0);
      return {
        blocks: [
          say(`Você tem **${due.length} ${due.length === 1 ? "conta" : "contas"}** até ${formatShortDate(until)}, somando **${money(total)}**.${overdue.length ? ` ${overdue.length === 1 ? "Uma está" : `${overdue.length} estão`} em atraso.` : ""}`),
          { type: "card", card: { kind: "table", title: "Próximos vencimentos", columns: ["Conta", "Data", "Valor"], rows: due.slice(0, 8).map((item) => [item.description, item.date < today ? `${formatShortDate(item.date)} · atrasada` : formatShortDate(item.date), money(item.amountCents)]), footer: ["Total", "", money(total)] } },
          featureCard("bills"),
        ],
        suggestions: ["Quanto ainda posso gastar?", "Quanto pago em assinaturas?"],
      };
    }

    case "tips": {
      const categories = expensesByCategory(snapshot.expenses, month);
      const unusual = unusualIncreases(snapshot.expenses, month);
      const recurring = data(tool("cobrancas_recorrentes", {})) as { cobrancas_ativas: unknown[]; total_mensal_equivalente: string };
      const usage = budgetUsage(snapshot.budgets, snapshot.expenses, month);
      const tips: string[] = [];
      if (unusual[0]) tips.push(`- **${unusual[0].category}** está ${money(unusual[0].increaseCents)} acima da sua média dos últimos 3 meses. Vale olhar o que mudou.`);
      if (categories[0]) tips.push(`- Sua maior categoria é **${categories[0].category}** (${money(categories[0].amountCents)}). ${snapshot.budgets.some((item) => item.category === categories[0].category) ? "Acompanhe o limite dela de perto." : "Um limite mensal ajuda a segurar esse gasto."}`);
      if (recurring.cobrancas_ativas.length) tips.push(`- As assinaturas e contas fixas somam ${recurring.total_mensal_equivalente} por mês. Revise se ainda usa todas.`);
      const over = usage.find((item) => item.level === "over");
      if (over) tips.push(`- **${over.category}** já passou do limite. Segurar essa categoria até o fim do mês faz diferença.`);
      tips.push("- Separe o valor das metas assim que o dinheiro entrar: o que sobra é o que dá para gastar.");
      if (!snapshot.expenses.length) tips.unshift("- Comece registrando os gastos por uma semana: só de ver para onde vai, fica mais fácil decidir onde cortar.");
      const suggestion = categories[0] && !snapshot.budgets.some((item) => item.category === categories[0].category) ? `Limite de ${Math.ceil((categories[0].amountCents * 0.9) / 10000) * 100} para ${categories[0].category}` : "Quanto pago em assinaturas?";
      return { blocks: [say(`Olhando seus registros ${periodLabel(null)}, estes são os pontos com mais efeito:`, tips.slice(0, 4).join("\n"))], suggestions: [suggestion, "Onde estou gastando mais?", "Consigo guardar 300 por mês?"] };
    }

    case "navigate": {
      const id = u.feature!;
      const feature = features[id];
      const howTo = /\bcomo\b/.test(u.normalized) ? feature.howTo : undefined;
      return { blocks: [say(howTo ?? pick([`Aqui está ${feature.title}:`, `Te levo para ${feature.title}:`])), featureCard(id)], suggestions: ["O que você consegue fazer?"] };
    }

    case "unknown":
    default: {
      if (u.feature) return { blocks: [say(`Isso fica em **${features[u.feature].title}**:`), featureCard(u.feature)], suggestions: ["O que você consegue fazer?"] };
      return {
        blocks: [say(pick(["Não entendi bem.", "Hmm, não consegui entender."]) + " Posso ver gastos, saldo por banco, metas, orçamentos e investimentos, ou registrar algo para você. Tente uma destas:")],
        suggestions: ["Onde estou gastando mais?", "Gastei 30 na padaria", "Quanto tenho em cada banco?"],
      };
    }
  }
}
