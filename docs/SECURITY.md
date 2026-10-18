# Security

## Implemented

- Email/password signup, login, recovery, callback exchange, password update, and logout use Supabase Auth.
- Next.js 16 `proxy.ts` refreshes cookie sessions using `@supabase/ssr`; protected layouts and sensitive Server Actions verify claims with `getClaims()`.
- Private records are queried with the user's cookie-backed client. The browser never receives a service-role key.
- Server Actions validate input with Zod and re-check the authenticated subject; PostgreSQL RLS is the authorization boundary.
- Migrations explicitly revoke `anon` access, grant only required operations, and define owner-scoped policies for profiles, rules, and expenses.
- Callback `next` paths are restricted to local absolute paths to prevent open redirects.

## Verification and remaining risk

- `supabase/tests/finance_rls.test.sql` checks visibility and denied cross-user writes. It must be run against a configured local Supabase database; it has not been executed in this workspace.
- No Supabase project credentials are present, so live authentication, migrations, Auth redirect settings, and deployed RLS behavior remain unverified.
- Configure email confirmation, allowed callback URLs, SMTP limits, backups, and project-level Auth protections before production use.
- Reported income/balance are user-provided estimates; they are not bank data. No banking integration or financial advice is provided.
- Do not claim production security until pgTAP, integration, and end-to-end tests pass against the actual project configuration.
