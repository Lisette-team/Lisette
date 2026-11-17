begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

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
  ('a1a1a1a1-0000-0000-0000-000000000002', 'A doua operă', '66666666-6666-6666-6666-666666666666', 'author');
insert into public.manuscript_versions (id, work_id, storage_path, sha256, byte_size, page_count) values
  ('b1b1b1b1-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001', 'a/w1/v1.pdf', repeat('ab', 32), 1024, 3),
  ('b1b1b1b1-0000-0000-0000-000000000002', 'a1a1a1a1-0000-0000-0000-000000000002', 'a/w2/v1.pdf', repeat('cd', 32), 1024, 3);
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

-- Signed in as A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';

select set_config('test.s1', public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000001',
  'b1b1b1b1-0000-0000-0000-000000000001', (select id from public.genres where code = 'poetry'),
  '{"synopsis": "66666666-6666-6666-6666-666666666666/materials/synopsis.pdf", "author_intro": "Scriu poezie."}',
  'e1e1e1e1-0000-0000-0000-000000000001', true, true)::text, true);

select results_eq(
  $$ select contact_email, contact_phone, status::text, publisher_id from public.submissions
     where id = current_setting('test.s1')::uuid $$,
  $$ values ('a@test.local'::text, '+40712345678'::text, 'submitted'::text, '88888888-8888-8888-8888-888888888888'::uuid) $$,
  'a valid submission copies the contact details and is submitted to the call''s publisher'
);
select results_eq(
  $$ select accepted_policy from public.submissions where id = current_setting('test.s1')::uuid $$,
  $$ values ('{"requirements": {"full_manuscript": true, "synopsis": true, "sample": false, "genre": true,
     "author_intro": false}, "sharing_policy": "author_controlled"}'::jsonb) $$,
  'the accepted requirements and sharing policy are stored'
);
select results_eq(
  $$ select kind::text, body, storage_path from public.submission_materials
     where submission_id = current_setting('test.s1')::uuid order by kind $$,
  $$ values ('author_intro'::text, 'Scriu poezie.'::text, null::text),
            ('synopsis', null, '66666666-6666-6666-6666-666666666666/materials/synopsis.pdf') $$,
  'the synopsis is a stored PDF and the author introduction is text'
);
select results_eq(
  $$ select from_status::text, to_status::text, changed_by from public.submission_status_history
     where submission_id = current_setting('test.s1')::uuid $$,
  $$ values (null::text, 'submitted'::text, '66666666-6666-6666-6666-666666666666'::uuid) $$,
  'the first history row records the submission'
);
select is(
  public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000001', 'b1b1b1b1-0000-0000-0000-000000000001',
    (select id from public.genres where code = 'poetry'),
    '{"synopsis": "66666666-6666-6666-6666-666666666666/materials/synopsis.pdf"}',
    'e1e1e1e1-0000-0000-0000-000000000001', true, true),
  current_setting('test.s1')::uuid,
  'replay returns the same id'
);
select is((select count(*) from public.submissions), 1::bigint, 'a replay creates no second submission');
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000001',
       null, '{}', gen_random_uuid(), true, true) $$,
  'P0001', 'duplicate_active', 'the same work cannot have two active submissions to one publisher'
);
select results_eq(
  $$ select reason, submission_id from public.submission_eligibility('b1b1b1b1-0000-0000-0000-000000000001',
       array['c1c1c1c1-0000-0000-0000-000000000002'::uuid]) $$,
  $$ values ('duplicate_active'::text, current_setting('test.s1')::uuid) $$,
  'eligibility names the existing active submission'
);
select results_eq(
  $$ select call_id, reason from public.submission_eligibility('b1b1b1b1-0000-0000-0000-000000000002',
       array['c1c1c1c1-0000-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-000000000003']::uuid[]) order by call_id $$,
  $$ values ('c1c1c1c1-0000-0000-0000-000000000002'::uuid, null::text),
            ('c1c1c1c1-0000-0000-0000-000000000003'::uuid, 'call_not_open') $$,
  'eligibility checks each call separately'
);
select lives_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{}', gen_random_uuid(), true, true) $$,
  'a different work can go to the same publisher'
);
reset role;
delete from public.submissions where work_id = 'a1a1a1a1-0000-0000-0000-000000000002';
set local role authenticated;
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000003', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{}', gen_random_uuid(), true, true) $$,
  'P0001', 'call_not_open', 'closed call rejects'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000004', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{}', gen_random_uuid(), true, true) $$,
  'P0001', 'call_not_open', 'a cancelled call rejects'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000009', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{}', gen_random_uuid(), true, true) $$,
  'P0001', 'call_not_open', 'unapproved publisher rejects'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{}', gen_random_uuid(), false, true) $$,
  'P0001', 'missing_consent', 'the rights declaration is required'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{}', gen_random_uuid(), true, false) $$,
  'P0001', 'missing_consent', 'consent to share the contact details is required'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000001', 'b1b1b1b1-0000-0000-0000-000000000002',
       (select id from public.genres where code = 'poetry'), '{}', gen_random_uuid(), true, true) $$,
  'P0001', 'missing_material', 'a required synopsis must be sent'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000001', 'b1b1b1b1-0000-0000-0000-000000000002',
       (select id from public.genres where code = 'poetry'),
       '{"synopsis": "77777777-7777-7777-7777-777777777777/materials/other.pdf"}', gen_random_uuid(), true, true) $$,
  'P0001', 'invalid_material', 'a synopsis must be the author''s own uploaded file'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{"cover_letter": "Bună ziua"}', gen_random_uuid(), true, true) $$,
  'P0001', 'invalid_material', 'unknown materials are refused'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000001', 'b1b1b1b1-0000-0000-0000-000000000002',
       (select id from public.genres where code = 'novel'),
       '{"synopsis": "66666666-6666-6666-6666-666666666666/materials/synopsis.pdf"}', gen_random_uuid(), true, true) $$,
  'P0001', 'invalid_genre', 'the genre must be one the call accepts'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000001', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{"synopsis": "66666666-6666-6666-6666-666666666666/materials/synopsis.pdf"}', gen_random_uuid(), true, true) $$,
  'P0001', 'invalid_genre', 'a call that requires a genre needs one'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, jsonb_build_object('author_intro', repeat('a', 5001)), gen_random_uuid(), true, true) $$,
  'P0001', 'invalid_material', 'an author introduction over 5000 characters is refused'
);
select lives_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000002',
       (select id from public.genres where code = 'novel'), '{}', 'e1e1e1e1-0000-0000-0000-0000000000a2', true, true) $$,
  'a call with no genres accepts any genre'
);
reset role;
delete from public.submissions where work_id = 'a1a1a1a1-0000-0000-0000-000000000002';
set local role authenticated;
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000002',
       gen_random_uuid(), '{}', gen_random_uuid(), true, true) $$,
  'P0001', 'invalid_genre', 'an unknown genre is refused'
);
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000001', 'b1b1b1b1-0000-0000-0000-000000000002',
       (select id from public.genres where code = 'poetry'),
       '{"synopsis": "66666666-6666-6666-6666-666666666666/materials/never-uploaded.pdf"}', gen_random_uuid(), true, true) $$,
  'P0001', 'invalid_material', 'a synopsis path with no uploaded file is refused'
);
select results_eq(
  $$ select reason from public.submission_eligibility('b1b1b1b1-0000-0000-0000-000000000002', array[gen_random_uuid()]) $$,
  $$ values ('call_not_open'::text) $$,
  'eligibility answers for every requested call, even an unknown one'
);
select throws_ok(
  $$ insert into public.submissions (author_id, work_id, version_id, publisher_id, call_id, contact_email, contact_phone,
       rights_declared_at, contact_consent_at, accepted_policy, idempotency_key)
     values ('66666666-6666-6666-6666-666666666666', 'a1a1a1a1-0000-0000-0000-000000000002',
       'b1b1b1b1-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888',
       'c1c1c1c1-0000-0000-0000-000000000002', 'a@test.local', '+40712345678', now(), now(), '{}', gen_random_uuid()) $$,
  '42501', null, 'a client cannot insert a submission directly'
);
select is((select jsonb_array_length(public.export_my_data() -> 'submissions')), 1, 'export contains the author''s submissions');

