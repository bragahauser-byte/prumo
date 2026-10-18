"use client";

import { ChevronLeft, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { currencyDecimals } from "@/domain/currencies";
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
export function nextKeypadValue(current: string, key: string, decimals = 2): string | null {
  if (key === "backspace") return current.slice(0, -1);
  if (key === ",") return decimals === 0 || current.includes(",") ? null : `${current || "0"},`;
  const [whole, fraction] = current.split(",");
  if (fraction !== undefined && fraction.length >= decimals) return null;
  if (fraction === undefined && whole.length >= maxIntegerDigits) return null;
  if (current === "0") return key;
  return `${current}${key}`;
}

/** Estado do teclado: valor digitado, animações de aceite/recusa e suporte a teclado físico. */
export function useKeypadInput({
  initialCents = null,
  currency = "BRL",
  onSubmit,
  onEscape,
  enabled = true,
}: {
  initialCents?: number | null;
  currency?: string;
  onSubmit?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}) {
  const decimals = currencyDecimals(currency);
  const [value, setValue] = useState(() => centsToKeypadValue(initialCents));
  const [feedback, setFeedback] = useState<"bump" | "shake" | null>(null);
  const [bumpKey, setBumpKey] = useState(0);

  const reject = useCallback(() => {
    setFeedback("shake");
    setBumpKey((key) => key + 1);
  }, []);

  const press = useCallback((key: string) => {
    const next = nextKeypadValue(value, key, decimals);
    if (next === null) { reject(); return; }
    setValue(next);
    setFeedback(key === "backspace" ? null : "bump");
    setBumpKey((count) => count + 1);
  }, [decimals, reject, value]);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(event.key)) { event.preventDefault(); press(event.key); }
      else if (event.key === "," || event.key === ".") { event.preventDefault(); press(","); }
      else if (event.key === "Backspace") { event.preventDefault(); press("backspace"); }
      else if (event.key === "Enter" && onSubmit) { event.preventDefault(); onSubmit(); }
      else if (event.key === "Escape" && onEscape) { event.preventDefault(); onEscape(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onEscape, onSubmit, press]);

  const clear = useCallback(() => { setValue(""); setFeedback(null); }, []);

  return { value, cents: keypadValueToCents(value), decimals, press, reject, clear, feedback, bumpKey };
}

/** Valor em destaque: o tamanho diminui conforme o número cresce para caber na largura do celular. */
export function AmountDisplay({
  value,
  currency = "BRL",
  feedback,
  bumpKey,
  className = "",
}: {
  value: string;
  currency?: string;
  feedback?: "bump" | "shake" | null;
  bumpKey?: number;
  className?: string;
}) {
  const symbol = currencySymbol(currency);
  const text = `${symbol}${formatKeypadValue(value || "0")}`;
  const size = text.length <= 7 ? 64 : text.length <= 9 ? 52 : 44;
  return (
    <output
      key={bumpKey}
      aria-live="polite"
      aria-label={`Valor: ${symbol} ${formatKeypadValue(value || "0")}`}
      className={`tabular block whitespace-nowrap font-semibold leading-none tracking-[-0.03em] ${feedback === "bump" ? "animate-amount-bump" : feedback === "shake" ? "animate-amount-shake" : ""} ${className}`}
      style={{ fontSize: size }}
    >
      {text}
    </output>
  );
}

/** Grade 3×4 com dígitos sem fundo, vírgula e apagar, como na referência. */
export function KeypadGrid({ onPress, decimals = 2 }: { onPress: (key: string) => void; decimals?: number }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "backspace"];
  return (
    <div className="grid grid-cols-3" role="group" aria-label="Teclado numérico">
      {keys.map((key) => key === "," && decimals === 0 ? <span key={key} aria-hidden="true" /> : (
        <button
          key={key}
          type="button"
          onClick={() => onPress(key)}
          aria-label={key === "backspace" ? "Apagar" : key === "," ? "Vírgula" : key}
          className="flex h-[60px] items-center justify-center rounded-2xl text-2xl font-medium transition-colors active:bg-[#163300]/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-current"
        >
          {key === "backspace" ? <ChevronLeft size={26} strokeWidth={2.25} aria-hidden="true" /> : key === "," ? <span className="-mt-3">,</span> : key}
        </button>
      ))}
    </div>
  );
}

export type KeypadTone = "action" | "success";

const toneBackground: Record<KeypadTone, string> = {
  action: "bg-[var(--color-accent)]",
  success: "bg-[var(--color-accent)]",
};

/**
 * Teclado de valor em tela cheia para ajustes rápidos (saldo, limites, recorrências).
 * Aceita toque e teclado físico (dígitos, vírgula/ponto, Backspace, Enter e Esc).
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<() => void>(() => {});
  const keypad = useKeypadInput({ initialCents, currency, onSubmit: () => submitRef.current(), onEscape: onClose });
  const canSubmit = allowZero || keypad.cents > 0;

  useEffect(() => {
    submitRef.current = () => {
      if (!canSubmit) keypad.reject();
      else onSubmit(keypad.cents);
    };
  });

  useEffect(() => {
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 lg:items-center lg:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-keypad=""
        tabIndex={-1}
        className={`animate-sheet-in flex w-full flex-col text-[#163300] outline-none lg:h-[min(820px,calc(100dvh-48px))] lg:max-w-[420px] lg:rounded-[40px] lg:shadow-[0_24px_80px_rgba(0,0,0,0.3)] ${toneBackground[tone]}`}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),16px)]">
          <button
            type="button"
            onClick={onClose}
            aria-label={closeVariant === "back" ? "Voltar" : "Fechar"}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-[#163300]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163300]"
          >
            {closeVariant === "back" ? <ChevronLeft size={24} aria-hidden="true" /> : <X size={22} aria-hidden="true" />}
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{title}</h2>
          <span className="h-11 w-11" aria-hidden="true" />
        </div>

        {header ? <div className="mt-4 flex justify-center px-4">{header}</div> : null}

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <AmountDisplay value={keypad.value} currency={currency} feedback={keypad.feedback} bumpKey={keypad.bumpKey} className={keypad.value ? "" : "opacity-60"} />
          {helper ? <div className="mt-4 min-h-5 text-sm text-[#163300]/80">{helper}</div> : null}
        </div>

        <div className="px-4"><KeypadGrid onPress={keypad.press} decimals={keypad.decimals} /></div>

        <div className="px-4 pb-[max(env(safe-area-inset-bottom),24px)] pt-4">
          <button
            type="button"
            onClick={() => submitRef.current()}
            aria-disabled={!canSubmit}
            className={`min-h-12 w-full rounded-full bg-[#163300]/10 text-base font-semibold transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163300] ${canSubmit ? "" : "opacity-60"}`}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
