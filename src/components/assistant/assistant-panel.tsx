"use client";

import { ArrowUp, ChevronLeft, History, Plus, Square, SquarePen, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFinance } from "@/components/finance-provider";
import { focusRing } from "@/components/ui/primitives";
import { AiMark } from "./ai-mark";
import { AssistantCardView, AssistantText, ProposalCard } from "./assistant-cards";
import { useAssistant } from "./assistant-context";
import { useAssistantChat } from "./use-assistant-chat";

const baseSuggestions = ["Onde estou gastando mais?", "Quanto ainda posso gastar?", "Consigo guardar R$ 500 por mês?"];

const shortcuts = [
  { label: "Registrar um gasto", prompt: "Gastei " },
  { label: "Registrar uma receita", prompt: "Recebi " },
  { label: "Criar uma meta", prompt: "Criar meta de " },
  { label: "Guardar dinheiro numa meta", prompt: "Guardei " },
  { label: "Atualizar saldo de um banco", prompt: "Tenho " },
  { label: "Ajustar um orçamento", prompt: "Limite de " },
  { label: "Comparar com o mês passado", prompt: "Compare meus gastos deste mês com o mês passado" },
];

const iconButton = `flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-[var(--color-text)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur transition-colors hover:bg-white ${focusRing}`;

const weekdayGreeting = ["Bom domingo", "Boa segunda", "Boa terça", "Boa quarta", "Boa quinta", "Boa sexta", "Bom sábado"];

export function AssistantPanel() {
  const { open, closeAssistant, consumePrompt, pendingPrompt } = useAssistant();
  if (!open) return null;
  return <AssistantDialog onClose={closeAssistant} consumePrompt={consumePrompt} hasPrompt={Boolean(pendingPrompt)} />;
}

