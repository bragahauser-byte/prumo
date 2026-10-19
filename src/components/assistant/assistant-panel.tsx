"use client";

import { ArrowUp, ChevronLeft, History, Plus, RotateCcw, Sparkles, Square, SquarePen, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFinance } from "@/components/finance-provider";
import { focusRing } from "@/components/ui/primitives";
import { AssistantCardView, AssistantText, ProposalCard } from "./assistant-cards";
import { useAssistant } from "./assistant-context";
import { useAssistantChat } from "./use-assistant-chat";

const baseSuggestions = ["Onde estou gastando mais?", "Como economizar este mês?", "Consigo guardar R$ 500 por mês?"];

const shortcuts = [
  { label: "Registrar um gasto", prompt: "Quero registrar um gasto: " },
  { label: "Criar uma meta", prompt: "Quero criar uma meta para " },
  { label: "Ajustar um orçamento", prompt: "Quero ajustar o orçamento de " },
  { label: "Comparar com o mês passado", prompt: "Compare meus gastos deste mês com o mês passado" },
];

function Sparkle({ size = 20, className = "" }: { size?: number; className?: string }) {
  return <Sparkles size={size} strokeWidth={1.75} fill="currentColor" aria-hidden="true" className={className} />;
}

const iconButton = `flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-[var(--color-text)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-white ${focusRing}`;

export function AssistantPanel() {
  const { open, closeAssistant, consumePrompt, pendingPrompt } = useAssistant();
  if (!open) return null;
  return <AssistantDialog onClose={closeAssistant} consumePrompt={consumePrompt} hasPrompt={Boolean(pendingPrompt)} />;
}

