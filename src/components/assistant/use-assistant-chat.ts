"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useExchangeRates } from "@/components/exchange-rates";
import { useFinance } from "@/components/finance-provider";
import { todayISO } from "@/lib/dates";
import { createFinanceId } from "@/lib/finance/repository";
import { emptyMemory, respond, type EngineReply } from "./engine";
import type { Conversation, DisplayItem, ProposalStatus } from "./types";

const storageKey = "prumo:assistant:conversations:v2";
const maxConversations = 20;

export type ChatStatus = "idle" | "thinking" | "streaming";

function readConversations(): Conversation[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? (value as Conversation[]).filter((item) => Array.isArray(item?.items)).map((item) => ({ ...item, memory: item.memory ?? emptyMemory })) : [];
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

const newId = () => createFinanceId();

function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 48 ? `${clean.slice(0, 47)}…` : clean;
}

/** Converte a resposta do motor em itens da conversa; as sugestões ficam na última fala. */
function toItems(reply: EngineReply): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (const block of reply.blocks) {
    if (block.type === "text") items.push({ id: newId(), type: "assistant", text: block.text, suggestions: [] });
    else if (block.type === "card") items.push({ id: newId(), type: "card", card: block.card });
    else items.push({ id: newId(), type: "proposal", proposal: block.proposal, status: "pending" });
  }
  const lastText = [...items].reverse().find((item) => item.type === "assistant");
  if (lastText && lastText.type === "assistant") lastText.suggestions = reply.suggestions.slice(0, 3);
  return items;
}

/**
 * Conversa com o assistente local. A resposta é calculada na hora, no aparelho; a "digitação"
 * é só um efeito curto para a leitura ficar natural. Conversas ficam salvas neste navegador.
 */
export function useAssistantChat() {
  const finance = useFinance();
  const { table, manualRates, refresh: refreshRates } = useExchangeRates();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [streamingText, setStreamingText] = useState("");
  const contextRef = useRef({ finance, table, manualRates });
  const timers = useRef<number[]>([]);
  const finishRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    contextRef.current = { finance, table, manualRates };
  });

  useEffect(() => {
    const stored = readConversations();
    Promise.resolve().then(() => setConversations(stored));
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const current = conversations.find((conversation) => conversation.id === currentId) ?? null;

  const update = useCallback((id: string, change: (conversation: Conversation) => Conversation) => {
    setConversations((list) => {
      const next = list.map((conversation) => (conversation.id === id ? { ...change(conversation), updatedAt: Date.now() } : conversation));
      writeConversations(next);
      return next;
    });
  }, []);

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  /** Mostra "pensando", "digita" o primeiro parágrafo e então publica a resposta completa. */
  const deliver = useCallback((id: string, reply: EngineReply) => {
    const items = toItems(reply);
    const finish = () => {
      clearTimers();
      finishRef.current = null;
      setStatus("idle");
      setStreamingText("");
      update(id, (conversation) => ({ ...conversation, items: [...conversation.items, ...items], memory: reply.memory }));
    };
    finishRef.current = finish;
    setStatus("thinking");
    const firstText = reply.blocks.find((block) => block.type === "text");
    const full = firstText && firstText.type === "text" ? firstText.text : "";
    const thinkMs = 380 + Math.min(420, full.length * 2);
    timers.current.push(window.setTimeout(() => {
      if (!full) return finish();
      setStatus("streaming");
      const step = Math.max(3, Math.ceil(full.length / 45));
      let shown = 0;
      const tick = () => {
        shown = Math.min(full.length, shown + step);
        setStreamingText(full.slice(0, shown));
        if (shown >= full.length) finish();
        else timers.current.push(window.setTimeout(tick, 16));
      };
      tick();
    }, thinkMs));
  }, [update]);

  const send = useCallback((text: string) => {
    const question = text.trim().slice(0, 2000);
    if (!question || status !== "idle") return;
    const { finance: data, table: rates, manualRates: manual } = contextRef.current;
    if (data.accounts.some((account) => account.currency !== (data.preferences?.currency ?? "BRL"))) refreshRates();
    const userItem: DisplayItem = { id: newId(), type: "user", text: question };
    const existing = conversations.find((conversation) => conversation.id === currentId);
    const memory = existing?.memory ?? emptyMemory;
    let reply: EngineReply;
    try {
      reply = respond(question, memory, { snapshot: data, today: todayISO(), rates, manualRates: manual, mode: data.mode });
    } catch {
      reply = { blocks: [{ type: "text", text: "Algo deu errado ao calcular essa resposta. Tente perguntar de outro jeito." }], suggestions: ["O que você consegue fazer?"], memory: emptyMemory };
    }
    let id = existing?.id;
    if (!id) {
      id = newId();
      const conversation: Conversation = { id, title: titleFrom(question), updatedAt: Date.now(), items: [userItem], memory: emptyMemory };
      setConversations((list) => {
        const next = [conversation, ...list];
        writeConversations(next);
        return next;
      });
      setCurrentId(id);
    } else {
      update(id, (conversation) => ({ ...conversation, items: [...conversation.items, userItem] }));
    }
    deliver(id, reply);
  }, [conversations, currentId, deliver, refreshRates, status, update]);

  /** Pular a digitação: publica a resposta inteira na hora. */
  const stop = useCallback(() => {
    finishRef.current?.();
  }, []);

  const newConversation = useCallback(() => {
    stop();
    setCurrentId(null);
  }, [stop]);

  const openConversation = useCallback((id: string) => {
    stop();
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
    send,
    stop,
    newConversation,
    openConversation,
    deleteConversation,
    setProposalStatus,
  };
}
