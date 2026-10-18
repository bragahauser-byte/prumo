import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pt-16 pb-10">
      <Link href="/onboarding" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#F1F1F1] px-4 text-sm font-medium text-black">
        Voltar ao onboarding
      </Link>
      <h1 className="mt-8 text-3xl font-semibold">Termos de uso</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">Última atualização: 10 de outubro de 2026</p>

      <div className="mt-8 space-y-7 text-sm leading-6">
        <section>
          <h2 className="font-semibold">Uso do aplicativo</h2>
          <p className="mt-2">O Prumo ajuda você a registrar e organizar receitas, despesas, orçamentos, metas e compromissos. Ele não movimenta dinheiro nem se conecta a bancos. Você decide quais informações registrar e é responsável por mantê-las corretas.</p>
        </section>
        <section>
          <h2 id="privacidade" className="font-semibold">Privacidade e armazenamento dos seus dados</h2>
          <p className="mt-2">Sem uma conta Supabase configurada, suas preferências e seus registros ficam armazenados no localStorage deste navegador. Eles não são sincronizados com outros navegadores ou dispositivos e podem ser removidos ao limpar os dados do navegador.</p>
          <p className="mt-2">Quando a autenticação Supabase estiver configurada e você entrar em uma conta, os dados são associados à sua identidade e protegidos por políticas de acesso do banco. Não há dados bancários conectados nem sincronização com instituições financeiras.</p>
        </section>
        <section>
          <h2 className="font-semibold">Valores e estimativas</h2>
          <p className="mt-2">A moeda escolhida muda apenas a exibição dos valores; não há conversão cambial. Renda e saldo são informações declaradas por você. Estimativas consideram somente o que foi registrado e não representam saldo confirmado, extrato ou aconselhamento financeiro.</p>
        </section>
        <section>
          <h2 className="font-semibold">Notificações</h2>
          <p className="mt-2">Se você autorizar, o navegador pode mostrar lembretes locais para despesas não pagas com vencimento no dia atual quando o aplicativo estiver aberto. Isso não é um serviço de notificação em segundo plano nem garante lembretes quando o aplicativo estiver fechado.</p>
        </section>
        <section>
          <h2 className="font-semibold">Segurança</h2>
          <p className="mt-2">Não informe senhas bancárias, números completos de cartão ou outras credenciais financeiras. O aplicativo não solicita esses dados nem inicia pagamentos.</p>
        </section>
      </div>
    </main>
  );
}
