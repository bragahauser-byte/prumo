/**
 * Ferramentas do assistente: definição enviada ao modelo (JSON Schema) e validação das entradas (zod).
 * As ferramentas rodam no navegador, sobre os dados da pessoa; só o resultado de cada consulta
 * vai para o modelo, nunca o histórico financeiro inteiro.
 * Ferramentas "propor_*" não mudam nada: mostram um cartão e só executam se a pessoa confirmar.
 */
import { z } from "zod";
import { expenseCategories } from "../categories";
import { currencyCodes } from "../currencies";

const presets = ["este_mes", "mes_passado", "ultimos_30_dias", "ultimos_3_meses", "este_ano", "personalizado"] as const;
const goalIcons = ["travel", "emergency", "electronics", "car", "house", "education", "health", "family", "adventure", "ticket", "gift", "other"] as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().positive().max(100_000_000);

const periodSchema = z.object({
  periodo: z.enum(presets),
  de: date.nullish(),
  ate: date.nullish(),
});

export const toolInputSchemas = {
  gastos_por_periodo: periodSchema.extend({
    agrupar_por: z.enum(["categoria", "banco", "nenhum"]).default("categoria"),
    tipo: z.enum(["gastos", "receitas"]).default("gastos"),
    categoria: z.string().max(80).nullish(),
    conta: z.string().max(60).nullish(),
  }),
  saldo_e_previsao: z.object({}).passthrough(),
  comparar_periodos: z.object({
    periodo_a: periodSchema,
    periodo_b: periodSchema,
    tipo: z.enum(["gastos", "receitas"]).default("gastos"),
  }),
  cobrancas_recorrentes: z.object({}).passthrough(),
  simular_meta: z.object({
    valor_alvo: money,
    valor_inicial: z.number().min(0).max(100_000_000).nullish(),
    prazo_meses: z.number().int().min(1).max(600).nullish(),
    aporte_mensal: money.nullish(),
  }),
  resumo_investimentos: z.object({}).passthrough(),
  converter_moeda: z.object({
    valor: money,
    de: z.enum(currencyCodes),
    para: z.enum(currencyCodes),
  }),
  metas_e_orcamentos: z.object({}).passthrough(),
  propor_criar_meta: z.object({
    nome: z.string().min(1).max(80),
    valor_alvo: money,
    prazo: date.nullish(),
    icone: z.enum(goalIcons).nullish(),
  }),
  propor_ajustar_orcamento: z.object({
    categoria: z.enum(expenseCategories),
    limite: money,
  }),
  propor_registrar_gasto: z.object({
    descricao: z.string().min(1).max(120),
    valor: money,
    categoria: z.enum(expenseCategories),
    data: date.nullish(),
    conta: z.string().max(60).nullish(),
    ja_pago: z.boolean().nullish(),
  }),
} as const;

export type ToolName = keyof typeof toolInputSchemas;
export type ToolInput<T extends ToolName> = z.infer<(typeof toolInputSchemas)[T]>;

export function isToolName(name: string): name is ToolName {
  return Object.hasOwn(toolInputSchemas, name);
}

const periodJson = {
  type: "object",
  properties: {
    periodo: { type: "string", enum: presets, description: "Período nomeado. Use \"personalizado\" com de/ate para datas específicas." },
    de: { type: "string", description: "Data inicial AAAA-MM-DD (só para personalizado)." },
    ate: { type: "string", description: "Data final AAAA-MM-DD (só para personalizado)." },
  },
  required: ["periodo"],
  additionalProperties: false,
};

const empty = { type: "object", properties: {}, additionalProperties: false };

