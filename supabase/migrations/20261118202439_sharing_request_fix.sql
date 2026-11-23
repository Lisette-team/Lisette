create or replace function public.request_sharing(text_version_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.contents; e public.excerpts; rid uuid;
begin
 select c0.* into c from public.text_versions v join public.contents c0 on c0.id=v.excerpt_id where v.id=request_sharing.text_version_id and c0.account_id=auth.uid();
 select * into e from public.excerpts where content_id=c.id;
 if c.id is null then raise exception 'not_allowed' using errcode='42501'; end if;
 perform 1 from public.works where id=c.work_id for update;
 insert into public.sharing_requests(requested_by,work_id,kind,text_version_id,author_decision) values(auth.uid(),c.work_id,e.share_kind,request_sharing.text_version_id,case when e.source='received_manuscript' then 'pending'::public.decision else null end)
 on conflict on constraint sharing_requests_text_version_id_key do update set text_version_id=excluded.text_version_id returning id into rid;
 if e.source <> 'own_book' then
 insert into public.sharing_decisions(request_id,submission_id,publisher_id)
 select rid,s.id,s.publisher_id from public.submissions s where s.work_id=c.work_id and s.publisher_id<>auth.uid() and s.status in ('submitted','in_review','on_hold','selected')
 and (s.accepted_policy->>'sharing_policy'='synopsis_and_excerpt_approval' or (e.share_kind='synopsis' and s.accepted_policy->>'sharing_policy'='synopsis_approval'))
 on conflict do nothing;
 end if;
 return rid;
end $$;
