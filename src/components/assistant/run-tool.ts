/**
 * Executa as ferramentas do assistente no navegador. Cada execução devolve só o resultado da
 * consulta (JSON para o modelo) e, quando faz sentido, um cartão com os números para a tela.
 */
import { accountBalances } from "@/domain/accounts";
import {
  averageMonthlySurplus,
  comparePeriods,
  latestRecordDate,
  recurringCharges,
  resolvePeriod,
  simulateGoal,
  spendingInPeriod,
  type Period,
} from "@/domain/assistant/calculations";
import { isToolName, toolInputSchemas, type ToolInput, type ToolName } from "@/domain/assistant/tools";
import { convertCents, type ManualRates, type RatesTable } from "@/domain/exchange";
import { investmentTypeName, summarizeInvestments } from "@/domain/investments";
import {
  budgetUsage,
  currentBalance,
  endOfMonthProjection,
  goalProgress,
  lastDayOfMonth,
  spendableThisMonth,
} from "@/domain/planning";
import type { FinanceSnapshot } from "@/lib/finance/repository";
import { formatCurrency, formatShortDate } from "@/lib/formatting";
import type { AssistantCard, AssistantProposal } from "./types";

export type ToolContext = {
  snapshot: FinanceSnapshot;
  today: string;
  rates: RatesTable | null;
  manualRates: ManualRates;
  mode: "local" | "supabase";
};

export type ToolOutcome = {
  content: string;
  isError?: boolean;
  card?: AssistantCard;
  proposal?: AssistantProposal;
};

const toCents = (value: number) => Math.round(value * 100);

function periodLabel(period: Period) {
  return `${formatShortDate(period.from)} a ${formatShortDate(period.to)}`;
}

function error(message: string): ToolOutcome {
  return { content: JSON.stringify({ erro: message }), isError: true };
}

function percent(value: number | null) {
  return value === null ? "sem base" : `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR")}%`;
}

export function runAssistantTool(name: string, rawInput: unknown, context: ToolContext): ToolOutcome {
  if (!isToolName(name)) return error(`Ferramenta desconhecida: ${name}`);
  const parsed = toolInputSchemas[name].safeParse(rawInput ?? {});
  if (!parsed.success) return error(`Parâmetros inválidos: ${parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ")}`);
  return execute(name, parsed.data as ToolInput<typeof name>, context);
}

