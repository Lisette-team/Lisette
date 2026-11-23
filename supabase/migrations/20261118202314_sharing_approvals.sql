-- Exact text and decisions are written only by the functions below.
create type public.excerpt_source as enum ('own_work','own_book','received_manuscript');
create type public.share_kind as enum ('synopsis','excerpt','beta_pages');
create type public.audience as enum ('public','followers');
create type public.decision as enum ('pending','approved','refused');
create table public.excerpts (
 content_id uuid primary key references public.contents(id) on delete cascade,
 share_kind public.share_kind not null check (share_kind in ('synopsis','excerpt')),
 source public.excerpt_source not null, submission_id uuid references public.submissions(id),
 audience public.audience not null default 'public', published_version_id uuid,
 check ((source = 'received_manuscript') = (submission_id is not null))
);
create table public.text_versions (
 id uuid primary key default gen_random_uuid(), excerpt_id uuid not null references public.excerpts(content_id),
 body text not null check (btrim(body) <> '' and char_length(body) <= 10000), sha256 text not null,
 created_at timestamptz not null default now()
);
alter table public.excerpts add foreign key (published_version_id) references public.text_versions(id);
create table public.sharing_requests (
 id uuid primary key default gen_random_uuid(), requested_by uuid not null references public.accounts(id),
 work_id uuid not null references public.works(id), kind public.share_kind not null,
 text_version_id uuid unique references public.text_versions(id), beta_share_id uuid,
 author_decision public.decision, author_decided_at timestamptz, created_at timestamptz not null default now(),
 check (num_nonnulls(text_version_id,beta_share_id)=1)
);
create table public.sharing_decisions (
 request_id uuid references public.sharing_requests(id), submission_id uuid references public.submissions(id),
 publisher_id uuid not null references public.publishers(id), decision public.decision not null default 'pending',
 decided_at timestamptz, primary key(request_id,submission_id)
);
alter table public.excerpts enable row level security;
alter table public.text_versions enable row level security;
alter table public.sharing_requests enable row level security;
alter table public.sharing_decisions enable row level security;
revoke insert,update,delete on public.excerpts,public.text_versions,public.sharing_requests,public.sharing_decisions from anon,authenticated;

create or replace function public.can_view_content(content_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
 select 1 from public.contents c left join public.excerpts e on e.content_id=c.id
 where c.id=can_view_content.content_id and c.deleted_at is null and c.hidden_at is null
 and not public.is_blocked(auth.uid(),c.account_id)
 and (c.account_id=auth.uid() or c.kind='post' or
 (e.published_version_id is not null and (e.audience='public' or exists
 (select 1 from public.follows f where f.followed_id=c.account_id and f.follower_id=auth.uid())))))
$$;
create function public.can_view_sharing_request(rid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.sharing_requests r join public.works w on w.id=r.work_id
 where r.id=rid and (r.requested_by=auth.uid() or w.owner_id=auth.uid() or
 exists(select 1 from public.sharing_decisions d where d.request_id=r.id and d.publisher_id=auth.uid())))
$$;
create policy excerpts_select on public.excerpts for select to authenticated using (public.can_view_content(content_id));
create policy text_versions_select on public.text_versions for select to authenticated using (
 exists(select 1 from public.excerpts e where e.content_id=excerpt_id and e.published_version_id=id and public.can_view_content(e.content_id))
 or exists(select 1 from public.contents c where c.id=excerpt_id and c.account_id=auth.uid())
 or exists(select 1 from public.sharing_requests r where r.text_version_id=id and public.can_view_sharing_request(r.id)));
create policy sharing_requests_select on public.sharing_requests for select to authenticated using (public.can_view_sharing_request(id));
create policy sharing_decisions_select on public.sharing_decisions for select to authenticated using (public.can_view_sharing_request(request_id));

-- Serialise submission insertion and publication for the same work.
create function public.lock_submission_work() returns trigger language plpgsql security definer set search_path='' as $$
begin perform 1 from public.works where id=new.work_id for update; return new; end $$;
create trigger sharing_submission_lock before insert on public.submissions for each row execute function public.lock_submission_work();

