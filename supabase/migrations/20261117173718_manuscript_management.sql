create table public.work_preferences (
  work_id uuid primary key references public.works(id) on delete cascade,
  is_starred boolean not null default false,
  main_version_id uuid references public.manuscript_versions(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.work_preferences enable row level security;
create policy work_preferences_select_owner on public.work_preferences for select to authenticated
  using (exists (select 1 from public.works w where w.id = work_id and w.owner_id = auth.uid()));

create function public.set_work_starred(work_id uuid, starred boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.works w where w.id = work_id and w.owner_id = auth.uid();
  if not found then raise exception 'not_owner' using errcode = '42501'; end if;
  insert into public.work_preferences as pref (work_id, is_starred) values (work_id, starred)
    on conflict on constraint work_preferences_pkey do update set is_starred = excluded.is_starred, updated_at = now();
end $$;

create function public.set_main_version(work_id uuid, version_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.works w where w.id = work_id and w.owner_id = auth.uid() for update;
  if not found then raise exception 'not_owner' using errcode = '42501'; end if;
  if version_id is not null and not exists (select 1 from public.manuscript_versions v where v.id = version_id and v.work_id = set_main_version.work_id) then
    raise exception 'invalid_version';
  end if;
  insert into public.work_preferences as pref (work_id, main_version_id) values (work_id, version_id)
    on conflict on constraint work_preferences_pkey do update set main_version_id = excluded.main_version_id, updated_at = now();
end $$;

create function public.rename_work(work_id uuid, title text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.works w set title = rename_work.title where w.id = work_id and w.owner_id = auth.uid();
  if not found then raise exception 'not_owner' using errcode = '42501'; end if;
end $$;

create function public.delete_manuscript_version(version_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare path text;
begin
  select v.storage_path into path from public.manuscript_versions v join public.works w on w.id = v.work_id
    where v.id = version_id and w.owner_id = auth.uid() for update of v;
  if not found then raise exception 'not_owner' using errcode = '42501'; end if;
  if exists (select 1 from public.submissions s where s.version_id = delete_manuscript_version.version_id) then
    raise exception 'version_sent';
  end if;
  delete from public.manuscript_versions v where v.id = version_id;
  return path;
end $$;

create function public.delete_manuscript(work_id uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare paths text[];
begin
  perform 1 from public.works w where w.id = work_id and w.owner_id = auth.uid() for update;
  if not found then raise exception 'not_owner' using errcode = '42501'; end if;
  perform 1 from public.manuscript_versions v where v.work_id = delete_manuscript.work_id for update;
  if exists (select 1 from public.submissions s where s.work_id = delete_manuscript.work_id) then
    raise exception 'work_sent';
  end if;
  select coalesce(array_agg(v.storage_path), '{}') into paths from public.manuscript_versions v where v.work_id = delete_manuscript.work_id;
  delete from public.manuscript_versions v where v.work_id = delete_manuscript.work_id;
  delete from public.works w where w.id = work_id;
  return paths;
exception when foreign_key_violation then raise exception 'work_in_use';
end $$;

create function public.my_submissions() returns table (id uuid, status public.submission_status, submitted_at timestamptz,
  status_changed_at timestamptz, work_title text, version_id uuid, version_label text, call_title text,
  publisher_name text, publisher_kind public.publisher_kind)
language sql stable security definer set search_path = '' as $$
  select s.id, s.status, s.submitted_at, s.status_changed_at, w.title, v.id, v.label, c.title, p.name, p.kind
  from public.submissions s join public.works w on w.id = s.work_id
  join public.manuscript_versions v on v.id = s.version_id join public.calls c on c.id = s.call_id
  join public.publishers p on p.id = s.publisher_id where s.author_id = auth.uid() order by s.submitted_at desc;
$$;
revoke all on function public.set_work_starred(uuid,boolean), public.set_main_version(uuid,uuid), public.rename_work(uuid,text), public.delete_manuscript_version(uuid), public.delete_manuscript(uuid), public.my_submissions() from public, anon;
grant execute on function public.set_work_starred(uuid,boolean), public.set_main_version(uuid,uuid), public.rename_work(uuid,text), public.delete_manuscript_version(uuid), public.delete_manuscript(uuid), public.my_submissions() to authenticated;


-- Preserve exports from submissions, community, and the library.
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
    'work_preferences', (select coalesce(jsonb_agg(p), '[]') from public.work_preferences p
                         join public.works w on w.id = p.work_id where w.owner_id = uid),
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
    'calls', (select coalesce(jsonb_agg(c), '[]') from public.calls c where c.publisher_id = uid),
    'submissions', (select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object(
                      'materials', (select coalesce(jsonb_agg(m), '[]') from public.submission_materials m
                                    where m.submission_id = s.id),
                      'history', (select coalesce(jsonb_agg(h), '[]') from public.submission_status_history h
                                  where h.submission_id = s.id))), '[]')
                    from public.submissions s where s.author_id = uid),
    'library_entries', (select coalesce(jsonb_agg(e), '[]') from public.library_entries e where e.user_id = uid)
  );
end;
$$;
