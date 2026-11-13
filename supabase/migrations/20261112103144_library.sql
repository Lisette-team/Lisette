-- 04.1: personal library (shelves, per-entry public switch, inspirations), the ISBN cache in `works`
-- and "Is this the book?" suggestions. Catalogue books (ISBN lookup or manual add) are one shared,
-- public, published row with no owner (decided 2026-11-12); the person's entry stays private.

create type public.shelf as enum ('to_read', 'reading', 'read');

create table public.library_entries (
  user_id uuid references public.profiles (id) on delete cascade,
  work_id uuid references public.works (id) on delete cascade,
  shelf public.shelf not null default 'to_read',
  is_public boolean not null default false,
  is_inspiration boolean not null default false,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, work_id)
);

create index library_entries_work on public.library_entries (work_id);
create index library_entries_public on public.library_entries (user_id, updated_at desc) where is_public;

create trigger library_entries_updated_at
  before update on public.library_entries
  for each row execute function public.set_updated_at();

alter table public.library_entries enable row level security;

-- Every write goes through the functions below.
revoke insert, update, delete on public.library_entries from anon, authenticated;

-- Private by default: others see an entry only once it is public, and never across a block.
create policy library_entries_select on public.library_entries
  for select to authenticated
  using (user_id = auth.uid() or (is_public and not public.is_blocked_with(user_id)));

-- A book as the app shows it in the library, the scanner and the suggestions.
create function public.work_card(w public.works) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', w.id, 'title', w.title, 'authorNames', to_jsonb(w.author_names),
    'publisherName', w.publisher_name, 'isbn', w.isbn);
$$;

-- Digits only, so "978-0-14-032872-1" and "9780140328721" are the same ISBN.
create function public.clean_isbn(isbn text) returns text
language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(coalesce(isbn, ''), '[^0-9]', '', 'g'), '');
$$;

-- Cached books only; the isbn-lookup Edge Function asks Open Library on a miss. Null when unknown.
create function public.lookup_isbn(isbn text) returns jsonb
language sql stable set search_path = '' as $$
  select public.work_card(w) from public.works w where w.isbn = public.clean_isbn(lookup_isbn.isbn);
$$;

