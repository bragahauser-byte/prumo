/**
 * Vibração curta de confirmação. O Prumo roda como site e PWA; se um dia for empacotado como app
 * nativo (Capacitor), usa a API de haptics da plataforma. Sem suporte, não faz nada.
 */
type Platform = "native" | "pwa" | "web";

type CapacitorHaptics = {
  impact?: (options: { style: "LIGHT" | "MEDIUM" | "HEAVY" }) => Promise<void>;
  notification?: (options: { type: "SUCCESS" | "WARNING" | "ERROR" }) => Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: { Haptics?: CapacitorHaptics };
};

function capacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "web";
  if (capacitor()?.isNativePlatform?.()) return "native";
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone ? "pwa" : "web";
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    // Alguns navegadores bloqueiam a vibração sem interação recente: falha em silêncio.
  }
}

/** Toque leve, para cada tecla da calculadora. */
export function hapticTap() {
  const haptics = capacitor()?.Plugins?.Haptics;
  if (detectPlatform() === "native" && haptics?.impact) {
    haptics.impact({ style: "LIGHT" }).catch(() => {});
    return;
  }
  vibrate(10);
}

/** Sequência de comemoração, para meta concluída. */
export function hapticSuccess() {
  const haptics = capacitor()?.Plugins?.Haptics;
  if (detectPlatform() === "native" && haptics?.notification) {
    haptics.notification({ type: "SUCCESS" }).catch(() => {});
    return;
  }
  vibrate([40, 70, 40, 70, 120]);
}
