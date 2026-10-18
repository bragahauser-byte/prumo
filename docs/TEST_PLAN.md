# Test Plan

## Automated checks

- `npm test`: financial calculations, Brazilian currency parsing/formatting, category totals, and weekly/monthly/yearly recurrence dates (including leap years and year boundaries).
- `npm run lint`: ESLint across the project.
- `npm run build`: Next.js production compilation and strict TypeScript checks.
- `npm run test:e2e`: Playwright covers empty setup state, login field accessibility, and selected-tab/overflow behavior across all five mobile routes; the protected-route case runs only when Supabase environment variables are configured.
- `supabase test db`: pgTAP ownership, RLS read isolation, and denied cross-user insert/update/delete in `supabase/tests/finance_rls.test.sql`.

## Not yet verified

- pgTAP, CRUD integration, Auth signup/callback/recovery, and cross-user behavior require a local Supabase stack and are not run without one.
- Playwright coverage for authenticated CRUD, recurrence persistence, and payment flows remains pending a configured Supabase test project.
- Manual responsive and keyboard checks must be performed on the configured deployment.

## Acceptance criteria

- Domain money calculations remain in integer cents and deterministic date tests pass.
- All persisted reads and writes are owner-scoped in both Server Actions and PostgreSQL RLS.
- Production acceptance requires passing database and browser tests against configured Supabase, not only a successful build.

## Cobertura atual

- Unitários (Vitest): regras de dinheiro e recorrência (inclusive intervalos personalizados), cálculos de planejamento (saldo, quanto pode gastar, orçamento, metas, aumentos incomuns, séries), sugestão de categoria, teclado de valores e repositório local (inclusive leitura de dados antigos).
- E2E (Playwright, modo local): onboarding e edição de preferências, navegação e ausência de rolagem horizontal no celular, registro de gasto pelo teclado com categoria sugerida, pagamento e exclusão, criação de meta e aporte, limite de orçamento, recorrência e pausa, redirecionamento das rotas antigas.
