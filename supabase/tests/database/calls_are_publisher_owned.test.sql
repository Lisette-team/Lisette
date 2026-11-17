begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- P is an approved publishing house, Q a pending magazine, R a person (reader).
insert into auth.users (id, email, raw_user_meta_data) values
  ('33333333-3333-3333-3333-333333333333', 'p@test.local',
   '{"display_name": "Editura P", "account_kind": "publisher", "publisher_kind": "publishing_house"}'),
  ('44444444-4444-4444-4444-444444444444', 'q@test.local',
   '{"display_name": "Revista Q", "account_kind": "publisher", "publisher_kind": "literary_magazine"}'),
  ('55555555-5555-5555-5555-555555555555', 'r@test.local', '{"display_name": "Radu"}');
update public.publishers set approval_status = 'approved' where id = '33333333-3333-3333-3333-333333333333';

-- Signed in as P.
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

-- c1: open poetry call with a deadline; c2: draft; c4: opens in the future; c5: already closed; c6: cancelled.
select set_config('test.c1', public.save_call(null, 'Apel de poezie', null, now() - interval '1 day',
  now() + interval '30 days', '{ro}', true, true, false, true, false,
  array[(select id from public.genres where code = 'poetry')])::text, true);
select public.publish_call(current_setting('test.c1')::uuid);
select set_config('test.c2', public.save_call(null, 'Ciornă', null, null, null, '{ro,en}',
  true, false, false, false, false, '{}')::text, true);
select set_config('test.c4', public.save_call(null, 'Viitor', null, now() + interval '5 days', null, '{ro}',
  true, false, false, false, false, '{}')::text, true);
select public.publish_call(current_setting('test.c4')::uuid);
select set_config('test.c5', public.save_call(null, 'Închis', null, now() - interval '10 days',
  now() - interval '1 day', '{ro}', true, false, false, false, false, '{}')::text, true);
select public.publish_call(current_setting('test.c5')::uuid);
select set_config('test.c6', public.save_call(null, 'Anulat', null, null, null, '{ro}',
  true, false, false, false, false, '{}')::text, true);
select public.publish_call(current_setting('test.c6')::uuid);
select public.cancel_call(current_setting('test.c6')::uuid);

select results_eq(
  $$ select title, genre_ids = array[(select id from public.genres where code = 'poetry')], accepted_languages
     from public.open_calls where id = current_setting('test.c1')::uuid $$,
  $$ values ('Apel de poezie'::text, true, '{ro}'::text[]) $$,
  'a published call of an approved publisher is open, with its genres'
);
select is((select count(*) from public.calls where id = current_setting('test.c2')::uuid), 1::bigint,
  'the owner sees her draft');
select is((select count(*) from public.open_calls where id = current_setting('test.c2')::uuid), 0::bigint,
  'a draft is not open, even for its owner');
select is((select count(*) from public.open_calls where id = current_setting('test.c6')::uuid), 0::bigint,
  'a cancelled call is not open, even for its owner');
select throws_ok(
  $$ select public.save_call(null, 'Gol', null, null, null, '{ro,NULL}', true, false, false, false, false, '{}') $$,
  '23514', null, 'a language code cannot be empty'
);
select throws_ok(
  $$ select public.save_call(null, 'Lipite', null, null, null, '{"ro,en"}', true, false, false, false, false, '{}') $$,
  '23514', null, 'one language entry holds one code'
);
select set_config('test.c7', public.save_call(null, 'Dublu', null, null, null, '{ro}', true, false, false, false,
  false, array[(select id from public.genres where code = 'poetry'), (select id from public.genres where code = 'poetry')])::text,
  true);
select is((select count(*) from public.call_genres where call_id = current_setting('test.c7')::uuid), 1::bigint,
  'a repeated genre is stored once');
select is((select count(*) from public.open_calls where id = current_setting('test.c4')::uuid), 0::bigint,
  'a call that has not started is not open');
select is((select count(*) from public.open_calls where id = current_setting('test.c5')::uuid), 0::bigint,
  'a call past its deadline is not open');
