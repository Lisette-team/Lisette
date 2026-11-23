begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- A is an author with two works (W1, W2), one version each and a phone. B is another person.
-- P is an approved publisher; Q is pending.
insert into auth.users (id, email, raw_user_meta_data) values
  ('66666666-6666-6666-6666-666666666666', 'a@test.local', '{"display_name": "Ana"}'),
  ('77777777-7777-7777-7777-777777777777', 'b@test.local', '{"display_name": "Bogdan"}'),
  ('88888888-8888-8888-8888-888888888888', 'p@test.local',
   '{"display_name": "Editura P", "account_kind": "publisher", "publisher_kind": "publishing_house"}'),
  ('99999999-9999-9999-9999-999999999999', 'q@test.local',
   '{"display_name": "Revista Q", "account_kind": "publisher", "publisher_kind": "literary_magazine"}');
update public.profiles set author_enabled = true where id = '66666666-6666-6666-6666-666666666666';
update public.private_contacts set phone = '+40712345678' where user_id = '66666666-6666-6666-6666-666666666666';
update public.publishers set approval_status = 'approved' where id = '88888888-8888-8888-8888-888888888888';
insert into public.works (id, title, owner_id, source) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'Prima operă', '66666666-6666-6666-6666-666666666666', 'author'),
  ('a1a1a1a1-0000-0000-0000-000000000002', 'A doua operă', '66666666-6666-6666-6666-666666666666', 'author'),
  ('a1a1a1a1-0000-0000-0000-000000000003', 'Alta', '77777777-7777-7777-7777-777777777777', 'author');
insert into public.manuscript_versions (id, work_id, storage_path, sha256, byte_size, page_count) values
  ('b1b1b1b1-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001', 'a/w1/v1.pdf', repeat('ab', 32), 1024, 3),
  ('b1b1b1b1-0000-0000-0000-000000000002', 'a1a1a1a1-0000-0000-0000-000000000001', 'a/w1/v2.pdf', repeat('cd', 32), 1024, 3),
  ('b1b1b1b1-0000-0000-0000-000000000003', 'a1a1a1a1-0000-0000-0000-000000000003', 'b/x/v1.pdf', repeat('cd', 32), 1024, 3),
  ('b1b1b1b1-0000-0000-0000-000000000004', 'a1a1a1a1-0000-0000-0000-000000000002', 'a/w2/v1.pdf', repeat('cd', 32), 1024, 3);
insert into storage.objects (bucket_id, name) values
  ('manuscripts', '66666666-6666-6666-6666-666666666666/materials/synopsis.pdf'),
  ('manuscripts', '77777777-7777-7777-7777-777777777777/materials/other.pdf');
-- C1 needs a synopsis and a poetry genre; C2 needs only the manuscript; C3 is closed; C4 cancelled; CQ is Q's.
insert into public.calls (id, publisher_id, title, opens_at, closes_at, accepted_languages, req_synopsis, req_genre,
  published_at, cancelled_at) values
  ('c1c1c1c1-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', 'Poezie', now() - interval '1 day',
   null, '{ro}', true, true, now(), null),
  ('c1c1c1c1-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', 'Permanent', now() - interval '1 day',
   null, '{ro}', false, false, now(), null),
  ('c1c1c1c1-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', 'Închis', now() - interval '9 days',
   now() - interval '1 day', '{ro}', false, false, now(), null),
  ('c1c1c1c1-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888888', 'Anulat', now() - interval '1 day',
   null, '{ro}', false, false, now(), now()),
  ('c1c1c1c1-0000-0000-0000-000000000009', '99999999-9999-9999-9999-999999999999', 'Revista', now() - interval '1 day',
   null, '{ro}', false, false, now(), null);
insert into public.call_genres (call_id, genre_id)
select 'c1c1c1c1-0000-0000-0000-000000000001', id from public.genres where code = 'poetry';

set local role authenticated;
set local request.jwt.claims to '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002','b1b1b1b1-0000-0000-0000-000000000001',null,'{}',gen_random_uuid(),true,true);
select lives_ok($$select public.set_work_starred('a1a1a1a1-0000-0000-0000-000000000001',true)$$,'owner stars work');
select is(jsonb_array_length(public.export_my_data() -> 'work_preferences'), 1, 'export includes own preferences');
select lives_ok($$select public.set_main_version('a1a1a1a1-0000-0000-0000-000000000001','b1b1b1b1-0000-0000-0000-000000000002')$$,'owner sets main');
select throws_ok($$select public.set_main_version('a1a1a1a1-0000-0000-0000-000000000001','b1b1b1b1-0000-0000-0000-000000000003')$$,'P0001','invalid_version','main version must belong to the work');
select throws_ok($$select public.delete_manuscript_version('b1b1b1b1-0000-0000-0000-000000000001')$$,'P0001','version_sent','delete refuses a version a submission uses');
select is(public.delete_manuscript_version('b1b1b1b1-0000-0000-0000-000000000002'),'a/w1/v2.pdf','deleting main returns path');
select is((select main_version_id from public.work_preferences where work_id='a1a1a1a1-0000-0000-0000-000000000001'),null::uuid,'deleting the main version clears it');
select throws_ok($$select public.delete_manuscript('a1a1a1a1-0000-0000-0000-000000000001')$$,'P0001','work_sent','sent work cannot be deleted');
select is(public.delete_manuscript('a1a1a1a1-0000-0000-0000-000000000002'),array['a/w2/v1.pdf']::text[],'unsent work deletes its versions');
select throws_ok($$select public.rename_work('a1a1a1a1-0000-0000-0000-000000000001','')$$,'23514',null,'empty title rejected');
set local request.jwt.claims to '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}';
select public.cancel_call('c1c1c1c1-0000-0000-0000-000000000002');
set local request.jwt.claims to '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select results_eq($$select call_title,publisher_name from public.my_submissions()$$,$$values ('Permanent'::text,'Editura P'::text)$$,'my_submissions shows a cancelled call');
update public.work_preferences set is_starred=false where work_id='a1a1a1a1-0000-0000-0000-000000000001';
select is((select is_starred from public.work_preferences where work_id='a1a1a1a1-0000-0000-0000-000000000001'),true,'direct update changes nothing');
reset role;
update public.works set visibility = 'public' where id = 'a1a1a1a1-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';
select is((select count(*) from public.work_preferences),0::bigint,'other users cannot read preferences');
select is(jsonb_array_length(public.export_my_data() -> 'work_preferences'), 0, 'export excludes others preferences');
select is((select count(*) from public.works where id='a1a1a1a1-0000-0000-0000-000000000001'),1::bigint,'public work remains visible');
select throws_ok($$insert into public.work_preferences(work_id) values ('a1a1a1a1-0000-0000-0000-000000000001')$$,'42501',null,'direct preferences insertion forbidden');
select throws_ok($$select public.set_work_starred('a1a1a1a1-0000-0000-0000-000000000001',true)$$,'42501','not_owner','other cannot star');
select throws_ok($$select public.rename_work('a1a1a1a1-0000-0000-0000-000000000001','Alt')$$,'42501','not_owner','other cannot rename');
select is((select count(*) from public.my_submissions()),0::bigint,'other sees no submissions');
select * from finish();
rollback;
