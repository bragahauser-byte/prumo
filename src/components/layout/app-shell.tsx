"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BarChart3,
  CreditCard,
  LayoutGrid,
  Settings,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { useFinance } from "@/components/finance-provider";

const navigation = [
  { href: "/overview", label: "Visão geral", icon: LayoutGrid },
  { href: "/expenses", label: "Despesas", icon: CreditCard },
  { href: "/recurring", label: "Recorrências", mobileLabel: "Recorr.", icon: Sparkles },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/settings", label: "Configurações", mobileLabel: "Ajustes", icon: Settings },
];

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { preferences, isLoading, hasLoaded, error, refresh } = useFinance();
  const isOnboarding = pathname.startsWith("/onboarding");
  const isOnboardingEdit = pathname === "/onboarding/edit";
  const activeItem = navigation.find((item) => isActiveRoute(pathname, item.href));
  const pageTitle = isOnboardingEdit ? "Preferências iniciais" : isOnboarding ? "Primeiros passos" : activeItem?.label ?? "Finanças";
  const onboardingComplete = preferences?.onboardingCompleted === true;

  useEffect(() => {
    if (!hasLoaded || error) return;
    if (!onboardingComplete && !isOnboarding) router.replace("/onboarding");
    if (onboardingComplete && isOnboarding && !isOnboardingEdit) router.replace("/overview");
  }, [error, hasLoaded, isOnboarding, onboardingComplete, router]);

  if (!hasLoaded && error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 pt-16 pb-10 text-center" role="alert">
        <h1 className="text-xl font-semibold">Não foi possível abrir seus dados</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">Verifique sua conexão e tente novamente. Os dados salvos não foram alterados.</p>
        <button onClick={() => void refresh()} className="mt-6 min-h-11 rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white">Tentar novamente</button>
      </main>
    );
  }

  if (isLoading || !hasLoaded || (!error && ((!onboardingComplete && !isOnboarding) || (onboardingComplete && isOnboarding && !isOnboardingEdit)))) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 pt-16 pb-10 text-sm text-[var(--color-muted)]" role="status">
        Carregando seus dados financeiros...
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-white text-[var(--color-text)] lg:bg-[var(--color-bg)]">
      <div className={`mx-auto flex min-h-dvh ${isOnboarding ? "w-full max-w-[393px] flex-col px-0 pt-0 pb-0" : "max-w-[1440px] gap-8 px-4 pt-16 pb-[calc(122px+env(safe-area-inset-bottom))] sm:px-6 lg:gap-12 lg:px-8 lg:pb-10 lg:pt-16"}`}>
        {!isOnboarding ? <aside className="sticky top-16 hidden h-[calc(100dvh-8rem)] w-60 shrink-0 flex-col lg:flex">
          <nav aria-label="Navegação principal" className="space-y-1">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = isActiveRoute(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)] ${active ? "bg-[var(--color-surface)] text-[var(--color-action)]" : "text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"}`}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </aside> : null}

        <div className="min-w-0 flex-1">
          {!isOnboarding ? (
            <header className="mb-8 flex min-h-12 items-center border-b border-[var(--color-border)] pb-4">
              <h1 className="text-2xl font-semibold">{pageTitle}</h1>
            </header>
          ) : null}

          <main>{children}</main>

          {!isOnboarding ? <nav
            aria-label="Navegação principal"
            className="fixed inset-x-3 bottom-0 z-20 mx-auto max-w-[440px] pb-[max(env(safe-area-inset-bottom),8px)] pt-2 lg:hidden"
          >
            <div className="flex h-[66px] items-center gap-1 rounded-full border border-white/80 bg-[var(--color-nav-glass)] p-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl">
              {navigation.map(({ href, label, mobileLabel, icon: Icon }) => {
                const active = isActiveRoute(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-action)] ${active ? "bg-[var(--color-nav-selection)] text-[var(--color-action)]" : "text-[var(--color-text)] hover:bg-black/[0.04]"}`}
                  >
                    <Icon size={19} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
                    <span className="w-full truncate text-[10px] font-semibold leading-3">
                      {mobileLabel ?? label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav> : null}
        </div>
      </div>
    </div>
  );
}
