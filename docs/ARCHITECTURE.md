# Architecture

## Runtime boundaries

- `src/app`: App Router pages, layouts, Auth callback, and Server Actions.
- `src/components`: reusable presentation and small client forms using React `useActionState`.
- `src/domain`: pure money/date/recurrence rules; monetary values use integer cents.
- `src/lib/finance/repository.ts`: common repository interface, localStorage adapter, validation, and local recurrence generation.
- `src/lib/finance/supabase-repository.ts`: authenticated Supabase adapter implementing the same repository interface.
- `src/components/finance-provider.tsx`: selects the persistence mode once and exposes loading/error/mutation state to screens.
- `src/lib`: Brazilian display formatting and request-scoped Supabase SSR/browser clients.
- `proxy.ts`: refreshes Supabase cookies on Next.js 16 requests. Protected layouts and each sensitive action additionally verify claims.
- `supabase/migrations`: PostgreSQL schema, constraints, grants, RLS, and bounded recurrence generation.

## Data flow

Screens read and write through one provider/repository contract. Without Supabase environment variables, the local adapter persists the user's records in this browser. With Supabase configured, protected App Router layouts verify claims and the remote adapter uses the authenticated client; RLS remains the authorization boundary. No elevated service-role client is used.

The database stores `numeric(12,2)` as decimal strings; the domain converts inputs to integer cents before calculations. Calendar due dates remain `date` strings, avoiding timezone shifts.

## External configuration boundary

Without Supabase URL and publishable key, first use goes to the financial onboarding and then to fully usable local screens; no sample records are shown. Remote multi-device persistence requires migrations, Auth email configuration, and the callback allow-list in a real project.
