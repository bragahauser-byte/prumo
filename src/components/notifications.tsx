"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, BellRing, CalendarClock, Lightbulb, TriangleAlert, type LucideIcon } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { Sheet } from "@/components/ui/sheet";
import { focusRing } from "@/components/ui/primitives";
import { buildNotifications, type AppNotification, type NotificationLevel } from "@/domain/notifications";
import { asset } from "@/lib/base-path";
import { defaultNotificationSettings } from "@/lib/finance/repository";
import { formatCurrency } from "@/lib/formatting";

const seenKey = "prumo:notifications:seen";
const pushedKey = "prumo:notifications:pushed";
const insightPushKey = "prumo:notifications:last-insight-push";
const insightPushInterval = 7 * 24 * 60 * 60 * 1000;

function readList(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeList(key: string, values: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(values.slice(-300)));
  } catch {
    // Armazenamento indisponível (aba anônima, por exemplo): a central continua funcionando sem lembrar o que foi visto.
  }
}

type NotificationsContextValue = {
  items: AppNotification[];
  unseenCount: number;
  markAllSeen: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue>({ items: [], unseenCount: 0, markAllSeen: () => {} });

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { expenses, budgets, savingsGoals, preferences, hasLoaded } = useFinance();
  const { currency, projectionCents } = useFinanceSummary();
  const [now, setNow] = useState(() => new Date());
  const [seen, setSeen] = useState<string[]>(() => (typeof window === "undefined" ? [] : readList(seenKey)));
  const settings = preferences?.notificationSettings ?? defaultNotificationSettings;

  // Recalcula a cada minuto: os lembretes dependem do horário escolhido.
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const items = useMemo(() => hasLoaded ? buildNotifications({
    now,
    movements: expenses,
    budgets,
    goals: savingsGoals,
    projectionCents,
    reminders: settings.reminders,
    formatMoney: (cents) => formatCurrency(cents, currency),
  }) : [], [budgets, currency, expenses, hasLoaded, now, projectionCents, savingsGoals, settings.reminders]);

  // Notificações do sistema: alertas e lembretes uma vez cada; insights no máximo um por semana.
  useEffect(() => {
    if (!hasLoaded || !preferences?.notificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
    const pushed = new Set(readList(pushedKey));
    const send = (item: AppNotification) => {
      const notification = new Notification(item.title, { body: item.body, icon: asset("/app-icon.png"), tag: item.id });
      notification.onclick = () => { window.focus(); router.push(item.href); notification.close(); };
      pushed.add(item.id);
    };
    for (const item of items) {
      if (pushed.has(item.id)) continue;
      if (item.level === "reminder" || (item.level === "alert" && settings.alertsPush)) send(item);
    }
    const topInsight = items.find((item) => item.level === "insight" && !pushed.has(item.id));
    if (settings.insightsPush && topInsight) {
      let last = 0;
      try { last = Number(window.localStorage.getItem(insightPushKey) ?? 0); } catch { /* sem armazenamento */ }
      if (Date.now() - last >= insightPushInterval) {
        send(topInsight);
        try { window.localStorage.setItem(insightPushKey, String(Date.now())); } catch { /* sem armazenamento */ }
      }
    }
    writeList(pushedKey, [...pushed]);
  }, [hasLoaded, items, preferences?.notificationsEnabled, router, settings.alertsPush, settings.insightsPush]);

  const unseenCount = items.filter((item) => item.level !== "insight" && !seen.includes(item.id)).length;

  const value = useMemo(() => ({
    items,
    unseenCount,
    markAllSeen: () => {
      const next = [...new Set([...seen, ...items.map((item) => item.id)])];
      setSeen(next);
      writeList(seenKey, next);
    },
  }), [items, seen, unseenCount]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

const sections: { level: NotificationLevel; title: string; icon: LucideIcon; tone: string }[] = [
  { level: "alert", title: "Importantes", icon: TriangleAlert, tone: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" },
  { level: "reminder", title: "Lembretes", icon: CalendarClock, tone: "bg-[var(--color-soft)] text-[var(--color-text)]" },
  { level: "insight", title: "Insights", icon: Lightbulb, tone: "bg-[var(--color-action-soft)] text-[var(--color-action)]" },
];

export function NotificationBell() {
  const { items, unseenCount, markAllSeen } = useNotifications();
  const [open, setOpen] = useState(false);

  function close() {
    markAllSeen();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unseenCount ? `Notificações, ${unseenCount} ${unseenCount === 1 ? "nova" : "novas"}` : "Notificações"}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-soft)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] ${focusRing}`}
      >
        {unseenCount ? <BellRing size={20} aria-hidden="true" /> : <Bell size={20} aria-hidden="true" />}
        {unseenCount ? (
          <span className="tabular absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-error)] px-1 text-xs font-semibold text-white ring-2 ring-white" aria-hidden="true">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <Sheet title="Notificações" description="Só o que pede atenção, os lembretes que você escolheu e o que vale saber." onClose={close}>
          {items.length ? (
            <div className="space-y-6 pb-2">
              {sections.map(({ level, title, icon: Icon, tone }) => {
                const list = items.filter((item) => item.level === level);
                if (!list.length) return null;
                return (
                  <section key={level} aria-labelledby={`notifications-${level}`}>
                    <h3 id={`notifications-${level}`} className="text-sm font-semibold text-[var(--color-tertiary)]">{title}</h3>
                    <ul className="mt-2 divide-y divide-[var(--color-border)]">
                      {list.map((item) => (
                        <li key={item.id} className="flex gap-3 py-3">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon size={18} aria-hidden="true" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold leading-6">{item.title}</p>
                            <p className="mt-0.5 text-sm leading-5 text-[var(--color-muted)]">{item.body}</p>
                            <Link href={item.href} onClick={close} className={`mt-1 inline-flex min-h-9 items-center text-sm font-semibold text-[var(--color-link)] underline underline-offset-4 ${focusRing}`}>{item.action}</Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-base text-[var(--color-muted)]">Tudo em dia por aqui. Quando algo pedir atenção, aparece nesta lista.</p>
          )}
          <Link href="/settings/notifications" onClick={close} className={`mt-2 flex min-h-11 items-center justify-center rounded-full text-sm font-semibold text-[var(--color-link)] hover:bg-[var(--color-soft)] ${focusRing}`}>Configurar notificações e lembretes</Link>
        </Sheet>
      ) : null}
    </>
  );
}
