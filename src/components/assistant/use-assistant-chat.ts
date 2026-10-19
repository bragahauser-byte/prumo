"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useExchangeRates } from "@/components/exchange-rates";
import { useFinance } from "@/components/finance-provider";
import { expenseCategories } from "@/domain/categories";
import { asset } from "@/lib/base-path";
import { todayISO } from "@/lib/dates";
import { createFinanceId } from "@/lib/finance/repository";
import { runAssistantTool } from "./run-tool";
import type { ApiContentBlock, ApiMessage, Conversation, DisplayItem, ProposalStatus } from "./types";

const storageKey = "prumo:assistant:conversations:v1";
const maxConversations = 20;
const maxToolRounds = 8;

export type ChatError = { message: string; retryable: boolean };
export type ChatStatus = "idle" | "thinking" | "streaming";

function readConversations(): Conversation[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? (value as Conversation[]) : [];
  } catch {
    return [];
  }
}

function writeConversations(conversations: Conversation[]) {
  const sorted = [...conversations].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, maxConversations);
  for (let keep = sorted.length; keep > 0; keep -= 1) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(sorted.slice(0, keep)));
      return;
    } catch {
      // Sem espaço: tenta guardar menos conversas antigas.
    }
  }
}

/** Separa as sugestões de resposta rápida (<sugestoes>a|b|c</sugestoes>) do texto. */
export function splitSuggestions(text: string) {
  const match = text.match(/<sugestoes>([\s\S]*?)(<\/sugestoes>|$)/);
  const suggestions = match ? match[1].split("|").map((item) => item.trim()).filter(Boolean).slice(0, 3) : [];
  const clean = text.replace(/<sugestoes>[\s\S]*$/, "").replace(/<[a-z]*$/i, "").trim();
  return { text: clean, suggestions };
}

const newId = () => createFinanceId();

function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 48 ? `${clean.slice(0, 47)}…` : clean;
}

type StreamResult = { content: ApiContentBlock[]; stopReason: string | null };

class ChatRequestError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

async function streamTurn(body: unknown, signal: AbortSignal, onText: (text: string) => void): Promise<StreamResult> {
  let response: Response;
  try {
    response = await fetch(asset("/api/assistant"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ChatRequestError("Não consegui me conectar. Verifique sua internet e tente de novo.", true);
  }
  if (response.status === 404 || response.status === 405) {
    throw new ChatRequestError("O assistente precisa do servidor do Prumo e não está disponível nesta versão estática. Use a versão publicada na Vercel.", false);
  }
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
    throw new ChatRequestError(data?.message ?? "O assistente não respondeu agora. Tente de novo.", data?.code !== "not_configured" && data?.code !== "unauthorized");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: StreamResult | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator >= 0) {
      const chunk = buffer.slice(0, separator).trim();
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf("\n\n");
      if (!chunk.startsWith("data:")) continue;
      const event = JSON.parse(chunk.slice(5)) as { type: string; text?: string; content?: ApiContentBlock[]; stop_reason?: string | null; message?: string; code?: string };
      if (event.type === "text" && event.text) onText(event.text);
      else if (event.type === "done") result = { content: event.content ?? [], stopReason: event.stop_reason ?? null };
      else if (event.type === "error") throw new ChatRequestError(event.message ?? "Algo deu errado. Tente de novo.", event.code !== "config");
    }
  }
  if (!result) throw new ChatRequestError("A resposta foi interrompida. Tente de novo.", true);
  return result;
}

