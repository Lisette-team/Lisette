begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Ana is an author, Bogdan a reader, Revista Test a publisher. Each has one open session.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local', '{"display_name": "Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'bogdan@test.local', '{"display_name": "Bogdan"}'),
  ('33333333-3333-3333-3333-333333333333', 'revista@test.local',
   '{"display_name": "Revista Test", "account_kind": "publisher", "publisher_kind": "literary_magazine"}');
update public.profiles set author_enabled = true where id = '11111111-1111-1111-1111-111111111111';
insert into auth.sessions (id, user_id) values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222');

select throws_ok(
  $$ insert into public.works (title, source, isbn) values ('Carte', 'manual', '9780306406158') $$,
  '23514', null, 'an ISBN with a wrong check digit is rejected'
);
select col_type_is('public', 'works', 'publisher_name', 'text', 'works stores the catalogue publisher name as plain text');
select throws_ok(
  $$ insert into public.works (title, source, isbn) values ('Ciocolata', 'manual', '5901234123457') $$,
  '23514', null, 'a product barcode that is not an ISBN (no 978/979 prefix) is rejected'
);
select lives_ok(
  $$ insert into public.works (title, source, isbn, visibility) values ('Carte', 'manual', '9780306406157', 'public') $$,
  'a valid ISBN-13 is accepted'
);

-- Signed in as Ana.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

create temp table ana_work on commit drop as
  select public.create_work('Proiectul Anei', 'Un roman', 'ro', (select id from public.genres where code = 'novel')) as id;
grant select on ana_work to authenticated;

select results_eq(
  $$ select w.owner_id::text, w.visibility::text, w.source::text, w.is_published
     from public.works w join ana_work using (id) $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 'private', 'author', false) $$,
  'create_work makes a private author work owned by the caller'
);
select results_eq(
  $$ select wa.author_id::text, wa.status::text from public.work_authors wa join ana_work a on a.id = wa.work_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 'confirmed') $$,
  'create_work confirms the owner as author'
);
select throws_ok(
  $$ insert into public.works (title, source, owner_id) values ('Fals', 'author', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'works cannot be inserted directly'
);

create temp table ana_export on commit drop as select public.export_my_data() as data;

-- Signed in as Bogdan, who has not activated author.
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is((select count(*) from public.works w join ana_work using (id)), 0::bigint, 'another account cannot read a private work');
select is(
  (select count(*) from public.work_authors wa join ana_work a on a.id = wa.work_id),
  0::bigint,
  'another account cannot read the author link of a private work'
);
select is((select count(*) from public.works where isbn = '9780306406157'), 1::bigint, 'a public work is readable');
select is(
  (select count(*) from public.private_contacts where user_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'another account cannot read private contacts'
);
select throws_ok($$ select public.create_work('Nu sunt autor') $$, '42501', null, 'only an author can create a work');
select throws_ok(
  $$ select public.enqueue_event('test', gen_random_uuid(), 'k1', '{}', '{in_app}') $$,
  '42501', null, 'clients cannot call enqueue_event'
);
select throws_ok($$ insert into public.domain_events (event_key, kind, subject_id, recipient_ids, channels)
  values ('k1', 'test', gen_random_uuid(), '{}', '{in_app}') $$, '42501', null, 'clients cannot write domain_events');

-- Signed in as the publisher.
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.create_work('Antologie') $$, '42501', null, 'a publisher cannot create an author work');

-- Back to Ana: she asks for deletion.
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.request_account_deletion();
select results_eq(
  $$ select status::text from public.account_deletion_requests $$,
  $$ values ('requested') $$,
  'the deletion request is queued and visible to its owner'
);

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok($$ select public.export_my_data() $$, '42501', null, 'anonymous export fails');

reset role;
select is(
  (select data -> 'account' ->> 'id' from ana_export),
  '11111111-1111-1111-1111-111111111111',
  'export contains the caller''s account'
);
select is((select jsonb_array_length(data -> 'works') from ana_export), 1, 'export contains the caller''s works');
select is(
  (select data -> 'private_contacts' ->> 'contact_email' from ana_export),
  'ana@test.local',
  'export contains the caller''s private contacts'
);
select ok(
  (select position('22222222-2222-2222-2222-222222222222' in data::text) = 0
      and position('9780306406157' in data::text) = 0 from ana_export),
  'export contains no other account''s rows'
);
select results_eq(
  $$ select user_id::text from auth.sessions $$,
  $$ values ('22222222-2222-2222-2222-222222222222') $$,
  'a deletion request ends only the caller''s sessions'
);
select ok(
  (select count(*) = 1 from public.accounts where id = '11111111-1111-1111-1111-111111111111')
  and (select count(*) = 1 from public.works where owner_id = '11111111-1111-1111-1111-111111111111'),
  'a deletion request deletes nothing else'
);

select public.enqueue_event('test', gen_random_uuid(), 'same-key', '{22222222-2222-2222-2222-222222222222}', '{in_app}');
select public.enqueue_event('test', gen_random_uuid(), 'same-key', '{22222222-2222-2222-2222-222222222222}', '{in_app}');
select is((select count(*) from public.domain_events where event_key = 'same-key'), 1::bigint, 'the same event_key stores one row');

select * from finish();
rollback;
