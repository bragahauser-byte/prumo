create function public.generate_recurring_expenses(p_rule_id uuid, p_through_date date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  rule public.recurring_rules%rowtype;
  occurrence date;
  window_start date := current_date;
  month_cursor date;
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
      occurrence := occurrence + ((window_start - occurrence + 6) / 7) * 7;
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
      occurrence := occurrence + 7;
    end loop;
  elsif rule.frequency = 'monthly' then
    month_cursor := date_trunc('month', window_start)::date;
    while month_cursor <= p_through_date loop
      last_day := extract(day from (month_cursor + interval '1 month - 1 day'))::integer;
      occurrence := make_date(extract(year from month_cursor)::integer,
                              extract(month from month_cursor)::integer,
                              least(rule.due_day, last_day));
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
      month_cursor := (month_cursor + interval '1 month')::date;
    end loop;
  else
    for year_cursor in
      select generate_series(extract(year from window_start)::integer,
                             extract(year from p_through_date)::integer)
    loop
      month_cursor := make_date(year_cursor, extract(month from rule.starts_on)::integer, 1);
      last_day := extract(day from (month_cursor + interval '1 month - 1 day'))::integer;
      occurrence := make_date(year_cursor, extract(month from rule.starts_on)::integer,
                              least(rule.due_day, last_day));
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
    end loop;
  end if;

  return inserted_total;
end;
$$;

revoke all on function public.generate_recurring_expenses(uuid, date) from public, anon;
grant execute on function public.generate_recurring_expenses(uuid, date) to authenticated;
