"use client";

import { CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Confirmações e progresso (nível 4 das notificações): um aviso discreto dentro da interface,
 * que some sozinho. Nunca vira notificação do sistema.
 */
const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((message: string) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message });
    timer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(40px+68px+16px)] z-[80] flex justify-center px-4 lg:bottom-8" role="status" aria-live="polite">
        {toast ? (
          <div key={toast.id} className="animate-toast-in flex max-w-[360px] items-center gap-2 rounded-full bg-[var(--color-forest-green)] py-3 pl-3 pr-5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(14,15,12,0.22)]">
            <CircleCheck size={20} className="shrink-0 text-[var(--color-bright-green)]" aria-hidden="true" />
            <span>{toast.message}</span>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
