"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const storageKey = "prumo:privacy:hide-values";
export const maskedValue = "••••";

type PrivacyValue = {
  hidden: boolean;
  toggle: () => void;
  /** Troca o valor formatado por "••••" quando os valores estão ocultos. */
  mask: (formatted: string) => string;
};

const PrivacyContext = createContext<PrivacyValue>({ hidden: false, toggle: () => {}, mask: (value) => value });

function readHidden() {
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

/** Mostrar ou ocultar saldos e totais; a escolha fica salva neste dispositivo entre sessões. */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  // Lê depois de montar para que o HTML do servidor e o primeiro render do navegador coincidam.
  useEffect(() => {
    const stored = readHidden();
    if (stored) Promise.resolve().then(() => setHidden(true));
  }, []);

  const toggle = useCallback(() => {
    setHidden((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // Sem armazenamento: vale só para esta sessão.
      }
      return next;
    });
  }, []);

  const value = useMemo<PrivacyValue>(() => ({
    hidden,
    toggle,
    mask: (formatted) => (hidden ? maskedValue : formatted),
  }), [hidden, toggle]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
