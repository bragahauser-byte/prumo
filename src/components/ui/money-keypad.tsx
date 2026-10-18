"use client";

import { ChevronLeft, Delete, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { currencySymbol } from "@/lib/formatting";

const maxIntegerDigits = 9;

export function centsToKeypadValue(cents: number | null) {
  if (!cents) return "";
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return fraction ? `${whole},${String(fraction).padStart(2, "0").replace(/0$/, "")}` : String(whole);
}

export function keypadValueToCents(value: string) {
  if (!value) return 0;
  const [whole, fraction = ""] = value.split(",");
  return Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"));
}

function formatKeypadValue(value: string) {
  const [whole, fraction] = value.split(",");
  const grouped = Number(whole || "0").toLocaleString("pt-BR");
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

/** Próximo valor digitado, ou null quando a tecla não é aceita (limite de dígitos ou vírgula repetida). */
export function nextKeypadValue(current: string, key: string): string | null {
  if (key === "backspace") return current.slice(0, -1);
  if (key === ",") return current.includes(",") ? null : `${current || "0"},`;
  const [whole, fraction] = current.split(",");
  if (fraction !== undefined && fraction.length >= 2) return null;
  if (fraction === undefined && whole.length >= maxIntegerDigits) return null;
  if (current === "0") return key;
  return `${current}${key}`;
}

export type KeypadTone = "action" | "success";

const toneClasses: Record<KeypadTone, { background: string; button: string }> = {
  action: { background: "bg-[var(--color-action)]", button: "text-[var(--color-action)]" },
  success: { background: "bg-[var(--color-success)]", button: "text-[var(--color-success)]" },
};

/**
 * Teclado numérico em tela cheia para digitar valores, inspirado no fluxo de "digitar o valor primeiro".
 * Aceita toque e teclado físico (dígitos, vírgula/ponto, Backspace e Enter).
 */
export function MoneyKeypad({
  title,
  currency = "BRL",
  initialCents = null,
  tone = "action",
  submitLabel = "Continuar",
  helper,
  header,
  allowZero = false,
  onSubmit,
  onClose,
  closeVariant = "close",
}: {
  title: string;
  currency?: string;
  initialCents?: number | null;
  tone?: KeypadTone;
  submitLabel?: string;
  helper?: ReactNode;
  header?: ReactNode;
  allowZero?: boolean;
  onSubmit: (cents: number) => void;
  onClose: () => void;
  closeVariant?: "close" | "back";
}) {
  const [value, setValue] = useState(() => centsToKeypadValue(initialCents));
  const [feedback, setFeedback] = useState<"bump" | "shake" | null>(null);
  const [bumpKey, setBumpKey] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cents = keypadValueToCents(value);
  const canSubmit = allowZero || cents > 0;
  const symbol = currencySymbol(currency);
  const colors = toneClasses[tone];

  const reject = useCallback(() => {
    setFeedback("shake");
    setBumpKey((key) => key + 1);
  }, []);

  const press = useCallback((key: string) => {
    const next = nextKeypadValue(value, key);
    if (next === null) { reject(); return; }
    setValue(next);
    setFeedback(key === "backspace" ? null : "bump");
    setBumpKey((count) => count + 1);
  }, [reject, value]);

  const submit = useCallback(() => {
    if (!canSubmit) { reject(); return; }
    onSubmit(cents);
  }, [canSubmit, cents, onSubmit, reject]);

  useEffect(() => {
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(event.key)) { event.preventDefault(); press(event.key); }
      else if (event.key === "," || event.key === ".") { event.preventDefault(); press(","); }
      else if (event.key === "Backspace") { event.preventDefault(); press("backspace"); }
      else if (event.key === "Enter") { event.preventDefault(); submit(); }
      else if (event.key === "Escape") { event.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, press, submit]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "backspace"];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 lg:items-center lg:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-keypad=""
        tabIndex={-1}
        className={`animate-sheet-in flex w-full flex-col text-white outline-none transition-colors duration-300 lg:h-[min(820px,calc(100dvh-48px))] lg:max-w-[420px] lg:rounded-[32px] lg:shadow-[0_24px_80px_rgba(0,0,0,0.3)] ${colors.background}`}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),16px)]">
          <button
            type="button"
            onClick={onClose}
            aria-label={closeVariant === "back" ? "Voltar" : "Fechar"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {closeVariant === "back" ? <ChevronLeft size={22} aria-hidden="true" /> : <X size={20} aria-hidden="true" />}
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{title}</h2>
          <span className="h-11 w-11" aria-hidden="true" />
        </div>

        {header ? <div className="mt-4 flex justify-center px-4">{header}</div> : null}

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <output
            key={bumpKey}
            aria-live="polite"
            aria-label={`Valor: ${symbol} ${formatKeypadValue(value || "0")}`}
            className={`tabular flex items-baseline gap-1 font-semibold ${feedback === "bump" ? "animate-amount-bump" : feedback === "shake" ? "animate-amount-shake" : ""}`}
          >
            <span className="text-2xl text-white/80">{symbol}</span>
            <span className={`text-4xl ${value ? "text-white" : "text-white/60"}`}>{formatKeypadValue(value || "0")}</span>
          </output>
          {helper ? <div className="mt-3 min-h-5 text-sm text-white/80">{helper}</div> : null}
        </div>

        <div className="grid grid-cols-3 gap-1 px-4" role="group" aria-label="Teclado numérico">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              aria-label={key === "backspace" ? "Apagar" : key === "," ? "Vírgula" : key}
              className="flex h-16 items-center justify-center rounded-2xl text-2xl font-semibold transition-colors hover:bg-white/10 active:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
            >
              {key === "backspace" ? <Delete size={24} aria-hidden="true" /> : key}
            </button>
          ))}
        </div>

        <div className="px-4 pb-[max(env(safe-area-inset-bottom),24px)] pt-4">
          <button
            type="button"
            onClick={submit}
            aria-disabled={!canSubmit}
            className={`min-h-14 w-full rounded-full bg-white text-base font-semibold transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${colors.button} ${canSubmit ? "" : "opacity-60"}`}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
