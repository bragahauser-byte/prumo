"use client";

import { useState } from "react";
import { useFinance } from "@/components/finance-provider";

export function RecurringRuleControls({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const { generateOccurrences, setRecurringRuleActive, isSaving } = useFinance();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function generate() {
    setFailed(false);
    try {
      const through = new Date();
      through.setUTCDate(through.getUTCDate() + 90);
      const count = await generateOccurrences(id, through.toISOString().slice(0, 10));
      setMessage(count ? `${count} ocorrência(s) gerada(s).` : "As próximas ocorrências já estão geradas.");
    } catch {
      setFailed(true);
      setMessage("Não foi possível gerar ocorrências. Tente novamente.");
    }
  }

  async function toggle() {
    if (isActive && !window.confirm("Pausar esta regra? As ocorrências que já foram geradas serão mantidas.")) return;
    setFailed(false);
    try {
      await setRecurringRuleActive(id, !isActive);
      setMessage(isActive ? "Regra pausada; ocorrências existentes foram mantidas." : "Regra retomada.");
    } catch {
      setFailed(true);
      setMessage("Não foi possível atualizar a regra. Tente novamente.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
      {isActive ? (
          <button type="button" onClick={() => void generate()} disabled={isSaving} className="min-h-10 px-2 text-sm underline underline-offset-4 disabled:opacity-60">
            {isSaving ? "Gerando..." : "Gerar próximas"}
          </button>
      ) : null}
        <button type="button" onClick={() => void toggle()} disabled={isSaving} className="min-h-10 px-2 text-sm underline underline-offset-4 disabled:opacity-60">
          {isSaving ? "Atualizando..." : isActive ? "Pausar" : "Retomar"}
        </button>
      </div>
      {message ? <p className="mt-1 text-xs" role={failed ? "alert" : "status"}>{message}</p> : null}
    </div>
  );
}
