"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/brand";

/**
 * Abertura do app: a bússola balança por alguns segundos e a tela some num fade suave,
 * revelando as boas-vindas. Com "reduzir movimento", dura bem menos.
 */
export function SplashScreen({ duration = 2600 }: { duration?: number }) {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leave = window.setTimeout(() => setPhase("leave"), reduce ? 600 : duration);
    const gone = window.setTimeout(() => setPhase("gone"), (reduce ? 600 : duration) + 450);
    return () => { window.clearTimeout(leave); window.clearTimeout(gone); };
  }, [duration]);

  if (phase === "gone") return null;
  return <LoadingScreen label="Abrindo o Prumo" className={`transition-opacity duration-[450ms] ease-out ${phase === "leave" ? "pointer-events-none opacity-0" : "opacity-100"}`} />;
}
