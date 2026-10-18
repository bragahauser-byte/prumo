"use client";

import { useId, useState } from "react";
import { currencyDecimals } from "@/domain/currencies";
import { currencySymbol } from "@/lib/formatting";

/**
 * Normaliza o que foi digitado: mantém dígitos e uma vírgula decimal, trata pontos como separador de milhar
 * e limita as casas decimais à moeda. Retorna o texto já agrupado (ex.: "6.000,5").
 */
export function normalizeMoneyText(raw: string, decimals = 2) {
  const cleaned = raw.replace(/[^\d,]/g, "");
  const [wholeRaw = "", ...rest] = cleaned.split(",");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "").slice(0, 10);
  const hasComma = decimals > 0 && cleaned.includes(",");
  const fraction = rest.join("").slice(0, decimals);
  const grouped = whole ? Number(whole).toLocaleString("pt-BR") : hasComma ? "0" : "";
  return hasComma ? `${grouped},${fraction}` : grouped;
}

export function moneyTextToCents(text: string): number | null {
  if (!text) return null;
  const [whole, fraction = ""] = text.replace(/\./g, "").split(",");
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToMoneyText(cents: number | null, decimals = 2) {
  if (cents === null) return "";
  const whole = Math.floor(Math.abs(cents) / 100).toLocaleString("pt-BR");
  const fraction = Math.abs(cents) % 100;
  return decimals > 0 && fraction ? `${whole},${String(fraction).padStart(2, "0")}` : whole;
}

/** Campo monetário de digitação direta, com teclado numérico no celular e formatação da moeda. */
export function MoneyInput({
  label,
  value,
  onChange,
  currency = "BRL",
  variant = "underline",
  placeholder = "0",
  autoFocus,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (cents: number | null) => void;
  currency?: string;
  variant?: "underline" | "hero";
  placeholder?: string;
  autoFocus?: boolean;
  hint?: string;
}) {
  const id = useId();
  const decimals = currencyDecimals(currency);
  const [text, setText] = useState(() => centsToMoneyText(value, decimals));
  const symbol = currencySymbol(currency);

  function update(raw: string) {
    const next = normalizeMoneyText(raw, decimals);
    setText(next);
    onChange(moneyTextToCents(next));
  }

  if (variant === "hero") {
    return (
      <div className="flex flex-col items-center text-center">
        <label htmlFor={id} className="sr-only">{label}</label>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-2xl font-semibold text-[var(--color-muted)]">{symbol}</span>
          <input
            id={id}
            value={text}
            onChange={(event) => update(event.target.value)}
            inputMode={decimals ? "decimal" : "numeric"}
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder={placeholder}
            aria-describedby={hint ? `${id}-hint` : undefined}
            size={Math.max(1, (text || placeholder).length)}
            className="tabular min-w-[1ch] max-w-[9ch] bg-transparent text-center text-4xl font-semibold text-[var(--color-text)] outline-none placeholder:text-[#C7C7CC]"
          />
        </div>
        {hint ? <p id={`${id}-hint`} className="mt-1 text-sm text-[var(--color-muted)]">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-[#9A9AA0]">{label}</label>
      <div className="mt-1 flex items-baseline gap-2 border-b border-[var(--color-text)] pb-2 focus-within:border-[var(--color-action)]">
        <span className="text-xl font-medium text-[var(--color-muted)]">{symbol}</span>
        <input
          id={id}
          value={text}
          onChange={(event) => update(event.target.value)}
          inputMode={decimals ? "decimal" : "numeric"}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="tabular min-w-0 flex-1 bg-transparent text-xl font-medium text-[var(--color-text)] outline-none placeholder:text-[#C7C7CC]"
        />
      </div>
      {hint ? <p id={`${id}-hint`} className="mt-2 text-sm text-[var(--color-muted)]">{hint}</p> : null}
    </div>
  );
}
