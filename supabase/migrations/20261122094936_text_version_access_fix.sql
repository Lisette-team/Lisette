drop policy text_versions_select on public.text_versions;
create policy text_versions_select on public.text_versions for select to authenticated using (
 exists(select 1 from public.excerpts e where e.content_id=text_versions.excerpt_id and e.published_version_id=text_versions.id and public.can_view_content(e.content_id))
 or exists(select 1 from public.contents c where c.id=text_versions.excerpt_id and c.account_id=auth.uid())
 or exists(select 1 from public.sharing_requests r where r.text_version_id=text_versions.id and public.can_view_sharing_request(r.id))
);
