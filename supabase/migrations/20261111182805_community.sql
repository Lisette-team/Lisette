-- 03.3: the shared content base, posts with images and reshares, reactions, comments and follows.
-- `contents` is shared with excerpts (03.1): add the excerpt condition to can_view_content, never a second rule.

create type public.content_kind as enum ('post', 'excerpt');
create type public.reaction_kind as enum ('love', 'okay', 'dislike');

-- Public images (posts now; avatars, logos and covers later). Each account uploads only under its own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-media', 'public-media', true, 5242880, '{image/jpeg,image/png,image/webp}');

create policy public_media_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  account_id uuid not null references public.accounts (id) on delete cascade,
  work_id uuid references public.works (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  hidden_at timestamptz
);

create index contents_account_created on public.contents (account_id, created_at desc, id desc);
create index contents_work on public.contents (work_id) where work_id is not null;

create table public.posts (
  content_id uuid primary key references public.contents (id) on delete cascade,
  body text check (char_length(body) <= 3000),
  reshare_of uuid references public.contents (id)
);

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.posts (content_id) on delete cascade,
  storage_path text not null,
  position smallint not null check (position between 0 and 3),
  unique (content_id, position)
);

create table public.reactions (
  account_id uuid references public.accounts (id) on delete cascade,
  content_id uuid references public.contents (id) on delete cascade,
  kind public.reaction_kind not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, content_id)
);