-- Service role only (the isbn-lookup Edge Function): caches one Open Library answer. The first answer
-- wins; an ISBN already on Lisette is returned unchanged, never overwritten or merged. Null when the
-- row holding the ISBN is not public, so the service role never hands a private work to the caller.
create function public.cache_isbn_work(isbn text, title text, author_names text[], publisher_name text,
  external_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  clean text := public.clean_isbn(cache_isbn_work.isbn);
begin
  insert into public.works (title, author_names, publisher_name, isbn, external_id, source, visibility, is_published)
  values (left(btrim(cache_isbn_work.title), 200),
          array(select btrim(n) from unnest(cache_isbn_work.author_names) n where btrim(n) <> ''),
          nullif(btrim(cache_isbn_work.publisher_name), ''), clean, cache_isbn_work.external_id,
          'isbn_lookup', 'public', true)
  on conflict on constraint works_isbn_key do nothing;
  return (select public.work_card(w) from public.works w where w.isbn = clean and w.visibility = 'public');
end;
$$;
revoke execute on function public.cache_isbn_work(text, text, text[], text, text) from public, anon, authenticated;
grant execute on function public.cache_isbn_work(text, text, text[], text, text) to service_role;

-- "Is this the book?": visible books with a similar title or author, best match first. Security
-- invoker, so another person's private project is never suggested.
create function public.find_similar_works(title text, author text default null) returns setof jsonb
language sql stable set search_path = '' as $$
  select public.work_card(w)
  from public.works w
  where w.title operator(extensions.%) btrim(find_similar_works.title)
     or (nullif(btrim(find_similar_works.author), '') is not null
         and public.names_to_text(w.author_names) operator(extensions.%) btrim(find_similar_works.author))
  order by greatest(
    extensions.similarity(w.title, btrim(find_similar_works.title)),
    extensions.similarity(public.names_to_text(w.author_names), coalesce(btrim(find_similar_works.author), ''))) desc,
    w.title
  limit 5;
$$;

-- "New book": always a separate work, even when a similar one exists. Person accounts only. It never
-- takes an ISBN: only the isbn-lookup Edge Function sets one, through attach_isbn (ruling 2026-11-13).
create function public.create_catalogue_work(title text, authors text[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'only a person account adds books' using errcode = '42501';
  end if;
  insert into public.works (title, author_names, source, visibility, is_published)
  values (btrim(create_catalogue_work.title),
          array(select btrim(n) from unnest(create_catalogue_work.authors) n where btrim(n) <> ''),
          'manual', 'public', true)
  returning id into new_id;
  return new_id;
end;
$$;

-- Service role only (the isbn-lookup Edge Function, after Open Library answered "no record"): gives a
-- manual book without an ISBN its ISBN. False when the ISBN is already held by any book, public or
-- private, or the book is not such a manual book; the caller answers the same either way, so nobody
-- learns that a private work holds the ISBN.
create function public.attach_isbn(work_id uuid, isbn text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.works w set isbn = public.clean_isbn(attach_isbn.isbn)
  where w.id = attach_isbn.work_id and w.source = 'manual' and w.owner_id is null and w.isbn is null;
  return found;
exception when unique_violation then
  return false;
end;
$$;
revoke execute on function public.attach_isbn(uuid, text) from public, anon, authenticated;
grant execute on function public.attach_isbn(uuid, text) to service_role;

-- Adds a book to a shelf, or moves it: one entry per person and book. A new entry is private.
create function public.save_book(work_id uuid, shelf public.shelf) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'only a person account has a library' using errcode = '42501';
  end if;
  if not exists (select 1 from public.works w where w.id = save_book.work_id
                 and (w.visibility = 'public' or w.owner_id = auth.uid())) then
    raise exception 'this book cannot be saved' using errcode = '42501';
  end if;
  insert into public.library_entries (user_id, work_id, shelf) values (auth.uid(), save_book.work_id, save_book.shelf)
  on conflict on constraint library_entries_pkey do update set shelf = excluded.shelf;
end;
$$;

-- "Not in your library" is P0002 in the functions below; 22023 means the change itself is refused.

-- Only an entry for a public work can be shown on the profile, so a private title never leaks.
create function public.set_entry_public(work_id uuid, public boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.library_entries e
                 where e.user_id = auth.uid() and e.work_id = set_entry_public.work_id) then
    raise exception 'this book is not in your library' using errcode = 'P0002';
  end if;
  if set_entry_public.public and not exists (
    select 1 from public.works w where w.id = set_entry_public.work_id and w.visibility = 'public') then
    raise exception 'only an entry for a public book can be shown' using errcode = '22023';
  end if;
  update public.library_entries e set is_public = set_entry_public.public
  where e.user_id = auth.uid() and e.work_id = set_entry_public.work_id;
end;
$$;

-- Author accounts only. Marking does not publish the entry; the profile's Inspirations section (03.2) decides what to show.
create function public.set_inspiration(work_id uuid, is_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if set_inspiration.is_on and not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.author_enabled) then
    raise exception 'only an author marks inspirations' using errcode = '42501';
  end if;
  update public.library_entries e set is_inspiration = set_inspiration.is_on
  where e.user_id = auth.uid() and e.work_id = set_inspiration.work_id;
  if not found then
    raise exception 'this book is not in your library' using errcode = 'P0002';
  end if;
end;
$$;

-- Removes the entry only; the work stays for everyone else.
create function public.remove_book(work_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.library_entries e where e.user_id = auth.uid() and e.work_id = remove_book.work_id;
  if not found then
    raise exception 'this book is not in your library' using errcode = 'P0002';
  end if;
end;
$$;

-- "What the authors you follow are reading": public entries of followed accounts, newest first.
-- Security invoker: the entry policy drops private entries and blocked accounts either way.
create function public.followed_library(page_size int default 20) returns setof jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'accountId', e.user_id, 'name', public.account_name(e.user_id),
    'workId', w.id, 'title', w.title, 'authorNames', to_jsonb(w.author_names),
    'shelf', e.shelf, 'updatedAt', e.updated_at)
  from public.library_entries e
  join public.works w on w.id = e.work_id
  join public.follows f on f.followed_id = e.user_id and f.follower_id = auth.uid()
  where e.is_public and e.user_id <> auth.uid()
  order by e.updated_at desc
  limit least(greatest(followed_library.page_size, 1), 50);
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
    'follows', (select coalesce(jsonb_agg(f), '[]') from public.follows f where f.follower_id = uid),
    'library_entries', (select coalesce(jsonb_agg(e), '[]') from public.library_entries e where e.user_id = uid)
  );
end;
$$;
