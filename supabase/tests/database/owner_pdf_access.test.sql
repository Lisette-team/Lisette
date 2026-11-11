begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Ana is an author with one work and one uploaded version; Bogdan is another author.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local', '{"display_name": "Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'bogdan@test.local', '{"display_name": "Bogdan"}');
update public.profiles set author_enabled = true;
insert into public.works (id, title, owner_id, source)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Proiectul Anei', '11111111-1111-1111-1111-111111111111', 'author');
insert into storage.objects (bucket_id, name)
values ('manuscripts', '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/v1.pdf');

select results_eq(
  $$ select public, file_size_limit from storage.buckets where id = 'manuscripts' $$,
  $$ values (false, 20971520::bigint) $$,
  'the manuscripts bucket is private and capped at 20 MiB'
);

-- record_manuscript_version runs as the upload function (service_role) on behalf of the verified caller.
set local role service_role;
create temp table v1 on commit drop as
  select (public.record_manuscript_version('11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/v1.pdf',
    repeat('ab', 32), 1024, 3, 'v1')).id as id;
select throws_ok(
  $$ select public.record_manuscript_version('22222222-2222-2222-2222-222222222222',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x.pdf', repeat('ab', 32), 1024, 3, null) $$,
  '42501', null, 'only the work owner can add a version'
);
select throws_ok(
  $$ select public.record_manuscript_version('11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x.pdf', repeat('ab', 32), 20971521, 3, null) $$,
  '23514', null, 'a file over 20 MiB is rejected'
);
select throws_ok(
  $$ select public.record_manuscript_version('11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x.pdf', 'not-a-hash', 1024, 3, null) $$,
  '23514', null, 'the hash must be 64 hex characters'
);
select throws_ok(
  $$ select public.record_manuscript_version('11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x.pdf', repeat('ab', 32), 1024, 0, null) $$,
  '23514', null, 'a PDF needs at least one page'
);
grant select on v1 to authenticated, anon;

-- Signed in as Ana.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq(
  $$ select mv.sha256, mv.byte_size, mv.page_count, mv.label from public.manuscript_versions mv join v1 using (id) $$,
  $$ values (repeat('ab', 32), 1024, 3, 'v1'::text) $$,
  'the owner reads her version metadata'
);
select throws_ok(
  $$ select public.record_manuscript_version('11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x.pdf', repeat('ab', 32), 1024, 3, null) $$,
  '42501', null, 'a client cannot record a version directly'
);
select throws_ok(
  $$ insert into public.manuscript_versions (work_id, storage_path, sha256, byte_size, page_count)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x.pdf', repeat('ab', 32), 1024, 3) $$,
  '42501', null, 'a client cannot insert a version'
);
update public.manuscript_versions set label = 'changed';
delete from public.manuscript_versions;
reset role;
select results_eq(
  $$ select count(*), min(label) from public.manuscript_versions where work_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ values (1::bigint, 'v1'::text) $$,
  'a version cannot be changed or deleted by its owner'
);
set local role authenticated;
select is(
  (select count(*) from storage.objects where bucket_id = 'manuscripts'),
  0::bigint,
  'the owner cannot read the bucket directly'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('manuscripts', '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/x.pdf',
             '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'the owner cannot write to the bucket directly'
);
select is(
  (select jsonb_array_length(public.export_my_data() -> 'manuscript_versions')),
  1,
  'export contains the caller''s versions'
);

-- Signed in as Bogdan.
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.manuscript_versions), 0::bigint, 'another account cannot read the versions');
select is(
  (select jsonb_array_length(public.export_my_data() -> 'manuscript_versions')),
  0,
  'another account''s export has no versions'
);

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*) from public.manuscript_versions), 0::bigint, 'signed out cannot read the versions');
select is((select count(*) from storage.objects where bucket_id = 'manuscripts'), 0::bigint, 'signed out cannot read the bucket');

select * from finish();
rollback;
