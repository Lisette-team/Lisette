create or replace function public.publish_excerpt(text_version_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.contents; e public.excerpts; r public.sharing_requests; recipients uuid[];
begin
 select c0.* into c from public.text_versions v join public.contents c0 on c0.id=v.excerpt_id where v.id=publish_excerpt.text_version_id and c0.account_id=auth.uid() for update of c0;
 select * into e from public.excerpts where content_id=c.id for update;
 if c.id is null then raise exception 'not_allowed' using errcode='42501'; end if;
 perform 1 from public.works where id=c.work_id for update;
 if e.source='own_book' and not exists(select 1 from public.work_publishers wp join public.works w on w.id=wp.work_id where wp.work_id=c.work_id and wp.publisher_id=auth.uid() and wp.status='confirmed' and w.is_published) then raise exception 'not_allowed' using errcode='42501'; end if;
 select * into r from public.sharing_requests where sharing_requests.text_version_id=publish_excerpt.text_version_id;
 if r.id is null or (e.source='received_manuscript' and (r.author_decision is distinct from 'approved'::public.decision or not exists(select 1 from public.submissions s where s.id=e.submission_id and s.status in ('submitted','in_review','on_hold','selected')))) or
 (e.source <> 'own_book' and exists(select 1 from public.submissions s where s.work_id=c.work_id and s.publisher_id<>auth.uid() and s.status in ('submitted','in_review','on_hold','selected') and (s.accepted_policy->>'sharing_policy'='synopsis_and_excerpt_approval' or (e.share_kind='synopsis' and s.accepted_policy->>'sharing_policy'='synopsis_approval')) and not exists(select 1 from public.sharing_decisions d where d.request_id=r.id and d.submission_id=s.id and d.decision='approved'))) then raise exception 'approvals_required'; end if;
 if e.published_version_id=publish_excerpt.text_version_id then return; end if;
 update public.excerpts set published_version_id=publish_excerpt.text_version_id where content_id=c.id;
 select coalesce(array_agg(f.follower_id),'{}'::uuid[]) into recipients from public.follows f where f.followed_id=auth.uid() and not public.is_blocked(f.follower_id,auth.uid());
 perform public.enqueue_event('author_published',c.id,'author_published:'||publish_excerpt.text_version_id,recipients,'{in_app}');
end $$;
