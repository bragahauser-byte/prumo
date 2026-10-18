"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { Confetti } from "@/components/ui/confetti";
import { goalProgress } from "@/domain/planning";
import { asset } from "@/lib/base-path";
import { todayISO } from "@/lib/dates";
import { formatCurrency } from "@/lib/formatting";
import type { CurrencyCode } from "@/lib/finance/repository";

const celebratedKey = "prumo:goals:celebrated";

function noise(seed: number) {
  const value = Math.sin(seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** Estilhaços que explodem do troféu em todas as direções. */
const burstColors = ["#9FE870", "#FFEB69", "#FFC091", "#FFD7EF", "#A0E1E1", "#FFFFFF"];
const burst = Array.from({ length: 30 }, (_, index) => {
  const angle = (index / 30) * Math.PI * 2 + noise(index) * 0.3;
  const distance = 130 + noise(index + 40) * 90;
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
    turn: (noise(index + 80) - 0.5) * 720,
    size: 6 + noise(index + 120) * 8,
    round: index % 3 === 0,
    delay: 0.32 + noise(index + 160) * 0.12,
    color: burstColors[index % burstColors.length],
  };
});

const title = "Meta atingida!";

function useCountUp(target: number, delayMs: number, durationMs: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const start = performance.now() + (reduce ? 0 : delayMs);
    const tick = (time: number) => {
      const progress = reduce ? 1 : Math.max(0, Math.min(1, (time - start) / durationMs));
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [delayMs, durationMs, target]);
  return value;
}

export function GoalCelebration({
  goalId,
  name,
  amountCents,
  currency,
  onClose,
}: {
  goalId: string;
  name: string;
  amountCents: number;
  currency: CurrencyCode;
  onClose: () => void;
}) {
  const counted = useCountUp(amountCents, 900, 1300);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    navigator.vibrate?.([40, 70, 40, 70, 120]);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => primaryRef.current?.focus(), 400);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="celebration-title" aria-describedby="celebration-description" className="fixed inset-0 z-[90] flex justify-center overflow-hidden bg-[var(--color-forest-green)] text-white">
      <Confetti className="z-[91]" />
      <div className="relative z-[92] flex w-full max-w-[480px] flex-col px-6 pb-[max(env(safe-area-inset-bottom),40px)] pt-16">
        <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[var(--color-bright-green)] transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-bright-green)]">
          <X size={22} aria-hidden="true" />
        </button>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="pointer-events-none relative flex h-[280px] w-[280px] items-center justify-center" aria-hidden="true">
            <div className="absolute inset-[-45%] rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(159,232,112,0.18)_0deg_9deg,transparent_9deg_24deg)] [mask-image:radial-gradient(circle,black_20%,transparent_68%)] motion-safe:animate-[rays-spin_28s_linear_infinite]" />
            <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(255,235,105,0.55)_0%,rgba(159,232,112,0.28)_42%,transparent_70%)] motion-safe:animate-[glow-pulse_2.6s_ease-in-out_infinite]" />
            <span className="absolute inset-[22%] rounded-full border-2 border-[var(--color-bright-green)] opacity-0 animate-[shockwave_1.3s_ease-out_0.35s_both]" />
            <span className="absolute inset-[22%] rounded-full border border-[var(--color-bright-yellow)] opacity-0 animate-[shockwave_1.5s_ease-out_0.6s_both]" />
            {burst.map((piece, index) => (
              <span
                key={index}
                className="absolute left-1/2 top-1/2 block opacity-0"
                style={{
                  width: piece.size,
                  height: piece.round ? piece.size : piece.size * 1.8,
                  borderRadius: piece.round ? "50%" : 2,
                  backgroundColor: piece.color,
                  animation: `burst 1.2s cubic-bezier(0.12, 0.8, 0.3, 1) ${piece.delay}s both`,
                  ["--dx" as string]: `${piece.dx}px`,
                  ["--dy" as string]: `${piece.dy}px`,
                  ["--turn" as string]: `${piece.turn}deg`,
                }}
              />
            ))}
            <div className="relative animate-[trophy-pop_0.9s_cubic-bezier(0.2,0.9,0.3,1.25)_both]">
              <div className="motion-safe:animate-[trophy-float_3.2s_ease-in-out_1s_infinite]">
                <Image src={asset("/illustrations/goal-reached.png")} alt="" width={232} height={232} priority draggable={false} className="select-none drop-shadow-[0_18px_30px_rgba(0,0,0,0.35)]" />
              </div>
            </div>
          </div>

          <h1 id="celebration-title" className="mt-2 text-4xl font-black uppercase leading-tight tracking-[-0.01em] text-[var(--color-bright-green)]" aria-label={title}>
            {[...title].map((letter, index) => (
              <span key={index} aria-hidden="true" className="inline-block whitespace-pre animate-[letter-in_0.5s_cubic-bezier(0.2,0.9,0.3,1.3)_both]" style={{ animationDelay: `${0.55 + index * 0.045}s` }}>{letter}</span>
            ))}
          </h1>
          <p className="tabular mt-3 text-4xl font-semibold text-white animate-[fade-up_0.5s_ease-out_0.9s_both]" aria-label={`${formatCurrency(amountCents, currency)} guardados`}><span aria-hidden="true">{formatCurrency(counted, currency)}</span></p>
          <p id="celebration-description" className="mt-3 max-w-[300px] text-base leading-6 text-white/85 animate-[fade-up_0.5s_ease-out_1.2s_both]">
            Você completou <span className="font-semibold text-white">{name}</span>. Do primeiro aporte até aqui, foi tudo você.
          </p>
        </div>

        <div className="flex flex-col gap-2 animate-[fade-up_0.5s_ease-out_1.5s_both]">
          <Link ref={primaryRef} href={`/goals/detail?id=${goalId}`} onClick={onClose} className="flex min-h-14 w-full items-center justify-center rounded-full bg-[var(--color-bright-green)] text-base font-semibold text-[var(--color-forest-green)] transition-colors hover:bg-[var(--color-accent-pressed)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-bright-green)]">Ver minha meta</Link>
          <Link href="/goals/new" onClick={onClose} className="flex min-h-12 w-full items-center justify-center rounded-full text-base font-semibold text-[var(--color-bright-green)] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-bright-green)]">Criar a próxima meta</Link>
        </div>
      </div>
    </div>
  );
}

