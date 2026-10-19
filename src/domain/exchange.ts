/**
 * Conversão entre moedas. A cotação vem de uma API pública (com cache e data visível) ou de uma
 * taxa manual informada pela pessoa, que tem prioridade quando existe.
 */

/** Cotações publicadas: quantas unidades de cada moeda valem 1 unidade da moeda-base. */
export type RatesTable = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

/** Taxas manuais: quanto vale 1 unidade da moeda estrangeira na moeda-base (ex.: 1 USD = 5,40 BRL). */
export type ManualRates = Record<string, number>;

export type Quote = {
  /** Valor de 1 unidade de `from` em `to`. */
  rate: number;
  date: string | null;
  source: "same" | "api" | "manual";
};

/** Valor de 1 unidade de `currency` na moeda-base. */
function unitInBase(currency: string, base: string, table: RatesTable | null, manual: ManualRates): Omit<Quote, "rate"> & { value: number } | null {
  if (currency === base) return { value: 1, date: null, source: "same" };
  const manualRate = manual[currency];
  if (manualRate && manualRate > 0) return { value: manualRate, date: null, source: "manual" };
  if (!table || table.base !== base) return null;
  const perBase = table.rates[currency];
  if (!perBase || perBase <= 0) return null;
  return { value: 1 / perBase, date: table.date, source: "api" };
}

export function quote(from: string, to: string, base: string, table: RatesTable | null, manual: ManualRates = {}): Quote | null {
  if (from === to) return { rate: 1, date: null, source: "same" };
  const fromUnit = unitInBase(from, base, table, manual);
  const toUnit = unitInBase(to, base, table, manual);
  if (!fromUnit || !toUnit) return null;
  const source = fromUnit.source === "manual" || toUnit.source === "manual" ? "manual" : "api";
  return { rate: fromUnit.value / toUnit.value, date: fromUnit.date ?? toUnit.date, source };
}

/** Converte centésimos de uma moeda para outra, arredondando para o centésimo mais próximo. */
export function convertCents(amountCents: number, from: string, to: string, base: string, table: RatesTable | null, manual: ManualRates = {}) {
  const found = quote(from, to, base, table, manual);
  if (!found) return null;
  return { cents: Math.round(amountCents * found.rate), ...found };
}
