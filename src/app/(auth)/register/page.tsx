import Link from "next/link";
import { AuthFeedback } from "@/components/auth-feedback";
import { signUpAction } from "../actions";

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/overview" className="mb-10 text-sm font-medium underline underline-offset-4">Finanças pessoais</Link>
      <h1 className="text-2xl font-semibold">Criar conta</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">Seus dados financeiros ficam vinculados à sua conta.</p>
      <div className="mt-6"><AuthFeedback error={params.error} /></div>
      <form action={signUpAction} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Nome
          <input name="name" autoComplete="name" required maxLength={80} className="mt-2 min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]" />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={255} className="mt-2 min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]" />
        </label>
        <label className="block text-sm font-medium">
          Senha
          <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="mt-2 min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]" />
        </label>
        <button className="min-h-11 w-full rounded-full bg-[var(--color-action)] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]">Cadastrar</button>
      </form>
      <p className="mt-5 text-sm">Já tem conta? <Link href="/login" className="underline underline-offset-4">Entrar</Link></p>
    </main>
  );
}
