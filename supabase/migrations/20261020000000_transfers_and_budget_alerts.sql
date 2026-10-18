-- Movimentações internas (transferência entre contas próprias e pagamento de fatura) não são gasto nem entrada.
alter table public.expenses drop constraint if exists expenses_kind_check;
alter table public.expenses
  add constraint expenses_kind_check check (kind in ('expense', 'income', 'transfer'));
alter table public.recurring_rules drop constraint if exists recurring_rules_kind_check;
alter table public.recurring_rules
  add constraint recurring_rules_kind_check check (kind in ('expense', 'income', 'transfer'));

-- Alerta configurável por orçamento: percentual do limite (null desliga).
alter table public.budgets
  add column alert_at smallint default 80 check (alert_at is null or alert_at between 1 and 100);
