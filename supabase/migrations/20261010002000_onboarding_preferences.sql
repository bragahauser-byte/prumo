alter table public.profiles
  add column payday smallint check (payday between 1 and 31),
  add column onboarding_completed boolean not null default false;

alter table public.profiles drop constraint profiles_currency_check;
alter table public.profiles
  add constraint profiles_currency_check check (currency in ('BRL', 'USD', 'EUR'));

alter table public.recurring_rules
  add column is_variable boolean not null default false;

insert into public.profiles (user_id, display_name)
select users.id, nullif(users.raw_user_meta_data ->> 'name', '')
from auth.users as users
on conflict (user_id) do nothing;