reset role;
select is((select count(*) from public.submissions where work_id = 'a1a1a1a1-0000-0000-0000-000000000002'), 0::bigint,
  'a rollback leaves no submission');
select is((select count(*) from public.domain_events where subject_id = current_setting('test.s1')::uuid), 1::bigint,
  'a retry emits one event');
select is((select count(*) from public.domain_events
  where kind = 'submission_status_changed' and '88888888-8888-8888-8888-888888888888' = any (recipient_ids)), 3::bigint,
  'only the three successful submissions emitted events');
select results_eq(
  $$ select recipient_ids, channels::text[] from public.domain_events where subject_id = current_setting('test.s1')::uuid $$,
  $$ values (array['88888888-8888-8888-8888-888888888888'::uuid], '{in_app}'::text[]) $$,
  'the publisher is notified in the app'
);

-- Missing phone and blocks.
update public.private_contacts set phone = null where user_id = '66666666-6666-6666-6666-666666666666';
set local role authenticated;
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{}', gen_random_uuid(), true, true) $$,
  'P0001', 'missing_phone', 'a phone number is required'
);
reset role;
update public.private_contacts set phone = '+40712345678' where user_id = '66666666-6666-6666-6666-666666666666';
insert into public.blocks (blocker_id, blocked_id)
values ('66666666-6666-6666-6666-666666666666', '88888888-8888-8888-8888-888888888888');
set local role authenticated;
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{}', gen_random_uuid(), true, true) $$,
  'P0001', 'blocked', 'an author who blocked the publisher cannot submit to it'
);
reset role;
delete from public.blocks;

