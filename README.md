# Personal Finance

Personal Finance is a responsive web app for tracking expenses, recurring commitments, and monthly planning with a clear financial overview.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase Auth and PostgreSQL
- Vitest and Playwright
- Lucide React
- Zod

## Requirements

- Node.js 20+
- npm
- Supabase é opcional para desenvolvimento e avaliação local

## Getting started

```bash
npm install
```

Sem configuração Supabase, o aplicativo funciona imediatamente e guarda onboarding, despesas e recorrências no `localStorage` deste navegador. Os registros continuam disponíveis após recarregar, mas não são sincronizados com outros navegadores ou dispositivos.

Para habilitar contas autenticadas e sincronização remota, configure um projeto Supabase. Copie `.env.example` para `.env.local` e preencha a URL pública do projeto e a chave publishable. No PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Depois aplique as migrations listadas em `supabase/migrations/` e inicie o app:

```bash
npm run dev
```

O onboarding financeiro é independente da autenticação. Quando as variáveis Supabase existem, as rotas privadas exigem login e usam o banco com RLS; sem elas, não há simulação de nuvem e nenhum dado sai do navegador.

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run test:e2e
npm run build
```

For database development, start a local Supabase stack, apply migrations, and run the RLS suite:

```bash
supabase start
supabase db reset
supabase test db
```

See [deployment](docs/DEPLOYMENT.md), [security](docs/SECURITY.md), and [test plan](docs/TEST_PLAN.md) for required external configuration and checks.

## Project structure

- `src/app`: App Router routes, actions, and layouts
- `src/components`: reusable UI and form controls
- `src/domain`: financial rules and calculations
- `src/lib`: formatting and Supabase helpers
- `supabase`: migrations and RLS tests
- `docs`: product, design, architecture, security, test, and deployment decisions

## Current status

Onboarding, perfil, CRUD de despesas, recorrências, visão geral e insights funcionam no modo local persistente. O adaptador Supabase mantém o mesmo contrato de repositório e requer projeto, migrations, Auth e RLS configurados para ativar sincronização entre dispositivos. Não há dados de exemplo nem conexão bancária.
