/**
 * Moedas de exibição. O real vem sempre primeiro; as demais seguem a ordem definida pelo produto.
 * Escolher a moeda muda apenas a formatação dos valores: o Prumo não converte nem movimenta dinheiro.
 */
export const currencies = [
  { code: "BRL", name: "Real brasileiro", flag: "brl" },
  { code: "USD", name: "Dólar americano", flag: "usd" },
  { code: "EUR", name: "Euro", flag: "eur" },
  { code: "JPY", name: "Iene japonês", flag: "jpy" },
  { code: "GBP", name: "Libra esterlina", flag: "gbp" },
  { code: "CNY", name: "Yuan chinês", flag: "cny" },
  { code: "AUD", name: "Dólar australiano", flag: "aud" },
  { code: "CAD", name: "Dólar canadense", flag: "cad" },
  { code: "CHF", name: "Franco suíço", flag: "chf" },
  { code: "HKD", name: "Dólar de Hong Kong", flag: "hkd" },
  { code: "NZD", name: "Dólar neozelandês", flag: "nzd" },
] as const;

export type CurrencyCode = (typeof currencies)[number]["code"];

export const currencyCodes = currencies.map((item) => item.code) as [CurrencyCode, ...CurrencyCode[]];

/** Casas decimais da moeda (o iene não usa centavos). Os valores continuam guardados em centésimos. */
export function currencyDecimals(currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