create function public.create_excerpt(work_id uuid, share_kind public.share_kind, source public.excerpt_source,
 submission_id uuid, body text, audience public.audience) returns uuid
language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 if auth.uid() is null or create_excerpt.share_kind not in ('synopsis','excerpt') or create_excerpt.audience is null then raise exception 'invalid_request' using errcode='42501'; end if;
 if create_excerpt.source='own_work' then
   if create_excerpt.submission_id is not null or not exists(select 1 from public.works w where w.id=create_excerpt.work_id and w.owner_id=auth.uid()) then raise exception 'not_allowed' using errcode='42501'; end if;
 elsif create_excerpt.source='own_book' then
   if create_excerpt.submission_id is not null or not exists(select 1 from public.work_publishers wp join public.works w on w.id=wp.work_id where wp.work_id=create_excerpt.work_id and wp.publisher_id=auth.uid() and wp.status='confirmed' and w.is_published) then raise exception 'not_allowed' using errcode='42501'; end if;
 elsif create_excerpt.source='received_manuscript' then
   if not exists(select 1 from public.submissions s where s.id=create_excerpt.submission_id and s.work_id=create_excerpt.work_id and s.publisher_id=auth.uid() and s.status in ('submitted','in_review','on_hold','selected')) then raise exception 'not_allowed' using errcode='42501'; end if;
 else raise exception 'not_allowed' using errcode='42501'; end if;
 insert into public.contents(kind,account_id,work_id) values('excerpt',auth.uid(),create_excerpt.work_id) returning id into eid;
 insert into public.excerpts(content_id,share_kind,source,submission_id,audience) values(eid,create_excerpt.share_kind,create_excerpt.source,create_excerpt.submission_id,create_excerpt.audience);
 insert into public.text_versions(excerpt_id,body,sha256) values(eid,create_excerpt.body,encode(extensions.digest(convert_to(create_excerpt.body,'UTF8'),'sha256'),'hex'));
 return eid;
