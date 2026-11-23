-- 02.2: calls. Every way into a publication is a call; `closes_at` empty means always open. Writes go
-- through save_call / publish_call / cancel_call, so a call and its genres change together.

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.publishers (id),
  title text not null check (btrim(title) <> '' and char_length(title) <= 200),
  description text check (char_length(description) <= 5000),
  opens_at timestamptz not null,
  closes_at timestamptz,
  -- NULL entries become '?' and the length check catches an entry holding several codes ("ro,en").
  accepted_languages text[] not null check (
    cardinality(accepted_languages) >= 1
    and array_to_string(accepted_languages, ',', '?') ~ '^[a-z]{2}(,[a-z]{2})*$'
    and char_length(array_to_string(accepted_languages, ',', '?')) = 3 * cardinality(accepted_languages) - 1),
  req_full_manuscript boolean not null default true,
  req_synopsis boolean not null default false,
  req_sample boolean not null default false,
  req_genre boolean not null default false,
  req_author_intro boolean not null default false,
  published_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or closes_at > opens_at)
);

create index calls_publisher on public.calls (publisher_id);

create trigger calls_updated_at
  before update on public.calls
  for each row execute function public.set_updated_at();

-- No rows = any genre.
create table public.call_genres (
  call_id uuid not null references public.calls (id) on delete cascade,
  genre_id uuid not null references public.genres (id),
  primary key (call_id, genre_id)
);

-- The owner sees all her calls; everyone else only published, uncancelled calls of an approved publisher.
alter table public.calls enable row level security;
alter table public.call_genres enable row level security;

create policy calls_select on public.calls
  for select to authenticated
  using (publisher_id = auth.uid()
    or (published_at is not null and cancelled_at is null and public.can_receive_submissions(publisher_id)));

-- The calls subquery applies the calls policy.
create policy call_genres_select on public.call_genres
  for select to authenticated
  using (exists (select 1 from public.calls c where c.id = call_id));

create function public.call_is_open(c public.calls, at timestamptz default now()) returns boolean
language sql stable set search_path = '' as $$
  select c.published_at is not null and c.cancelled_at is null and c.opens_at <= at
    and (c.closes_at is null or c.closes_at > at) and public.can_receive_submissions(c.publisher_id);
$$;

-- Internal: locks the caller's own call for a change.
create function public.lock_own_call(call_id uuid) returns public.calls
language plpgsql security definer set search_path = '' as $$
declare
  c public.calls;
begin
  select * into c from public.calls where id = lock_own_call.call_id for update;
  if c.id is null or c.publisher_id is distinct from auth.uid() then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if c.cancelled_at is not null then
    raise exception 'call_cancelled';
  end if;
  return c;
end;
$$;
revoke execute on function public.lock_own_call(uuid) from public, anon, authenticated;

-- A null call_id creates a draft. A pending publisher may prepare and publish calls; they show as open
-- only after approval. Editing a published call never changes what earlier submissions accepted.
create function public.save_call(call_id uuid, title text, description text, opens_at timestamptz,
  closes_at timestamptz, accepted_languages text[], req_full_manuscript boolean, req_synopsis boolean,
  req_sample boolean, req_genre boolean, req_author_intro boolean, genre_ids uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  saved_id uuid := save_call.call_id;
begin
  if not exists (select 1 from public.publishers p where p.id = auth.uid()) then
    raise exception 'not_publisher' using errcode = '42501';
  end if;
  if saved_id is null then
    insert into public.calls (publisher_id, title, description, opens_at, closes_at, accepted_languages,
      req_full_manuscript, req_synopsis, req_sample, req_genre, req_author_intro)
    values (auth.uid(), btrim(save_call.title), nullif(btrim(save_call.description), ''),
      coalesce(save_call.opens_at, now()), save_call.closes_at, save_call.accepted_languages,
      save_call.req_full_manuscript, save_call.req_synopsis, save_call.req_sample, save_call.req_genre,
      save_call.req_author_intro)
    returning id into saved_id;
  else
    perform public.lock_own_call(saved_id);
    update public.calls c
    set title = btrim(save_call.title), description = nullif(btrim(save_call.description), ''),
      opens_at = coalesce(save_call.opens_at, c.opens_at), closes_at = save_call.closes_at,
      accepted_languages = save_call.accepted_languages, req_full_manuscript = save_call.req_full_manuscript,
      req_synopsis = save_call.req_synopsis, req_sample = save_call.req_sample, req_genre = save_call.req_genre,
      req_author_intro = save_call.req_author_intro
    where c.id = saved_id;
    delete from public.call_genres cg where cg.call_id = saved_id;
  end if;
  insert into public.call_genres (call_id, genre_id)
  select distinct saved_id, g from unnest(coalesce(save_call.genre_ids, '{}')) g;
  return saved_id;
end;
$$;

create function public.publish_call(call_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_own_call(publish_call.call_id);
  update public.calls c set published_at = coalesce(c.published_at, now()) where c.id = publish_call.call_id;
end;
$$;

create function public.cancel_call(call_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_own_call(cancel_call.call_id);
  update public.calls c set cancelled_at = now() where c.id = cancel_call.call_id;
end;
$$;

-- Catalogue, tab "Open calls". Invoker rights: the calls and publishers policies apply.
create view public.open_calls with (security_invoker = true) as
select c.id, c.publisher_id, p.name as publisher_name, p.kind as publisher_kind, p.sharing_policy,
  c.title, c.description, c.opens_at, c.closes_at, c.accepted_languages,
  c.req_full_manuscript, c.req_synopsis, c.req_sample, c.req_genre, c.req_author_intro,
  coalesce((select array_agg(cg.genre_id) from public.call_genres cg where cg.call_id = c.id), '{}') as genre_ids
from public.calls c
join public.publishers p on p.id = c.publisher_id
where public.call_is_open(c);

-- Catalogue, tab "Publications": approved publishers only.
create view public.catalogue_publishers with (security_invoker = true) as
select p.id, p.name, p.kind, p.intro, p.logo_path,
  coalesce((select array_agg(pg.genre_id) from public.publisher_genres pg where pg.publisher_id = p.id), '{}')
    as genre_ids,
  (select count(*) from public.open_calls oc where oc.publisher_id = p.id) as open_call_count,
  coalesce((select array_agg(distinct l order by l) from public.open_calls oc, unnest(oc.accepted_languages) l
            where oc.publisher_id = p.id), '{}') as languages
from public.publishers p
where p.approval_status = 'approved';
