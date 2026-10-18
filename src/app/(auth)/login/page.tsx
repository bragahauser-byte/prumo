import Link from "next/link";
import { AuthFeedback } from "@/components/auth-feedback";
import { signInAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/overview" className="mb-10 text-sm font-medium underline underline-offset-4">Prumo</Link>
      <h1 className="text-2xl font-semibold">Acessar sua conta</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">Entre para consultar seus registros financeiros.</p>
      <div className="mt-6"><AuthFeedback error={params.error} registered={params.registered} /></div>
      <form action={signInAction} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={255} className="mt-2 min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]" />
        </label>
        <label className="block text-sm font-medium">
          Senha
          <input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={72} className="mt-2 min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]" />
        </label>
        <button className="min-h-11 w-full rounded-full bg-[var(--color-action)] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]">Entrar</button>
      </form>
      <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
        <Link href="/register" className="underline underline-offset-4">Criar conta</Link>
        <Link href="/forgot-password" className="underline underline-offset-4">Esqueci a senha</Link>
      </div>
    </main>
  );
}
