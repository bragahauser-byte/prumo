"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  Home,
  PiggyBank,
  Plus,
  Settings,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useFinance } from "@/components/finance-provider";
import { focusRing } from "@/components/ui/primitives";
import { asset } from "@/lib/base-path";

type NavigationItem = { href: string; label: string; mobileLabel?: string; title?: string; icon: LucideIcon; mobile?: boolean };

const navigation: NavigationItem[] = [
  { href: "/overview", label: "Início", icon: Home, mobile: true },
  { href: "/transactions", label: "Transações", mobileLabel: "Extrato", icon: ArrowLeftRight, mobile: true },
  { href: "/bills", label: "Agenda", title: "Agenda", icon: CalendarClock },
  { href: "/budgets", label: "Orçamentos", icon: Target },
  { href: "/goals", label: "Metas", icon: PiggyBank, mobile: true },
  { href: "/reports", label: "Relatórios", icon: BarChart3, mobile: true },
  { href: "/settings", label: "Ajustes", title: "Perfil e ajustes", icon: Settings },
];

const mobileNavigation = navigation.filter((item) => item.mobile);

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Avatar({ name }: { name: string | null }) {
  const initial = name?.trim().charAt(0).toLocaleUpperCase("pt-BR");
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,#dfe9f5,#c9d8ea)] text-base font-semibold text-[var(--color-action)]">
      {initial || <Settings size={20} aria-hidden="true" />}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { preferences, isLoading, hasLoaded, error, refresh } = useFinance();
  const isOnboarding = pathname.startsWith("/onboarding");
  const isOnboardingEdit = pathname === "/onboarding/edit";
  const isFullScreen = pathname.startsWith("/add");
  const activeItem = navigation.find((item) => isActiveRoute(pathname, item.href));
  const pageTitle = activeItem?.title ?? activeItem?.label ?? "Prumo";
  const onboardingComplete = preferences?.onboardingCompleted === true;

  useEffect(() => {
    if (!hasLoaded || error) return;
    if (!onboardingComplete && !isOnboarding) router.replace("/onboarding");
    if (onboardingComplete && isOnboarding && !isOnboardingEdit) router.replace("/overview");
  }, [error, hasLoaded, isOnboarding, isOnboardingEdit, onboardingComplete, router]);

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

  if (isOnboarding) {
    return (
      <div className="min-h-dvh bg-white">
        <div className="mx-auto flex min-h-dvh w-full max-w-[393px] flex-col"><main>{children}</main></div>
      </div>
    );
  }

  if (isFullScreen) return <main>{children}</main>;

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="mx-auto flex min-h-dvh max-w-[1280px] gap-10 px-4 pb-[calc(116px+env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),20px)] sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
        <aside className="sticky top-10 hidden h-[calc(100dvh-5rem)] w-60 shrink-0 flex-col lg:flex">
          <Link href="/overview" className={`mb-8 flex items-center gap-3 rounded-2xl px-3 py-1 ${focusRing}`}>
            <Image src={asset("/app-icon.png")} alt="" width={36} height={36} className="rounded-[10px]" />
            <span className="text-xl font-semibold">Prumo</span>
          </Link>
          <Link href="/add" className={`mb-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-action)] px-5 text-base font-semibold text-white transition-colors hover:bg-[var(--color-action-pressed)] ${focusRing}`}>
            <Plus size={20} aria-hidden="true" /> Novo registro
          </Link>
          <nav aria-label="Navegação principal" className="space-y-1">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = isActiveRoute(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold transition-colors ${focusRing} ${active ? "bg-white text-[var(--color-action)] shadow-[0_1px_4px_rgba(0,0,0,0.05)]" : "text-[var(--color-muted)] hover:bg-white/70 hover:text-[var(--color-text)]"}`}
                >
                  <Icon size={20} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
          <p className="mt-auto px-4 text-xs leading-5 text-[var(--color-muted)]">O Prumo não movimenta dinheiro. Ele organiza o que você registra para ajudar a decidir melhor.</p>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="mb-6 flex min-h-14 items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-[-0.01em]">{pageTitle}</h1>
            <Link href="/settings" aria-label="Perfil e ajustes" className={`rounded-full ${focusRing}`}>
              <Avatar name={preferences?.displayName ?? null} />
            </Link>
          </header>

          <main className="max-w-[1040px]">{children}</main>
        </div>
      </div>

      <nav aria-label="Navegação principal" className="fixed inset-x-3 bottom-0 z-30 mx-auto max-w-[440px] pb-[max(env(safe-area-inset-bottom),8px)] pt-2 lg:hidden">
        <div className="flex h-[68px] items-center gap-1 rounded-full border border-white/80 bg-[var(--color-nav-glass)] p-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          {mobileNavigation.slice(0, 2).map((item) => <MobileNavLink key={item.href} item={item} active={isActiveRoute(pathname, item.href)} />)}
          <Link href="/add" aria-label="Adicionar registro" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-action)] text-white shadow-[0_6px_20px_rgba(0,102,204,0.35)] transition-transform active:scale-95 ${focusRing}`}>
            <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
          </Link>
          {mobileNavigation.slice(2).map((item) => <MobileNavLink key={item.href} item={item} active={isActiveRoute(pathname, item.href)} />)}
        </div>
      </nav>
    </div>
  );
}

function MobileNavLink({ item, active }: { item: NavigationItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-action)] ${active ? "bg-[var(--color-nav-selection)] text-[var(--color-action)]" : "text-[var(--color-text)] hover:bg-black/[0.04]"}`}
    >
      <Icon size={20} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
      <span className="w-full truncate text-xs font-semibold leading-4">{item.mobileLabel ?? item.label}</span>
    </Link>
  );
}
