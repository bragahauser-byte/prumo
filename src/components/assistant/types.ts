import type { FeatureId, Intent } from "@/domain/assistant/understand";

/** Cartões exibidos no chat (números calculados pelo app a partir dos registros). */
export type AssistantCard =
  | { kind: "table"; title: string; subtitle?: string; columns: string[]; rows: string[][]; footer?: string[] }
  | { kind: "bars"; title: string; subtitle?: string; items: { label: string; value: number; display: string; note?: string }[] }
  | { kind: "plan"; title: string; subtitle?: string; lines: { label: string; value: string }[]; note?: string }
  /** Atalho para uma tela do app, com ilustração e explicação curta. */
  | { kind: "feature"; feature: FeatureId; title: string; description: string; href: string; cta: string }
  /** Saldos por banco, com logo e participação. */
  | { kind: "accounts"; title: string; subtitle?: string; items: { name: string; bank: string; display: string; note?: string }[] }
  /** Progresso de metas ou orçamentos. */
  | { kind: "progress"; title: string; subtitle?: string; items: { label: string; ratio: number; display: string; note?: string; icon?: string; tone?: "ok" | "warning" | "over" }[]; href?: string };

export type ProposalStatus = "pending" | "confirmed" | "declined" | "failed";

export type AssistantProposal =
  | { kind: "create_goal"; name: string; targetCents: number; deadline: string | null; icon: string }
  | { kind: "set_budget"; category: string; limitCents: number; previousCents: number | null }
  | { kind: "add_expense"; description: string; amountCents: number; category: string; date: string; accountId: string | null; accountName: string | null; paid: boolean }
  | { kind: "add_income"; description: string; amountCents: number; category: string; date: string; accountId: string | null; accountName: string | null; received: boolean }
  | { kind: "goal_contribution"; goalId: string; goalName: string; goalIcon: string; amountCents: number; date: string }
  | { kind: "set_balance"; accountId: string | null; accountName: string; bank: string | null; currency: string; balanceCents: number; previousCents: number | null }
  | { kind: "add_investment"; type: string; institution: string; appliedCents: number; date: string };

/** Itens que aparecem na conversa. */
export type DisplayItem =
  | { id: string; type: "user"; text: string }
  | { id: string; type: "assistant"; text: string; suggestions: string[] }
  | { id: string; type: "card"; card: AssistantCard }
  | { id: string; type: "proposal"; proposal: AssistantProposal; status: ProposalStatus }
  | { id: string; type: "notice"; text: string };

/** O que ainda falta para concluir um pedido (ex.: o valor de um gasto) e o rascunho até aqui. */
export type PendingRequest = { intent: Intent; text: string; missing: "amount" | "category" | "goal" | "account" | "name" };

/** Memória curta da conversa: permite "e no mês passado?" ou responder só o valor que faltou. */
export type ConversationMemory = {
  lastIntent: Intent | null;
  lastText: string | null;
  pending: PendingRequest | null;
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  items: DisplayItem[];
  memory: ConversationMemory;
};
