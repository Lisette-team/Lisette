create or replace function public.save_submission_evaluation(submission_id uuid, evaluation jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.submissions; event_id uuid := gen_random_uuid();
begin
  select * into s from public.submissions where id = save_submission_evaluation.submission_id for update;
  if s.id is null or s.publisher_id <> auth.uid() then raise exception 'not_owner' using errcode = '42501'; end if;
  if s.status = 'withdrawn' then raise exception 'invalid_transition'; end if;
  if jsonb_typeof(evaluation) <> 'object' or nullif(regexp_replace(coalesce(evaluation->>'stood_out','') || coalesce(evaluation->>'could_improve','') || coalesce(evaluation->>'observations',''), '[[:space:]]', '', 'g'), '') is null then raise exception 'evaluation_required'; end if;
  if length(coalesce(evaluation->>'stood_out','') || coalesce(evaluation->>'could_improve','') || coalesce(evaluation->>'observations','')) > 2000 then raise exception 'evaluation_too_long'; end if;
  insert into public.evaluations (submission_id, stood_out, could_improve, observations)
    values (s.id, evaluation->>'stood_out', evaluation->>'could_improve', evaluation->>'observations')
  on conflict on constraint evaluations_submission_id_key do update set stood_out = excluded.stood_out, could_improve = excluded.could_improve, observations = excluded.observations;
  perform public.enqueue_event('evaluation_added', s.id, 'evaluation_added:' || event_id, array[s.author_id], '{in_app}');
end;
$$;

create or replace function public.transition_submission(submission_id uuid, target public.submission_status, evaluation jsonb default null) returns void
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
    if jsonb_typeof(evaluation) <> 'object' or nullif(regexp_replace(coalesce(evaluation->>'stood_out','') || coalesce(evaluation->>'could_improve','') || coalesce(evaluation->>'observations',''), '[[:space:]]', '', 'g'), '') is null then raise exception 'evaluation_required'; end if;
    if length(coalesce(evaluation->>'stood_out','') || coalesce(evaluation->>'could_improve','') || coalesce(evaluation->>'observations','')) > 2000 then raise exception 'evaluation_too_long'; end if;
  end if;
  update public.submissions set status = target, status_changed_at = now() where id = s.id;
  insert into public.submission_status_history(submission_id, from_status, to_status, changed_by)
    values (s.id, s.status, target, auth.uid()) returning id into h;
  if evaluation is not null then
    insert into public.evaluations(submission_id, history_id, stood_out, could_improve, observations)
      values (s.id, h, evaluation->>'stood_out', evaluation->>'could_improve', evaluation->>'observations')
    on conflict on constraint evaluations_submission_id_key do update set history_id = excluded.history_id, stood_out = excluded.stood_out, could_improve = excluded.could_improve, observations = excluded.observations;
  end if;
  perform public.enqueue_event('submission_status_changed', s.id, 'submission_status_changed:' || h, array[s.author_id], '{in_app}');
end;
$$;

alter table public.evaluations drop constraint evaluations_check1;
alter table public.evaluations add constraint evaluations_nonblank check (nullif(regexp_replace(coalesce(stood_out,'') || coalesce(could_improve,'') || coalesce(observations,''), '[[:space:]]', '', 'g'), '') is not null);
