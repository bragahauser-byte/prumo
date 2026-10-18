-- Receitas, recorrência personalizada, orçamentos por categoria e metas financeiras.

alter table public.profiles
  add column balance_reported_on date;

alter table public.expenses
  add column kind text not null default 'expense' check (kind in ('expense', 'income'));

alter table public.recurring_rules
  add column kind text not null default 'expense' check (kind in ('expense', 'income')),
  add column interval_count smallint not null default 1 check (interval_count between 1 and 12);

-- Ocorrências geradas herdam o tipo (receita/despesa) da regra.
create function public.expenses_inherit_rule_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recurring_rule_id is not null then
    select rules.kind into new.kind
    from public.recurring_rules as rules
    where rules.id = new.recurring_rule_id and rules.user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger expenses_inherit_rule_kind
before insert on public.expenses
for each row execute function public.expenses_inherit_rule_kind();

create or replace function public.generate_recurring_expenses(p_rule_id uuid, p_through_date date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  rule public.recurring_rules%rowtype;
  occurrence date;
  window_start date := current_date;
  month_index integer;
  limit_index integer;
  year_cursor integer;
  last_day integer;
  inserted_total integer := 0;
  inserted_count integer;
begin
  if p_through_date > current_date + 93 then
    raise exception 'Occurrence window cannot exceed 93 days.' using errcode = '22023';
  end if;

  select * into rule
  from public.recurring_rules
  where id = p_rule_id
    and user_id = (select auth.uid())
    and is_active;

  if not found then return 0; end if;
  window_start := greatest(rule.starts_on, current_date);

  if rule.frequency = 'weekly' then
    occurrence := rule.starts_on;
    if occurrence < window_start then
      occurrence := occurrence
        + ((window_start - occurrence + 7 * rule.interval_count - 1) / (7 * rule.interval_count)) * 7 * rule.interval_count;
    end if;
    while occurrence <= p_through_date and (rule.ends_on is null or occurrence <= rule.ends_on) loop
      insert into public.expenses
        (user_id, recurring_rule_id, occurrence_date, description, amount, category, due_date, status)
      values
        (rule.user_id, rule.id, occurrence, rule.name, rule.amount, rule.category, occurrence,
         case when occurrence <= current_date then 'pending' else 'scheduled' end)
      on conflict (recurring_rule_id, occurrence_date) do nothing;
      get diagnostics inserted_count = row_count;
      inserted_total := inserted_total + inserted_count;
      occurrence := occurrence + 7 * rule.interval_count;
    end loop;
  elsif rule.frequency = 'monthly' then
    month_index := extract(year from rule.starts_on)::integer * 12 + extract(month from rule.starts_on)::integer - 1;
    month_index := month_index + greatest(0,
      ((extract(year from window_start)::integer * 12 + extract(month from window_start)::integer - 1) - month_index)
      / rule.interval_count) * rule.interval_count;
    limit_index := extract(year from p_through_date)::integer * 12 + extract(month from p_through_date)::integer - 1;
    while month_index <= limit_index loop
      last_day := extract(day from (make_date(month_index / 12, month_index % 12 + 1, 1) + interval '1 month - 1 day'))::integer;
      occurrence := make_date(month_index / 12, month_index % 12 + 1, least(rule.due_day, last_day));
      if occurrence >= window_start and occurrence <= p_through_date
         and (rule.ends_on is null or occurrence <= rule.ends_on) then
        insert into public.expenses
          (user_id, recurring_rule_id, occurrence_date, description, amount, category, due_date, status)
        values
          (rule.user_id, rule.id, occurrence, rule.name, rule.amount, rule.category, occurrence,
           case when occurrence <= current_date then 'pending' else 'scheduled' end)
        on conflict (recurring_rule_id, occurrence_date) do nothing;
        get diagnostics inserted_count = row_count;
        inserted_total := inserted_total + inserted_count;
      end if;
      month_index := month_index + rule.interval_count;
    end loop;
  else
    year_cursor := extract(year from rule.starts_on)::integer
      + greatest(0, (extract(year from window_start)::integer - extract(year from rule.starts_on)::integer) / rule.interval_count)
      * rule.interval_count;
    while year_cursor <= extract(year from p_through_date)::integer loop
      last_day := extract(day from (make_date(year_cursor, extract(month from rule.starts_on)::integer, 1) + interval '1 month - 1 day'))::integer;
      occurrence := make_date(year_cursor, extract(month from rule.starts_on)::integer, least(rule.due_day, last_day));
      if occurrence >= window_start and occurrence <= p_through_date
         and (rule.ends_on is null or occurrence <= rule.ends_on) then
        insert into public.expenses
          (user_id, recurring_rule_id, occurrence_date, description, amount, category, due_date, status)
        values
          (rule.user_id, rule.id, occurrence, rule.name, rule.amount, rule.category, occurrence,
           case when occurrence <= current_date then 'pending' else 'scheduled' end)
        on conflict (recurring_rule_id, occurrence_date) do nothing;
        get diagnostics inserted_count = row_count;
        inserted_total := inserted_total + inserted_count;
      end if;
      year_cursor := year_cursor + rule.interval_count;
    end loop;
  end if;

  return inserted_total;
end;
$$;

create table public.budgets (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (char_length(category) between 1 and 80),
  limit_amount numeric(12, 2) not null check (limit_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  icon text not null check (char_length(icon) between 1 and 40),
  target_amount numeric(12, 2) not null check (target_amount > 0),
  deadline date,
  created_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  contributed_on date not null,
  status text not null check (status in ('planned', 'done')),
  created_at timestamptz not null default now(),
  foreign key (user_id, goal_id) references public.savings_goals (user_id, id) on delete cascade
);

create index goal_contributions_goal_idx on public.goal_contributions (goal_id);

create trigger budgets_set_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();

create trigger savings_goals_set_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.goal_contributions enable row level security;

revoke all on public.budgets, public.savings_goals, public.goal_contributions from anon, authenticated;
grant select, insert, update, delete on public.budgets, public.savings_goals, public.goal_contributions to authenticated;

create policy budgets_all_own on public.budgets
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy savings_goals_all_own on public.savings_goals
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy goal_contributions_all_own on public.goal_contributions
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
