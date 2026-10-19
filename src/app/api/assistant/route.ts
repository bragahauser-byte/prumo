import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { toolDefinitions } from "@/domain/assistant/tools";
import { assistantContextBlock, assistantSystemPrompt } from "@/lib/assistant/system-prompt";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Proxy do assistente: recebe a conversa (já com resultados de ferramentas calculados no navegador),
 * chama a API da Anthropic com streaming e devolve eventos SSE. A chave fica só no servidor.
 * O laço de ferramentas roda no cliente, onde estão os dados; esta rota faz um turno por chamada.
 */

const defaultModel = "claude-sonnet-5-5";
const maxBodyBytes = 400_000;

const blockSchema = z.object({ type: z.string().max(40) }).passthrough();
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string().max(4000), z.array(blockSchema).max(40)]),
});
const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(120),
  context: z.object({
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weekday: z.string().max(20),
    name: z.string().max(80).nullable(),
    currency: z.string().length(3),
    accounts: z.array(z.object({ name: z.string().max(60), currency: z.string().length(3) })).max(30),
    categories: z.array(z.string().max(80)).max(40),
    hasData: z.object({ movements: z.number(), goals: z.number(), budgets: z.number(), investments: z.number(), recurring: z.number() }),
  }),
});

/** Limite simples por IP (melhor esforço: cada instância serverless tem a própria contagem). */
const windowMs = 10 * 60 * 1000;
const maxRequestsPerWindow = 60;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > maxRequestsPerWindow;
}

function json(status: number, code: string, message: string) {
  return Response.json({ code, message }, { status });
}

function friendlyError(error: unknown): { code: string; message: string } {
  if (error instanceof Anthropic.RateLimitError) return { code: "rate_limit", message: "Muitas perguntas em pouco tempo. Espere um instante e tente de novo." };
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return { code: "config", message: "O assistente não está configurado corretamente no servidor." };
  if (error instanceof Anthropic.BadRequestError) return { code: "bad_request", message: "Não consegui processar esta conversa. Tente começar uma nova." };
  if (error instanceof Anthropic.APIConnectionError) return { code: "connection", message: "Não foi possível falar com o serviço de IA agora. Verifique a conexão e tente de novo." };
  if (error instanceof Anthropic.APIError) return { code: "unavailable", message: "O serviço de IA está instável no momento. Tente de novo em alguns segundos." };
  return { code: "unknown", message: "Algo deu errado ao gerar a resposta. Tente de novo." };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(503, "not_configured", "O assistente ainda não foi configurado neste servidor (falta a chave da API).");

  // Com contas (Supabase), só quem está logado usa o assistente.
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims.sub) return json(401, "unauthorized", "Entre na sua conta para usar o assistente.");
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return json(429, "rate_limit", "Muitas perguntas em pouco tempo. Espere alguns minutos e tente de novo.");

  const raw = await request.text();
  if (raw.length > maxBodyBytes) return json(413, "too_large", "Esta conversa ficou longa demais. Comece uma nova conversa.");

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(JSON.parse(raw));
  } catch {
    return json(400, "bad_request", "Requisição inválida.");
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const model = process.env.ANTHROPIC_MODEL || defaultModel;
  const effort = (process.env.ANTHROPIC_EFFORT as "low" | "medium" | "high" | undefined) || "low";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        const messageStream = client.beta.messages.stream({
          model,
          max_tokens: 16000,
          // Fallback padrão do servidor quando o modelo recusa por política (Claude API).
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort },
          system: [
            { type: "text", text: assistantSystemPrompt, cache_control: { type: "ephemeral" } },
            { type: "text", text: assistantContextBlock(body.context) },
          ],
          tools: toolDefinitions.map((tool) => ({ ...tool, input_schema: tool.input_schema as Anthropic.Beta.BetaTool.InputSchema, eager_input_streaming: true })),
          messages: body.messages as unknown as Anthropic.Beta.BetaMessageParam[],
        }, { signal: request.signal });

        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ type: "text", text: event.delta.text });
        }
        const message = await messageStream.finalMessage();
        send({ type: "done", content: message.content, stop_reason: message.stop_reason });
      } catch (error) {
        if (!request.signal.aborted) send({ type: "error", ...friendlyError(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
