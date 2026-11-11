-- 01.3: works and their author/publisher links, the domain event log, data export and deletion requests.

create extension if not exists pg_trgm with schema extensions;

create type public.link_status as enum ('pending', 'confirmed', 'declined');
create type public.work_visibility as enum ('private', 'public');
create type public.work_source as enum ('author', 'isbn_lookup', 'manual');
create type public.notification_channel as enum ('in_app', 'email');
create type public.deletion_status as enum ('requested', 'in_review', 'completed');

create function public.is_valid_isbn13(isbn text) returns boolean
language sql immutable strict set search_path = '' as $$
  -- ISBN-13 is an EAN-13 in the 978/979 "Bookland" range; [0-9] because \d also matches non-ASCII digits.
  select case when isbn ~ '^97[89][0-9]{10}$' then (
    select sum(substr(isbn, i, 1)::int * (case when i % 2 = 0 then 3 else 1 end)) % 10 = 0
    from generate_series(1, 13) i)
  else false end;
$$;

-- array_to_string is only stable; the trigram index needs an immutable expression.
create function public.names_to_text(names text[]) returns text
language sql immutable set search_path = '' as $$
  select array_to_string(names, ' ');
$$;

create table public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> '' and char_length(title) <= 200),
  description text check (char_length(description) <= 2000),
  owner_id uuid references public.profiles (id),
  is_published boolean not null default false,
  isbn text unique check (public.is_valid_isbn13(isbn)),
  author_names text[] not null default '{}',
  language text check (language ~ '^[a-z]{2}$'),
  genre_id uuid references public.genres (id),
  cover_path text,
  visibility public.work_visibility not null default 'private',
  source public.work_source not null,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index works_title_trgm on public.works using gin (title extensions.gin_trgm_ops);
create index works_author_names_trgm on public.works using gin (public.names_to_text(author_names) extensions.gin_trgm_ops);
create index works_owner on public.works (owner_id);

create trigger works_updated_at
  before update on public.works
  for each row execute function public.set_updated_at();

create table public.work_authors (
  work_id uuid references public.works (id) on delete cascade,
  author_id uuid references public.profiles (id),
  status public.link_status not null default 'pending',
  primary key (work_id, author_id)
);

create table public.work_publishers (
  work_id uuid references public.works (id) on delete cascade,
  publisher_id uuid references public.publishers (id),
  status public.link_status not null default 'pending',
  primary key (work_id, publisher_id)
);

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null,
  subject_id uuid not null,
  recipient_ids uuid[] not null,
  channels public.notification_channel[] not null,
  created_at timestamptz not null default now()
);

create table public.account_deletion_requests (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  requested_at timestamptz not null default now(),
  status public.deletion_status not null default 'requested'
);

alter table public.works enable row level security;
alter table public.work_authors enable row level security;
alter table public.work_publishers enable row level security;
alter table public.domain_events enable row level security;
alter table public.account_deletion_requests enable row level security;

-- Writes go through functions; later tasks add the editing paths they need.
create policy works_select on public.works
  for select to authenticated using (visibility = 'public' or owner_id = auth.uid());

-- The works subquery applies the works policy, so links of private works stay hidden.
create policy work_authors_select on public.work_authors
  for select to authenticated
  using (author_id = auth.uid() or (status = 'confirmed' and exists (select 1 from public.works w where w.id = work_id)));

create policy work_publishers_select on public.work_publishers
  for select to authenticated
  using (publisher_id = auth.uid() or (status = 'confirmed' and exists (select 1 from public.works w where w.id = work_id)));

revoke all on public.domain_events from anon, authenticated;

create policy account_deletion_requests_select_own on public.account_deletion_requests
  for select to authenticated using (account_id = auth.uid());

create function public.create_work(title text, description text default null, language text default null,
  genre_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  work_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and author_enabled) then
    raise exception 'only an author can create a work' using errcode = '42501';
  end if;
  insert into public.works (title, description, language, genre_id, owner_id, source)
  values (create_work.title, create_work.description, create_work.language, create_work.genre_id, auth.uid(), 'author')
  returning id into work_id;
  insert into public.work_authors (work_id, author_id, status) values (work_id, auth.uid(), 'confirmed');
  return work_id;
end;
$$;

-- Internal: called only from other database functions, inside their transaction.
create function public.enqueue_event(kind text, subject_id uuid, event_key text, recipient_ids uuid[],
  channels public.notification_channel[]) returns void
language sql set search_path = '' as $$
  insert into public.domain_events (kind, subject_id, event_key, recipient_ids, channels)
  values (kind, subject_id, event_key, recipient_ids, channels)
  on conflict (event_key) do nothing;
$$;
revoke execute on function public.enqueue_event(text, uuid, text, uuid[], public.notification_channel[])
  from public, anon, authenticated;

-- Queue only: retention rules are undecided, so nothing is deleted. Signing out every session
-- revokes refresh tokens; an access token already issued stays valid until it expires.
create function public.request_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.account_deletion_requests (account_id) values (auth.uid()) on conflict do nothing;
  delete from auth.sessions where user_id = auth.uid();
end;
$$;

-- Each later module adds its own rows here (create or replace). Security definer because some of the
-- caller's rows are not client-readable, so every query must filter on uid.
create function public.export_my_data() returns jsonb
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
    'account_deletion_request', (select to_jsonb(d) from public.account_deletion_requests d where d.account_id = uid)
  );
end;
$$;
