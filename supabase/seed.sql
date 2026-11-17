-- Local only: `supabase db reset` loads this file; it is never pushed to the hosted project.
-- Three approved publications (one of each kind) with calls, so calls, the catalogue and submissions
-- can be tried before publication sign-up exists. Password for all three: local-only-password-1.
-- No writers or manuscripts here: writers are created in the app, and their files need the upload function.
-- Never run this against a hosted database (`db reset --linked`, `db push --include-seed`, preview branches).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('local-only-password-1', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}',
  jsonb_build_object('display_name', u.name, 'locale', 'ro', 'account_kind', 'publisher', 'publisher_kind', u.kind),
  now(), now(), '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'editura@lisette.local', 'Editura Pagina Albă', 'publishing_house'),
  ('d0000000-0000-4000-8000-000000000002', 'revista@lisette.local', 'Revista Vatra Nouă', 'literary_magazine'),
  ('d0000000-0000-4000-8000-000000000003', 'editor@lisette.local', 'Ioana Marin, editor independent', 'independent_editor')
) u (id, email, name, kind);

-- Password sign-in needs an email identity for each user.
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users u where u.email like '%@lisette.local';

update public.publishers p
set approval_status = 'approved', verification_method = 'direct_confirmation', reviewed_at = now(), intro = i.intro
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'Publicăm proză contemporană și debuturi românești.'),
  ('d0000000-0000-4000-8000-000000000002', 'Revistă lunară de poezie și proză scurtă.'),
  ('d0000000-0000-4000-8000-000000000003', 'Citesc și redactez proză scurtă și nuvele.')
) i (id, intro)
where p.id = i.id;

insert into public.publisher_genres (publisher_id, genre_id)
select g.publisher_id, genres.id
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'novel'), ('d0000000-0000-4000-8000-000000000001', 'short_fiction'),
  ('d0000000-0000-4000-8000-000000000002', 'poetry'), ('d0000000-0000-4000-8000-000000000002', 'short_fiction'),
  ('d0000000-0000-4000-8000-000000000003', 'short_fiction'), ('d0000000-0000-4000-8000-000000000003', 'novella')
) g (publisher_id, code)
join public.genres on genres.code = g.code;

-- Open: two at the publishing house, one at the editor. The magazine has one closed call and one draft.
insert into public.calls (id, publisher_id, title, description, opens_at, closes_at, accepted_languages,
  req_full_manuscript, req_synopsis, req_sample, req_genre, req_author_intro, published_at)
values
  ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Concurs de debut în proză 2027',
   'Căutăm primul tău roman sau volum de proză scurtă.', now() - interval '3 days', now() + interval '60 days', '{ro}',
   true, true, true, false, true, now()),
  ('d1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Manuscrise de roman',
   'Primim oricând manuscrise de roman.', now() - interval '30 days', null, '{ro,en}',
   true, true, false, false, false, now()),
  ('d1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', 'Număr de toamnă: poezie',
   null, now() - interval '60 days', now() - interval '10 days', '{ro}',
   true, false, false, false, false, now()),
  ('d1000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000002', 'Număr de iarnă',
   'Ciornă, încă nepublicată.', now(), null, '{ro}',
   true, false, false, false, false, null),
  ('d1000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000003', 'Citesc proză scurtă',
   'Trimite-mi o povestire sau o nuvelă.', now() - interval '7 days', null, '{ro,en}',
   true, true, false, true, false, now());

insert into public.call_genres (call_id, genre_id)
select c.call_id, genres.id
from (values
  ('d1000000-0000-4000-8000-000000000001'::uuid, 'novel'), ('d1000000-0000-4000-8000-000000000001', 'short_fiction'),
  ('d1000000-0000-4000-8000-000000000005', 'short_fiction'), ('d1000000-0000-4000-8000-000000000005', 'novella')
) c (call_id, code)
join public.genres on genres.code = c.code;
