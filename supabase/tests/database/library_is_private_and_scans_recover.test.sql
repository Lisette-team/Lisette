begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Ana is an author, Bogdan a reader, Revista Test a publisher, Dana a reader Bogdan will block.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local', '{"display_name": "Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'bogdan@test.local', '{"display_name": "Bogdan"}'),
  ('33333333-3333-3333-3333-333333333333', 'revista@test.local',
   '{"display_name": "Revista Test", "account_kind": "publisher", "publisher_kind": "literary_magazine"}'),
  ('44444444-4444-4444-4444-444444444444', 'dana@test.local', '{"display_name": "Dana"}');
update public.profiles set author_enabled = true where id = '11111111-1111-1111-1111-111111111111';

insert into public.works (id, title, source, owner_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Proiect privat', 'author', '11111111-1111-1111-1111-111111111111');
insert into public.follows (follower_id, followed_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222');

create temp table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to anon, authenticated, service_role;

-- The ISBN Edge Function caches an Open Library answer with the service role.
set local role service_role;
insert into ids select 'scanned', (public.cache_isbn_work('9780140328721', 'Fantastic Mr Fox',
  array['Roald Dahl'], 'Puffin', 'OL45804W') ->> 'id')::uuid;
select is(
  (public.cache_isbn_work('9780140328721', 'Another title', array['Someone'], null, null) ->> 'id')::uuid,
  (select id from ids where name = 'scanned'),
  'caching the same ISBN again returns the existing book and changes nothing'
);
reset role;

select results_eq(
  $$ select w.title, w.author_names, w.publisher_name, w.source::text, w.visibility::text, w.is_published, w.owner_id
     from public.works w where w.isbn = '9780140328721' $$,
  $$ values ('Fantastic Mr Fox', array['Roald Dahl'], 'Puffin', 'isbn_lookup', 'public', true, null::uuid) $$,
  'a cached catalogue book is public, published, has no owner and keeps the first answer'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$ select public.cache_isbn_work('9780306406157', 'Invented', array['Nobody'], null, null) $$,
  '42501', null, 'only the Edge Function can write to the ISBN cache'
);
select throws_ok(
  $$ insert into public.library_entries (user_id, work_id, shelf)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 'to_read') $$,
  '42501', null, 'a client cannot write library entries directly'
);

-- Scanning: the cached book is found by ISBN, with or without hyphens.
select is(
  (public.lookup_isbn('978-0-14-032872-1') ->> 'id')::uuid,
  (select id from ids where name = 'scanned'),
  'lookup_isbn finds a cached book'
);
select is(public.lookup_isbn('9780306406157'), null, 'an unknown ISBN gives null');
select is(
  (select count(*)::int from public.works where isbn = '9780306406157'), 0,
  'an unknown ISBN never creates a book with an invented title'
);
select is(public.lookup_isbn('9780306406158'), null, 'an ISBN with a wrong check digit gives null');

-- A new entry is private.
select lives_ok(
  $$ select public.save_book((select id from ids where name = 'scanned'), 'to_read') $$,
  'a reader saves a scanned book'
);
select results_eq(
  $$ select shelf::text, is_public, is_inspiration from public.library_entries
     where user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values ('to_read', false, false) $$,
  'a new entry is private and not an inspiration'
);

-- Scanning the same book again updates the same entry.
select public.set_entry_public((select id from ids where name = 'scanned'), true);
select public.save_book((select id from ids where name = 'scanned'), 'reading');
select results_eq(
  $$ select count(*)::int, min(shelf::text), bool_and(is_public) from public.library_entries
     where user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values (1, 'reading', true) $$,
  'saving the same book again moves the one entry and keeps its public choice'
);

select throws_ok(
  $$ select public.save_book('aaaaaaaa-0000-0000-0000-000000000002', 'to_read') $$,
  '42501', null, 'someone else''s private project cannot be saved'
);
select throws_ok(
  $$ select public.set_entry_public('aaaaaaaa-0000-0000-0000-000000000002', true) $$,
  '22023', null, 'set_entry_public needs the book to be in the caller''s library'
);
select throws_ok(
  $$ select public.set_inspiration((select id from ids where name = 'scanned'), true) $$,
  '42501', null, 'only an author can mark an inspiration'
);
select lives_ok(
  $$ select public.set_inspiration((select id from ids where name = 'scanned'), false) $$,
  'clearing the mark needs no author profile'
);

-- Bogdan blocks Dana.
select public.set_block('44444444-4444-4444-4444-444444444444', true);

-- Ana follows Bogdan and sees his public entry, in the table and in the followed strip.
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(
  (select count(*)::int from public.library_entries where user_id = '22222222-2222-2222-2222-222222222222'), 1,
  'a public entry is visible to others'
);
select results_eq(
  $$ select f ->> 'name', f ->> 'title', f ->> 'shelf' from public.followed_library() f $$,
  $$ values ('Bogdan', 'Fantastic Mr Fox', 'reading') $$,
  'the followed strip shows public entries of followed accounts, with name, title and shelf'
);

-- Ana's own entries: her private project and the catalogue book; she marks an inspiration.
select public.save_book('aaaaaaaa-0000-0000-0000-000000000002', 'reading');
select throws_ok(
  $$ select public.set_entry_public('aaaaaaaa-0000-0000-0000-000000000002', true) $$,
  '22023', null, 'an entry for a private work cannot be made public'
);
select public.save_book((select id from ids where name = 'scanned'), 'read');
select lives_ok(
  $$ select public.set_inspiration((select id from ids where name = 'scanned'), true) $$,
  'an author marks a book as an inspiration'
);
select results_eq(
  $$ select is_inspiration, is_public from public.library_entries
     where user_id = '11111111-1111-1111-1111-111111111111' and work_id = (select id from ids where name = 'scanned') $$,
  $$ values (true, false) $$,
  'the inspiration mark does not publish the entry'
);
select is(
  (public.export_my_data() -> 'library_entries' -> 0 ->> 'user_id')::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the data export includes the library'
);

-- Bogdan sees neither of Ana's private entries.
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(
  (select count(*)::int from public.library_entries where user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'private entries are visible to their owner only'
);

-- Dana follows Bogdan but is blocked: his public entry is hidden from her.
set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select is(
  (select count(*)::int from public.library_entries where user_id = '22222222-2222-2222-2222-222222222222'), 0,
  'a blocked account does not see a public entry'
);
select is((select count(*)::int from public.followed_library()), 0, 'nor in the followed strip');

-- A private entry of a followed account never appears in the strip.
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.set_entry_public((select id from ids where name = 'scanned'), false);
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.followed_library()), 0, 'a followed account''s private entry is not shown');
select is(
  (select count(*)::int from public.library_entries where user_id = '22222222-2222-2222-2222-222222222222'), 0,
  'and is no longer visible once made private again'
);

-- Removing an entry never deletes the work.
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok($$ select public.remove_book((select id from ids where name = 'scanned')) $$, 'a reader removes a book');
select is(
  (select count(*)::int from public.library_entries where user_id = '22222222-2222-2222-2222-222222222222'), 0,
  'the entry is gone'
);
select is(
  (select count(*)::int from public.works where id = (select id from ids where name = 'scanned')), 1,
  'the work stays'
);
select is(
  (select count(*)::int from public.library_entries where work_id = (select id from ids where name = 'scanned')), 0,
  'Bogdan sees no entry for it (Ana''s is private)'
);
select throws_ok(
  $$ select public.remove_book((select id from ids where name = 'scanned')) $$,
  '22023', null, 'removing a book that is not in the library is reported'
);

-- Publisher accounts have no personal library.
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ select public.save_book((select id from ids where name = 'scanned'), 'to_read') $$,
  '42501', null, 'a publisher account has no library'
);

-- Signed out: nothing.
set local request.jwt.claims to '{"role": "anon"}';
set local role anon;
select throws_ok(
  $$ select public.save_book((select id from ids where name = 'scanned'), 'to_read') $$,
  '42501', null, 'signed-out callers cannot save'
);

reset role;
select is(
  (select count(*)::int from public.library_entries where user_id = '11111111-1111-1111-1111-111111111111'), 2,
  'Ana''s entries are untouched by the others'
);

select * from finish();
rollback;