select throws_ok(
  $$ select public.save_call(current_setting('test.c6')::uuid, 'Din nou', null, null, null, '{ro}',
       true, false, false, false, false, '{}') $$,
  'P0001', 'call_cancelled', 'a cancelled call cannot be edited'
);
select throws_ok(
  $$ select public.save_call(null, 'Greșit', null, now(), now() - interval '1 day', '{ro}',
       true, false, false, false, false, '{}') $$,
  '23514', null, 'the deadline must come after the start'
);
select throws_ok(
  $$ select public.save_call(null, 'Fără limbă', null, null, null, '{}', true, false, false, false, false, '{}') $$,
  '23514', null, 'a call accepts at least one language'
);
select throws_ok(
  $$ select public.save_call(null, 'Limbă greșită', null, null, null, '{romana}', true, false, false, false, false, '{}') $$,
  '23514', null, 'languages are ISO 639-1 codes'
);
select throws_ok(
  $$ insert into public.calls (publisher_id, title, opens_at, accepted_languages)
     values ('33333333-3333-3333-3333-333333333333', 'Direct', now(), '{ro}') $$,
  '42501', null, 'a publisher cannot insert a call directly'
);

-- Signed in as Q (pending): its published call stays hidden.
set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select set_config('test.c3', public.save_call(null, 'Apelul revistei', null, null, null, '{ro}',
  true, false, false, false, false, '{}')::text, true);
select public.publish_call(current_setting('test.c3')::uuid);
select throws_ok(
  $$ select public.save_call(current_setting('test.c1')::uuid, 'Furat', null, null, null, '{ro}',
       true, false, false, false, false, '{}') $$,
  '42501', 'not_owner', 'a publisher cannot edit another publisher''s call'
);
select throws_ok(
  $$ select public.publish_call(current_setting('test.c2')::uuid) $$,
  '42501', 'not_owner', 'a publisher cannot publish another publisher''s call'
);
select throws_ok(
  $$ select public.cancel_call(current_setting('test.c1')::uuid) $$,
  '42501', 'not_owner', 'a publisher cannot cancel another publisher''s call'
);

-- Signed in as R (reader).
set local request.jwt.claims to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select is((select count(*) from public.calls where id = current_setting('test.c2')::uuid), 0::bigint,
  'a reader cannot see a draft');
select is((select count(*) from public.call_genres where call_id = current_setting('test.c1')::uuid), 1::bigint,
  'a reader sees the genres of a published call');
select is((select count(*) from public.calls where id = current_setting('test.c6')::uuid), 0::bigint,
  'a reader cannot see a cancelled call');
select is((select count(*) from public.calls where id = current_setting('test.c3')::uuid), 0::bigint,
  'a pending publisher''s published call is not visible');
select is((select count(*) from public.open_calls where id = current_setting('test.c3')::uuid), 0::bigint,
  'a pending publisher''s call is not open');
select throws_ok(
  $$ select public.save_call(null, 'Cititor', null, null, null, '{ro}', true, false, false, false, false, '{}') $$,
  '42501', 'not_publisher', 'a person cannot create a call'
);
select results_eq(
  $$ select name, open_call_count, languages from public.catalogue_publishers
     where id = '33333333-3333-3333-3333-333333333333' $$,
  $$ values ('Editura P'::text, 1::bigint, '{ro}'::text[]) $$,
  'the catalogue lists the approved publisher with its open calls and their languages'
);
select is((select count(*) from public.catalogue_publishers where id = '44444444-4444-4444-4444-444444444444'),
  0::bigint, 'the catalogue never lists an unapproved publisher');

-- P is suspended: its calls are no longer open or listed.
reset role;
update public.publishers set approval_status = 'suspended' where id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
select is((select count(*) from public.open_calls where publisher_id = '33333333-3333-3333-3333-333333333333'),
  0::bigint, 'suspended publisher''s calls are not open');
select is((select count(*) from public.calls where publisher_id = '33333333-3333-3333-3333-333333333333'),
  0::bigint, 'suspended publisher''s calls are not visible to readers');
select is((select count(*) from public.catalogue_publishers where id = '33333333-3333-3333-3333-333333333333'),
  0::bigint, 'a suspended publisher leaves the catalogue');

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok(
  $$ select public.publish_call(gen_random_uuid()) $$,
  '42501', 'not_owner', 'signed out cannot publish, even an unknown call'
);

select * from finish();
rollback;
