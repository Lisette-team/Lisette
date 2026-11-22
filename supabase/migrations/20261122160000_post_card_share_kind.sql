-- The feed names what a share is ("shared a few pages from …"), so post_card returns the share kind.
create or replace function public.post_card(content_id uuid, with_source boolean default true) returns jsonb
language plpgsql stable set search_path = '' as $$
begin
  if exists(select 1 from public.contents c where c.id=post_card.content_id and c.kind='excerpt') then
    return (select jsonb_build_object('id',c.id,'accountId',c.account_id,'authorName',public.account_name(c.account_id),
      'authorKind',(select pub.kind from public.publishers pub where pub.id=c.account_id),'createdAt',c.created_at,'updatedAt',c.updated_at,
      'body',v.body,'text_version_id',v.id,'has_image',v.image_path is not null,'shareVersionId',case when e.share_kind='beta_pages' then v.id end,'shareKind',e.share_kind,'provenanceScore',v.provenance_score,'pageStart',v.page_start,'pageEnd',v.page_end,'workId',c.work_id,'workTitle',(select w.title from public.works w where w.id=c.work_id),
      'images','[]'::jsonb,'reactions',(select coalesce(jsonb_object_agg(r.kind,r.n),'{}') from (select r.kind,count(*) n from public.reactions r where r.content_id=c.id group by r.kind) r),
      'myReaction',(select r.kind from public.reactions r where r.content_id=c.id and r.account_id=auth.uid()),
      'commentCount',(select count(*) from public.comments cm where cm.content_id=c.id),'reshareOf',null,'source',null)
      from public.contents c join public.excerpts e on e.content_id=c.id join public.text_versions v on v.id=e.published_version_id
      where c.id=post_card.content_id and public.can_view_content(c.id));
  end if;
  return (select jsonb_build_object(
    'id', c.id,
    'accountId', c.account_id,
    'authorName', public.account_name(c.account_id),
    'authorKind', (select pub.kind from public.publishers pub where pub.id = c.account_id),
    'createdAt', c.created_at,
    'updatedAt', c.updated_at,
    'body', p.body,
    'workId', c.work_id,
    'workTitle', (select w.title from public.works w where w.id = c.work_id),
    'images', (select coalesce(jsonb_agg(i.storage_path order by i.position), '[]')
               from public.post_images i where i.content_id = c.id),
    'reactions', (select coalesce(jsonb_object_agg(r.kind, r.n), '{}')
                  from (select r.kind, count(*) n from public.reactions r where r.content_id = c.id group by r.kind) r),
    'myReaction', (select r.kind from public.reactions r where r.content_id = c.id and r.account_id = auth.uid()),
    'commentCount', (select count(*) from public.comments cm where cm.content_id = c.id),
    'reshareOf', p.reshare_of,
    'source', case when with_source and p.reshare_of is not null
                   then public.post_card(p.reshare_of, false) end)
  from public.contents c
  join public.posts p on p.content_id = c.id
  where c.id = post_card.content_id);
end;
$$;
