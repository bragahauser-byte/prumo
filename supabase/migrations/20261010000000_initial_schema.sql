create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  monthly_income numeric(12, 2) check (monthly_income is null or monthly_income >= 0),
  reported_balance numeric(12, 2),
  currency text not null default 'BRL' check (currency = 'BRL'),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null check (char_length(category) between 1 and 80),
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  starts_on date not null,
  due_day smallint check (due_day between 1 and 31),
  ends_on date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  check (ends_on is null or ends_on >= starts_on),
  check ((frequency = 'weekly' and due_day is null) or (frequency <> 'weekly' and due_day is not null))
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recurring_rule_id uuid,
  occurrence_date date,
  description text not null check (char_length(description) between 1 and 120),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null check (char_length(category) between 1 and 80),
  due_date date not null,
  status text not null default 'pending' check (status in ('paid', 'pending', 'scheduled')),
  paid_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, recurring_rule_id)
    references public.recurring_rules (user_id, id),
  unique (recurring_rule_id, occurrence_date),
  check ((recurring_rule_id is null and occurrence_date is null) or (recurring_rule_id is not null and occurrence_date is not null)),
  check ((status = 'paid' and paid_on is not null) or (status <> 'paid' and paid_on is null))
);

create index expenses_user_due_date_idx on public.expenses (user_id, due_date);
create index recurring_rules_user_active_idx on public.recurring_rules (user_id, is_active);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger recurring_rules_set_updated_at
before update on public.recurring_rules
for each row execute function public.set_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.expenses enable row level security;

revoke all on public.profiles, public.recurring_rules, public.expenses from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.recurring_rules, public.expenses to authenticated;

create policy profiles_select_own on public.profiles
for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy recurring_rules_select_own on public.recurring_rules
for select to authenticated using ((select auth.uid()) = user_id);
create policy recurring_rules_insert_own on public.recurring_rules
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy recurring_rules_update_own on public.recurring_rules
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy recurring_rules_delete_own on public.recurring_rules
for delete to authenticated using ((select auth.uid()) = user_id);

create policy expenses_select_own on public.expenses
for select to authenticated using ((select auth.uid()) = user_id);
create policy expenses_insert_own on public.expenses
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy expenses_update_own on public.expenses
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy expenses_delete_own on public.expenses
for delete to authenticated using ((select auth.uid()) = user_id);
