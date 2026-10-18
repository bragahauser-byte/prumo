"use client";

import { useState } from "react";
import { useFinance } from "@/components/finance-provider";

export function ExpensePaymentButton({
  id,
  currentStatus,
  correctionStatus = "pending",
}: {
  id: string;
  currentStatus: "paid" | "pending" | "scheduled";
  correctionStatus?: "pending" | "scheduled";
}) {
  const { setExpenseStatus, isSaving } = useFinance();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const isPaid = currentStatus === "paid";

  async function updateStatus() {
    if (isPaid && !window.confirm("Desmarcar este pagamento? A data de pagamento será removida.")) return;
    setFailed(false);
    try {
      await setExpenseStatus(id, isPaid ? correctionStatus : "paid", isPaid ? null : new Date().toISOString().slice(0, 10));
      setMessage(isPaid ? "Pagamento corrigido." : "Pagamento registrado.");
    } catch {
      setFailed(true);
      setMessage("Não foi possível atualizar o pagamento. Tente novamente.");
    }
  }

  return (
    <div>
      <button type="button" disabled={isSaving} onClick={() => void updateStatus()} className="min-h-10 px-2 text-sm font-medium underline underline-offset-4 disabled:opacity-60">
        {isSaving ? "Atualizando..." : isPaid ? "Corrigir pagamento" : "Marcar como paga"}
      </button>
      {message ? <p className="mt-1 text-xs" role={failed ? "alert" : "status"}>{message}</p> : null}
    </div>
  );
}
