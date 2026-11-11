-- 01.2: account kinds, full person profile, publishers and their approval, admins, genres, blocks.

create type public.publisher_kind as enum ('publishing_house', 'literary_magazine', 'independent_editor');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.verification_method as enum ('official_email', 'direct_confirmation');
create type public.sharing_policy as enum ('author_controlled', 'synopsis_approval', 'synopsis_and_excerpt_approval');

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Links are [{kind: blog | website | social, url: https://...}].
create function public.valid_links(links jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(links) = 'array' and not exists (
    select 1 from jsonb_array_elements(links) e
    where jsonb_typeof(e) <> 'object'
      or coalesce(e ->> 'kind', '') not in ('blog', 'website', 'social')
      or coalesce(e ->> 'url', '') !~ '^https://\S+$'
  );
$$;

alter table public.profiles
  add column pen_name text check (char_length(pen_name) <= 80),
  add column avatar_path text,
  add column bio text check (char_length(bio) <= 1000),
  add column links jsonb not null default '[]' check (public.valid_links(links)),
  add column author_enabled boolean not null default false,
  add column author_activated_at timestamptz;

create table public.private_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  contact_email text not null check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  updated_at timestamptz not null default now()
);

create trigger private_contacts_updated_at
  before update on public.private_contacts
  for each row execute function public.set_updated_at();

create table public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.publishers (
  id uuid primary key references public.accounts (id) on delete cascade,
  kind public.publisher_kind not null,
  name text not null check (btrim(name) <> '' and char_length(name) <= 120),
  intro text check (char_length(intro) <= 2000),
  logo_path text,
  website text check (website ~ '^https://\S+$'),
  approval_status public.approval_status not null default 'pending',
  verification_method public.verification_method,
  reviewed_by uuid references public.admins (user_id),
  reviewed_at timestamptz,
  resubmission_allowed boolean not null default false,
  sharing_policy public.sharing_policy not null default 'author_controlled',
  created_at timestamptz not null default now()
);

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z_]+$'),
  name_ro text not null,
  name_en text not null
);

insert into public.genres (code, name_ro, name_en) values
  ('poetry', 'Poezie', 'Poetry'),
  ('short_fiction', 'Proză scurtă', 'Short fiction'),
  ('novel', 'Roman', 'Novel'),
  ('novella', 'Nuvelă', 'Novella'),
  ('essay', 'Eseu', 'Essay'),
  ('drama', 'Dramaturgie', 'Drama'),
  ('children', 'Literatură pentru copii', 'Children''s literature'),
  ('young_adult', 'Literatură young adult', 'Young adult'),
  ('memoir', 'Memorialistică', 'Memoir'),
  ('nonfiction', 'Non-ficțiune', 'Non-fiction'),
  ('sci_fi_fantasy', 'SF și fantasy', 'Science fiction and fantasy'),
  ('crime_thriller', 'Polițist și thriller', 'Crime and thriller');

create table public.publisher_genres (
  publisher_id uuid references public.publishers (id) on delete cascade,
  genre_id uuid references public.genres (id),
  primary key (publisher_id, genre_id)
);

create table public.blocks (
  blocker_id uuid references public.accounts (id) on delete cascade,
  blocked_id uuid references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.private_contacts enable row level security;
alter table public.admins enable row level security;
alter table public.publishers enable row level security;
alter table public.genres enable row level security;
alter table public.publisher_genres enable row level security;
alter table public.blocks enable row level security;

-- Owners edit only ordinary fields; roles, approval and review fields change through functions.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, pen_name, avatar_path, bio, links) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid());

revoke update on public.private_contacts from anon, authenticated;
grant update (contact_email, phone) on public.private_contacts to authenticated;
create policy private_contacts_select_own on public.private_contacts
  for select to authenticated using (user_id = auth.uid());
create policy private_contacts_update_own on public.private_contacts
  for update to authenticated using (user_id = auth.uid());

revoke all on public.admins from anon, authenticated;

revoke update on public.publishers from anon, authenticated;
grant update (kind, name, intro, logo_path, website, resubmission_allowed, sharing_policy)
  on public.publishers to authenticated;
