begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Ana is an author with a private project, Bogdan a reader, Revista Test a publisher.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local', '{"display_name": "Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'bogdan@test.local', '{"display_name": "Bogdan"}'),
  ('33333333-3333-3333-3333-333333333333', 'revista@test.local',
   '{"display_name": "Revista Test", "account_kind": "publisher", "publisher_kind": "literary_magazine"}');
update public.profiles set author_enabled = true where id = '11111111-1111-1111-1111-111111111111';

insert into public.works (id, title, author_names, isbn, source, visibility, is_published) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Anotimpul cenușiu', array['Elena Dobre'], '9780140328721',
   'manual', 'public', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Grădina de sticlă', array['Ioana Mareș'], null, 'manual', 'public', true);
insert into public.works (id, title, source, owner_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Anotimpul cenușiu (ciornă)', 'author', '11111111-1111-1111-1111-111111111111');

create temp table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select results_eq(
  $$ select (f ->> 'id')::uuid from public.find_similar_works('anotimpul cenusiu') f $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid) $$,
  'a near-identical title is suggested; another reader''s private project is not'
);
select results_eq(
  $$ select f ->> 'title', f -> 'authorNames' ->> 0 from public.find_similar_works('Anotimpul cenușiu') f $$,
  $$ values ('Anotimpul cenușiu', 'Elena Dobre') $$,
  'a suggestion carries its title and authors'
);
select results_eq(
  $$ select (f ->> 'id')::uuid from public.find_similar_works('O carte nouă', 'Elena Dobre') f $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid) $$,
  'a book by a similar author is suggested even when the title differs'
);
select is(
  (select count(*)::int from public.find_similar_works('Cu totul altceva', 'Nimeni Cunoscut')), 0,
  'unrelated books are not suggested'
);

-- Choosing "new book" creates a second, separate work.
insert into ids select 'new', public.create_catalogue_work('Anotimpul cenușiu', array['Elena Dobre']);
select isnt(
  (select id from ids where name = 'new'), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'a new book is a different work'
);
select is(
  (select count(*)::int from public.works where title = 'Anotimpul cenușiu'), 2,
  'both books exist side by side: nothing is merged'
);
select results_eq(
  $$ select w.source::text, w.visibility::text, w.is_published, w.owner_id, w.author_names, w.isbn
     from public.works w join ids on ids.id = w.id where ids.name = 'new' $$,
  $$ values ('manual', 'public', true, null::uuid, array['Elena Dobre'], null::text) $$,
  'a manual catalogue book is public, published and owned by nobody'
);
select results_eq(
  $$ select title, author_names from public.works where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ values ('Anotimpul cenușiu', array['Elena Dobre']) $$,
  'the existing book is unchanged'
);

select public.save_book((select id from ids where name = 'new'), 'to_read');
select results_eq(
  $$ select work_id from public.library_entries where user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ select id from ids where name = 'new' $$,
  'the entry points to the new book only'
);

select throws_ok(
  $$ select public.create_catalogue_work('Alt titlu', array['Elena Dobre'], '9780140328721') $$,
  '23505', null, 'an ISBN already on Lisette is not created twice'
);
select throws_ok(
  $$ select public.create_catalogue_work('Alt titlu', array['Elena Dobre'], '9780140328722') $$,
  '23514', null, 'an ISBN with a wrong check digit is refused'
);
select throws_ok(
  $$ select public.create_catalogue_work('   ', array['Elena Dobre']) $$,
  '23514', null, 'a book needs a title'
);
insert into ids select 'trimmed', public.create_catalogue_work(' Iarna lungă ', array[' Dan Ilie ', ''],
  '978-0-306-40615-7');
select is(
  (select w.isbn from public.works w join ids on ids.id = w.id where ids.name = 'trimmed'),
  '9780306406157',
  'a new book keeps a valid ISBN without hyphens'
);
select results_eq(
  $$ select title, author_names from public.works where isbn = '9780306406157' $$,
  $$ values ('Iarna lungă', array['Dan Ilie']) $$,
  'title and author names are trimmed and empty names dropped'
);

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ select public.create_catalogue_work('Carte de editură', array['Cineva']) $$,
  '42501', null, 'a publisher account does not add books to a personal library'
);

select * from finish();
rollback;
