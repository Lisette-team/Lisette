-- One authenticated workspace returns only sources and requests available to the caller.
create function public.sharing_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'not_signed_in' using errcode='42501'; end if;
 return jsonb_build_object(
 'works', (select coalesce(jsonb_agg(x),'[]'::jsonb) from (
   select w.id,w.title,'own_work'::text source,null::uuid "submissionId" from public.works w where w.owner_id=auth.uid()
   union all select w.id,w.title,'own_book',null::uuid from public.works w join public.work_publishers wp on wp.work_id=w.id where wp.publisher_id=auth.uid() and wp.status='confirmed' and w.is_published
   union all select w.id,w.title,'received_manuscript',s.id from public.works w join public.submissions s on s.work_id=w.id where s.publisher_id=auth.uid() and s.status in ('submitted','in_review','on_hold','selected')
 ) x),
 'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'versionId',v.id,'excerptId',e.content_id,'body',v.body,'title',w.title,'source',e.source,'requestedBy',r.requested_by,'authorDecision',r.author_decision,'isAuthor',w.owner_id=auth.uid(),'published',e.published_version_id=v.id,'decisions',
  (select coalesce(jsonb_agg(jsonb_build_object('submissionId',d.submission_id,'publisherId',d.publisher_id,'publisher',p.name,'decision',d.decision,'status',s.status)),'[]'::jsonb) from public.sharing_decisions d join public.publishers p on p.id=d.publisher_id join public.submissions s on s.id=d.submission_id where d.request_id=r.id)) order by r.created_at desc),'[]'::jsonb)
 from public.sharing_requests r join public.text_versions v on v.id=r.text_version_id join public.excerpts e on e.content_id=v.excerpt_id join public.works w on w.id=r.work_id where public.can_view_sharing_request(r.id)));
end $$;
