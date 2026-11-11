begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Ana is a person, Revista Test a publisher, Admin a person added to admins by setup.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local', '{"display_name": "Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'revista@test.local',
   '{"display_name": "Revista Test", "account_kind": "publisher", "publisher_kind": "literary_magazine"}'),
  ('44444444-4444-4444-4444-444444444444', 'alta@test.local',
   '{"display_name": "Editura Alta", "account_kind": "publisher", "publisher_kind": "publishing_house"}'),
  ('33333333-3333-3333-3333-333333333333', 'admin@test.local', '{"display_name": "Admin"}');
insert into public.admins (user_id) values ('33333333-3333-3333-3333-333333333333');
insert into public.publisher_genres select '44444444-4444-4444-4444-444444444444', id from public.genres where code = 'novel';

select results_eq(
  $$ select kind::text, approval_status::text, name from public.publishers
     where id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values ('literary_magazine', 'pending', 'Revista Test') $$,
  'publisher sign-up creates a pending publisher'
);
select is(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'a publisher account has no person profile'
);
select is(
  (select contact_email from public.private_contacts where user_id = '11111111-1111-1111-1111-111111111111'),
  'ana@test.local',
  'a person''s contact email starts as the sign-up email'
);
select ok(
  (select count(*) = 12 from public.genres),
  'genres are seeded'
);

update auth.users set raw_user_meta_data = '{"display_name": "Ana", "account_kind": "publisher"}'
  where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select kind::text from public.accounts where id = '11111111-1111-1111-1111-111111111111'),
  'person',
  'changing auth metadata after sign-up does not change the kind'
);
select is(
  public.can_receive_submissions('22222222-2222-2222-2222-222222222222'),
  false,
  'an unapproved publisher cannot receive submissions'
);

-- Signed in as Ana.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ update public.profiles set author_enabled = true where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'author_enabled cannot be set directly'
);
select throws_ok(
  $$ update public.profiles set links = '[{"kind": "blog", "url": "javascript:alert(1)"}]'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'profile links must be https'
);
select throws_ok(
  $$ update public.private_contacts set phone = '0712345678' where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'a phone number without the international prefix is rejected'
);
select lives_ok(
  $$ update public.private_contacts set phone = '+40712345678' where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'the owner saves a phone number in international format'
);
select public.activate_author();
select is(
  public.get_session_context() - 'locale' - 'approvalStatus',
  '{"accountId": "11111111-1111-1111-1111-111111111111", "kind": "person", "authorEnabled": true}'::jsonb,
  'a person enables author and keeps the same ID'
);
select throws_ok(
  $$ select public.approve_publisher('22222222-2222-2222-2222-222222222222', 'official_email') $$,
  '42501', null, 'a non-admin cannot approve'
);
select throws_ok(
  $$ insert into public.admins (user_id) values ('11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'nobody can insert into admins from the app'
);
select throws_ok(
  $$ insert into public.publisher_genres select '22222222-2222-2222-2222-222222222222', id from public.genres where code = 'poetry' $$,
  '42501', null, 'a person cannot add genres to a publisher'
);
select throws_ok(
  $$ select reviewed_by from public.publishers $$,
  '42501', null, 'other accounts cannot see which admin reviewed a publisher'
);
update public.accounts set kind = 'publisher' where id = '11111111-1111-1111-1111-111111111111';
select public.set_block('22222222-2222-2222-2222-222222222222', true);

-- Signed in as the publisher.
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok($$ select public.activate_author() $$, '42501', null, 'a publisher account cannot activate author');
select is(public.get_session_context() ->> 'approvalStatus', 'pending', 'session context shows the approval status');
select is((select count(*) from public.blocks), 0::bigint, 'a block is visible only to the blocker');
select lives_ok(
  $$ insert into public.publisher_genres select '22222222-2222-2222-2222-222222222222', id from public.genres where code = 'poetry' $$,
  'a publisher adds a genre to its own profile'
);
select throws_ok(
  $$ insert into public.publisher_genres select '44444444-4444-4444-4444-444444444444', id from public.genres where code = 'poetry' $$,
  '42501', null, 'a publisher cannot add genres to another publisher'
);
delete from public.publisher_genres where publisher_id = '44444444-4444-4444-4444-444444444444';
select throws_ok(
  $$ select public.is_blocked('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'clients cannot ask whether two accounts are blocked'
);
select is(
  public.is_blocked_with('11111111-1111-1111-1111-111111111111'),
  true,
  'the blocked account sees the block through is_blocked_with'
);
select throws_ok(
  $$ update public.publishers set approval_status = 'approved' where id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'a publisher cannot approve itself'
);
select lives_ok(
  $$ update public.publishers set name = 'Revista Noua' where id = '22222222-2222-2222-2222-222222222222' $$,
  'a pending publisher can rename itself'
);

-- Signed in as the admin.
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select throws_ok(
  $$ select public.approve_publisher('44444444-4444-4444-4444-444444444444', null) $$,
  '22004', null, 'an approval needs a verification method'
);
select public.approve_publisher('22222222-2222-2222-2222-222222222222', 'official_email');
select throws_ok(
  $$ select public.reject_publisher('22222222-2222-2222-2222-222222222222') $$,
  '55000', null, 'only a pending publisher can be approved or rejected'
);
select is(
  public.is_blocked_with('11111111-1111-1111-1111-111111111111'),
  false,
  'is_blocked_with answers only about the caller'
);

-- Signed in as the approved publisher.
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$ update public.publishers set name = 'Humanitas' where id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'an approved publisher cannot change its name'
);
select ok(
  (select d -> 'publisher' ->> 'name' = 'Revista Noua' and not (d -> 'publisher') ? 'reviewed_by'
   from (select public.export_my_data() as d) x),
  'a publisher exports its own row without the reviewing admin'
);

reset role;
select results_eq(
  $$ select approval_status::text, verification_method::text, reviewed_by::text, public.can_receive_submissions(id)
     from public.publishers where id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values ('approved', 'official_email', '33333333-3333-3333-3333-333333333333', true) $$,
  'an admin approval is recorded and lets the publisher receive submissions'
);
select is(
  (select kind::text from public.accounts where id = '11111111-1111-1111-1111-111111111111'),
  'person',
  'the kind cannot be changed from the app'
);
select is(
  (select count(*) from public.publisher_genres where publisher_id = '44444444-4444-4444-4444-444444444444'),
  1::bigint,
  'a publisher cannot remove another publisher''s genres'
);
select ok(
  public.is_blocked('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
  and public.is_blocked('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),
  'a block works in both directions'
);

select * from finish();
rollback;
