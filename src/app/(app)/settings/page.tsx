"use client";

import Link from "next/link";
import { OnboardingForm } from "@/components/onboarding-form";
import { useFinance } from "@/components/finance-provider";
import { signOutAction } from "../actions";

export default function SettingsPage() {
  const { mode, preferences } = useFinance();

  return (
    <div>
      <div className="mb-6 border-b border-[var(--color-border)] pb-5">
        <p className="text-sm leading-6 text-[var(--color-muted)]">
          {mode === "local"
            ? "Seus dados ficam salvos neste navegador e neste dispositivo. Eles não são enviados para a nuvem nem sincronizados com outros aparelhos."
            : "Suas preferências e registros são vinculados à sua conta autenticada."}
        </p>
        {preferences?.displayName ? <p className="mt-2 text-sm font-medium">Perfil: {preferences.displayName}</p> : null}
      </div>

      <OnboardingForm editing returnTo="/settings" />

      {mode === "supabase" ? (
        <div className="mt-7 flex flex-wrap gap-5 text-sm">
          <Link href="/settings/password" className="underline underline-offset-4">Alterar senha</Link>
          <form action={signOutAction}><button className="underline underline-offset-4">Encerrar sessão</button></form>
        </div>
      ) : null}
    </div>
  );
}