function execute(name: ToolName, input: unknown, context: ToolContext): ToolOutcome {
  const { snapshot, today, rates, manualRates } = context;
  const currency = snapshot.preferences?.currency ?? "BRL";
  const money = (cents: number) => formatCurrency(cents, currency);
  const movements = snapshot.expenses;
  const month = today.slice(0, 7);
  const source = {
    fonte: context.mode === "local" ? "Registros feitos pela pessoa no Prumo (salvos neste navegador)" : "Registros feitos pela pessoa no Prumo (conta sincronizada)",
    registros_ate: latestRecordDate(movements, today),
    consultado_em: today,
  };
  const findAccount = (accountName: string | null | undefined) => {
    if (!accountName) return null;
    const normalized = accountName.toLocaleLowerCase("pt-BR");
    return snapshot.accounts.find((account) => account.name.toLocaleLowerCase("pt-BR") === normalized)
      ?? snapshot.accounts.find((account) => account.name.toLocaleLowerCase("pt-BR").includes(normalized))
      ?? null;
  };

  switch (name) {
    case "gastos_por_periodo": {
      const args = input as ToolInput<"gastos_por_periodo">;
      const period = resolvePeriod(args.periodo, today, args.de, args.ate);
      if (!period) return error("Período personalizado precisa de de/ate válidos (de ≤ ate).");
      const account = findAccount(args.conta);
      if (args.conta && !account) return error(`Conta "${args.conta}" não encontrada. Contas cadastradas: ${snapshot.accounts.map((item) => item.name).join(", ") || "nenhuma"}.`);
      const kind = args.tipo === "receitas" ? "income" : "expense";
      const result = spendingInPeriod(movements, snapshot.accounts, { period, groupBy: args.agrupar_por, kind, category: args.categoria, accountId: account?.id ?? null });
      const label = kind === "income" ? "Receitas" : "Gastos";
      const card: AssistantCard | undefined = result.groups.length
        ? { kind: "bars", title: `${label} por ${args.agrupar_por === "banco" ? "banco" : "categoria"}`, subtitle: `${periodLabel(period)} · total ${money(result.totalCents)}`, items: result.groups.slice(0, 8).map((group) => ({ label: group.label, value: group.cents, display: money(group.cents), note: `${group.sharePercent.toLocaleString("pt-BR")}%` })) }
        : undefined;
      return {
        content: JSON.stringify({
          periodo: { de: period.from, ate: period.to },
          tipo: args.tipo,
          total: money(result.totalCents),
          lancamentos: result.count,
          pago_ou_recebido: money(result.paidCents),
          pendente: money(result.pendingCents),
          grupos: result.groups.map((group) => ({ nome: group.label, valor: money(group.cents), participacao: `${group.sharePercent.toLocaleString("pt-BR")}%`, lancamentos: group.count })),
          maiores_lancamentos: result.largest.map((item) => ({ descricao: item.description, categoria: item.category, data: item.date, valor: money(item.cents) })),
          aviso: result.count === 0 ? "Nenhum lançamento registrado nesse período." : undefined,
          ...source,
        }),
        card,
      };
    }

    case "saldo_e_previsao": {
      const preferences = snapshot.preferences;
      const byAccount = accountBalances(snapshot.accounts, movements, currency, rates, manualRates);
      const balanceCents = byAccount.hasBalances ? byAccount.totalCents : currentBalance(preferences?.reportedBalanceCents ?? null, preferences?.balanceReportedOn ?? null, movements);
      const spendable = spendableThisMonth({ balanceCents, monthlyIncomeCents: preferences?.monthlyIncomeCents ?? null, movements, goals: snapshot.savingsGoals, month });
      const projection = endOfMonthProjection(balanceCents, preferences?.monthlyIncomeCents ?? null, movements, month);
      const lines = [
        { label: "Saldo disponível", value: balanceCents === null ? "não informado" : money(balanceCents) },
        ...(spendable ? [
          { label: spendable.basis === "balance" ? "A receber até o fim do mês" : "Renda do mês", value: money(spendable.incomingCents) },
          { label: spendable.basis === "balance" ? "Contas a pagar até o fim do mês" : "Despesas do mês", value: money(spendable.outgoingCents) },
          { label: "Reservado para metas", value: money(spendable.reservedCents) },
          { label: "Ainda pode gastar", value: money(spendable.amountCents) },
        ] : []),
        { label: "Sobra estimada no fim do mês", value: projection === null ? "sem dados" : money(projection) },
      ];
      return {
        content: JSON.stringify({
          saldo_disponivel: balanceCents === null ? null : money(balanceCents),
          origem_do_saldo: byAccount.hasBalances ? "soma dos saldos informados por conta, ajustados pelo que foi pago/recebido em cada conta" : balanceCents === null ? "a pessoa ainda não informou o saldo" : "saldo informado no perfil, ajustado pelo que foi pago/recebido desde então",
          saldo_informado_em: byAccount.hasBalances ? byAccount.items.filter((item) => item.balanceCents !== null).map((item) => ({ conta: item.account.name, em: item.account.balanceReportedOn })) : preferences?.balanceReportedOn ?? null,
          saldos_por_conta: byAccount.items.filter((item) => item.balanceCents !== null).map((item) => ({
            conta: item.account.name,
            moeda: item.account.currency,
            saldo: formatCurrency(item.balanceCents!, item.account.currency),
            convertido: item.convertedCents === null ? "sem cotação" : money(item.convertedCents),
            cotacao_de: item.rateDate,
          })),
          moedas_sem_cotacao: byAccount.missingRates,
          ainda_pode_gastar: spendable ? money(spendable.amountCents) : null,
          base_do_calculo: spendable?.basis === "balance" ? "saldo + a receber − a pagar − reservado para metas, até " + lastDayOfMonth(month) : spendable ? "renda do mês − despesas do mês − aportes em metas" : "sem saldo nem renda informados",
          a_receber_ate_fim_do_mes: spendable?.basis === "balance" ? money(spendable.incomingCents) : null,
          a_pagar_ate_fim_do_mes: spendable ? money(spendable.outgoingCents) : null,
          reservado_para_metas: spendable ? money(spendable.reservedCents) : null,
          sobra_estimada_fim_do_mes: projection === null ? null : money(projection),
          premissas: ["Considera apenas o que foi registrado no Prumo; não consulta o banco.", "Estimativa: muda se surgirem gastos ou receitas não registrados."],
          ...source,
        }),
        card: { kind: "plan", title: "Saldo e previsão do mês", subtitle: `Até ${formatShortDate(lastDayOfMonth(month))}`, lines, note: "Estimativa com base no que foi registrado." },
      };
    }

    case "comparar_periodos": {
      const args = input as ToolInput<"comparar_periodos">;
      const first = resolvePeriod(args.periodo_a.periodo, today, args.periodo_a.de, args.periodo_a.ate);
      const second = resolvePeriod(args.periodo_b.periodo, today, args.periodo_b.de, args.periodo_b.ate);
      if (!first || !second) return error("Os dois períodos precisam ser válidos.");
      const result = comparePeriods(movements, first, second, args.tipo === "receitas" ? "income" : "expense");
      return {
        content: JSON.stringify({
          periodo_a: { de: first.from, ate: first.to, total: money(result.first.totalCents), lancamentos: result.first.count },
          periodo_b: { de: second.from, ate: second.to, total: money(result.second.totalCents), lancamentos: result.second.count },
          diferenca: money(result.differenceCents),
          variacao: percent(result.changePercent),
          por_categoria: result.byCategory.map((item) => ({ categoria: item.label, periodo_a: money(item.firstCents), periodo_b: money(item.secondCents), diferenca: money(item.differenceCents), variacao: percent(item.changePercent) })),
          ...source,
        }),
        card: {
          kind: "table",
          title: args.tipo === "receitas" ? "Comparação de receitas" : "Comparação de gastos",
          subtitle: `${periodLabel(first)} × ${periodLabel(second)}`,
          columns: ["Categoria", "Antes", "Depois", "Variação"],
          rows: result.byCategory.slice(0, 8).map((item) => [item.label, money(item.firstCents), money(item.secondCents), percent(item.changePercent)]),
          footer: ["Total", money(result.first.totalCents), money(result.second.totalCents), percent(result.changePercent)],
        },
      };
    }

    case "cobrancas_recorrentes": {
      const result = recurringCharges(snapshot.recurringRules, movements, month);
      const frequency = { weekly: "semanal", monthly: "mensal", yearly: "anual" } as const;
      return {
        content: JSON.stringify({
          cobrancas_ativas: result.items.map((item) => ({ nome: item.name, categoria: item.category, valor: money(item.amountCents), frequencia: frequency[item.frequency], a_cada: item.interval, valor_variavel: item.isVariable, equivalente_mensal: money(item.monthlyCents) })),
          total_mensal_equivalente: money(result.totalMonthlyCents),
          para_conferir: result.toCheck.map((item) => ({ motivo: item.reason, itens: item.items })),
          observacao: "Pontos para conferir são indícios a verificar com a pessoa, não cobranças indevidas confirmadas.",
          aviso: result.items.length === 0 ? "Nenhuma recorrência de gasto cadastrada." : undefined,
          ...source,
        }),
        card: result.items.length ? {
          kind: "table",
          title: "Cobranças recorrentes",
          subtitle: `${result.items.length} ativas`,
          columns: ["Cobrança", "Valor", "Por mês"],
          rows: result.items.slice(0, 10).map((item) => [item.name, `${money(item.amountCents)} ${frequency[item.frequency]}`, money(item.monthlyCents)]),
          footer: ["Total", "", money(result.totalMonthlyCents)],
        } : undefined,
      };
    }

    case "simular_meta": {
      const args = input as ToolInput<"simular_meta">;
      if (!args.prazo_meses && !args.aporte_mensal) return error("Informe prazo_meses ou aporte_mensal para simular.");
      const surplus = averageMonthlySurplus(movements, month);
      const result = simulateGoal({
        targetCents: toCents(args.valor_alvo),
        initialCents: toCents(args.valor_inicial ?? 0),
        months: args.prazo_meses ?? null,
        monthlyCents: args.aporte_mensal ? toCents(args.aporte_mensal) : null,
        averageSurplusCents: surplus.averageCents,
      });
      const lines = [
        { label: "Objetivo", value: money(toCents(args.valor_alvo)) },
        ...(args.valor_inicial ? [{ label: "Já guardado", value: money(toCents(args.valor_inicial)) }] : []),
        { label: "Falta", value: money(result.remainingCents) },
        { label: "Aporte mensal", value: result.monthlyCents === null ? "—" : money(result.monthlyCents) },
        { label: "Prazo", value: result.months === null ? "—" : `${result.months} ${result.months === 1 ? "mês" : "meses"}` },
        { label: "Sobra média recente", value: surplus.averageCents === null ? "sem histórico" : money(surplus.averageCents) },
      ];
      return {
        content: JSON.stringify({
          falta: money(result.remainingCents),
          aporte_mensal: result.monthlyCents === null ? null : money(result.monthlyCents),
          meses: result.months,
          sobra_media_mensal: surplus.averageCents === null ? null : money(surplus.averageCents),
          meses_usados_na_media: surplus.monthsWithData,
          cabe_na_sobra_media: result.fitsAverageSurplus,
          premissas: result.assumptions,
          ...source,
        }),
        card: { kind: "plan", title: "Plano da meta", subtitle: "Simulação sem juros nem rendimento", lines, note: result.assumptions.join(" ") },
      };
    }

    case "resumo_investimentos": {
      const summary = summarizeInvestments(snapshot.investments);
      const institutions = [...new Set(snapshot.investments.map((item) => item.institution))];
      return {
        content: JSON.stringify({
          aplicacoes: summary.count,
          total_aplicado: money(summary.appliedCents),
          valor_atual_informado: money(summary.currentCents),
          diferenca_informada: money(summary.differenceCents),
          aplicacoes_com_valor_atual: summary.withCurrentValue,
          distribuicao: summary.distribution.map((item) => ({ tipo: investmentTypeName(item.type), valor: money(item.currentCents), participacao: `${Math.round(item.share * 1000) / 10}%`, aplicacoes: item.count })),
          instituicoes: institutions,
          observacao: "Valores informados pela pessoa. Quando não há valor atual, conta o valor aplicado. O Prumo não estima rendimento.",
          aviso: summary.count === 0 ? "Nenhuma aplicação cadastrada." : undefined,
          ...source,
        }),
        card: summary.count ? {
          kind: "bars",
          title: "Investimentos por tipo",
          subtitle: `Total ${money(summary.currentCents)}`,
          items: summary.distribution.map((item) => ({ label: investmentTypeName(item.type), value: item.currentCents, display: money(item.currentCents), note: `${Math.round(item.share * 100)}%` })),
        } : undefined,
      };
    }

    case "converter_moeda": {
      const args = input as ToolInput<"converter_moeda">;
      const converted = convertCents(toCents(args.valor), args.de, args.para, currency, rates, manualRates);
      if (!converted) return error(`Sem cotação disponível para ${args.de}→${args.para} agora. A pessoa pode informar uma taxa manual em Ajustes > Bancos e contas.`);
      return {
        content: JSON.stringify({
          valor_original: formatCurrency(toCents(args.valor), args.de),
          convertido: formatCurrency(converted.cents, args.para),
          taxa: `1 ${args.de} = ${converted.rate.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} ${args.para}`,
          origem_da_cotacao: converted.source === "manual" ? "taxa manual informada pela pessoa" : converted.source === "api" ? "cotação de referência do Banco Central Europeu (Frankfurter)" : "mesma moeda",
          data_da_cotacao: converted.date,
        }),
      };
    }

    case "metas_e_orcamentos": {
      const goals = snapshot.savingsGoals.map((goal) => {
        const progress = goalProgress(goal, today);
        return { nome: goal.name, objetivo: money(goal.targetCents), guardado: money(progress.savedCents), falta: money(progress.remainingCents), progresso: `${Math.round(progress.ratio * 100)}%`, prazo: goal.deadline, aporte_mensal_necessario: progress.monthlyNeededCents === null ? null : money(progress.monthlyNeededCents) };
      });
      const budgets = budgetUsage(snapshot.budgets, movements, month);
      return {
        content: JSON.stringify({
          metas: goals,
          orcamentos_do_mes: budgets.map((budget) => ({ categoria: budget.category, limite: money(budget.limitCents), gasto: money(budget.spentCents), restante: money(budget.remainingCents), uso: `${Math.round(budget.ratio * 100)}%` })),
          ...source,
        }),
        card: budgets.length ? {
          kind: "table",
          title: "Orçamentos do mês",
          columns: ["Categoria", "Limite", "Gasto", "Uso"],
          rows: budgets.map((budget) => [budget.category, money(budget.limitCents), money(budget.spentCents), `${Math.round(budget.ratio * 100)}%`]),
        } : undefined,
      };
    }

    case "propor_criar_meta": {
      const args = input as ToolInput<"propor_criar_meta">;
      if (args.prazo && args.prazo < today) return error("O prazo precisa ser uma data futura.");
      return proposal({ kind: "create_goal", name: args.nome.trim(), targetCents: toCents(args.valor_alvo), deadline: args.prazo ?? null, icon: args.icone ?? "other" });
    }

    case "propor_ajustar_orcamento": {
      const args = input as ToolInput<"propor_ajustar_orcamento">;
      const previous = snapshot.budgets.find((budget) => budget.category === args.categoria);
      return proposal({ kind: "set_budget", category: args.categoria, limitCents: toCents(args.limite), previousCents: previous?.limitCents ?? null });
    }

    case "propor_registrar_gasto": {
      const args = input as ToolInput<"propor_registrar_gasto">;
      const account = findAccount(args.conta);
      const date = args.data ?? today;
      return proposal({ kind: "add_expense", description: args.descricao.trim(), amountCents: toCents(args.valor), category: args.categoria, date, accountId: account?.id ?? null, accountName: account?.name ?? null, paid: args.ja_pago ?? date <= today });
    }
  }
}

function proposal(value: AssistantProposal): ToolOutcome {
  return {
    content: JSON.stringify({
      status: "proposta exibida",
      instrucao: "Um cartão com Confirmar/Cancelar foi mostrado. Nada foi alterado ainda: diga que a pessoa pode confirmar no cartão e não afirme que foi feito.",
    }),
    proposal: value,
  };
}
