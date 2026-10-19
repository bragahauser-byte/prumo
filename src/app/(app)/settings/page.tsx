"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Camera, ChevronRight, KeyRound, Landmark, LogOut, ShieldCheck, SlidersHorizontal, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { QuickBalanceUpdate } from "@/components/accounts/quick-balance";
import { useFinance } from "@/components/finance-provider";
import { NotificationCenter, useNotifications } from "@/components/notifications";
import { usePrivacy } from "@/components/privacy";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useToast } from "@/components/ui/toast";
import { photoToAvatarDataUrl } from "@/lib/image";
import { useFinanceSummary } from "@/components/use-finance-summary";
import { Card, focusRing } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/formatting";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const rowClass = `flex min-h-14 w-full items-center gap-4 rounded-2xl px-2 py-2 text-left text-base transition-colors hover:bg-[var(--color-soft)] ${focusRing}`;

export default function SettingsPage() {
  const { mode, preferences, expenses, savingsGoals, recurringRules, accounts, savePreferences } = useFinance();
  const { currency, balanceCents } = useFinanceSummary();
  const { unseenCount } = useNotifications();
  const { mask } = usePrivacy();
  const [editingBalance, setEditingBalance] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const router = useRouter();
  const toast = useToast();
  const photoInput = useRef<HTMLInputElement>(null);
  const name = preferences?.displayName?.trim();

  async function changePhoto(file: File | undefined) {
    if (!file || !preferences) return;
    setMessage(null);
    if (file.size > 20 * 1024 * 1024) return setMessage({ text: "Escolha uma foto com até 20 MB.", failed: true });
    try {
      const avatarDataUrl = await photoToAvatarDataUrl(file);
      await savePreferences({ ...preferences, avatarDataUrl });
      toast("Foto de perfil atualizada");
    } catch {
      setMessage({ text: "Não foi possível usar essa imagem. Tente uma foto em JPG ou PNG.", failed: true });
    } finally {
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  async function removePhoto() {
    if (!preferences) return;
    try {
      await savePreferences({ ...preferences, avatarDataUrl: null });
      toast("Foto removida");
    } catch {
      setMessage({ text: "Não foi possível remover a foto.", failed: true });
    }
  }

  async function signOut() {
    try {
      await createSupabaseBrowserClient().auth.signOut();
      router.replace("/login");
    } catch {
      setMessage({ text: "Não foi possível encerrar a sessão. Tente novamente.", failed: true });
    }
  }

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      <Card className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center text-center sm:w-1/2">
          <div className="relative">
            <ProfileAvatar name={name} photo={preferences?.avatarDataUrl} size={96} />
            <button type="button" onClick={() => photoInput.current?.click()} aria-label={preferences?.avatarDataUrl ? "Trocar foto de perfil" : "Adicionar foto de perfil"} className={`absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-forest-green)] text-white ring-4 ring-white transition-colors hover:bg-[var(--color-action-pressed)] ${focusRing}`}>
              <Camera size={18} aria-hidden="true" />
            </button>
            <input ref={photoInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => void changePhoto(event.target.files?.[0])} />
          </div>
          <h2 className="mt-3 text-2xl font-semibold">{name || "Seu perfil"}</h2>
          <p className="text-sm text-[var(--color-muted)]">{mode === "local" ? "Dados neste navegador" : "Conta sincronizada"}</p>
          {preferences?.avatarDataUrl ? <button type="button" onClick={() => void removePhoto()} className={`mt-1 min-h-9 rounded-full px-3 text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-soft)] ${focusRing}`}>Remover foto</button> : null}
        </div>
        <dl className="w-full divide-y divide-[var(--color-border)] sm:w-1/2">
          <div className="py-3"><dt className="text-xs text-[var(--color-muted)]">Transações</dt><dd className="text-2xl font-semibold">{expenses.length}</dd></div>
          <div className="py-3"><dt className="text-xs text-[var(--color-muted)]">Metas</dt><dd className="text-2xl font-semibold">{savingsGoals.length}</dd></div>
          <div className="py-3"><dt className="text-xs text-[var(--color-muted)]">Recorrências</dt><dd className="text-2xl font-semibold">{recurringRules.length}</dd></div>
        </dl>
      </Card>

      {message ? <p className={`text-sm ${message.failed ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}`} role={message.failed ? "alert" : "status"}>{message.text}</p> : null}

      <Card className="p-3 sm:p-3">
        <Link href="/settings/profile" className={rowClass}>
          <SlidersHorizontal size={20} className="text-[var(--color-muted)]" aria-hidden="true" />
          <span className="flex-1"><span className="block font-medium">Perfil e preferências</span><span className="block text-sm text-[var(--color-tertiary)]">Nome, moeda, renda, recebimento, saldo e objetivos</span></span>
          <ChevronRight size={18} className="text-[var(--color-quaternary)]" aria-hidden="true" />
        </Link>
        <Link href="/settings/accounts" className={rowClass}>
          <Landmark size={20} className="text-[var(--color-muted)]" aria-hidden="true" />
          <span className="flex-1"><span className="block font-medium">Bancos e contas</span><span className="block text-sm text-[var(--color-tertiary)]">{accounts.length ? `${accounts.length} ${accounts.length === 1 ? "conta" : "contas"} · saldos e cotações` : "Saldos por banco e em outras moedas"}</span></span>
          <ChevronRight size={18} className="text-[var(--color-quaternary)]" aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => setShowNotifications(true)} className={rowClass}>
          <BellRing size={20} className="text-[var(--color-muted)]" aria-hidden="true" />
          <span className="flex-1"><span className="block font-medium">Central de notificações</span><span className="block text-sm text-[var(--color-tertiary)]">{unseenCount ? `${unseenCount} ${unseenCount === 1 ? "aviso novo" : "avisos novos"}` : "Avisos, lembretes e insights"}</span></span>
          {unseenCount ? <span className="tabular flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-highlight)] px-1.5 text-xs font-semibold text-white">{unseenCount > 9 ? "9+" : unseenCount}</span> : null}
          <ChevronRight size={18} className="text-[var(--color-quaternary)]" aria-hidden="true" />
        </button>
        <Link href="/settings/notifications" className={rowClass}>
          <Bell size={20} className="text-[var(--color-muted)]" aria-hidden="true" />
          <span className="flex-1"><span className="block font-medium">Notificações e lembretes</span><span className="block text-sm text-[var(--color-muted)]">Alertas importantes, lembretes no seu horário e insights</span></span>
          <ChevronRight size={18} className="text-[var(--color-muted)]" aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => setEditingBalance(true)} className={rowClass}>
          <Wallet size={20} className="text-[var(--color-muted)]" aria-hidden="true" />
          <span className="flex-1"><span className="block font-medium">Saldo disponível</span><span className="tabular block text-sm text-[var(--color-tertiary)]">{balanceCents === null ? "Não informado" : mask(formatCurrency(balanceCents, currency))}</span></span>
          <ChevronRight size={18} className="text-[var(--color-muted)]" aria-hidden="true" />
        </button>
        {mode === "supabase" ? (
          <>
            <Link href="/settings/password" className={rowClass}>
              <KeyRound size={20} className="text-[var(--color-muted)]" aria-hidden="true" />
              <span className="flex-1 font-medium">Alterar senha</span>
              <ChevronRight size={18} className="text-[var(--color-muted)]" aria-hidden="true" />
            </Link>
            <button type="button" onClick={() => void signOut()} className={rowClass}>
              <LogOut size={20} className="text-[var(--color-error)]" aria-hidden="true" />
              <span className="flex-1 font-medium text-[var(--color-error)]">Encerrar sessão</span>
            </button>
          </>
        ) : null}
      </Card>

      <Card className="flex gap-4">
        <ShieldCheck size={24} className="shrink-0 text-[var(--color-success)]" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">Seus dados</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--color-muted)]">
            {mode === "local"
              ? "Tudo fica salvo neste navegador e neste dispositivo. Nada é enviado para a nuvem nem sincronizado com outros aparelhos."
              : "Suas preferências e registros ficam vinculados à sua conta, protegidos por regras de acesso por usuário."}
            {" "}O Prumo não se conecta ao banco e não movimenta dinheiro.
          </p>
          <Link href="/terms" className="mt-2 inline-block text-sm font-semibold text-[var(--color-action)]">Termos de uso</Link>
        </div>
      </Card>

      {editingBalance ? <QuickBalanceUpdate onClose={() => setEditingBalance(false)} /> : null}
      {showNotifications ? <NotificationCenter onClose={() => setShowNotifications(false)} /> : null}
    </div>
  );
}
