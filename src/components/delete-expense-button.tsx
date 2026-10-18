"use client";

import { useState } from "react";
import { useFinance } from "@/components/finance-provider";

export function DeleteExpenseButton({
  id,
  description,
}: {
  id: string;
  description: string;
}) {
  const { deleteExpense, isSaving } = useFinance();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function remove() {
    if (!window.confirm(`Excluir a despesa "${description}"? Esta ação não pode ser desfeita.`)) return;
    setFailed(false);
    try {
      await deleteExpense(id);
      setMessage("Despesa excluída.");
    } catch {
      setFailed(true);
      setMessage("Não foi possível excluir. Tente novamente.");
    }
  }

  return (
    <div>
      <button type="button" disabled={isSaving} onClick={() => void remove()} className="min-h-10 px-2 text-sm text-[var(--color-error)] underline underline-offset-4 disabled:opacity-60">
        {isSaving ? "Excluindo..." : "Excluir"}
      </button>
      {message ? <p className="mt-1 text-xs" role={failed ? "alert" : "status"}>{message}</p> : null}
    </div>
  );
}