-- The publisher tightens C1 after the submission: what A accepted does not change.
set local role authenticated;
set local request.jwt.claims to '{"sub": "88888888-8888-8888-8888-888888888888", "role": "authenticated"}';
select public.save_call('c1c1c1c1-0000-0000-0000-000000000001', 'Poezie', null, null, null, '{ro}',
  true, false, true, false, true, '{}');
select is((select accepted_policy -> 'requirements' ->> 'sample' from public.submissions
  where id = current_setting('test.s1')::uuid), 'false', 'accepted_policy is a snapshot');
select is((select count(*) from public.submission_materials where submission_id = current_setting('test.s1')::uuid),
  2::bigint, 'the publisher sees the materials of a submission it received');

-- After withdrawal, resubmission follows the publisher's setting.
reset role;
update public.submissions set status = 'withdrawn' where id = current_setting('test.s1')::uuid;
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000001',
       null, '{}', gen_random_uuid(), true, true) $$,
  'P0001', 'resubmission_not_allowed', 'no resubmission after withdrawal by default'
);
set local request.jwt.claims to '{"sub": "88888888-8888-8888-8888-888888888888", "role": "authenticated"}';
select is((select count(*) from public.submission_materials where submission_id = current_setting('test.s1')::uuid),
  0::bigint, 'after withdrawal the publisher no longer reads the materials');
set local request.jwt.claims to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';
select is((select count(*) from public.submission_materials where submission_id = current_setting('test.s1')::uuid),
  2::bigint, 'the author still reads her materials after withdrawal');
reset role;
update public.publishers set resubmission_allowed = true where id = '88888888-8888-8888-8888-888888888888';
set local role authenticated;
select lives_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000001',
       null, '{}', gen_random_uuid(), true, true) $$,
  'a resubmission is allowed when the publisher allows it'
);

-- Other accounts.
set local request.jwt.claims to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';
select is((select count(*) from public.submissions), 0::bigint, 'another person sees no submissions');
select throws_ok(
  $$ select public.submit_manuscript('c1c1c1c1-0000-0000-0000-000000000002', 'b1b1b1b1-0000-0000-0000-000000000002',
       null, '{}', gen_random_uuid(), true, true) $$,
  '42501', 'not_owner', 'only the owner of the work can send it'
);
set local request.jwt.claims to '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';
select is((select count(*) from public.submissions), 0::bigint, 'another publisher sees no submissions');
set local request.jwt.claims to '{"sub": "88888888-8888-8888-8888-888888888888", "role": "authenticated"}';
select is((select count(*) from public.submissions), 2::bigint, 'the recipient publisher sees both submissions');

select * from finish();
rollback;
