# Deployment

## GitHub Pages (versão pública atual)

- Endereço: https://bragahauser-byte.github.io/prumo/
- Workflow: `.github/workflows/pages.yml`, a cada push na `main` (ou manual em Actions).
- Passos: `npm ci` → `npm test` → `scripts/prepare-pages.mjs` (remove login Supabase, Server Actions, rota de callback e proxy da cópia do CI) → `next build` com `DEPLOY_TARGET=pages` (`output: "export"`, `basePath: /prumo`, `trailingSlash`) → `scripts/flatten-rsc-segments.mjs` (cria os nomes de arquivo de pré-carregamento que o navegador pede) → publicação do diretório `out`.
- Em Settings → Pages, a origem precisa ser **GitHub Actions**.
- Arquivos de `public/` devem ser referenciados com `asset()` (`src/lib/base-path.ts`) para respeitar o prefixo `/prumo`.

## Servidor Next com Supabase

## Supabase

1. Create a Supabase project and copy its Project URL and publishable key.
2. Apply `supabase/migrations/` with the Supabase CLI or SQL editor, in filename order.
3. Enable email/password authentication and confirm the email templates use the callback path.
4. Add local values from `.env.example` to `.env.local`.
5. Set the Auth Site URL and allowed redirect URLs to include `http://localhost:3000/auth/callback` and the production `/auth/callback` URL.
6. Run the pgTAP suite with `supabase test db` against a local Supabase stack before production data is used.

The app uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with user-scoped cookies and RLS. No service-role key is required by the web app.

## Vercel

1. Link the project with `vercel link` or import the Git repository in Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL` for Preview and Production.
3. Set `NEXT_PUBLIC_APP_URL` to the exact deployed origin, without a trailing slash.
4. Add the deployed callback URL to Supabase Auth redirect allow-list.
5. Run `npm run lint`, `npm test`, and `npm run build` before `vercel --prod`.
6. Verify the deployment URL, signup/login callback, protected route behavior, and a create/read/update/delete expense flow.

Do not deploy production while Supabase environment variables, migrations, and redirects are unconfigured. Vercel CLI deployment requires an authenticated Vercel account.
