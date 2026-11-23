create table public.submission_inbox (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  opened_at timestamptz
);
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  history_id uuid unique references public.submission_status_history(id),
  stood_out text, could_improve text, observations text,
  created_at timestamptz not null default now(),
  check (length(coalesce(stood_out,'') || coalesce(could_improve,'') || coalesce(observations,'')) <= 2000),
  check (nullif(btrim(coalesce(stood_out,'') || coalesce(could_improve,'') || coalesce(observations,'')), '') is not null)
);
alter table public.submission_inbox enable row level security;
alter table public.evaluations enable row level security;
create policy inbox_publisher on public.submission_inbox for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id and s.publisher_id = auth.uid()));
create policy evaluation_participants on public.evaluations for select to authenticated using (
  exists (select 1 from public.submissions s where s.id = submission_id));

create function public.author_submission_opened() returns table(submission_id uuid, opened boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, i.opened_at is not null from public.submissions s
  left join public.submission_inbox i on i.submission_id = s.id where s.author_id = auth.uid();
$$;

create function public.save_submission_evaluation(submission_id uuid, evaluation jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.submissions; event_id uuid := gen_random_uuid();
begin
  select * into s from public.submissions where id = save_submission_evaluation.submission_id for update;
  if s.id is null or s.publisher_id <> auth.uid() then raise exception 'not_owner' using errcode = '42501'; end if;
  if s.status = 'withdrawn' then raise exception 'invalid_transition'; end if;
  if jsonb_typeof(evaluation) <> 'object' or nullif(btrim(coalesce(evaluation->>'stood_out','') || coalesce(evaluation->>'could_improve','') || coalesce(evaluation->>'observations','')), '') is null then raise exception 'evaluation_required'; end if;
  if length(coalesce(evaluation->>'stood_out','') || coalesce(evaluation->>'could_improve','') || coalesce(evaluation->>'observations','')) > 2000 then raise exception 'evaluation_too_long'; end if;
  insert into public.evaluations (submission_id, stood_out, could_improve, observations)
    values (s.id, evaluation->>'stood_out', evaluation->>'could_improve', evaluation->>'observations')
  on conflict (submission_id) do update set stood_out = excluded.stood_out, could_improve = excluded.could_improve, observations = excluded.observations;
  perform public.enqueue_event('evaluation_added', s.id, 'evaluation_added:' || event_id, array[s.author_id], '{in_app}');
end;
$$;

create function public.transition_submission(submission_id uuid, target public.submission_status, evaluation jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.submissions; h uuid;
begin
  select * into s from public.submissions where id = transition_submission.submission_id for update;
  if s.id is null or s.publisher_id <> auth.uid() then raise exception 'not_owner' using errcode = '42501'; end if;
  if not ((s.status = 'submitted' and target in ('in_review','on_hold','selected','rejected')) or
          (s.status = 'in_review' and target in ('on_hold','selected','rejected')) or
          (s.status = 'on_hold' and target in ('in_review','selected','rejected')) or
          (s.status = 'selected' and target = 'rejected')) then raise exception 'invalid_transition'; end if;
  if target = 'selected' and evaluation is null and not exists (select 1 from public.evaluations e where e.submission_id = s.id) then raise exception 'evaluation_required'; end if;
  if evaluation is not null then
    if jsonb_typeof(evaluation) <> 'object' or nullif(btrim(coalesce(evaluation->>'stood_out','') || coalesce(evaluation->>'could_improve','') || coalesce(evaluation->>'observations','')), '') is null then raise exception 'evaluation_required'; end if;
    if length(coalesce(evaluation->>'stood_out','') || coalesce(evaluation->>'could_improve','') || coalesce(evaluation->>'observations','')) > 2000 then raise exception 'evaluation_too_long'; end if;
  end if;
  update public.submissions set status = target, status_changed_at = now() where id = s.id;
  insert into public.submission_status_history(submission_id, from_status, to_status, changed_by)
    values (s.id, s.status, target, auth.uid()) returning id into h;
  if evaluation is not null then
    insert into public.evaluations(submission_id, history_id, stood_out, could_improve, observations)
      values (s.id, h, evaluation->>'stood_out', evaluation->>'could_improve', evaluation->>'observations')
    on conflict (submission_id) do update set history_id = excluded.history_id, stood_out = excluded.stood_out, could_improve = excluded.could_improve, observations = excluded.observations;
  end if;
  perform public.enqueue_event('submission_status_changed', s.id, 'submission_status_changed:' || h, array[s.author_id], '{in_app}');
end;
$$;
create function public.withdraw_submission(submission_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.submissions; h uuid;
begin
  select * into s from public.submissions where id = withdraw_submission.submission_id for update;
  if s.id is null or s.author_id <> auth.uid() then raise exception 'not_owner' using errcode = '42501'; end if;
  if s.status not in ('submitted','in_review','on_hold','selected') then raise exception 'invalid_transition'; end if;
  update public.submissions set status = 'withdrawn', status_changed_at = now() where id = s.id;
  insert into public.submission_status_history(submission_id, from_status, to_status, changed_by)
    values (s.id, s.status, 'withdrawn', auth.uid()) returning id into h;
  perform public.enqueue_event('submission_status_changed', s.id, 'submission_status_changed:' || h, array[s.publisher_id], '{in_app}');
end;
$$;
revoke all on function public.author_submission_opened(), public.save_submission_evaluation(uuid,jsonb), public.transition_submission(uuid,public.submission_status,jsonb), public.withdraw_submission(uuid) from public, anon;
grant execute on function public.author_submission_opened(), public.save_submission_evaluation(uuid,jsonb), public.transition_submission(uuid,public.submission_status,jsonb), public.withdraw_submission(uuid) to authenticated;
