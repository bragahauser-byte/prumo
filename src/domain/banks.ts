/**
 * Instituições com logo próprio (public/banks). As nacionais vêm primeiro; depois as contas
 * globais multimoeda, que costumam guardar saldo em outras moedas. "other" usa a inicial do nome.
 */
export const banks = [
  { id: "nubank", name: "Nubank", region: "br" },
  { id: "itau", name: "Itaú", region: "br" },
  { id: "banco-do-brasil", name: "Banco do Brasil", region: "br" },
  { id: "bradesco", name: "Bradesco", region: "br" },
  { id: "caixa", name: "Caixa", region: "br" },
  { id: "santander", name: "Santander", region: "br" },
  { id: "inter", name: "Banco Inter", region: "br" },
  { id: "mercado-pago", name: "Mercado Pago", region: "br" },
  { id: "picpay", name: "PicPay", region: "br" },
  { id: "pagbank", name: "PagBank", region: "br" },
  { id: "sicredi", name: "Sicredi", region: "br" },
  { id: "wise", name: "Wise", region: "global" },
  { id: "revolut", name: "Revolut", region: "global" },
  { id: "paypal", name: "PayPal", region: "global" },
  { id: "other", name: "Outra instituição", region: "other" },
] as const;

export type BankId = (typeof banks)[number]["id"];

export const bankIds = banks.map((bank) => bank.id) as [BankId, ...BankId[]];

export function bankName(id: string) {
  return banks.find((bank) => bank.id === id)?.name ?? "Outra instituição";
}

export function hasBankLogo(id: string) {
  return id !== "other" && banks.some((bank) => bank.id === id);
}
