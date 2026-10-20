/**
 * Ferramentas do assistente: validação das entradas (zod) das consultas e propostas que o motor local executa.
 * Rodam no navegador, sobre os dados da pessoa; nada sai do aparelho.
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
