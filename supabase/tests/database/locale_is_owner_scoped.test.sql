begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Sign-up: the app sends display_name and locale as user metadata.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local', '{"display_name": "Ana", "locale": "en"}'),
  ('22222222-2222-2222-2222-222222222222', 'bogdan@test.local', '{"display_name": "Bogdan"}');

select results_eq(
  $$ select id::text, kind::text, locale::text from public.accounts order by id $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 'person', 'en'),
            ('22222222-2222-2222-2222-222222222222', 'person', 'ro') $$,
  'sign-up creates a person account; locale defaults to ro'
);
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ana',
  'sign-up creates the profile with the display name'
);
select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values ('33333333-3333-3333-3333-333333333333', 'noname@test.local', '{"locale": "ro"}') $$,
  '23502',
  null,
  'sign-up without a display name is rejected'
);

-- Signed in as Ana.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is((select count(*) from public.accounts), 1::bigint, 'an account sees only its own accounts row');
select is(
  public.get_session_context(),
  '{"accountId": "11111111-1111-1111-1111-111111111111", "kind": "person", "locale": "en", "authorEnabled": false, "approvalStatus": null}'::jsonb,
  'session context comes from the signed-in account'
);
select public.set_locale('ro');
select is(public.get_session_context() ->> 'locale', 'ro', 'set_locale changes the caller''s own locale');

update public.accounts set locale = 'en' where id = '22222222-2222-2222-2222-222222222222';
reset role;
select is(
  (select locale::text from public.accounts where id = '22222222-2222-2222-2222-222222222222'),
  'ro',
  'an account cannot change another account''s locale'
);

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok($$ select public.set_locale('en') $$, '42501', null, 'anonymous set_locale fails');

select * from finish();
rollback;