create index reactions_content on public.reactions (content_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete cascade,
  parent_id uuid references public.comments (id),
  account_id uuid not null references public.accounts (id) on delete cascade,
  body text not null check (btrim(body) <> '' and char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  hidden_at timestamptz
);

create index comments_content on public.comments (content_id, created_at);

create trigger comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

create table public.follows (
  follower_id uuid references public.accounts (id) on delete cascade,
  followed_id uuid references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index follows_followed on public.follows (followed_id);

alter table public.contents enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;

-- Every write goes through the functions below.
revoke insert, update, delete on public.contents, public.posts, public.post_images, public.reactions,
  public.comments, public.follows from anon, authenticated;

-- The one visibility rule for every kind of content. Posts are always public; until 03.1 adds the
-- excerpt audience and approval condition, an excerpt is visible to its creator only.
create function public.can_view_content(content_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.contents c
    where c.id = can_view_content.content_id
      and c.deleted_at is null and c.hidden_at is null
      and not public.is_blocked(auth.uid(), c.account_id)
      and (c.kind = 'post' or c.account_id = auth.uid()));
$$;

create policy contents_select on public.contents
  for select to authenticated using (public.can_view_content(id));
create policy posts_select on public.posts
  for select to authenticated using (public.can_view_content(content_id));
create policy post_images_select on public.post_images
  for select to authenticated using (public.can_view_content(content_id));
create policy reactions_select on public.reactions
  for select to authenticated using (public.can_view_content(content_id) and not public.is_blocked_with(account_id));
create policy comments_select on public.comments
  for select to authenticated
  using (deleted_at is null and hidden_at is null and public.can_view_content(content_id)
    and not public.is_blocked_with(account_id));
create policy follows_select on public.follows
  for select to authenticated
  using (not public.is_blocked_with(follower_id) and not public.is_blocked_with(followed_id));

-- work_id is only what the poster picked, and only a public work (a private title must not leak).
-- Images must already be uploaded under the caller's own public-media folder.
create function public.create_post(body text default null, image_paths text[] default null,
  work_id uuid default null, reshare_of uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  text_body text := nullif(btrim(create_post.body), '');
  image_count int := coalesce(cardinality(create_post.image_paths), 0);
  new_id uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if image_count > 4 then
    raise exception 'a post has at most four images' using errcode = '22023';
  end if;
  if text_body is null and image_count = 0 and create_post.reshare_of is null then
    raise exception 'a post needs text, an image or a reshare' using errcode = '22023';
  end if;
  if create_post.work_id is not null
     and not exists (select 1 from public.works w where w.id = create_post.work_id and w.visibility = 'public') then
    raise exception 'only a public work can be linked' using errcode = '42501';
  end if;
  if create_post.reshare_of is not null and not public.can_view_content(create_post.reshare_of) then
    raise exception 'this content cannot be reshared' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(create_post.image_paths) path
    where path not like uid::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'public-media' and o.name = path)
  ) then
    raise exception 'images must be uploaded by the poster' using errcode = '42501';
  end if;

  insert into public.contents (kind, account_id, work_id) values ('post', uid, create_post.work_id)
  returning id into new_id;
  insert into public.posts (content_id, body, reshare_of) values (new_id, text_body, create_post.reshare_of);
  insert into public.post_images (content_id, storage_path, position)
  select new_id, path, (n - 1)::smallint from unnest(create_post.image_paths) with ordinality as t(path, n);
  return new_id;
end;
$$;

create function public.edit_post(content_id uuid, body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  text_body text := nullif(btrim(edit_post.body), '');
begin
  update public.posts p set body = text_body
  from public.contents c
  where c.id = p.content_id and c.id = edit_post.content_id
    and c.account_id = auth.uid() and c.deleted_at is null and c.hidden_at is null;
  if not found then
    raise exception 'only the creator can edit this post' using errcode = '42501';
  end if;
  if text_body is null and not exists (
    select 1 from public.posts p where p.content_id = edit_post.content_id and p.reshare_of is not null
    union all
    select 1 from public.post_images i where i.content_id = edit_post.content_id
  ) then
    raise exception 'a post needs text, an image or a reshare' using errcode = '22023';
  end if;
  update public.contents c set updated_at = now() where c.id = edit_post.content_id;
end;
$$;

create function public.delete_post(content_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.contents c set deleted_at = now()
  where c.id = delete_post.content_id and c.kind = 'post' and c.account_id = auth.uid() and c.deleted_at is null;
  if not found then
    raise exception 'only the creator can delete this post' using errcode = '42501';
  end if;
end;
$$;

-- kind null removes the caller's reaction.
create function public.set_reaction(content_id uuid, kind public.reaction_kind) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if set_reaction.kind is null then
    delete from public.reactions r where r.account_id = auth.uid() and r.content_id = set_reaction.content_id;
    return;
  end if;
  if not public.can_view_content(set_reaction.content_id) then
    raise exception 'cannot react to this content' using errcode = '42501';
  end if;
  insert into public.reactions (account_id, content_id, kind) values (auth.uid(), set_reaction.content_id, set_reaction.kind)
  on conflict on constraint reactions_pkey do update set kind = excluded.kind, updated_at = now();
end;
$$;

create function public.add_comment(content_id uuid, parent_id uuid, body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  parent public.comments;
  new_id uuid;
begin
  if not public.can_view_content(add_comment.content_id) then
    raise exception 'cannot comment on this content' using errcode = '42501';
  end if;
  if add_comment.parent_id is not null then
    select * into parent from public.comments c
    where c.id = add_comment.parent_id and c.content_id = add_comment.content_id
      and c.deleted_at is null and c.hidden_at is null;
    if not found then
      raise exception 'a reply must answer a comment on the same content' using errcode = '22023';
    end if;
    if public.is_blocked(auth.uid(), parent.account_id) then
      raise exception 'cannot reply to this comment' using errcode = '42501';
    end if;
  end if;
  insert into public.comments (content_id, parent_id, account_id, body)
  values (add_comment.content_id, add_comment.parent_id, auth.uid(), btrim(add_comment.body))
  returning id into new_id;
  return new_id;
end;
$$;

create function public.edit_comment(comment_id uuid, body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.comments c set body = btrim(edit_comment.body)
  where c.id = edit_comment.comment_id and c.account_id = auth.uid() and c.deleted_at is null and c.hidden_at is null;
  if not found then
    raise exception 'only the writer can edit this comment' using errcode = '42501';
  end if;
end;
$$;

create function public.delete_comment(comment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.comments c set deleted_at = now()
  where c.id = delete_comment.comment_id and c.account_id = auth.uid() and c.deleted_at is null;
  if not found then
    raise exception 'only the writer can delete this comment' using errcode = '42501';
  end if;
end;
$$;

create function public.set_follow(target_id uuid, following boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if set_follow.target_id = auth.uid() then
    raise exception 'an account cannot follow itself' using errcode = '22023';
  end if;
  if not following then
    delete from public.follows f where f.follower_id = auth.uid() and f.followed_id = set_follow.target_id;
    return;
  end if;
  if not exists (select 1 from public.accounts a where a.id = set_follow.target_id) then
    raise exception 'no such account' using errcode = '22023';
  end if;
  if public.is_blocked(auth.uid(), set_follow.target_id) then
    raise exception 'cannot follow this account' using errcode = '42501';
  end if;
  insert into public.follows (follower_id, followed_id) values (auth.uid(), set_follow.target_id) on conflict do nothing;
end;
$$;

-- Blocking now also removes follows and reactions between the two; unblocking restores neither.
create or replace function public.set_block(target_id uuid, blocked boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if blocked then
    insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), target_id) on conflict do nothing;
    delete from public.follows f
    where (f.follower_id = auth.uid() and f.followed_id = set_block.target_id)
       or (f.follower_id = set_block.target_id and f.followed_id = auth.uid());
    delete from public.reactions r using public.contents c
    where c.id = r.content_id
      and ((r.account_id = auth.uid() and c.account_id = set_block.target_id)
        or (r.account_id = set_block.target_id and c.account_id = auth.uid()));
  else
    delete from public.blocks where blocker_id = auth.uid() and blocked_id = set_block.target_id;
  end if;
end;
$$;

-- Read side: security invoker, so the policies above decide what each part shows.
create function public.account_name(account_id uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce(
    (select coalesce(p.pen_name, p.display_name) from public.profiles p where p.id = account_name.account_id),
    (select pub.name from public.publishers pub where pub.id = account_name.account_id));
$$;

-- A post as the app shows it. The source of a reshare is null once the viewer cannot see it.
-- plpgsql because a SQL function body cannot call itself before it exists.
create function public.post_card(content_id uuid, with_source boolean default true) returns jsonb
language plpgsql stable set search_path = '' as $$
begin
  return (select jsonb_build_object(
    'id', c.id,
    'accountId', c.account_id,
    'authorName', public.account_name(c.account_id),
    'authorKind', (select pub.kind from public.publishers pub where pub.id = c.account_id),
    'createdAt', c.created_at,
    'updatedAt', c.updated_at,
    'body', p.body,
    'workId', c.work_id,
    'workTitle', (select w.title from public.works w where w.id = c.work_id),
    'images', (select coalesce(jsonb_agg(i.storage_path order by i.position), '[]')
               from public.post_images i where i.content_id = c.id),
    'reactions', (select coalesce(jsonb_object_agg(r.kind, r.n), '{}')
                  from (select r.kind, count(*) n from public.reactions r where r.content_id = c.id group by r.kind) r),
    'myReaction', (select r.kind from public.reactions r where r.content_id = c.id and r.account_id = auth.uid()),
    'commentCount', (select count(*) from public.comments cm where cm.content_id = c.id),
    'reshareOf', p.reshare_of,
    'source', case when with_source and p.reshare_of is not null
                   then public.post_card(p.reshare_of, false) end)
  from public.contents c
  join public.posts p on p.content_id = c.id
  where c.id = post_card.content_id);
end;
$$;

create function public.get_post(content_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select public.post_card(get_post.content_id);
$$;

-- Own posts and posts of followed accounts, newest first, paginated by (created_at, id).
create function public.feed_page(before_at timestamptz default null, before_id uuid default null,
  page_size int default 20) returns setof jsonb
language sql stable set search_path = '' as $$
  select public.post_card(c.id)
  from public.contents c
  where c.kind = 'post'
    and (c.account_id = auth.uid()
      or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followed_id = c.account_id))
    and (feed_page.before_at is null or (c.created_at, c.id) < (feed_page.before_at, feed_page.before_id))
  order by c.created_at desc, c.id desc
  limit least(greatest(feed_page.page_size, 1), 50);
$$;

create function public.get_comments(content_id uuid) returns setof jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', cm.id, 'parentId', cm.parent_id, 'accountId', cm.account_id,
    'authorName', public.account_name(cm.account_id), 'body', cm.body,
    'createdAt', cm.created_at, 'updatedAt', cm.updated_at)
  from public.comments cm
  where cm.content_id = get_comments.content_id
  order by cm.created_at, cm.id;
$$;

create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'account', (select to_jsonb(a) from public.accounts a where a.id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'private_contacts', (select to_jsonb(c) from public.private_contacts c where c.user_id = uid),
    'publisher', (select to_jsonb(p) - 'reviewed_by' from public.publishers p where p.id = uid),
    'publisher_genres', (select coalesce(jsonb_agg(g.code), '[]') from public.publisher_genres pg
                         join public.genres g on g.id = pg.genre_id where pg.publisher_id = uid),
    'blocks', (select coalesce(jsonb_agg(b), '[]') from public.blocks b where b.blocker_id = uid),
    'works', (select coalesce(jsonb_agg(w), '[]') from public.works w where w.owner_id = uid),
    'work_authors', (select coalesce(jsonb_agg(wa), '[]') from public.work_authors wa where wa.author_id = uid),
    'work_publishers', (select coalesce(jsonb_agg(wp), '[]') from public.work_publishers wp where wp.publisher_id = uid),
    'account_deletion_request', (select to_jsonb(d) from public.account_deletion_requests d where d.account_id = uid),
    'manuscript_versions', (select coalesce(jsonb_agg(mv), '[]') from public.manuscript_versions mv
                            join public.works w on w.id = mv.work_id where w.owner_id = uid),
    'contents', (select coalesce(jsonb_agg(c), '[]') from public.contents c where c.account_id = uid),
    'posts', (select coalesce(jsonb_agg(p), '[]') from public.posts p
              join public.contents c on c.id = p.content_id where c.account_id = uid),
    'post_images', (select coalesce(jsonb_agg(i), '[]') from public.post_images i
                    join public.contents c on c.id = i.content_id where c.account_id = uid),
    'reactions', (select coalesce(jsonb_agg(r), '[]') from public.reactions r where r.account_id = uid),
    'comments', (select coalesce(jsonb_agg(cm), '[]') from public.comments cm where cm.account_id = uid),
    'follows', (select coalesce(jsonb_agg(f), '[]') from public.follows f where f.follower_id = uid)
  );
end;
$$;
