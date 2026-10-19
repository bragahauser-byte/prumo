"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFinance } from "@/components/finance-provider";
import type { RatesTable } from "@/domain/exchange";

const cacheKey = "prumo:exchange-rates:v1";
/** As cotações de referência mudam uma vez por dia útil; 6 horas evita chamadas repetidas sem ficar desatualizado. */
const cacheTtl = 6 * 60 * 60 * 1000;

type CachedRates = RatesTable & { fetchedAt: number };

function readCache(base: string): CachedRates | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(cacheKey) ?? "null") as CachedRates | null;
    return value && value.base === base && typeof value.rates === "object" ? value : null;
  } catch {
    return null;
  }
}

function writeCache(value: CachedRates) {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(value));
  } catch {
    // Sem armazenamento: a cotação é buscada de novo na próxima abertura.
  }
}

/** Cotações de referência do Banco Central Europeu via Frankfurter (gratuita, sem chave, com CORS). */
export async function fetchRates(base: string): Promise<RatesTable> {
  const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`);
  if (!response.ok) throw new Error("Cotação indisponível");
  const data = (await response.json()) as { base: string; date: string; rates: Record<string, number> };
  if (!data?.rates || !data.date) throw new Error("Cotação inválida");
  return { base: data.base, date: data.date, rates: data.rates };
}

type ExchangeRatesValue = {
  base: string;
  table: RatesTable | null;
  manualRates: Record<string, number>;
  status: "idle" | "loading" | "ready" | "error";
  /** Momento em que a cotação foi buscada (para mostrar "atualizada às ..."). */
  fetchedAt: number | null;
  refresh: () => void;
};

const ExchangeRatesContext = createContext<ExchangeRatesValue>({
  base: "BRL",
  table: null,
  manualRates: {},
  status: "idle",
  fetchedAt: null,
  refresh: () => {},
});

/**
 * Busca as cotações só quando há algo em outra moeda (conta, movimentação) ou quando alguma tela pede.
 * O cache local evita uma chamada a cada abertura; sem rede, usa o último valor salvo.
 */
export function ExchangeRatesProvider({ children }: { children: ReactNode }) {
  const { preferences, accounts, expenses } = useFinance();
  const base = preferences?.currency ?? "BRL";
  const [cached, setCached] = useState<CachedRates | null>(null);
  const [status, setStatus] = useState<ExchangeRatesValue["status"]>("idle");
  const [requested, setRequested] = useState(0);
  const needsRates = requested > 0 || accounts.some((account) => account.currency !== base) || expenses.some((expense) => expense.original);

  useEffect(() => {
    if (!needsRates) return;
    let cancelled = false;
    const stored = readCache(base);
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (stored) setCached(stored);
      if (stored && Date.now() - stored.fetchedAt < cacheTtl && requested === 0) {
        setStatus("ready");
        return;
      }
      setStatus("loading");
      return fetchRates(base).then((table) => {
        if (cancelled) return;
        const next = { ...table, fetchedAt: Date.now() };
        writeCache(next);
        setCached(next);
        setStatus("ready");
      });
    }).catch(() => {
      if (!cancelled) setStatus(stored ? "ready" : "error");
    });
    return () => { cancelled = true; };
  }, [base, needsRates, requested]);

  const refresh = useCallback(() => setRequested((count) => count + 1), []);

  const value = useMemo<ExchangeRatesValue>(() => ({
    base,
    table: cached && cached.base === base ? cached : null,
    manualRates: preferences?.manualRates ?? {},
    status,
    fetchedAt: cached?.fetchedAt ?? null,
    refresh,
  }), [base, cached, preferences?.manualRates, refresh, status]);

  return <ExchangeRatesContext.Provider value={value}>{children}</ExchangeRatesContext.Provider>;
}

export function useExchangeRates() {
  return useContext(ExchangeRatesContext);
}
