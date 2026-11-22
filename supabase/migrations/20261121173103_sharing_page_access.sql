create function public.can_read_shared_pages(version_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.text_versions v join public.excerpts e on e.content_id=v.excerpt_id join public.contents c on c.id=e.content_id
  where v.id=version_id and e.share_kind='beta_pages' and c.deleted_at is null and c.hidden_at is null
  and (c.account_id=auth.uid() or (e.published_version_id=v.id and public.can_view_content(c.id)) or exists (
    select 1 from public.sharing_requests r join public.sharing_decisions d on d.request_id=r.id join public.submissions s on s.id=d.submission_id
    where r.text_version_id=v.id and d.publisher_id=auth.uid() and s.status in ('submitted','in_review','on_hold','selected')
  ))
 );
$$;