function readCelebrated(): string[] | null {
  try {
    const value = window.localStorage.getItem(celebratedKey);
    return value === null ? null : (JSON.parse(value) as string[]);
  } catch {
    return [];
  }
}

function writeCelebrated(ids: string[]) {
  try {
    window.localStorage.setItem(celebratedKey, JSON.stringify(ids));
  } catch {
    // Sem armazenamento: a comemoração pode se repetir, mas nada quebra.
  }
}

/**
 * Observa as metas e comemora quando uma delas é alcançada. Espera o fim dos fluxos de registro
 * e criação (o comprovante aparece primeiro). Metas que já estavam completas na primeira abertura
 * não disparam a comemoração.
 */
export function GoalCelebrationWatcher() {
  const pathname = usePathname();
  const { savingsGoals, preferences, hasLoaded } = useFinance();
  const [active, setActive] = useState<{ id: string; name: string; amountCents: number } | null>(null);
  const busy = pathname.startsWith("/add") || pathname.startsWith("/goals/new") || pathname.startsWith("/onboarding");

  useEffect(() => {
    if (!hasLoaded || active) return;
    const today = todayISO();
    const complete = savingsGoals.filter((goal) => goalProgress(goal, today).isComplete);
    const stored = readCelebrated();
    if (stored === null) {
      writeCelebrated(complete.map((goal) => goal.id));
      return;
    }
    // Uma meta que deixou de estar completa (aporte removido) pode ser comemorada de novo.
    const stillComplete = stored.filter((id) => complete.some((goal) => goal.id === id));
    const next = complete.find((goal) => !stillComplete.includes(goal.id));
    if (!next || busy) {
      if (stillComplete.length !== stored.length) writeCelebrated(stillComplete);
      return;
    }
    const timer = window.setTimeout(() => {
      writeCelebrated([...stillComplete, next.id]);
      setActive({ id: next.id, name: next.name, amountCents: goalProgress(next, today).savedCents });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [active, busy, hasLoaded, savingsGoals]);

  if (!active) return null;
  return <GoalCelebration goalId={active.id} name={active.name} amountCents={active.amountCents} currency={preferences?.currency ?? "BRL"} onClose={() => setActive(null)} />;
}
