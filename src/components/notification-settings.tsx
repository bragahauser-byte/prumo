"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { BellRing, CalendarClock, ChevronLeft, CircleCheck, Lightbulb, TriangleAlert, type LucideIcon } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { Card, focusRing, inkButton, textButton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { weekdayName } from "@/domain/notifications";
import { defaultNotificationSettings, type NotificationSettings } from "@/lib/finance/repository";

const selectClass = `min-h-11 rounded-full bg-[var(--color-soft)] px-4 text-sm font-semibold text-[var(--color-text)] outline-none ${focusRing}`;

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${focusRing} ${checked ? "bg-[var(--color-forest-green)]" : "bg-[var(--color-border-overlay)]"}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left] ${checked ? "left-[24px]" : "left-1"}`} />
    </button>
  );
}

function Section({ icon: Icon, tone, title, description, children }: { icon: LucideIcon; tone: string; title: string; description: string; children?: ReactNode }) {
  return (
    <Card>
      <div className="flex gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--color-muted)]">{description}</p>
        </div>
      </div>
      {children ? <div className="mt-4 divide-y divide-[var(--color-border)]">{children}</div> : null}
    </Card>
  );
}

function Row({ title, description, control, children }: { title: string; description?: string; control: ReactNode; children?: ReactNode }) {
  return (
    <div className="py-3">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium">{title}</p>
          {description ? <p className="text-sm leading-5 text-[var(--color-muted)]">{description}</p> : null}
        </div>
        {control}
      </div>
      {children ? <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

const subscribeNothing = () => () => {};

function usePermission() {
  // Lido no cliente; no HTML estático começa como "unsupported" e é atualizado na hidratação.
  return useSyncExternalStore(subscribeNothing, () => ("Notification" in window ? Notification.permission : "unsupported"), () => "unsupported" as const);
}

export function NotificationSettingsScreen() {
  const { preferences, savePreferences, isSaving } = useFinance();
  const toast = useToast();
  const browserPermission = usePermission();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const settings = preferences?.notificationSettings ?? defaultNotificationSettings;
  const currentPermission = permission ?? browserPermission;
  const pushOn = Boolean(preferences?.notificationsEnabled) && currentPermission === "granted";

  async function save(next: Partial<{ settings: NotificationSettings; notificationsEnabled: boolean }>, confirmation: string) {
    if (!preferences) return;
    setError(null);
    try {
      await savePreferences({ ...preferences, notificationSettings: next.settings ?? settings, notificationsEnabled: next.notificationsEnabled ?? preferences.notificationsEnabled });
      toast(confirmation);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    }
  }

  const reminders = settings.reminders;
  const setReminder = <K extends keyof NotificationSettings["reminders"]>(key: K, patch: Partial<NotificationSettings["reminders"][K]>, confirmation: string) =>
    save({ settings: { ...settings, reminders: { ...reminders, [key]: { ...reminders[key], ...patch } } } }, confirmation);

  async function enablePush() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") await save({ notificationsEnabled: true }, "Notificações ativadas");
    else setError("O navegador bloqueou as notificações. Libere nas configurações do site para receber os avisos.");
  }

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      <Link href="/settings" className={`${textButton} -ml-3`}><ChevronLeft size={18} aria-hidden="true" /> Ajustes</Link>

      <Section icon={BellRing} tone="bg-[var(--color-action-soft)] text-[var(--color-action)]" title="Notificações no aparelho" description="O Prumo calcula os avisos no seu aparelho: eles chegam quando o app está aberto em alguma aba ou janela. Nada é enviado a servidores.">
        {currentPermission === "unsupported" ? (
          <p className="py-3 text-sm text-[var(--color-muted)]">Este navegador não mostra notificações. Os avisos continuam no sino, no topo da tela.</p>
        ) : currentPermission === "granted" ? (
          <Row title="Receber notificações" description={pushOn ? "Ligado neste aparelho." : "Desligado. Os avisos ficam só no sino."} control={<Switch checked={pushOn} disabled={isSaving} label="Receber notificações" onChange={(value) => void save({ notificationsEnabled: value }, value ? "Notificações ativadas" : "Notificações desligadas")} />} />
        ) : (
          <div className="py-3">
            <button type="button" onClick={() => void enablePush()} className={`${inkButton} w-full sm:w-auto`}>Permitir notificações</button>
            {currentPermission === "denied" ? <p className="mt-2 text-sm text-[var(--color-muted)]">As notificações estão bloqueadas para este site. Libere nas configurações do navegador.</p> : null}
          </div>
        )}
      </Section>

      <Section icon={TriangleAlert} tone="bg-[var(--color-warning-soft)] text-[var(--color-warning)]" title="Alertas importantes" description="Só quando existe uma ação útil: conta que vence amanhã, orçamento perto do limite, meta com prazo próximo e ritmo abaixo do planejado.">
        <Row title="Também como notificação" description="Sempre aparecem no sino; aqui você escolhe se avisam fora do app." control={<Switch checked={settings.alertsPush} disabled={isSaving} label="Alertas importantes como notificação" onChange={(value) => void save({ settings: { ...settings, alertsPush: value } }, value ? "Alertas ligados" : "Alertas só no app")} />} />
      </Section>

      <Section icon={CalendarClock} tone="bg-[var(--color-soft)] text-[var(--color-text)]" title="Lembretes programados" description="Você escolhe a frequência e o horário. Todos começam desligados.">
        <Row title="Revisar as despesas da semana" description={reminders.weeklyReview.enabled ? `Toda ${weekdayName(reminders.weeklyReview.weekday)}, às ${reminders.weeklyReview.time}.` : undefined} control={<Switch checked={reminders.weeklyReview.enabled} disabled={isSaving} label="Revisar as despesas da semana" onChange={(value) => void setReminder("weeklyReview", { enabled: value }, value ? "Lembrete semanal ligado" : "Lembrete semanal desligado")} />}>
          {reminders.weeklyReview.enabled ? (
            <>
              <label className="sr-only" htmlFor="weekly-day">Dia da semana</label>
              <select id="weekly-day" value={reminders.weeklyReview.weekday} onChange={(event) => void setReminder("weeklyReview", { weekday: Number(event.target.value) }, "Lembrete atualizado")} className={selectClass}>
                {[0, 1, 2, 3, 4, 5, 6].map((day) => <option key={day} value={day}>{weekdayName(day).replace(/^./, (letter) => letter.toUpperCase())}</option>)}
              </select>
              <label className="sr-only" htmlFor="weekly-time">Horário da revisão semanal</label>
              <input id="weekly-time" type="time" value={reminders.weeklyReview.time} onChange={(event) => event.target.value && void setReminder("weeklyReview", { time: event.target.value }, "Lembrete atualizado")} className={selectClass} />
            </>
          ) : null}
        </Row>
        <Row title="Conferir o orçamento no início do mês" description={reminders.monthlyBudget.enabled ? `No dia 1, às ${reminders.monthlyBudget.time}.` : undefined} control={<Switch checked={reminders.monthlyBudget.enabled} disabled={isSaving} label="Conferir o orçamento no início do mês" onChange={(value) => void setReminder("monthlyBudget", { enabled: value }, value ? "Lembrete do orçamento ligado" : "Lembrete do orçamento desligado")} />}>
          {reminders.monthlyBudget.enabled ? (
            <>
              <label className="sr-only" htmlFor="budget-time">Horário do lembrete do orçamento</label>
              <input id="budget-time" type="time" value={reminders.monthlyBudget.time} onChange={(event) => event.target.value && void setReminder("monthlyBudget", { time: event.target.value }, "Lembrete atualizado")} className={selectClass} />
            </>
          ) : null}
        </Row>
        <Row title="Lembrar contas antes do vencimento" description={reminders.billsAhead.enabled ? `${reminders.billsAhead.daysBefore} dias antes, às ${reminders.billsAhead.time}.` : undefined} control={<Switch checked={reminders.billsAhead.enabled} disabled={isSaving} label="Lembrar contas antes do vencimento" onChange={(value) => void setReminder("billsAhead", { enabled: value }, value ? "Lembrete de contas ligado" : "Lembrete de contas desligado")} />}>
          {reminders.billsAhead.enabled ? (
            <>
              <label className="sr-only" htmlFor="bills-days">Antecedência</label>
              <select id="bills-days" value={reminders.billsAhead.daysBefore} onChange={(event) => void setReminder("billsAhead", { daysBefore: Number(event.target.value) }, "Lembrete atualizado")} className={selectClass}>
                {[2, 3, 5, 7].map((days) => <option key={days} value={days}>{days} dias antes</option>)}
              </select>
              <label className="sr-only" htmlFor="bills-time">Horário do lembrete de contas</label>
              <input id="bills-time" type="time" value={reminders.billsAhead.time} onChange={(event) => event.target.value && void setReminder("billsAhead", { time: event.target.value }, "Lembrete atualizado")} className={selectClass} />
            </>
          ) : null}
        </Row>
      </Section>

      <Section icon={Lightbulb} tone="bg-[var(--color-action-soft)] text-[var(--color-action)]" title="Insights financeiros" description="O que talvez você não tenha notado: gastou menos numa categoria, como deve fechar o mês, uma meta quase completa. No máximo três por vez, sempre com contexto.">
        <Row title="O principal insight da semana como notificação" description="No máximo um por semana. Os demais ficam no sino." control={<Switch checked={settings.insightsPush} disabled={isSaving} label="Insight da semana como notificação" onChange={(value) => void save({ settings: { ...settings, insightsPush: value } }, value ? "Insight semanal ligado" : "Insights só no app")} />} />
      </Section>

      <Section icon={CircleCheck} tone="bg-[var(--color-success-soft)] text-[var(--color-success)]" title="Confirmações" description="Despesa registrada, meta criada, orçamento atualizado: aparecem como um aviso discreto na tela e nunca viram notificação." />

      {error ? <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p> : null}
    </div>
  );
}