/** Definições enviadas ao modelo. Valores monetários são em unidades da moeda (ex.: 150.5 = R$ 150,50). */
export const toolDefinitions: { name: ToolName; description: string; input_schema: Record<string, unknown> }[] = [
  {
    name: "gastos_por_periodo",
    description: "Soma gastos (ou receitas) registrados em um período, com total pago e pendente, agrupamento por categoria ou por banco/conta e os maiores lançamentos. Use para perguntas como \"onde estou gastando mais\" ou \"quanto gastei com X\".",
    input_schema: {
      type: "object",
      properties: {
        ...periodJson.properties,
        agrupar_por: { type: "string", enum: ["categoria", "banco", "nenhum"] },
        tipo: { type: "string", enum: ["gastos", "receitas"] },
        categoria: { type: "string", description: "Filtra por uma categoria exata." },
        conta: { type: "string", description: "Filtra pelo nome de uma conta/banco cadastrado." },
      },
      required: ["periodo"],
      additionalProperties: false,
    },
  },
  {
    name: "saldo_e_previsao",
    description: "Saldo disponível atual (com origem e data em que foi informado), saldos por conta, contas a pagar e receitas a receber até o fim do mês, quanto ainda pode gastar e a sobra estimada no fim do mês, com as premissas do cálculo.",
    input_schema: empty,
  },
  {
    name: "comparar_periodos",
    description: "Compara gastos (ou receitas) de dois períodos: totais, diferença, variação percentual e diferença por categoria.",
    input_schema: {
      type: "object",
      properties: { periodo_a: periodJson, periodo_b: periodJson, tipo: { type: "string", enum: ["gastos", "receitas"] } },
      required: ["periodo_a", "periodo_b"],
      additionalProperties: false,
    },
  },
  {
    name: "cobrancas_recorrentes",
    description: "Lista as cobranças recorrentes ativas (assinaturas, contas fixas) com custo mensal equivalente e o total, mais pontos para a pessoa conferir (possíveis duplicidades). Os pontos são só indícios: não afirme que uma cobrança é indevida.",
    input_schema: empty,
  },
  {
    name: "simular_meta",
    description: "Simula uma meta de economia sem juros nem rendimento: com prazo_meses calcula o aporte mensal; com aporte_mensal calcula em quantos meses chega. Compara com a sobra média dos últimos meses registrados.",
    input_schema: {
      type: "object",
      properties: {
        valor_alvo: { type: "number", description: "Valor do objetivo, na moeda-base." },
        valor_inicial: { type: "number", description: "Quanto já tem guardado para isso." },
        prazo_meses: { type: "integer", description: "Em quantos meses quer chegar." },
        aporte_mensal: { type: "number", description: "Quanto consegue guardar por mês." },
      },
      required: ["valor_alvo"],
      additionalProperties: false,
    },
  },
  {
    name: "resumo_investimentos",
    description: "Resumo das aplicações cadastradas pela pessoa: total aplicado, valor atual informado, distribuição por tipo e instituições. Não estima rendimento.",
    input_schema: empty,
  },
  {
    name: "converter_moeda",
    description: "Converte um valor entre moedas pela cotação de referência em cache (ou taxa manual da pessoa), informando a data da cotação.",
    input_schema: {
      type: "object",
      properties: {
        valor: { type: "number" },
        de: { type: "string", enum: currencyCodes },
        para: { type: "string", enum: currencyCodes },
      },
      required: ["valor", "de", "para"],
      additionalProperties: false,
    },
  },
  {
    name: "metas_e_orcamentos",
    description: "Metas de economia (guardado, faltante, prazo, aporte mensal necessário) e orçamentos por categoria do mês (limite, gasto, restante).",
    input_schema: empty,
  },
  {
    name: "propor_criar_meta",
    description: "Propõe criar uma meta de economia. Nada é criado até a pessoa confirmar no cartão exibido.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        valor_alvo: { type: "number" },
        prazo: { type: "string", description: "Data limite AAAA-MM-DD (opcional)." },
        icone: { type: "string", enum: goalIcons },
      },
      required: ["nome", "valor_alvo"],
      additionalProperties: false,
    },
  },
  {
    name: "propor_ajustar_orcamento",
    description: "Propõe criar ou ajustar o limite mensal de uma categoria de gasto. Nada muda até a pessoa confirmar.",
    input_schema: {
      type: "object",
      properties: {
        categoria: { type: "string", enum: expenseCategories },
        limite: { type: "number", description: "Novo limite mensal na moeda-base." },
      },
      required: ["categoria", "limite"],
      additionalProperties: false,
    },
  },
  {
    name: "propor_registrar_gasto",
    description: "Propõe registrar um gasto. Nada é registrado até a pessoa confirmar.",
    input_schema: {
      type: "object",
      properties: {
        descricao: { type: "string" },
        valor: { type: "number" },
        categoria: { type: "string", enum: expenseCategories },
        data: { type: "string", description: "AAAA-MM-DD; padrão hoje." },
        conta: { type: "string", description: "Nome da conta/banco cadastrado (opcional)." },
        ja_pago: { type: "boolean", description: "Padrão: verdadeiro se a data for hoje ou passada." },
      },
      required: ["descricao", "valor", "categoria"],
      additionalProperties: false,
    },
  },
];
