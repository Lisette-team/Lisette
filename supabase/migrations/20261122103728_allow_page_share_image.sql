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
 if image_path is not null and (image_path not like actor::text || '/%' or not exists(select 1 from storage.objects o where o.bucket_id='excerpt-images' and o.name=image_path)) then raise exception 'invalid_image'; end if;
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

