"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type AssistantContextValue = {
  open: boolean;
  /** Abre o assistente; com `prompt`, já envia a pergunta. */
  openAssistant: (prompt?: string) => void;
  closeAssistant: () => void;
  pendingPrompt: string | null;
  consumePrompt: () => string | null;
};

const AssistantContext = createContext<AssistantContextValue>({
  open: false,
  openAssistant: () => {},
  closeAssistant: () => {},
  pendingPrompt: null,
  consumePrompt: () => null,
});

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const openAssistant = useCallback((prompt?: string) => {
    setPendingPrompt(prompt?.trim() || null);
    setOpen(true);
  }, []);
  const closeAssistant = useCallback(() => setOpen(false), []);
  const consumePrompt = useCallback(() => {
    const prompt = pendingPrompt;
    setPendingPrompt(null);
    return prompt;
  }, [pendingPrompt]);

  const value = useMemo(() => ({ open, openAssistant, closeAssistant, pendingPrompt, consumePrompt }), [closeAssistant, consumePrompt, open, openAssistant, pendingPrompt]);
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  return useContext(AssistantContext);
}