end $$;
create function public.revise_excerpt(excerpt_id uuid, body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare vid uuid;
begin
 if not exists(select 1 from public.contents where id=revise_excerpt.excerpt_id and account_id=auth.uid() and deleted_at is null) then raise exception 'not_allowed' using errcode='42501'; end if;
 insert into public.text_versions(excerpt_id,body,sha256) values(revise_excerpt.excerpt_id,revise_excerpt.body,encode(extensions.digest(convert_to(revise_excerpt.body,'UTF8'),'sha256'),'hex')) returning id into vid;
 return vid;
end $$;
create function public.request_sharing(text_version_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.contents; e public.excerpts; rid uuid;
begin
 select c0.* into c from public.text_versions v join public.contents c0 on c0.id=v.excerpt_id where v.id=request_sharing.text_version_id and c0.account_id=auth.uid();
 select * into e from public.excerpts where content_id=c.id;
 if c.id is null then raise exception 'not_allowed' using errcode='42501'; end if;
 perform 1 from public.works where id=c.work_id for update;
 insert into public.sharing_requests(requested_by,work_id,kind,text_version_id,author_decision) values(auth.uid(),c.work_id,e.share_kind,request_sharing.text_version_id,case when e.source='received_manuscript' then 'pending'::public.decision else null end)
 on conflict (text_version_id) do update set text_version_id=excluded.text_version_id returning id into rid;
 if e.source <> 'own_book' then
 insert into public.sharing_decisions(request_id,submission_id,publisher_id)
 select rid,s.id,s.publisher_id from public.submissions s where s.work_id=c.work_id and s.publisher_id<>auth.uid() and s.status in ('submitted','in_review','on_hold','selected')
 and (s.accepted_policy->>'sharing_policy'='synopsis_and_excerpt_approval' or (e.share_kind='synopsis' and s.accepted_policy->>'sharing_policy'='synopsis_approval'))
 on conflict do nothing;
 end if;
 return rid;
end $$;
create function public.decide_sharing(request_id uuid, submission_id uuid, approved boolean) returns void
language plpgsql security definer set search_path='' as $$
declare d public.sharing_decisions; requester uuid; choice public.decision;
begin
 choice:=case when approved then 'approved'::public.decision else 'refused'::public.decision end;
 select * into d from public.sharing_decisions x where x.request_id=decide_sharing.request_id and x.submission_id=decide_sharing.submission_id and x.publisher_id=auth.uid() for update;
 if d.request_id is null or approved is null or not exists(select 1 from public.submissions s where s.id=d.submission_id and s.status in ('submitted','in_review','on_hold','selected')) then raise exception 'not_allowed' using errcode='42501'; end if;
 if d.decision=choice then return; end if;
 if d.decision<>'pending' then raise exception 'already_decided'; end if;
 update public.sharing_decisions x set decision=choice,decided_at=now() where x.request_id=d.request_id and x.submission_id=d.submission_id;
 select requested_by into requester from public.sharing_requests where id=d.request_id;
 perform public.enqueue_event('sharing_decided',d.request_id,'sharing_decided:'||d.request_id||':'||d.submission_id,array[requester],'{in_app,email}');
end $$;
create function public.author_decide_quote(request_id uuid, approved boolean) returns void
language plpgsql security definer set search_path='' as $$
declare r public.sharing_requests; choice public.decision;
begin
 choice:=case when approved then 'approved'::public.decision else 'refused'::public.decision end;
 select r0.* into r from public.sharing_requests r0 join public.works w on w.id=r0.work_id join public.text_versions v on v.id=r0.text_version_id join public.excerpts e on e.content_id=v.excerpt_id join public.submissions s on s.id=e.submission_id where r0.id=author_decide_quote.request_id and w.owner_id=auth.uid() and e.source='received_manuscript' and s.status in ('submitted','in_review','on_hold','selected') for update of r0;
 if r.id is null or approved is null then raise exception 'not_allowed' using errcode='42501'; end if;
 if r.author_decision=choice then return; end if;
 if r.author_decision<>'pending' then raise exception 'already_decided'; end if;
 update public.sharing_requests set author_decision=choice,author_decided_at=now() where id=r.id;
 perform public.enqueue_event('sharing_decided',r.id,'sharing_author_decided:'||r.id,array[r.requested_by],'{in_app,email}');
end $$;
create function public.publish_excerpt(text_version_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.contents; e public.excerpts; r public.sharing_requests; recipients uuid[];
begin
 select c0.* into c from public.text_versions v join public.contents c0 on c0.id=v.excerpt_id where v.id=publish_excerpt.text_version_id and c0.account_id=auth.uid() for update of c0;
 select * into e from public.excerpts where content_id=c.id for update;
 if c.id is null then raise exception 'not_allowed' using errcode='42501'; end if;
 perform 1 from public.works where id=c.work_id for update;
 select * into r from public.sharing_requests where sharing_requests.text_version_id=publish_excerpt.text_version_id;
 if r.id is null or (e.source='received_manuscript' and (r.author_decision is distinct from 'approved'::public.decision or not exists(select 1 from public.submissions s where s.id=e.submission_id and s.status in ('submitted','in_review','on_hold','selected')))) or
 (e.source <> 'own_book' and exists(select 1 from public.submissions s where s.work_id=c.work_id and s.publisher_id<>auth.uid() and s.status in ('submitted','in_review','on_hold','selected') and (s.accepted_policy->>'sharing_policy'='synopsis_and_excerpt_approval' or (e.share_kind='synopsis' and s.accepted_policy->>'sharing_policy'='synopsis_approval')) and not exists(select 1 from public.sharing_decisions d where d.request_id=r.id and d.submission_id=s.id and d.decision='approved'))) then raise exception 'approvals_required'; end if;
 if e.published_version_id=publish_excerpt.text_version_id then return; end if;
 update public.excerpts set published_version_id=publish_excerpt.text_version_id where content_id=c.id;
 select coalesce(array_agg(f.follower_id),'{}'::uuid[]) into recipients from public.follows f where f.followed_id=auth.uid() and not public.is_blocked(f.follower_id,auth.uid());
 perform public.enqueue_event('author_published',c.id,'author_published:'||publish_excerpt.text_version_id,recipients,'{in_app}');
end $$;