export function useAssistantChat() {
  const finance = useFinance();
  const { table, manualRates, refresh: refreshRates } = useExchangeRates();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<ChatError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contextRef = useRef({ finance, table, manualRates });

  useEffect(() => {
    contextRef.current = { finance, table, manualRates };
  });

  useEffect(() => {
    const stored = readConversations();
    Promise.resolve().then(() => setConversations(stored));
  }, []);

  const current = conversations.find((conversation) => conversation.id === currentId) ?? null;

  const update = useCallback((id: string, change: (conversation: Conversation) => Conversation) => {
    setConversations((list) => {
      const next = list.map((conversation) => (conversation.id === id ? { ...change(conversation), updatedAt: Date.now() } : conversation));
      writeConversations(next);
      return next;
    });
  }, []);

  const requestContext = useCallback(() => {
    const { finance: data } = contextRef.current;
    const today = todayISO();
    return {
      today,
      weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date()),
      name: data.preferences?.displayName ?? null,
      currency: data.preferences?.currency ?? "BRL",
      accounts: data.accounts.map((account) => ({ name: account.name, currency: account.currency })),
      categories: [...expenseCategories],
      hasData: {
        movements: data.expenses.length,
        goals: data.savingsGoals.length,
        budgets: data.budgets.length,
        investments: data.investments.length,
        recurring: data.recurringRules.length,
      },
    };
  }, []);

  /** Roda turnos até o modelo terminar: cada pedido de ferramenta é executado aqui e devolvido. */
  const runLoop = useCallback(async (id: string, startingApi: ApiMessage[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    let api = startingApi;
    setError(null);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError({ message: "Você está sem internet. Conecte-se e toque em Tentar de novo.", retryable: true });
      return;
    }
    if (contextRef.current.finance.accounts.some((account) => account.currency !== (contextRef.current.finance.preferences?.currency ?? "BRL"))) refreshRates();
    try {
      for (let round = 0; round < maxToolRounds; round += 1) {
        setStatus("thinking");
        setStreamingText("");
        let streamed = "";
        const result = await streamTurn({ messages: api, context: requestContext() }, controller.signal, (text) => {
          streamed += text;
          setStatus("streaming");
          setStreamingText(splitSuggestions(streamed).text);
        });
        api = [...api, { role: "assistant", content: result.content }];
        const fullText = result.content.filter((block) => block.type === "text").map((block) => String(block.text ?? "")).join("");
        const { text, suggestions } = splitSuggestions(fullText);
        const items: DisplayItem[] = [];
        if (text) items.push({ id: newId(), type: "assistant", text, suggestions: result.stopReason === "tool_use" ? [] : suggestions });

        if (result.stopReason === "tool_use") {
          const { finance: data, table: rates, manualRates: manual } = contextRef.current;
          const toolResults: ApiContentBlock[] = [];
          for (const block of result.content.filter((item) => item.type === "tool_use")) {
            const outcome = runAssistantTool(String(block.name), block.input, {
              snapshot: data,
              today: todayISO(),
              rates,
              manualRates: manual,
              mode: data.mode,
            });
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) });
            if (outcome.card) items.push({ id: newId(), type: "card", card: outcome.card });
            if (outcome.proposal) items.push({ id: newId(), type: "proposal", proposal: outcome.proposal, status: "pending" });
          }
          api = [...api, { role: "user", content: toolResults }];
          const snapshotApi = api;
          update(id, (conversation) => ({ ...conversation, api: snapshotApi, items: [...conversation.items, ...items] }));
          continue;
        }

        if (result.stopReason === "refusal") items.push({ id: newId(), type: "notice", text: "Não posso ajudar com esse pedido. Posso ajudar com seus gastos, saldo, metas e orçamentos." });
        if (result.stopReason === "max_tokens") items.push({ id: newId(), type: "notice", text: "A resposta ficou longa e foi cortada. Peça para eu continuar ou resumir." });
        const finalApi = api;
        update(id, (conversation) => ({ ...conversation, api: finalApi, items: [...conversation.items, ...items] }));
        break;
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      const message = caught instanceof ChatRequestError ? caught.message : "Algo deu errado ao responder. Tente de novo.";
      const retryable = caught instanceof ChatRequestError ? caught.retryable : true;
      setError({ message, retryable });
      // Guarda o que já foi concluído (turnos e resultados de ferramentas) para o "Tentar de novo" seguir dali.
      const partialApi = api;
      update(id, (conversation) => ({ ...conversation, api: partialApi }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStatus("idle");
      setStreamingText("");
    }
  }, [refreshRates, requestContext, update]);

  const send = useCallback((text: string) => {
    const question = text.trim().slice(0, 2000);
    if (!question || status !== "idle") return;
    let id = currentId;
    let api: ApiMessage[];
    const userItem: DisplayItem = { id: newId(), type: "user", text: question };
    const existing = conversations.find((conversation) => conversation.id === id);
    if (!existing) {
      id = newId();
      api = [{ role: "user", content: question }];
      const conversation: Conversation = { id, title: titleFrom(question), updatedAt: Date.now(), api, items: [userItem] };
      setConversations((list) => {
        const next = [conversation, ...list];
        writeConversations(next);
        return next;
      });
      setCurrentId(id);
    } else {
      // Se o último envio falhou antes da resposta, a pergunta nova substitui a pendente no histórico da API.
      const last = existing.api.at(-1);
      const pendingQuestion = last?.role === "user" && typeof last.content === "string";
      api = [...(pendingQuestion ? existing.api.slice(0, -1) : existing.api), { role: "user", content: question }];
      const nextApi = api;
      update(existing.id, (conversation) => ({ ...conversation, api: nextApi, items: [...conversation.items, userItem] }));
    }
    void runLoop(id!, api);
  }, [conversations, currentId, runLoop, status, update]);

  const retry = useCallback(() => {
    if (!current || status !== "idle") return;
    const last = current.api.at(-1);
    if (!last || last.role !== "user") return setError(null);
    void runLoop(current.id, current.api);
  }, [current, runLoop, status]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setStreamingText("");
  }, []);

  const newConversation = useCallback(() => {
    stop();
    setError(null);
    setCurrentId(null);
  }, [stop]);

  const openConversation = useCallback((id: string) => {
    stop();
    setError(null);
    setCurrentId(id);
  }, [stop]);

  const deleteConversation = useCallback((id: string) => {
    setConversations((list) => {
      const next = list.filter((conversation) => conversation.id !== id);
      writeConversations(next);
      return next;
    });
    if (id === currentId) setCurrentId(null);
  }, [currentId]);

  const setProposalStatus = useCallback((itemId: string, nextStatus: ProposalStatus) => {
    if (!currentId) return;
    update(currentId, (conversation) => ({
      ...conversation,
      items: conversation.items.map((item) => (item.id === itemId && item.type === "proposal" ? { ...item, status: nextStatus } : item)),
    }));
  }, [currentId, update]);

  return {
    conversations: [...conversations].sort((left, right) => right.updatedAt - left.updatedAt),
    current,
    status,
    streamingText,
    error,
    send,
    retry,
    stop,
    newConversation,
    openConversation,
    deleteConversation,
    setProposalStatus,
  };
}
