# Data Model

`src/lib/finance/repository.ts` defines the product data contract. In local mode, a versioned `localStorage` record stores only the user's preferences, transactions (table/type still named `expenses`), recurring rules, budgets, and savings goals; an empty browser starts with empty arrays and no financial records. Local data is device/browser-specific and is not cloud synchronization.

When Supabase is configured, `src/lib/finance/supabase-repository.ts` implements the same contract using the authenticated browser client. The migrations create `profiles`, `recurring_rules`, `expenses`, `budgets`, `savings_goals`, and `goal_contributions` in the exposed `public` schema. Auth identity is the owner key (`user_id`); an Auth trigger/backfill creates profiles. Categories are constrained text values rather than a user-editable table.

## Money and dates

- Amounts use PostgreSQL `numeric(12,2)` and are serialized as decimal strings.
- The TypeScript domain stores currency in integer cents; binary floating-point is not used for additions or subtraction.
- `due_date`, `paid_on`, `starts_on`, `ends_on`, and `occurrence_date` are PostgreSQL `date`, not timestamps.
- Audit fields use `timestamptz`.
- Expenses require a positive amount. Profile income is non-negative; reported bank balance can be negative.
- Profiles also store `payday`, `currency`, and `onboarding_completed`; all financial onboarding values are optional except currency/default preference completion.
- The onboarding-completed flag is the only gate for first use; it is not coupled to sign-in or Supabase setup.

## Recurrences

- `recurring_rules` owns schedule definitions; each generated expense is a separate row.
- `(recurring_rule_id, occurrence_date)` is unique, making generation idempotent.
- Generated rows retain the rule's initial amount; later expense edits do not rewrite other occurrences.
- Local and remote generators use an explicit future window (90 days in the UI/RPC), never mark an occurrence paid, and avoid duplicates by `(rule, occurrence date)`.
- Monthly and yearly dates clamp to the last day of short months (including February).
- A rule referenced by occurrences cannot be hard-deleted; pause it to preserve history.

## Integrity and access

- Foreign keys bind expenses to the same owner's recurrence rule.
- Checks constrain status, payment date, frequency, schedule day, and date ranges.
- RLS is enabled on every table; grants are explicitly revoked from `anon` and restricted to required operations for `authenticated`.
- Policies compare `user_id` to `(select auth.uid())`; indexes support owner/date and owner/active queries.

## Receitas, orçamentos e metas (migração `20261018000000_planning.sql`)

- `expenses.kind` and `recurring_rules.kind` are `'expense' | 'income'` (default `'expense'`). A trigger copies the rule's kind into generated occurrences. Status `paid` means "pago" for expenses and "recebido" for incomes.
- `recurring_rules.interval_count` (1–12) supports "a cada N semanas/meses/anos"; local and SQL generators align occurrences to the start date.
- `profiles.balance_reported_on` records when the balance was informed; settled movements from that date on adjust the displayed balance.
- `profiles.avatar_data` holds the profile photo as a reduced JPEG data URL (256 px square, capped at 200 000 characters). `profiles.notification_settings` (jsonb) stores `alertsPush`, `insightsPush` and the scheduled reminders (`weeklyReview`, `monthlyBudget`, `billsAhead`), all reminders off by default. Older local data without these fields loads with the defaults.
- Goal `icon` values: `travel`, `emergency`, `electronics`, `car`, `house`, `education`, `health`, `family`, `adventure`, `ticket`, `gift`, `other`. Earlier values (`computer`, `fitness`, `music`) are mapped when displayed.
- Celebrated goals and seen/pushed notification ids live only in the browser (`localStorage`), so the celebration and each notification appear once per device.
- `budgets` has one monthly limit per `(user_id, category)`.
- `savings_goals` holds target, optional deadline and icon; `goal_contributions` holds `planned` or `done` contributions and cascades on goal deletion. Contributions never move money.
- Local data saved before these fields existed is read with defaults (`kind = expense`, `interval = 1`, empty budgets and goals).
