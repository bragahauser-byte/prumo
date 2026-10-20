"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  CalendarClock,
  ChartColumn,
  Eye,
  EyeOff,
  House,
  Landmark,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { AiMark } from "@/components/assistant/ai-mark";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { AssistantProvider, useAssistant } from "@/components/assistant/assistant-context";
import { BrandLogo, LoadingScreen } from "@/components/brand";
import { useFinance } from "@/components/finance-provider";
import { GoalCelebrationWatcher } from "@/components/goal-celebration";
import { NotificationsProvider } from "@/components/notifications";
import { PrivacyProvider, usePrivacy } from "@/components/privacy";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useKeyboardOpen } from "@/components/use-keyboard-open";
import { ToastProvider } from "@/components/ui/toast";
import { focusRing } from "@/components/ui/primitives";

type NavigationItem = { href: string; label: string; title?: string; subtitle: string; icon: LucideIcon; mobile?: boolean };

const navigation: NavigationItem[] = [
  { href: "/overview", label: "Início", subtitle: "Seu mês em dia", icon: House, mobile: true },
  { href: "/transactions", label: "Extrato", subtitle: "Entradas e saídas", icon: ReceiptText, mobile: true },
  { href: "/goals", label: "Metas", subtitle: "Seus objetivos", icon: PiggyBank, mobile: true },
  { href: "/reports", label: "Relatórios", subtitle: "Como foi o mês", icon: ChartColumn, mobile: true },
  { href: "/investments", label: "Investimentos", subtitle: "Suas aplicações", icon: Landmark },
  { href: "/bills", label: "Agenda", subtitle: "Contas do mês", icon: CalendarClock },
  { href: "/budgets", label: "Orçamentos", subtitle: "Limites do mês", icon: Wallet },
  { href: "/settings", label: "Ajustes", title: "Perfil e ajustes", subtitle: "Sua conta", icon: Settings },
];

/** Telas internas dos ajustes com título próprio. */
const subpages: { href: string; title: string; subtitle: string }[] = [
  { href: "/settings/profile", title: "Perfil", subtitle: "Seus dados e preferências" },
  { href: "/settings/accounts", title: "Bancos e contas", subtitle: "Saldos por instituição" },
  { href: "/settings/notifications", title: "Notificações", subtitle: "Alertas e lembretes" },
  { href: "/investments/learn", title: "Tipos de investimento", subtitle: "Conheça antes de aplicar" },
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
  const isFullScreen = pathname.startsWith("/add") || pathname.startsWith("/goals/new");
  const activeItem = navigation.find((item) => isActiveRoute(pathname, item.href));
  const subpage = subpages.find((item) => isActiveRoute(pathname, item.href));
  const pageTitle = subpage?.title ?? activeItem?.title ?? activeItem?.label ?? "Prumo";
  const firstName = preferences?.displayName?.trim().split(/\s+/)[0];
  const pageSubtitle = subpage?.subtitle ?? (activeItem?.href === "/overview" && firstName ? `Olá, ${firstName}` : activeItem?.subtitle ?? "");
  const onboardingComplete = preferences?.onboardingCompleted === true;

  useEffect(() => {
    if (!hasLoaded || error) return;
    if (!onboardingComplete && !isOnboarding) router.replace("/onboarding");
    if (onboardingComplete && isOnboarding) router.replace(pathname === "/onboarding/edit" ? "/settings/profile" : "/overview");
  }, [error, hasLoaded, isOnboarding, onboardingComplete, pathname, router]);

  if (!hasLoaded && error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 pt-16 pb-10 text-center" role="alert">
        <h1 className="text-xl font-semibold">Não foi possível abrir seus dados</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">Verifique sua conexão e tente novamente. Os dados salvos não foram alterados.</p>
        <button onClick={() => void refresh()} className="mt-6 min-h-11 rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white">Tentar novamente</button>
      </main>
    );
  }

  if (isLoading || !hasLoaded || (!error && ((!onboardingComplete && !isOnboarding) || (onboardingComplete && isOnboarding)))) {
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
        <div className="mx-auto flex min-h-dvh max-w-[1280px] gap-10 px-4 pb-[calc(132px+env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),64px)] sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <DesktopSidebar pathname={pathname} />

          <div className="min-w-0 flex-1">
            <header className="mb-6 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-semibold leading-[30px] tracking-[-0.01em] text-[var(--color-text)]">{pageTitle}</h1>
                {pageSubtitle ? <p className="truncate text-2xl font-normal leading-[30px] tracking-[-0.01em] text-[var(--color-tertiary)]">{pageSubtitle}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PrivacyToggle />
                <Link href="/settings" aria-label="Perfil e ajustes" className={`rounded-full ${focusRing}`}>
                  <ProfileAvatar name={preferences?.displayName} photo={preferences?.avatarDataUrl} />
                </Link>
              </div>
            </header>

            <main className="max-w-[1040px]">{children}</main>
          </div>
        </div>

        <MobileNavigation pathname={pathname} />
      </div>
    </Providers>
  );
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <PrivacyProvider>
        <AssistantProvider>
          <NotificationsProvider>
            {children}
            <GoalCelebrationWatcher />
            <AssistantPanel />
          </NotificationsProvider>
        </AssistantProvider>
      </PrivacyProvider>
    </ToastProvider>
  );
}

