begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

-- Ana is an author, Bogdan a reader, Revista Test a publisher, Dana a reader Ana will block.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local', '{"display_name": "Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'bogdan@test.local', '{"display_name": "Bogdan"}'),
  ('33333333-3333-3333-3333-333333333333', 'revista@test.local',
   '{"display_name": "Revista Test", "account_kind": "publisher", "publisher_kind": "literary_magazine"}'),
  ('44444444-4444-4444-4444-444444444444', 'dana@test.local', '{"display_name": "Dana"}');
update public.profiles set author_enabled = true where id = '11111111-1111-1111-1111-111111111111';

insert into public.works (id, title, source, visibility) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Carte publică', 'manual', 'public');
insert into public.works (id, title, source, owner_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Proiect privat', 'author', '11111111-1111-1111-1111-111111111111');

-- Uploaded images: the app puts them under the uploader's own folder in public-media.
insert into storage.objects (bucket_id, name) values
  ('public-media', '11111111-1111-1111-1111-111111111111/posts/1.jpg'),
  ('public-media', '11111111-1111-1111-1111-111111111111/posts/2.jpg'),
  ('public-media', '11111111-1111-1111-1111-111111111111/posts/3.jpg'),
  ('public-media', '11111111-1111-1111-1111-111111111111/posts/4.jpg'),
  ('public-media', '11111111-1111-1111-1111-111111111111/posts/5.jpg'),
  ('public-media', '22222222-2222-2222-2222-222222222222/posts/1.jpg');

create temp table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated;

set local role authenticated;

-- Signed in as Ana.
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.contents (kind, account_id) values ('post', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'a client cannot insert content directly, so not for another account either'
);

insert into ids select 'ana_post', public.create_post(body => 'Primul meu text');
select results_eq(
  $$ select c.account_id::text, c.kind::text, c.work_id from public.contents c join ids on ids.id = c.id
     where ids.name = 'ana_post' $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 'post', null::uuid) $$,
  'create_post records the caller as creator and adds no work link unless one is chosen'
);

insert into ids select 'linked_post',
  public.create_post(body => 'Despre carte', work_id => 'aaaaaaaa-0000-0000-0000-000000000001');
select is(
  (select c.work_id from public.contents c join ids on ids.id = c.id where ids.name = 'linked_post'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'a chosen public work is linked'
);
select throws_ok(
  $$ select public.create_post(body => 'Secret', work_id => 'aaaaaaaa-0000-0000-0000-000000000002') $$,
  '42501', null, 'a private work cannot be linked, not even by its owner'
);
select throws_ok($$ select public.create_post() $$, '22023', null, 'a post needs text, an image or a reshare');
select throws_ok(
  $$ select public.create_post(body => repeat('a', 3001)) $$, '23514', null, 'post text is limited to 3000 characters'
);

insert into ids select 'image_post', public.create_post(body => 'Poze', image_paths => array[
  '11111111-1111-1111-1111-111111111111/posts/2.jpg', '11111111-1111-1111-1111-111111111111/posts/1.jpg']);
select results_eq(
  $$ select pi.storage_path, pi.position::int from public.post_images pi join ids on ids.id = pi.content_id
     where ids.name = 'image_post' order by pi.position $$,
  $$ values ('11111111-1111-1111-1111-111111111111/posts/2.jpg', 0), ('11111111-1111-1111-1111-111111111111/posts/1.jpg', 1) $$,
  'images keep the chosen order'
);
select throws_ok(
  $$ select public.create_post(image_paths => array[
       '11111111-1111-1111-1111-111111111111/posts/1.jpg', '11111111-1111-1111-1111-111111111111/posts/2.jpg',
       '11111111-1111-1111-1111-111111111111/posts/3.jpg', '11111111-1111-1111-1111-111111111111/posts/4.jpg',
       '11111111-1111-1111-1111-111111111111/posts/5.jpg']) $$,
  '22023', null, 'a post has at most four images'
);
select throws_ok(
  $$ select public.create_post(image_paths => array['22222222-2222-2222-2222-222222222222/posts/1.jpg']) $$,
  '42501', null, 'a post cannot use an image uploaded by someone else'
);

insert into ids select 'to_hide', public.create_post(body => 'Va fi ascuns');
insert into ids select 'dana_target', public.create_post(body => 'Pentru Dana');

-- Signed in as Dana: she follows Ana and reacts before Ana blocks her.
set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select lives_ok($$ select public.set_follow('11111111-1111-1111-1111-111111111111', true) $$, 'set_follow succeeds');
select lives_ok($$ select public.set_reaction((select id from ids where name = 'dana_target'), 'love') $$, 'set_reaction succeeds');
insert into ids select 'dana_post', public.create_post(body => 'Postarea Danei');

-- Signed in as Bogdan.
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select lives_ok($$ select public.set_reaction((select id from ids where name = 'ana_post'), 'love') $$, 'set_reaction succeeds');
select lives_ok($$ select public.set_reaction((select id from ids where name = 'ana_post'), 'okay') $$, 'set_reaction succeeds');
select results_eq(
  $$ select r.account_id::text, r.kind::text from public.reactions r join ids on ids.id = r.content_id
     where ids.name = 'ana_post' $$,
  $$ values ('22222222-2222-2222-2222-222222222222', 'okay') $$,
  'changing a reaction keeps one row with the new kind'
);
select lives_ok($$ select public.set_reaction((select id from ids where name = 'ana_post'), null) $$, 'set_reaction succeeds');
select is(
  (select count(*) from public.reactions r join ids on ids.id = r.content_id where ids.name = 'ana_post'),
  0::bigint, 'removing a reaction deletes its row'
);

select throws_ok(
  $$ select public.edit_post((select id from ids where name = 'ana_post'), 'Schimbat de Bogdan') $$,
  '42501', null, 'only the creator edits a post'
);
select throws_ok(
  $$ select public.delete_post((select id from ids where name = 'ana_post')) $$,
  '42501', null, 'only the creator deletes a post'
);

select lives_ok($$ select public.set_follow('11111111-1111-1111-1111-111111111111', true) $$, 'set_follow succeeds');
select is(
  (select count(*) from public.follows where follower_id = '22222222-2222-2222-2222-222222222222'
     and followed_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint, 'a reader follows an author'
);
select lives_ok(
  $$ select public.set_follow('33333333-3333-3333-3333-333333333333', true) $$, 'a reader follows a publication'
);
select throws_ok(
  $$ select public.set_follow('22222222-2222-2222-2222-222222222222', true) $$, '22023', null, 'nobody follows themselves'
);
select ok(
  (select bool_or((p ->> 'id')::uuid = (select id from ids where name = 'ana_post')) from public.feed_page() p),
  'the feed shows posts of followed accounts'
);
select lives_ok($$ select public.set_follow('33333333-3333-3333-3333-333333333333', false) $$, 'set_follow succeeds');
select is(
  (select count(*) from public.follows where follower_id = '22222222-2222-2222-2222-222222222222'
     and followed_id = '33333333-3333-3333-3333-333333333333'),
  0::bigint, 'unfollow removes the row'
);

insert into ids select 'reshare', public.create_post(body => 'Citiți asta', reshare_of => (select id from ids where name = 'ana_post'));
insert into ids select 'reshare_hidden', public.create_post(reshare_of => (select id from ids where name = 'to_hide'));
select is(
  (select public.get_post((select id from ids where name = 'reshare')) -> 'source' ->> 'id')::uuid,
  (select id from ids where name = 'ana_post'),
  'a reshare shows its visible source'
);

insert into ids select 'comment', public.add_comment((select id from ids where name = 'ana_post'), null, 'Frumos');
select lives_ok(
  $$ select public.add_comment((select id from ids where name = 'ana_post'), (select id from ids where name = 'comment'), 'Răspuns') $$,
  'a reply points to a comment on the same content'
);
select throws_ok(
  $$ select public.add_comment((select id from ids where name = 'linked_post'), (select id from ids where name = 'comment'), 'Greșit') $$,
  '22023', null, 'a reply cannot point to a comment on other content'
);

-- Signed in as Ana: she edits, blocks Dana and deletes a post.
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ select public.edit_comment((select id from ids where name = 'comment'), 'Schimbat de Ana') $$,
  '42501', null, 'only the writer edits a comment'
);
select lives_ok($$ select public.edit_post((select id from ids where name = 'ana_post'), 'Primul meu text, revizuit') $$, 'edit_post succeeds');
select is(
  (select p.body from public.posts p join ids on ids.id = p.content_id where ids.name = 'ana_post'),
  'Primul meu text, revizuit', 'the creator edits their post'
);

select lives_ok($$ select public.set_block('44444444-4444-4444-4444-444444444444', true) $$, 'set_block succeeds');
select is(
  (select count(*) from public.follows where follower_id = '44444444-4444-4444-4444-444444444444'),
  0::bigint, 'blocking removes an existing follow'
);
select is(
  (select count(*) from public.reactions where account_id = '44444444-4444-4444-4444-444444444444'),
  0::bigint, 'blocking removes existing reactions between the two'
);
select throws_ok(
  $$ select public.set_follow('44444444-4444-4444-4444-444444444444', true) $$,
  '42501', null, 'the blocker cannot follow the blocked account'
);
select throws_ok(
  $$ select public.set_reaction((select id from ids where name = 'dana_post'), 'love') $$,
  '42501', null, 'the blocker cannot react to the blocked account'
);
select throws_ok(
  $$ select public.add_comment((select id from ids where name = 'dana_post'), null, 'Hei') $$,
  '42501', null, 'the blocker cannot comment on the blocked account'
);

select lives_ok($$ select public.delete_post((select id from ids where name = 'ana_post')) $$, 'delete_post succeeds');
reset role;
update public.contents set hidden_at = now() where id = (select id from ids where name = 'to_hide');
set local role authenticated;

-- Signed in as Dana, now blocked by Ana.
set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

select throws_ok(
  $$ select public.set_follow('11111111-1111-1111-1111-111111111111', true) $$,
  '42501', null, 'the blocked account cannot follow the blocker'
);
select throws_ok(
  $$ select public.set_reaction((select id from ids where name = 'linked_post'), 'love') $$,
  '42501', null, 'the blocked account cannot react to the blocker'
);
select throws_ok(
  $$ select public.add_comment((select id from ids where name = 'linked_post'), null, 'Hei') $$,
  '42501', null, 'the blocked account cannot comment on the blocker'
);
select is(
  (select count(*) from public.contents where account_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint, 'the blocked account does not see the blocker''s posts'
);

-- Signed in as Bogdan, after Ana deleted her post and moderation hid another.
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  public.get_post((select id from ids where name = 'reshare')) -> 'source',
  'null'::jsonb, 'a reshare loses its source when the source is deleted'
);
select is(
  public.get_post((select id from ids where name = 'reshare_hidden')) -> 'source',
  'null'::jsonb, 'a reshare loses its source when the source is hidden'
);
select is(
  (select count(*) from public.comments c join ids on ids.id = c.content_id where ids.name = 'ana_post'),
  0::bigint, 'comments on a deleted post are no longer shown'
);
select throws_ok(
  $$ select public.create_post(reshare_of => (select id from ids where name = 'ana_post')) $$,
  '42501', null, 'a deleted post cannot be reshared'
);
select is(
  (select c.account_id from public.contents c join ids on ids.id = c.id where ids.name = 'reshare'),
  '22222222-2222-2222-2222-222222222222'::uuid, 'the reshare itself stays visible'
);

select * from finish();
rollback;
