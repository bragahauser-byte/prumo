-- Contas por banco, investimentos e movimentações em outras moedas.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  bank text not null check (char_length(bank) between 1 and 40),
  currency text not null default 'BRL' check (currency in ('BRL', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'NZD')),
  balance numeric(14, 2),
  balance_reported_on date,
  created_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('poupanca', 'cdb_rdb', 'tesouro', 'acoes', 'fiis', 'fundos_etfs', 'lci_lca', 'cripto')),
  institution text not null check (char_length(institution) between 1 and 60),
  description text check (description is null or char_length(description) <= 80),
  applied_amount numeric(14, 2) not null check (applied_amount > 0),
  current_amount numeric(14, 2) check (current_amount is null or current_amount >= 0),
  applied_on date not null,
  updated_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses
  add column account_id uuid references public.accounts (id) on delete set null,
  add column original_currency text check (original_currency is null or original_currency in ('BRL', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'NZD')),
  add column original_amount numeric(14, 2) check (original_amount is null or original_amount > 0),
  add column exchange_rate numeric(18, 8) check (exchange_rate is null or exchange_rate > 0),
  add column rate_date date,
  add column rate_is_manual boolean;

alter table public.profiles
  add column manual_rates jsonb not null default '{}'::jsonb;

create index expenses_account_idx on public.expenses (account_id);

create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create trigger investments_set_updated_at
before update on public.investments
for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;
alter table public.investments enable row level security;

revoke all on public.accounts, public.investments from anon, authenticated;
grant select, insert, update, delete on public.accounts, public.investments to authenticated;

create policy accounts_all_own on public.accounts
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy investments_all_own on public.investments
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
