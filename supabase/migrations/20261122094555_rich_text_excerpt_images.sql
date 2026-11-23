create function public.plain_text(html text) returns text language sql immutable strict set search_path='' as $$
 select replace(replace(replace(replace(replace(replace(regexp_replace(regexp_replace(html, '<(/?(p|blockquote|ul|ol|li|h3)|br)[^>]*>', ' ', 'gi'), '<[^>]*>', '', 'g'), '&nbsp;', ' '), '&#39;', chr(39)), '&quot;', chr(34)), '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
$$;
alter table public.posts drop constraint posts_body_check;
alter table public.posts add constraint posts_body_check check (char_length(body)<=9000 and char_length(public.plain_text(body))<=3000);
alter table public.text_versions drop constraint text_versions_body_check;
alter table public.text_versions add constraint text_versions_body_check check (btrim(public.plain_text(body))<>'' and char_length(body)<=30000 and char_length(public.plain_text(body))<=10000);
alter table public.text_versions add column image_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('excerpt-images','excerpt-images',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy excerpt_images_insert on storage.objects for insert to authenticated with check (bucket_id='excerpt-images' and (storage.foldername(name))[1]=auth.uid()::text);
create or replace function public.create_post(body text default null, image_paths text[] default null,
  work_id uuid default null, reshare_of uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  text_body text := nullif(btrim(create_post.body), '');
  image_count int := coalesce(cardinality(create_post.image_paths), 0);
  new_id uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if image_count > 1 then
    raise exception 'a post has at most one image' using errcode = '22023';
  end if;
  if text_body is null and image_count = 0 and create_post.reshare_of is null then
    raise exception 'a post needs text, an image or a reshare' using errcode = '22023';
  end if;
  if create_post.work_id is not null
     and not exists (select 1 from public.works w where w.id = create_post.work_id and w.visibility = 'public') then
    raise exception 'only a public work can be linked' using errcode = '42501';
  end if;
  if create_post.reshare_of is not null and (not public.can_view_content(create_post.reshare_of) or exists (select 1 from public.excerpts e where e.content_id=create_post.reshare_of and e.audience <> 'public')) then
    raise exception 'this content cannot be reshared' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(create_post.image_paths) path
    where path not like uid::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'public-media' and o.name = path)
  ) then
    raise exception 'images must be uploaded by the poster' using errcode = '42501';
  end if;

  insert into public.contents (kind, account_id, work_id) values ('post', uid, create_post.work_id)
  returning id into new_id;
  insert into public.posts (content_id, body, reshare_of) values (new_id, text_body, create_post.reshare_of);
  insert into public.post_images (content_id, storage_path, position)
  select new_id, path, (n - 1)::smallint from unnest(create_post.image_paths) with ordinality as t(path, n);
  return new_id;
end;
$$;


create or replace function public.revise_excerpt(excerpt_id uuid, body text, image_path text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare vid uuid;
begin
 if not exists(select 1 from public.contents c join public.excerpts e on e.content_id=c.id where c.id=revise_excerpt.excerpt_id and c.account_id=auth.uid() and c.deleted_at is null and e.share_kind <> 'beta_pages') then raise exception 'not_allowed' using errcode='42501'; end if;
 if image_path is not null and (image_path not like auth.uid()::text || '/%' or not exists(select 1 from storage.objects o where o.bucket_id='excerpt-images' and o.name=image_path)) then raise exception 'not_allowed' using errcode='42501'; end if;
 insert into public.text_versions(excerpt_id,body,sha256,image_path) values(revise_excerpt.excerpt_id,revise_excerpt.body,encode(extensions.digest(convert_to(revise_excerpt.body,'UTF8'),'sha256'),'hex'),revise_excerpt.image_path) returning id into vid;
 return vid;
end $$;
drop function public.revise_excerpt(uuid,text);

drop function public.create_processed_share(uuid,uuid,public.share_kind,public.excerpt_source,uuid,text,public.audience,uuid,integer,integer,double precision,text,text);
create or replace function public.create_processed_share(actor uuid, work_id uuid, share_kind public.share_kind, source public.excerpt_source,
 submission_id uuid, body text, audience public.audience, manuscript_version_id uuid, page_start integer, page_end integer,
 provenance_score double precision, source_text text, pages_path text, image_path text default null) returns uuid
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare eid uuid; vid uuid; rid uuid; previous_claims text;
begin
 if actor is null or share_kind not in ('synopsis','excerpt','beta_pages') or audience is null then raise exception 'invalid_request'; end if;
 if source='own_work' then
   if submission_id is not null or not exists(select 1 from public.works w where w.id=work_id and w.owner_id=actor) then raise exception 'not_allowed' using errcode='42501'; end if;
 elsif source='own_book' then
   if submission_id is not null or not exists(select 1 from public.works w where w.id=work_id and w.is_published and (exists(select 1 from public.work_authors a where a.work_id=w.id and a.author_id=actor and a.status='confirmed') or exists(select 1 from public.work_publishers p where p.work_id=w.id and p.publisher_id=actor and p.status='confirmed'))) then raise exception 'not_allowed' using errcode='42501'; end if;
 elsif source='received_manuscript' then
   if not exists(select 1 from public.submissions s where s.id=submission_id and s.work_id=work_id and s.publisher_id=actor and s.version_id=manuscript_version_id and s.status in ('submitted','in_review','on_hold','selected')) then raise exception 'not_allowed' using errcode='42501'; end if;
 else raise exception 'not_allowed' using errcode='42501'; end if;
 if manuscript_version_id is not null and not exists(select 1 from public.manuscript_versions mv where mv.id=manuscript_version_id and mv.work_id=work_id and (page_end is null or page_end<=mv.page_count)) then raise exception 'invalid_version'; end if;
 if share_kind='beta_pages' and (source<>'own_work' or manuscript_version_id is null or page_start is null or page_end is null or pages_path is null) then raise exception 'invalid_pages'; end if;
 if share_kind='beta_pages' and page_start=1 and exists(select 1 from public.manuscript_versions mv where mv.id=manuscript_version_id and mv.page_count=page_end) then raise exception 'invalid_pages'; end if;
 if image_path is not null and (share_kind='beta_pages' or image_path not like actor::text || '/%' or not exists(select 1 from storage.objects o where o.bucket_id='excerpt-images' and o.name=image_path)) then raise exception 'invalid_image'; end if;
 if share_kind<>'beta_pages' and pages_path is not null then raise exception 'invalid_pages'; end if;
 insert into public.contents(kind,account_id,work_id) values('excerpt',actor,work_id) returning id into eid;
 insert into public.excerpts(content_id,share_kind,source,submission_id,audience) values(eid,share_kind,source,submission_id,audience);
 insert into public.text_versions(excerpt_id,body,sha256,manuscript_version_id,page_start,page_end,provenance_score,image_path)
 values(eid,body,encode(extensions.digest(convert_to(body,'UTF8'),'sha256'),'hex'),manuscript_version_id,page_start,page_end,provenance_score,image_path) returning id into vid;
 insert into public.share_private(text_version_id,source_text,pages_path) values(vid,source_text,pages_path);
 previous_claims:=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 rid:=public.request_sharing(vid);
 if source<>'received_manuscript' and not exists(select 1 from public.sharing_decisions d where d.request_id=rid) then perform public.publish_excerpt(vid); end if;
 perform set_config('request.jwt.claims',coalesce(previous_claims,'{}'),true);
 return eid;
end $$;

revoke all on function public.create_processed_share(uuid,uuid,public.share_kind,public.excerpt_source,uuid,text,public.audience,uuid,integer,integer,double precision,text,text,text) from public,anon,authenticated;
grant execute on function public.create_processed_share(uuid,uuid,public.share_kind,public.excerpt_source,uuid,text,public.audience,uuid,integer,integer,double precision,text,text,text) to service_role;
create or replace function public.post_card(content_id uuid, with_source boolean default true) returns jsonb
language plpgsql stable set search_path = '' as $$
begin
  if exists(select 1 from public.contents c where c.id=post_card.content_id and c.kind='excerpt') then
    return (select jsonb_build_object('id',c.id,'accountId',c.account_id,'authorName',public.account_name(c.account_id),
      'authorKind',(select pub.kind from public.publishers pub where pub.id=c.account_id),'createdAt',c.created_at,'updatedAt',c.updated_at,
      'body',v.body,'text_version_id',v.id,'has_image',v.image_path is not null,'shareVersionId',case when e.share_kind='beta_pages' then v.id end,'provenanceScore',v.provenance_score,'pageStart',v.page_start,'pageEnd',v.page_end,'workId',c.work_id,'workTitle',(select w.title from public.works w where w.id=c.work_id),
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

create or replace function public.sharing_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'not_signed_in' using errcode='42501'; end if;
 return jsonb_build_object(
 'works', (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'source',x.source,'submissionId',x.submission_id,
   'versions',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'label',v.label,'pages',v.page_count) order by v.uploaded_at desc),'[]'::jsonb) from public.manuscript_versions v where v.work_id=x.id and (x.source='own_work' or (x.source='received_manuscript' and v.id=(select s.version_id from public.submissions s where s.id=x.submission_id)))),
   'restrictions',(select coalesce(jsonb_agg(jsonb_build_object('publisher',p.name,'policy',s.accepted_policy->>'sharing_policy')),'[]'::jsonb) from public.submissions s join public.publishers p on p.id=s.publisher_id join public.works w on w.id=s.work_id where s.work_id=x.id and w.owner_id=auth.uid() and s.status in ('submitted','in_review','on_hold','selected') and s.accepted_policy->>'sharing_policy' <> 'author_controlled'))),'[]'::jsonb) from (
   select w.id,w.title,'own_work'::text source,null::uuid submission_id from public.works w where w.owner_id=auth.uid() and exists(select 1 from public.manuscript_versions v where v.work_id=w.id)
   union all select w.id,w.title,'own_book',null::uuid from public.works w where w.is_published and (exists(select 1 from public.work_authors a where a.work_id=w.id and a.author_id=auth.uid() and a.status='confirmed') or exists(select 1 from public.work_publishers p where p.work_id=w.id and p.publisher_id=auth.uid() and p.status='confirmed'))
   union all select w.id,w.title,'received_manuscript',s.id from public.works w join public.submissions s on s.work_id=w.id where s.publisher_id=auth.uid() and s.status in ('submitted','in_review','on_hold','selected')
 ) x),
 'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'workId',w.id,'versionId',v.id,'text_version_id',v.id,'has_image',v.image_path is not null,'excerptId',e.content_id,'body',v.body,'title',w.title,'source',e.source,'kind',e.share_kind,'pageStart',v.page_start,'pageEnd',v.page_end,'score',v.provenance_score,'requestedBy',r.requested_by,'authorDecision',r.author_decision,'isAuthor',w.owner_id=auth.uid(),'published',e.published_version_id=v.id,
 'diff',case when v.provenance_score < 0.9 and exists(select 1 from public.sharing_decisions d where d.request_id=r.id and d.publisher_id=auth.uid()) then (select coalesce(jsonb_agg(jsonb_build_object('word',word,'found',strpos(lower(coalesce(sp.source_text,'')),lower(word))>0)),'[]'::jsonb) from regexp_split_to_table(v.body,'\s+') word) else null end,
 'decisions',(select coalesce(jsonb_agg(jsonb_build_object('submissionId',d.submission_id,'publisherId',d.publisher_id,'publisher',p.name,'decision',d.decision,'status',s.status)),'[]'::jsonb) from public.sharing_decisions d join public.publishers p on p.id=d.publisher_id join public.submissions s on s.id=d.submission_id where d.request_id=r.id and (d.publisher_id=auth.uid() or w.owner_id=auth.uid()))) order by r.created_at desc),'[]'::jsonb)
 from public.sharing_requests r join public.text_versions v on v.id=r.text_version_id join public.excerpts e on e.content_id=v.excerpt_id join public.works w on w.id=r.work_id left join public.share_private sp on sp.text_version_id=v.id where public.can_view_sharing_request(r.id)));
end $$;

