export function AuthFeedback({
  error,
  registered,
  sent,
}: {
  error?: string | string[];
  registered?: string | string[];
  sent?: string | string[];
}) {
  const message = error === "configuration"
    ? "A autenticação ainda não está configurada. Adicione as variáveis do Supabase no ambiente."
    : error
      ? "Não foi possível concluir. Confira os campos e tente novamente."
      : registered
        ? "Conta criada. Confira seu email para confirmar o cadastro."
        : sent
          ? "Se esse endereço estiver cadastrado, você receberá um link para redefinir a senha."
          : null;

  if (!message) return null;
  return <p className="border-l-2 border-[var(--color-warning)] pl-3 text-sm leading-6" role="status">{message}</p>;
}