function AssistantDialog({ onClose, consumePrompt, hasPrompt }: { onClose: () => void; consumePrompt: () => string | null; hasPrompt: boolean }) {
  const { preferences, budgets, recurringRules, investments, accounts, savingsGoals } = useFinance();
  const chat = useAssistantChat();
  const [input, setInput] = useState("");
  const [view, setView] = useState<"chat" | "history">("chat");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstName = preferences?.displayName?.trim().split(/\s+/)[0];
  const busy = chat.status !== "idle";
  const items = chat.current?.items ?? [];
  const started = items.length > 0 || busy;
  const lastUserIndex = items.map((item) => item.type).lastIndexOf("user");
  const lastAssistant = items.slice(lastUserIndex + 1).reverse().find((item) => item.type === "assistant");
  const lastSuggestions = lastAssistant?.type === "assistant" ? lastAssistant.suggestions : [];
  const [greeting] = useState(() => weekdayGreeting[new Date().getDay()]);

  const suggestions = useMemo(() => {
    const extra: string[] = [];
    if (accounts.length > 1) extra.push("Quanto tenho em cada banco?");
    if (savingsGoals.length) extra.push("Como estão minhas metas?");
    if (recurringRules.length) extra.push("Quanto pago em assinaturas?");
    if (budgets.length) extra.push("Como estão meus orçamentos?");
    if (investments.length) extra.push("Resumo dos meus investimentos");
    return [...baseSuggestions, ...extra.slice(0, 3), "O que você consegue fazer?"];
  }, [accounts.length, budgets.length, investments.length, recurringRules.length, savingsGoals.length]);

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
  }, [items.length, chat.streamingText, chat.status]);

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
        className="animate-sheet-in relative isolate flex h-dvh w-full flex-col overflow-hidden bg-[#fbfbfa] text-[var(--color-text)] lg:h-[min(860px,calc(100dvh-48px))] lg:max-w-[480px] lg:rounded-[36px] lg:shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
      >
        {/* Identidade da IA: véu desfocado no topo (sempre) e dois brilhos nos cantos (só antes da conversa). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="ai-veil absolute -inset-x-10 -top-16 h-56" />
          <div className={`ai-orb ai-orb-a -left-24 -top-24 h-72 w-72 ${started ? "opacity-0" : "opacity-100"}`} />
          <div className={`ai-orb ai-orb-b -bottom-28 -right-24 h-80 w-80 ${started ? "opacity-0" : "opacity-100"}`} />
        </div>

        <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(env(safe-area-inset-top),16px)]">
          {view === "history" ? (
            <button type="button" onClick={() => setView("chat")} aria-label="Voltar à conversa" className={iconButton}><ChevronLeft size={20} aria-hidden="true" /></button>
          ) : (
            <button type="button" onClick={() => { chat.newConversation(); setInput(""); inputRef.current?.focus(); }} aria-label="Nova conversa" className={iconButton}><SquarePen size={18} aria-hidden="true" /></button>
          )}
          {view === "history" ? <h2 className="text-base font-semibold">Conversas</h2> : started ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-[var(--color-ai-deep)] backdrop-blur"><AiMark size={14} animated /> Prumo IA</span>
          ) : null}
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
              {!started ? (
                <div className="pt-[14vh]">
                  <AiMark size={26} animated />
                  <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.02em]">
                    Oi{firstName ? `, ${firstName}` : ""}! {greeting}.<br />O que você precisa?
                  </h1>
                  <p className="mt-3 max-w-[320px] text-sm leading-5 text-[var(--color-tertiary)]">Pergunte sobre gastos, bancos, metas e investimentos, ou peça para eu registrar algo. Funciono aqui no seu aparelho e só mudo algo quando você confirmar.</p>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {items.map((item, index) => {
                    if (item.type === "user") {
                      return <div key={item.id} className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-white px-4 py-2.5 text-base leading-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">{item.text}</p></div>;
                    }
                    if (item.type === "assistant") {
                      const showMark = items[index - 1]?.type === "user";
                      return (
                        <div key={item.id}>
                          {showMark ? <AiMark size={16} className="mb-2" /> : null}
                          <AssistantText text={item.text} />
                        </div>
                      );
                    }
                    if (item.type === "card") return <AssistantCardView key={item.id} card={item.card} />;
                    if (item.type === "proposal") return <ProposalCard key={item.id} proposal={item.proposal} status={item.status} onStatus={(status) => chat.setProposalStatus(item.id, status)} />;
                    return <p key={item.id} className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-[var(--color-muted)]">{item.text}</p>;
                  })}

                  {/* Próximos passos sugeridos: ficam no fim da resposta, depois dos cartões. */}
                  {lastSuggestions.length && !busy ? (
                    <div className="flex flex-wrap gap-2">
                      {lastSuggestions.map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => submit(suggestion)} className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-black/[0.06] bg-white/80 px-4 text-left text-sm font-medium transition-colors hover:bg-white ${focusRing}`}>
                          <AiMark size={12} />{suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {chat.status === "thinking" ? (
                    <div className="flex items-center gap-2 text-[var(--color-ai-teal)]" role="status" aria-label="Pensando">
                      <AiMark size={16} animated className="animate-pulse" />
                      <span className="flex gap-1" aria-hidden="true">
                        {[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${dot * 120}ms` }} />)}
                      </span>
                    </div>
                  ) : null}
                  {chat.status === "streaming" && chat.streamingText ? (
                    <div>
                      <AiMark size={16} className="mb-2" />
                      <AssistantText text={chat.streamingText} />
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2">
              {!started ? (
                <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                  {suggestions.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => submit(suggestion)} className={`min-h-[60px] w-[150px] shrink-0 rounded-[20px] border border-black/[0.05] bg-white/70 px-4 py-3 text-left text-sm font-medium leading-5 backdrop-blur transition-colors hover:bg-white ${focusRing}`}>
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
                <div className="flex min-h-12 flex-1 items-end gap-2 rounded-[26px] border border-black/[0.08] bg-white/90 py-1.5 pl-4 pr-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] backdrop-blur focus-within:border-[var(--color-ai-teal)]/40">
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
                    <button type="button" onClick={chat.stop} aria-label="Mostrar resposta inteira" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ai-night)] text-white ${focusRing}`}>
                      <Square size={14} fill="currentColor" aria-hidden="true" />
                    </button>
                  ) : (
                    <button type="submit" disabled={!input.trim()} aria-label="Enviar" className={`ai-gradient-fill flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:!bg-none disabled:bg-[var(--color-border)] disabled:text-[var(--color-placeholder)] ${focusRing}`}>
                      <ArrowUp size={18} strokeWidth={2.25} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </form>
              <p className="mt-2 text-center text-xs text-[var(--color-tertiary)]">Respostas calculadas no seu aparelho com os seus registros. Não é recomendação de investimento.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
