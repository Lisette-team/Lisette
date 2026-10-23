-- 01.1: accounts (one per login) and minimal person profiles.

create type public.app_locale as enum ('ro', 'en');
create type public.account_kind as enum ('person', 'publisher');

create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  kind public.account_kind not null,
  locale public.app_locale not null,
  suspended_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references public.accounts (id) on delete cascade,
  display_name text not null check (btrim(display_name) <> '' and char_length(display_name) <= 80)
);

alter table public.accounts enable row level security;
alter table public.profiles enable row level security;

-- No insert/update/delete policies: rows are written only by the functions below.
create policy accounts_select_own on public.accounts
  for select to authenticated using (id = auth.uid());

create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- Sign-up sends display_name (required) and locale (defaults to ro) as user metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.accounts (id, kind, locale)
  values (new.id, 'person', coalesce(new.raw_user_meta_data ->> 'locale', 'ro')::public.app_locale);
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.get_session_context() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('accountId', a.id, 'kind', a.kind, 'locale', a.locale)
  from public.accounts a
  where a.id = auth.uid();
$$;

create function public.set_locale(locale public.app_locale) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.accounts a set locale = set_locale.locale where a.id = auth.uid();
end;
$$;
