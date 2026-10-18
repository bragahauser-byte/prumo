import Link from "next/link";
import { AuthFeedback } from "@/components/auth-feedback";
import { requestPasswordResetAction } from "../actions";

export default async function ForgotPasswordPage({
  searchParams,
}: PageProps<"/forgot-password">) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/login" className="mb-10 text-sm font-medium underline underline-offset-4">Voltar ao login</Link>
      <h1 className="text-2xl font-semibold">Redefinir senha</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">Enviaremos um link de recuperação se o email estiver cadastrado.</p>
      <div className="mt-6"><AuthFeedback error={params.error} sent={params.sent} /></div>
      <form action={requestPasswordResetAction} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={255} className="mt-2 min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]" />
        </label>
        <button className="min-h-11 w-full rounded-full bg-[var(--color-action)] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]">Enviar link</button>
      </form>
    </main>
  );
}
