import { currencyDecimals } from "@/domain/currencies";

/** Valores são guardados em centésimos; a moeda define quantas casas aparecem (ex.: iene sem centavos). */
export function formatCurrency(amountCents: number, currency = "BRL") {
  const decimals = currencyDecimals(currency);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amountCents / 100);
}

/** Valor sem centavos quando redondo, para números de destaque. */
export function formatCurrencyCompact(amountCents: number, currency = "BRL") {
  const whole = amountCents % 100 === 0 || currencyDecimals(currency) === 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amountCents / 100);
}

export function currencySymbol(currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value ?? currency;
}

export function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonthKey(month: string, style: "long" | "short" = "long") {
  return new Intl.DateTimeFormat("pt-BR", style === "long"
    ? { month: "long", year: "numeric", timeZone: "UTC" }
    : { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`)).replace(".", "");
}

export function formatCalendarDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`)).replace(".", "");
}

export function formatWeekdayDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}