/** Olho no topo: mostra ou oculta saldos e totais (••••). */
function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy();
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
      className={`flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] ${focusRing}`}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

function DesktopSidebar({ pathname }: { pathname: string }) {
  const { openAssistant } = useAssistant();
  return (
    <aside className="sticky top-10 hidden h-[calc(100dvh-5rem)] w-60 shrink-0 flex-col border-r border-[var(--color-border)] pr-6 lg:flex">
      <Link href="/overview" className={`mb-8 flex items-center gap-3 rounded-2xl px-3 py-1 ${focusRing}`}>
        <BrandLogo size={36} />
        <span className="text-xl font-semibold">Prumo</span>
      </Link>
      <Link href="/add" className={`mb-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-5 text-base font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-pressed)] ${focusRing}`}>
        <Plus size={20} aria-hidden="true" /> Novo registro
      </Link>
      <button type="button" onClick={() => openAssistant()} className={`mb-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-soft)] px-5 text-base font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] ${focusRing}`}>
        <AiMark size={18} animated /> Assistente
      </button>
      <nav aria-label="Navegação principal" className="space-y-1">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = isActiveRoute(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors ${focusRing} ${active ? "bg-[var(--color-highlight-soft)] text-[var(--color-highlight-pressed)]" : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text)]"}`}
            >
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-4 text-xs leading-5 text-[var(--color-tertiary)]">O Prumo não movimenta dinheiro. Ele organiza o que você registra para ajudar a decidir melhor.</p>
    </aside>
  );
}

/**
 * Barra de abas (Figma "Tab Bar"): pílula de vidro com quatro abas de ícone + rótulo e, à direita,
 * o botão circular da IA com borda em gradiente animado. Some enquanto o teclado está aberto.
 */
function MobileNavigation({ pathname }: { pathname: string }) {
  const keyboardOpen = useKeyboardOpen();
  const { openAssistant, open } = useAssistant();
  if (keyboardOpen || open) return null;

  return (
    <>
      {/* Véu com desfoque: o conteúdo some suavemente ao passar por baixo da barra. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(120px+env(safe-area-inset-bottom))] bg-gradient-to-t from-white via-white/80 to-white/0 backdrop-blur-[4px] [mask-image:linear-gradient(to_top,black_50%,transparent)] lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[480px] items-center justify-end gap-4 px-[25px] pb-[max(25px,env(safe-area-inset-bottom))] pt-4 lg:hidden">
        <nav aria-label="Navegação principal" className="flex h-[54px] min-w-0 flex-1 items-center rounded-full bg-[var(--color-nav-glass)]/90 px-0.5 shadow-[var(--shadow-nav)] backdrop-blur-xl">
          {mobileNavigation.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative isolate flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-px px-2 pb-[7px] pt-1.5 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-nav-active)] rounded-full ${active ? "text-[var(--color-nav-active)]" : "text-[var(--color-nav-icon)]"}`}
              >
                {active ? <span aria-hidden="true" className="absolute inset-y-0 -left-0.5 -right-0.5 -z-10 rounded-full bg-[var(--color-nav-selection)] mix-blend-multiply" /> : null}
                <span className="flex h-7 items-center"><Icon size={20} strokeWidth={active ? 2.25 : 2} aria-hidden="true" /></span>
                <span className="w-full truncate text-center text-[10px] font-semibold leading-3 tracking-[-0.1px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => openAssistant()}
          aria-label="Abrir assistente"
          className="ai-ring relative flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-nav)] transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-nav-active)]"
        >
          <AiMark size={28} animated />
        </button>
      </div>
    </>
  );
}
