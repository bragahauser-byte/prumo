begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.expenses (id, user_id, description, amount, category, due_date)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner expense', 10.00, 'Outros', current_date),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'other expense', 20.00, 'Outros', current_date);

select ok((select relrowsecurity from pg_class where oid = 'public.expenses'::regclass), 'RLS is enabled on expenses');
select ok(not has_table_privilege('anon', 'public.expenses', 'select'), 'anonymous role has no read grant');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.expenses), 1, 'owner sees only their expense');

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.expenses), 1, 'another user sees only their own expense');
select throws_ok(
  $$insert into public.expenses (user_id, description, amount, category, due_date)
    values ('11111111-1111-4111-8111-111111111111', 'forged owner', 5.00, 'Outros', current_date)$$,
  '42501', null, 'a user cannot insert a record for another owner'
);
select is_empty(
  $$update public.expenses set amount = 99.00 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id$$,
  'another user cannot update the owner row'
);
select is_empty(
  $$delete from public.expenses where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id$$,
  'another user cannot delete the owner row'
);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is((select amount from public.expenses where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 10.00::numeric, 'denied writes leave the owner amount unchanged');
select is((select count(*)::integer from public.expenses), 1, 'owner row remains available to its owner');

select * from finish();
rollback;
