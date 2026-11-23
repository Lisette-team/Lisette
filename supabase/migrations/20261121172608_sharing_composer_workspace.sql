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
 'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'workId',w.id,'versionId',v.id,'excerptId',e.content_id,'body',v.body,'title',w.title,'source',e.source,'kind',e.share_kind,'pageStart',v.page_start,'pageEnd',v.page_end,'score',v.provenance_score,'requestedBy',r.requested_by,'authorDecision',r.author_decision,'isAuthor',w.owner_id=auth.uid(),'published',e.published_version_id=v.id,
 'diff',case when v.provenance_score < 0.9 and exists(select 1 from public.sharing_decisions d where d.request_id=r.id and d.publisher_id=auth.uid()) then (select coalesce(jsonb_agg(jsonb_build_object('word',word,'found',strpos(lower(coalesce(sp.source_text,'')),lower(word))>0)),'[]'::jsonb) from regexp_split_to_table(v.body,'\s+') word) else null end,
 'decisions',(select coalesce(jsonb_agg(jsonb_build_object('submissionId',d.submission_id,'publisherId',d.publisher_id,'publisher',p.name,'decision',d.decision,'status',s.status)),'[]'::jsonb) from public.sharing_decisions d join public.publishers p on p.id=d.publisher_id join public.submissions s on s.id=d.submission_id where d.request_id=r.id and (d.publisher_id=auth.uid() or w.owner_id=auth.uid()))) order by r.created_at desc),'[]'::jsonb)
 from public.sharing_requests r join public.text_versions v on v.id=r.text_version_id join public.excerpts e on e.content_id=v.excerpt_id join public.works w on w.id=r.work_id left join public.share_private sp on sp.text_version_id=v.id where public.can_view_sharing_request(r.id)));
end $$;

create or replace function public.publish_excerpt(text_version_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.contents; e public.excerpts; r public.sharing_requests; recipients uuid[];
begin
 select c0.* into c from public.text_versions v join public.contents c0 on c0.id=v.excerpt_id where v.id=publish_excerpt.text_version_id and c0.account_id=auth.uid() for update of c0;
 select * into e from public.excerpts where content_id=c.id for update;
 if c.id is null then raise exception 'not_allowed' using errcode='42501'; end if;
 perform 1 from public.works where id=c.work_id for update;
 if e.source='own_book' and not exists(select 1 from public.works w where w.id=c.work_id and w.is_published and (exists(select 1 from public.work_publishers wp where wp.work_id=w.id and wp.publisher_id=auth.uid() and wp.status='confirmed') or exists(select 1 from public.work_authors wa where wa.work_id=w.id and wa.author_id=auth.uid() and wa.status='confirmed'))) then raise exception 'not_allowed' using errcode='42501'; end if;
 select * into r from public.sharing_requests where sharing_requests.text_version_id=publish_excerpt.text_version_id;
 if r.id is null or (e.source='received_manuscript' and (r.author_decision is distinct from 'approved'::public.decision or not exists(select 1 from public.submissions s where s.id=e.submission_id and s.status in ('submitted','in_review','on_hold','selected')))) or
 (e.source <> 'own_book' and exists(select 1 from public.submissions s where s.work_id=c.work_id and s.publisher_id<>auth.uid() and s.status in ('submitted','in_review','on_hold','selected') and (s.accepted_policy->>'sharing_policy'='synopsis_and_excerpt_approval' or (e.share_kind='synopsis' and s.accepted_policy->>'sharing_policy'='synopsis_approval')) and not exists(select 1 from public.sharing_decisions d where d.request_id=r.id and d.submission_id=s.id and d.decision='approved'))) then raise exception 'approvals_required'; end if;
 if e.published_version_id=publish_excerpt.text_version_id then return; end if;
 update public.excerpts set published_version_id=publish_excerpt.text_version_id where content_id=c.id;
 select coalesce(array_agg(f.follower_id),'{}'::uuid[]) into recipients from public.follows f where f.followed_id=auth.uid() and not public.is_blocked(f.follower_id,auth.uid());
 perform public.enqueue_event('author_published',c.id,'author_published:'||publish_excerpt.text_version_id,recipients,'{in_app}');
end $$;

create or replace function public.submission_detail(submission_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'work_id', s.work_id, 'status', s.status, 'version_id', s.version_id, 'submitted_at', s.submitted_at,
    'work_title', w.title, 'version_label', v.label, 'author_name', pr.display_name, 'publisher_name', p.name, 'call_title', c.title,
    'contact_email', case when s.publisher_id = auth.uid() then s.contact_email end,
    'contact_phone', case when s.publisher_id = auth.uid() then s.contact_phone end,
    'accepted_policy', s.accepted_policy, 'opened', i.opened_at is not null,
    'history', (select coalesce(jsonb_agg(jsonb_build_object('status', h.to_status, 'changed_at', h.changed_at) order by h.changed_at), '[]') from public.submission_status_history h where h.submission_id = s.id),
    'evaluation', (select jsonb_build_object('stood_out', e.stood_out, 'could_improve', e.could_improve, 'observations', e.observations) from public.evaluations e where e.submission_id = s.id),
    'materials', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'body', m.body, 'has_file', m.storage_path is not null)), '[]') from public.submission_materials m where m.submission_id = s.id and (s.author_id = auth.uid() or s.status not in ('withdrawn','rejected')))
  ) from public.submissions s join public.works w on w.id = s.work_id
  join public.manuscript_versions v on v.id = s.version_id join public.profiles pr on pr.id = s.author_id join public.publishers p on p.id = s.publisher_id
  join public.calls c on c.id = s.call_id left join public.submission_inbox i on i.submission_id = s.id
  where s.id = submission_detail.submission_id and auth.uid() in (s.author_id, s.publisher_id);
$$;
revoke all on function public.submission_detail(uuid) from public, anon;
grant execute on function public.submission_detail(uuid) to authenticated;
