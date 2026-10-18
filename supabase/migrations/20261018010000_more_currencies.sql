-- Moedas de exibição: real brasileiro + dez moedas internacionais. Apenas formatação; não há conversão.
alter table public.profiles drop constraint profiles_currency_check;
alter table public.profiles
  add constraint profiles_currency_check check (
    currency in ('BRL', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'NZD')
  );
