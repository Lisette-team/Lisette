-- 02.1: private manuscript PDFs. Bytes live in the private `manuscripts` bucket, which has no client
-- policy at all: the `manuscript-upload` and `manuscript-file` Edge Functions are the only way in or out.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manuscripts', 'manuscripts', false, 20971520, '{application/pdf}');

create table public.manuscript_versions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id),
  storage_path text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size between 1 and 20971520),
  page_count integer not null check (page_count > 0),
  label text check (char_length(label) <= 80),
  uploaded_at timestamptz not null default now()
);

create index manuscript_versions_work on public.manuscript_versions (work_id);

-- Immutable: no insert, update or delete policy. Only the owner of the work reads the metadata.
alter table public.manuscript_versions enable row level security;

create policy manuscript_versions_select_owner on public.manuscript_versions
  for select to authenticated
  using (exists (select 1 from public.works w where w.id = work_id and w.owner_id = auth.uid()));

-- Called only by the upload function, after it has verified the caller's session (uploader) and
-- stored the checked file. The owner rule stays here so it holds whatever calls it.
create function public.record_manuscript_version(uploader uuid, work_id uuid, storage_path text, sha256 text,
  byte_size integer, page_count integer, label text) returns public.manuscript_versions
language plpgsql set search_path = '' as $$
declare
  version public.manuscript_versions;
begin
  if not exists (select 1 from public.works w where w.id = record_manuscript_version.work_id and w.owner_id = uploader) then
    raise exception 'only the owner of the work can add a version' using errcode = '42501';
  end if;
  insert into public.manuscript_versions (work_id, storage_path, sha256, byte_size, page_count, label)
  values (record_manuscript_version.work_id, record_manuscript_version.storage_path, record_manuscript_version.sha256,
    record_manuscript_version.byte_size, record_manuscript_version.page_count, nullif(btrim(record_manuscript_version.label), ''))
  returning * into version;
  return version;
end;
$$;
revoke execute on function public.record_manuscript_version(uuid, uuid, text, text, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.record_manuscript_version(uuid, uuid, text, text, integer, integer, text) to service_role;

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
                            join public.works w on w.id = mv.work_id where w.owner_id = uid)
  );
end;
$$;
