begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email, raw_user_meta_data) values
  ('ef000000-0000-0000-0000-000000000001', 'export-modules@test.local', '{"display_name":"Export Test"}');
set local role authenticated;
set local request.jwt.claims to '{"sub":"ef000000-0000-0000-0000-000000000001","role":"authenticated"}';

select ok(public.export_my_data() ?& array['calls', 'submissions', 'contents', 'posts', 'post_images',
  'reactions', 'comments', 'follows', 'library_entries'], 'export retains data from submissions, community and library');

select * from finish();
rollback;
