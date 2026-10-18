import Link from "next/link";
import { updatePasswordAction } from "../../actions";

export default async function PasswordPage({
  searchParams,
}: PageProps<"/settings/password">) {
  const params = await searchParams;

  return (
    <section className="max-w-lg">
      <h2 className="text-xl font-semibold">Alterar senha</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">Use pelo menos oito caracteres.</p>
      {params.error ? <p className="mt-4 text-sm text-[var(--color-error)]" role="alert">Não foi possível alterar a senha. Tente novamente.</p> : null}
      {params.updated ? <p className="mt-4 text-sm text-[var(--color-success)]" role="status">Senha atualizada.</p> : null}
      <form action={updatePasswordAction} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Nova senha
          <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required className="mt-2 min-h-11 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action)]" />
        </label>
        <button className="min-h-11 rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white">Salvar nova senha</button>
      </form>
      <Link href="/settings" className="mt-5 inline-block text-sm underline underline-offset-4">Voltar às configurações</Link>
    </section>
  );
}