function AssistantDialog({ onClose, consumePrompt, hasPrompt }: { onClose: () => void; consumePrompt: () => string | null; hasPrompt: boolean }) {
  const { preferences, budgets, recurringRules, investments, accounts } = useFinance();
  const chat = useAssistantChat();
  const [input, setInput] = useState("");
  const [view, setView] = useState<"chat" | "history">("chat");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstName = preferences?.displayName?.trim().split(/\s+/)[0];
  const busy = chat.status !== "idle";
  const items = chat.current?.items ?? [];
  const lastAssistantIndex = items.map((item) => item.type).lastIndexOf("assistant");

  const suggestions = useMemo(() => {
    const extra: string[] = [];
    if (recurringRules.length) extra.push("Quanto pago em assinaturas?");
    if (budgets.length) extra.push("Como estão meus orçamentos?");
    if (investments.length) extra.push("Resumo dos meus investimentos");
    if (accounts.length > 1) extra.push("Quanto gastei em cada banco?");
    return [...baseSuggestions, ...extra.slice(0, 2)];
  }, [accounts.length, budgets.length, investments.length, recurringRules.length]);

  // Pergunta enviada de fora (atalho de outra tela).
  useEffect(() => {
    if (!hasPrompt) return;
    const prompt = consumePrompt();
    if (prompt) chat.send(prompt);
  }, [chat, consumePrompt, hasPrompt]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items.length, chat.streamingText, chat.status, chat.error]);

  function submit(text = input) {
    if (!text.trim() || busy) return;
    chat.send(text);
    setInput("");
    setShowShortcuts(false);
    requestAnimationFrame(() => { if (inputRef.current) inputRef.current.style.height = ""; });
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-center bg-black/30 lg:items-center lg:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Assistente financeiro"
        className="animate-sheet-in relative flex h-dvh w-full flex-col overflow-hidden bg-[radial-gradient(120%_60%_at_0%_0%,#fdf1e7_0%,transparent_60%),radial-gradient(120%_60%_at_100%_100%,#eef1f6_0%,transparent_60%),linear-gradient(180deg,#faf9f7,#f5f5f3)] text-[var(--color-text)] lg:h-[min(860px,calc(100dvh-48px))] lg:max-w-[480px] lg:rounded-[36px] lg:shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
      >
        <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(env(safe-area-inset-top),16px)]">
          {view === "history" ? (
            <button type="button" onClick={() => setView("chat")} aria-label="Voltar à conversa" className={iconButton}><ChevronLeft size={20} aria-hidden="true" /></button>
          ) : (
            <button type="button" onClick={() => { chat.newConversation(); setInput(""); inputRef.current?.focus(); }} aria-label="Nova conversa" className={iconButton}><SquarePen size={18} aria-hidden="true" /></button>
          )}
          {view === "history" ? <h2 className="text-base font-semibold">Conversas</h2> : null}
          <div className="flex items-center gap-2">
            {view === "chat" ? <button type="button" onClick={() => setView("history")} aria-label="Histórico de conversas" className={iconButton}><History size={18} aria-hidden="true" /></button> : null}
            <button type="button" onClick={onClose} aria-label="Fechar assistente" className={iconButton}><X size={20} aria-hidden="true" /></button>
          </div>
        </header>

        {view === "history" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {chat.conversations.length ? (
              <ul className="mt-2 divide-y divide-black/[0.06] rounded-[20px] bg-white/80">
                {chat.conversations.map((conversation) => (
                  <li key={conversation.id} className="flex items-center gap-2 px-2">
                    <button type="button" onClick={() => { chat.openConversation(conversation.id); setView("chat"); }} className={`min-h-14 min-w-0 flex-1 rounded-2xl px-2 py-2 text-left ${focusRing}`}>
                      <span className="block truncate text-base font-medium">{conversation.title}</span>
                      <span className="block text-xs text-[var(--color-tertiary)]">{new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(conversation.updatedAt)}</span>
                    </button>
                    <button type="button" onClick={() => chat.deleteConversation(conversation.id)} aria-label={`Apagar conversa: ${conversation.title}`} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-tertiary)] hover:bg-[var(--color-soft)] ${focusRing}`}><Trash2 size={18} aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-10 text-center text-sm text-[var(--color-tertiary)]">Suas conversas ficam salvas aqui, neste dispositivo.</p>}
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4" aria-live="polite">
              {items.length === 0 && !busy ? (
                <div className="pt-[14vh]">
                  <Sparkle size={22} className="text-[var(--color-highlight)]" />
                  <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.02em]">
                    Oi{firstName ? `, ${firstName}` : ""}!<br />O que você precisa?
                  </h1>
                  <p className="mt-3 max-w-[320px] text-sm leading-5 text-[var(--color-tertiary)]">Pergunte sobre gastos, saldo, metas e orçamentos. Eu consulto seus registros no Prumo e só mudo algo quando você confirmar.</p>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {items.map((item, index) => {
                    if (item.type === "user") {
                      return <div key={item.id} className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-white px-4 py-2.5 text-base leading-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">{item.text}</p></div>;
                    }
                    if (item.type === "assistant") {
                      return (
                        <div key={item.id}>
                          <Sparkle size={16} className="mb-2 text-[var(--color-highlight)]" />
                          <AssistantText text={item.text} />
                          {index === lastAssistantIndex && item.suggestions.length && !busy ? (
                            <div className="mt-3 flex flex-col items-start gap-2">
                              {item.suggestions.map((suggestion) => (
                                <button key={suggestion} type="button" onClick={() => submit(suggestion)} className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-black/[0.06] bg-white/70 px-4 text-left text-sm font-medium transition-colors hover:bg-white ${focusRing}`}>
                                  <Sparkle size={14} className="text-[var(--color-tertiary)]" />{suggestion}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                    if (item.type === "card") return <AssistantCardView key={item.id} card={item.card} />;
                    if (item.type === "proposal") return <ProposalCard key={item.id} proposal={item.proposal} status={item.status} onStatus={(status) => chat.setProposalStatus(item.id, status)} />;
                    return <p key={item.id} className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-[var(--color-muted)]">{item.text}</p>;
                  })}

                  {chat.status === "thinking" ? (
                    <div className="flex items-center gap-2 text-[var(--color-tertiary)]" role="status" aria-label="Pensando">
                      <Sparkle size={16} className="animate-pulse text-[var(--color-highlight)]" />
                      <span className="flex gap-1" aria-hidden="true">
                        {[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${dot * 120}ms` }} />)}
                      </span>
                    </div>
                  ) : null}
                  {chat.status === "streaming" && chat.streamingText ? (
                    <div>
                      <Sparkle size={16} className="mb-2 text-[var(--color-highlight)]" />
                      <AssistantText text={chat.streamingText} />
                      <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[var(--color-text)] align-middle" />
                    </div>
                  ) : null}

                  {chat.error ? (
                    <div role="alert" className="rounded-[20px] bg-white/80 px-4 py-3">
                      <p className="text-sm text-[var(--color-muted)]">{chat.error.message}</p>
                      {chat.error.retryable ? (
                        <button type="button" onClick={chat.retry} className={`mt-2 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-soft)] px-4 text-sm font-semibold ${focusRing}`}>
                          <RotateCcw size={16} aria-hidden="true" /> Tentar de novo
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2">
              {items.length === 0 && !busy ? (
                <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                  {suggestions.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => submit(suggestion)} className={`min-h-[60px] w-[150px] shrink-0 rounded-[20px] border border-black/[0.05] bg-white/70 px-4 py-3 text-left text-sm font-medium leading-5 transition-colors hover:bg-white ${focusRing}`}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}

              {showShortcuts ? (
                <div className="mb-2 rounded-[20px] bg-white p-2 shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
                  {shortcuts.map((shortcut) => (
                    <button key={shortcut.label} type="button" onClick={() => { setInput(shortcut.prompt); setShowShortcuts(false); inputRef.current?.focus(); }} className={`flex min-h-11 w-full items-center rounded-2xl px-3 text-left text-sm font-medium hover:bg-[var(--color-soft)] ${focusRing}`}>
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="flex items-end gap-2">
                <button type="button" onClick={() => setShowShortcuts((value) => !value)} aria-label="Atalhos" aria-expanded={showShortcuts} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-white/70 ${focusRing}`}>
                  <Plus size={22} aria-hidden="true" />
                </button>
                <div className="flex min-h-12 flex-1 items-end gap-2 rounded-[26px] border border-black/[0.08] bg-white/90 py-1.5 pl-4 pr-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] focus-within:border-black/20">
                  <label className="sr-only" htmlFor="assistant-input">Mensagem para o assistente</label>
                  <textarea
                    id="assistant-input"
                    ref={inputRef}
                    rows={1}
                    value={input}
                    maxLength={2000}
                    onChange={(event) => {
                      setInput(event.target.value);
                      event.target.style.height = "";
                      event.target.style.height = `${Math.min(event.target.scrollHeight, 132)}px`;
                    }}
                    onKeyDown={onInputKeyDown}
                    placeholder="Pergunte ou peça algo"
                    className="max-h-[132px] min-h-9 flex-1 resize-none bg-transparent py-1.5 text-base leading-6 outline-none placeholder:text-[var(--color-placeholder)]"
                  />
                  {busy ? (
                    <button type="button" onClick={chat.stop} aria-label="Parar resposta" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-text)] text-white ${focusRing}`}>
                      <Square size={14} fill="currentColor" aria-hidden="true" />
                    </button>
                  ) : (
                    <button type="submit" disabled={!input.trim()} aria-label="Enviar" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-highlight)] text-white transition-opacity disabled:bg-[var(--color-border)] disabled:text-[var(--color-placeholder)] ${focusRing}`}>
                      <ArrowUp size={18} strokeWidth={2.25} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </form>
              <p className="mt-2 text-center text-xs text-[var(--color-tertiary)]">Respostas usam seus registros e podem conter erros. Não é recomendação de investimento.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