-- reviewed_by would reveal who the admins are, so clients select listed columns only.
revoke select on public.publishers from anon, authenticated;
grant select (id, kind, name, intro, logo_path, website, approval_status, verification_method, reviewed_at,
  resubmission_allowed, sharing_policy, created_at) on public.publishers to authenticated;

-- Approval vouches for this name and kind, so the publisher cannot change them once reviewed.
create function public.publishers_identity_locked() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and old.approval_status <> 'pending'
     and (new.name is distinct from old.name or new.kind is distinct from old.kind) then
    raise exception 'name and kind cannot change after review' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger publishers_identity_locked
  before update of name, kind on public.publishers
  for each row execute function public.publishers_identity_locked();

create policy publishers_select on public.publishers
  for select to authenticated using (true);
create policy publishers_update_own on public.publishers
  for update to authenticated using (id = auth.uid());

create policy genres_select on public.genres
  for select to authenticated using (true);

create policy publisher_genres_select on public.publisher_genres
  for select to authenticated using (true);
create policy publisher_genres_insert_own on public.publisher_genres
  for insert to authenticated with check (publisher_id = auth.uid());
create policy publisher_genres_delete_own on public.publisher_genres
  for delete to authenticated using (publisher_id = auth.uid());

create policy blocks_select_own on public.blocks
  for select to authenticated using (blocker_id = auth.uid());

-- Sign-up metadata: display_name (required), locale (default ro), account_kind (default person),
-- publisher_kind (required for publishers). The kind is read only here, so it never changes later.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := new.raw_user_meta_data;
  kind public.account_kind := coalesce(meta ->> 'account_kind', 'person')::public.account_kind;
begin
  insert into public.accounts (id, kind, locale)
  values (new.id, kind, coalesce(meta ->> 'locale', 'ro')::public.app_locale);
  if kind = 'person' then
    insert into public.profiles (id, display_name) values (new.id, meta ->> 'display_name');
    insert into public.private_contacts (user_id, contact_email) values (new.id, new.email);
  else
    insert into public.publishers (id, kind, name)
    values (new.id, (meta ->> 'publisher_kind')::public.publisher_kind, meta ->> 'display_name');
  end if;
  return new;
end;
$$;

create or replace function public.get_session_context() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'accountId', a.id, 'kind', a.kind, 'locale', a.locale,
    'authorEnabled', p.author_enabled, 'approvalStatus', pub.approval_status)
  from public.accounts a
  left join public.profiles p on p.id = a.id
  left join public.publishers pub on pub.id = a.id
  where a.id = auth.uid();
$$;

create function public.activate_author() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p
  set author_enabled = true, author_activated_at = coalesce(p.author_activated_at, now())
  where p.id = auth.uid();
  if not found then
    raise exception 'only a signed-in person account can activate author' using errcode = '42501';
  end if;
end;
$$;

create function public.approve_publisher(publisher_id uuid, method public.verification_method) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if method is null then
    raise exception 'verification method is required' using errcode = '22004';
  end if;
  update public.publishers p
  set approval_status = 'approved', verification_method = method, reviewed_by = auth.uid(), reviewed_at = now()
  where p.id = approve_publisher.publisher_id and p.approval_status = 'pending';
  if not found then
    raise exception 'publisher is not pending' using errcode = '55000';
  end if;
end;
$$;

create function public.reject_publisher(publisher_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.publishers p
  set approval_status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where p.id = reject_publisher.publisher_id and p.approval_status = 'pending';
  if not found then
    raise exception 'publisher is not pending' using errcode = '55000';
  end if;
end;
$$;

create function public.can_receive_submissions(publisher_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.approval_status = 'approved' from public.publishers p where p.id = can_receive_submissions.publisher_id),
    false);
$$;

-- Internal: answers for any two accounts, so clients must not call it directly.
create function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
revoke execute on function public.is_blocked(uuid, uuid) from public, anon, authenticated;

-- Client-callable form for RLS policies and the app: answers only about the caller.
create function public.is_blocked_with(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_blocked(auth.uid(), other);
$$;

create function public.set_block(target_id uuid, blocked boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if blocked then
    insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), target_id) on conflict do nothing;
  else
    delete from public.blocks where blocker_id = auth.uid() and blocked_id = set_block.target_id;
  end if;
end;
$$;
