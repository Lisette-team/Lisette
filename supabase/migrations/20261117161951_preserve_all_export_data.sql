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
