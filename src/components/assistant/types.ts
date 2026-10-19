/** Cartões exibidos no chat a partir do resultado das ferramentas (números calculados pelo app, não pelo modelo). */
export type AssistantCard =
  | { kind: "table"; title: string; subtitle?: string; columns: string[]; rows: string[][]; footer?: string[] }
  | { kind: "bars"; title: string; subtitle?: string; items: { label: string; value: number; display: string; note?: string }[] }
  | { kind: "plan"; title: string; subtitle?: string; lines: { label: string; value: string }[]; note?: string };

export type ProposalStatus = "pending" | "confirmed" | "declined" | "failed";

export type AssistantProposal =
  | { kind: "create_goal"; name: string; targetCents: number; deadline: string | null; icon: string }
  | { kind: "set_budget"; category: string; limitCents: number; previousCents: number | null }
  | { kind: "add_expense"; description: string; amountCents: number; category: string; date: string; accountId: string | null; accountName: string | null; paid: boolean };

/** Itens que aparecem na conversa (a história enviada à API fica separada, em formato da API). */
export type DisplayItem =
  | { id: string; type: "user"; text: string }
  | { id: string; type: "assistant"; text: string; suggestions: string[] }
  | { id: string; type: "card"; card: AssistantCard }
  | { id: string; type: "proposal"; proposal: AssistantProposal; status: ProposalStatus }
  | { id: string; type: "notice"; text: string };

export type ApiContentBlock = { type: string; [key: string]: unknown };
export type ApiMessage = { role: "user" | "assistant"; content: string | ApiContentBlock[] };

export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  api: ApiMessage[];
  items: DisplayItem[];
};
