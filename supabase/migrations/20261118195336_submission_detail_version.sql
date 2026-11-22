create or replace function public.submission_detail(submission_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'status', s.status, 'version_id', s.version_id, 'submitted_at', s.submitted_at,
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
