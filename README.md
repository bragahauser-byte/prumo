# Prumo

**Finanças pessoais para entender, planejar e melhorar a relação com o dinheiro.**

**Acesse:** https://bragahauser-byte.github.io/prumo/

O Prumo não movimenta dinheiro. Ele organiza o que você registra para responder, de forma clara, três perguntas: *como está minha vida financeira agora?*, *quanto ainda posso gastar?* e *o que vem pela frente?* — e assim antecipar problemas antes que aconteçam.

## O que o app faz

| | Funcionalidade | Resumo |
|---|---|---|
| 🏠 | **Início** | Saldo disponível, quanto ainda pode gastar no mês, receitas e despesas com comparação ao mês anterior, próximos vencimentos e atalhos. |
| 💸 | **Registro de receitas e despesas** | Valor digitado primeiro num teclado em tela cheia; depois descrição, categoria sugerida automaticamente, data, status e repetição. Busca, filtros, edição e exclusão. |
| 🎯 | **Orçamentos por categoria** | Limite mensal por categoria, quanto resta e alertas ao chegar a 80% e ao passar do limite. |
| 📅 | **Agenda: contas a pagar e a receber** | Atrasadas, próximos 7 dias e mais adiante; status previsto, pago, recebido ou atrasado; recorrências semanais, mensais, anuais ou personalizadas. |
| 🐷 | **Metas** | Doze tipos com ilustração 3D (viagem, reserva de emergência, carro, casa…), várias metas criadas de uma vez, anel dividido entre elas, barra com o ritmo esperado para hoje e uma comemoração quando a meta é atingida. |
| 🔔 | **Notificações** | Alertas importantes (vencimentos, orçamento no limite, meta fora do ritmo), lembretes no horário que você escolher (desligados por padrão), até três insights e confirmações discretas na tela. |
| 📊 | **Relatórios** | Evolução de seis meses, categorias que mais pesam, comparação entre meses, aumentos fora do comum e estimativa de sobra no fim do mês. |

Detalhes e regras de cálculo em [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).

## Design

- Escala tipográfica fixa: 12, 14, 16, 20, 24, 28 e 32 px.
- Paleta em tokens (`src/app/globals.css`): verde vivo e verde floresta como cores principais, secundárias para categorias e gráficos, tokens de conteúdo, interação, superfície, borda e sentimento.
- Fluxo "valor primeiro" para todo momento em que se digita dinheiro.
- Ícones de linha por categoria e ilustrações isométricas 3D (bnbicons.com) em `public/illustrations` e `public/goal-icons`.
- Cabeçalho com título e subtítulo em 24 px; no celular, 64 px do topo e barra de navegação a 40 px da borda inferior.

Mais em [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Auth + PostgreSQL com RLS, opcional) · Zod · Lucide · Vitest · Playwright

## Como rodar

Requer Node.js 20+.

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Sem configuração, o app funciona no **modo local**: tudo fica salvo no `localStorage` deste navegador, sem dados de exemplo e sem nada sair do dispositivo.

### Sincronização com Supabase (opcional)

Copie `.env.example` para `.env.local`, preencha a URL e a chave publishable do projeto e aplique as migrations de `supabase/migrations/`. Com as variáveis presentes, as rotas exigem login e os dados ficam na sua conta, protegidos por RLS.

```bash
supabase start
supabase db reset
supabase test db
```

## Publicação no GitHub Pages

Cada push na `main` roda o workflow `.github/workflows/pages.yml`: testes, build estático (`DEPLOY_TARGET=pages`, servido em `/prumo`) e publicação. A versão publicada usa o modo local — os dados ficam no navegador de quem usa; login e sincronização com Supabase exigem um servidor Next (ex.: Vercel).

## Scripts

```bash
npm run dev        # servidor de desenvolvimento
npm run lint       # ESLint
npm test           # testes unitários (Vitest)
npm run test:e2e   # testes ponta a ponta (Playwright)
npm run build      # build de produção
```

## Estrutura

- `src/app` — rotas: `overview`, `transactions`, `add`, `bills`, `budgets`, `goals`, `reports`, `settings`, onboarding e autenticação
- `src/components` — telas, fluxo de registro e kit de interface (`ui/`)
- `src/domain` — regras puras: dinheiro, recorrência, categorias e planejamento
- `src/lib` — repositórios (local e Supabase), formatação e datas
- `supabase` — migrations e testes de RLS
- `docs` — produto, design, arquitetura, modelo de dados, segurança, testes e deploy

Veja também [arquitetura](docs/ARCHITECTURE.md), [modelo de dados](docs/DATA_MODEL.md), [segurança](docs/SECURITY.md), [plano de testes](docs/TEST_PLAN.md) e [deploy](docs/DEPLOYMENT.md).
