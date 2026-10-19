import { convertCents, type ManualRates, type RatesTable } from "./exchange";
import { inMonth, type Movement } from "./planning";

export type AccountLike = {
  id: string;
  name: string;
  bank: string;
  currency: string;
  balanceCents: number | null;
  balanceReportedOn: string | null;
};

export type AccountMovement = Movement & {
  accountId: string | null;
  original: { currency: string; amountCents: number } | null;
};

/** Valor da movimentação na moeda pedida: o original quando bate, o convertido quando é a moeda-base. */
export function movementAmountIn(movement: Pick<AccountMovement, "amountCents" | "original">, currency: string, base: string) {
  if (movement.original && movement.original.currency === currency) return movement.original.amountCents;
  if (currency === base) return movement.amountCents;
  return null;
}

function signed(kind: Movement["kind"], cents: number) {
  return kind === "income" ? cents : kind === "expense" ? -cents : 0;
}

/**
 * Saldo da conta na moeda dela: o valor informado ajustado pelo que foi pago ou recebido
 * nesta conta a partir da data em que foi informado.
 */
export function accountBalance(account: AccountLike, movements: AccountMovement[], base: string) {
  if (account.balanceCents === null) return null;
  if (!account.balanceReportedOn) return account.balanceCents;
  return movements
    .filter((movement) => movement.accountId === account.id && movement.status === "paid" && movement.paidOn !== null && movement.paidOn >= account.balanceReportedOn!)
    .reduce((total, movement) => {
      const amount = movementAmountIn(movement, account.currency, base);
      return amount === null ? total : total + signed(movement.kind, amount);
    }, account.balanceCents);
}

/**
 * Saldos por conta e total na moeda-base. Contas em outra moeda são convertidas pela cotação
 * disponível; sem cotação, ficam fora do total e `missingRates` lista as moedas.
 */
export function accountBalances<A extends AccountLike>(accounts: A[], movements: AccountMovement[], base: string, table: RatesTable | null, manual: ManualRates = {}) {
  const missing = new Set<string>();
  const items = accounts.map((account) => {
    const balanceCents = accountBalance(account, movements, base);
    const converted = balanceCents === null ? null : convertCents(balanceCents, account.currency, base, base, table, manual);
    if (balanceCents !== null && !converted) missing.add(account.currency);
    return { account, balanceCents, convertedCents: converted?.cents ?? null, rate: converted?.rate ?? null, rateDate: converted?.date ?? null, rateSource: converted?.source ?? null };
  });
  const withBalance = items.filter((item) => item.balanceCents !== null);
  return {
    items,
    hasBalances: withBalance.length > 0,
    totalCents: withBalance.reduce((total, item) => total + (item.convertedCents ?? 0), 0),
    missingRates: [...missing],
  };
}

/** Entradas e saídas do mês por conta (valores na moeda-base); movimentações sem conta ficam em "Sem conta". */
export function movementsByAccount(accounts: Pick<AccountLike, "id" | "name" | "bank">[], movements: AccountMovement[], month: string) {
  const totals = new Map<string | null, { incomeCents: number; expenseCents: number; count: number }>();
  for (const movement of movements) {
    if (!inMonth(movement.date, month) || movement.kind === "transfer") continue;
    const key = movement.accountId && accounts.some((account) => account.id === movement.accountId) ? movement.accountId : null;
    const entry = totals.get(key) ?? { incomeCents: 0, expenseCents: 0, count: 0 };
    if (movement.kind === "income") entry.incomeCents += movement.amountCents;
    else entry.expenseCents += movement.amountCents;
    entry.count += 1;
    totals.set(key, entry);
  }
  return [...totals.entries()]
    .map(([accountId, entry]) => {
      const account = accounts.find((item) => item.id === accountId) ?? null;
      return { accountId, name: account?.name ?? "Sem conta", bank: account?.bank ?? null, ...entry, netCents: entry.incomeCents - entry.expenseCents };
    })
    .sort((left, right) => (right.incomeCents + right.expenseCents) - (left.incomeCents + left.expenseCents));
}
