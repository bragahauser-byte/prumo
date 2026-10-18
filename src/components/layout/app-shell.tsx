"use client";

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
import { BrandLogo, LoadingScreen } from "@/components/brand";
import { useFinance } from "@/components/finance-provider";
import { GoalCelebrationWatcher } from "@/components/goal-celebration";
import { NotificationBell, NotificationsProvider } from "@/components/notifications";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ToastProvider } from "@/components/ui/toast";
import { focusRing } from "@/components/ui/primitives";

type NavigationItem = { href: string; label: string; mobileLabel?: string; title?: string; subtitle: string; icon: LucideIcon; mobile?: boolean };

const navigation: NavigationItem[] = [
  { href: "/overview", label: "Início", subtitle: "Seu mês em dia", icon: Home, mobile: true },
  { href: "/transactions", label: "Transações", mobileLabel: "Extrato", subtitle: "Entradas e saídas", icon: ArrowLeftRight, mobile: true },
  { href: "/bills", label: "Agenda", title: "Agenda", subtitle: "Contas do mês", icon: CalendarClock },
  { href: "/budgets", label: "Orçamentos", subtitle: "Limites do mês", icon: Target },
  { href: "/goals", label: "Metas", subtitle: "Seus objetivos", icon: PiggyBank, mobile: true },
  { href: "/reports", label: "Relatórios", subtitle: "Como foi o mês", icon: BarChart3, mobile: true },
  { href: "/settings", label: "Ajustes", title: "Perfil e ajustes", subtitle: "Sua conta", icon: Settings },
];

const mobileNavigation = navigation.filter((item) => item.mobile);

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { preferences, isLoading, hasLoaded, error, refresh } = useFinance();
  const isOnboarding = pathname.startsWith("/onboarding");
  const isOnboardingEdit = pathname === "/onboarding/edit";
  const isFullScreen = pathname.startsWith("/add") || pathname.startsWith("/goals/new");
  const activeItem = navigation.find((item) => isActiveRoute(pathname, item.href));
  const pageTitle = activeItem?.title ?? activeItem?.label ?? "Prumo";
  const firstName = preferences?.displayName?.trim().split(/\s+/)[0];
  const pageSubtitle = activeItem?.href === "/overview" && firstName ? `Olá, ${firstName}` : activeItem?.subtitle ?? "";
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
      <LoadingScreen label="Carregando seus dados financeiros" />
    );
  }

  if (isOnboarding) {
    return (
      <Providers>
        <div className="min-h-dvh bg-white">
          <div className="mx-auto flex min-h-dvh w-full max-w-[393px] flex-col"><main>{children}</main></div>
        </div>
      </Providers>
    );
  }

  if (isFullScreen) return <Providers><main>{children}</main></Providers>;

  return (
    <Providers>
    <div className="min-h-dvh bg-white text-[var(--color-text)]">
      <div className="mx-auto flex min-h-dvh max-w-[1280px] gap-10 px-4 pb-[calc(148px+env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),64px)] sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
        <aside className="sticky top-10 hidden h-[calc(100dvh-5rem)] w-60 shrink-0 flex-col border-r border-[var(--color-border)] pr-6 lg:flex">
          <Link href="/overview" className={`mb-8 flex items-center gap-3 rounded-2xl px-3 py-1 ${focusRing}`}>
            <BrandLogo size={36} />
            <span className="text-xl font-semibold">Prumo</span>
          </Link>
          <Link href="/add" className={`mb-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-5 text-base font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-pressed)] ${focusRing}`}>
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
                  className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold transition-colors ${focusRing} ${active ? "bg-[var(--color-soft)] text-[var(--color-text)]" : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text)]"}`}
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
          <header className="mb-6 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold leading-[30px] tracking-[-0.01em] text-[var(--color-text)]">{pageTitle}</h1>
              {pageSubtitle ? <p className="truncate text-2xl font-normal leading-[30px] tracking-[-0.01em] text-[var(--color-tertiary)]">{pageSubtitle}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <NotificationBell />
              <Link href="/settings" aria-label="Perfil e ajustes" className={`rounded-full ${focusRing}`}>
                <ProfileAvatar name={preferences?.displayName} photo={preferences?.avatarDataUrl} />
              </Link>
            </div>
          </header>

          <main className="max-w-[1040px]">{children}</main>
        </div>
      </div>

      <nav aria-label="Navegação principal" className="fixed inset-x-4 bottom-[max(40px,env(safe-area-inset-bottom))] z-30 mx-auto max-w-[440px] lg:hidden">
        <div className="flex h-[68px] items-center gap-1 rounded-full border border-white/80 bg-[var(--color-nav-glass)] p-1.5 shadow-[0_8px_40px_rgba(14,15,12,0.14)] backdrop-blur-xl">
          {mobileNavigation.slice(0, 2).map((item) => <MobileNavLink key={item.href} item={item} active={isActiveRoute(pathname, item.href)} />)}
          <Link href="/add" aria-label="Adicionar registro" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-[0_6px_20px_rgba(22,51,0,0.28)] transition-transform active:scale-95 ${focusRing}`}>
            <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
          </Link>
          {mobileNavigation.slice(2).map((item) => <MobileNavLink key={item.href} item={item} active={isActiveRoute(pathname, item.href)} />)}
        </div>
      </nav>
    </div>
    </Providers>
  );
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <NotificationsProvider>
        {children}
        <GoalCelebrationWatcher />
      </NotificationsProvider>
    </ToastProvider>
  );
}

function MobileNavLink({ item, active }: { item: NavigationItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-action)] ${active ? "bg-[var(--color-nav-selection)] text-[var(--color-forest-green)]" : "text-[var(--color-muted)] hover:bg-black/[0.04]"}`}
    >
      <Icon size={20} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
      <span className="w-full truncate text-xs font-semibold leading-4">{item.mobileLabel ?? item.label}</span>
    </Link>
  );
}
