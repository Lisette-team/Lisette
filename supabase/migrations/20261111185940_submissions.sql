-- 02.2: submissions. A submission is one work, one fixed version, one call (and so one publisher). Rows
-- are created only by submit_manuscript; status changes come with 02.3. Nothing here is ever updated by
-- clients: there are no insert, update or delete policies.

create type public.submission_status as enum ('submitted', 'in_review', 'on_hold', 'selected', 'rejected', 'withdrawn');
create type public.material_kind as enum ('synopsis', 'sample', 'author_intro');

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id),
  work_id uuid not null references public.works (id),
  version_id uuid not null references public.manuscript_versions (id),
  publisher_id uuid not null references public.publishers (id),
  call_id uuid not null references public.calls (id),
  genre_id uuid references public.genres (id),
  status public.submission_status not null default 'submitted',
  contact_email text not null,
  contact_phone text not null,
  rights_declared_at timestamptz not null,
  contact_consent_at timestamptz not null,
  accepted_policy jsonb not null,
  idempotency_key uuid not null unique,
  submitted_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now()
);

-- One active submission per work and publisher, whatever the version or call.
create unique index submissions_one_active on public.submissions (work_id, publisher_id)
  where status in ('submitted', 'in_review', 'on_hold', 'selected');
create index submissions_author on public.submissions (author_id);
create index submissions_publisher on public.submissions (publisher_id);

-- Synopsis and sample are PDFs in the private bucket (storage_path); the author introduction is text (body).
create table public.submission_materials (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  kind public.material_kind not null,
  body text check (char_length(body) <= 5000),
  storage_path text,
  unique (submission_id, kind),
  check (body is not null or storage_path is not null)
);

create table public.submission_status_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  from_status public.submission_status,
  to_status public.submission_status not null,
  changed_by uuid not null references public.accounts (id),
  note text check (char_length(note) <= 1000),
  changed_at timestamptz not null default now()
);

create index submission_status_history_submission on public.submission_status_history (submission_id);

-- Readable only by the author and the recipient publisher.
alter table public.submissions enable row level security;
alter table public.submission_materials enable row level security;
alter table public.submission_status_history enable row level security;

create policy submissions_select on public.submissions
  for select to authenticated using (author_id = auth.uid() or publisher_id = auth.uid());
-- The recipient loses the materials once the submission is withdrawn or rejected; the author keeps them.
create policy submission_materials_select on public.submission_materials
  for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id
                 and (s.author_id = auth.uid() or s.status in ('submitted', 'in_review', 'on_hold', 'selected'))));
create policy submission_status_history_select on public.submission_status_history
  for select to authenticated using (exists (select 1 from public.submissions s where s.id = submission_id));

-- Internal: why this author cannot send this work to this call now, or null. Shared by the eligibility
-- check shown before sending and by submit_manuscript, so both say the same thing.
create function public.submission_block_reason(author uuid, work_id uuid, c public.calls, at timestamptz)
returns text
language sql stable security definer set search_path = '' as $$
  select case
    when not public.call_is_open(c, at) then 'call_not_open'
    when public.is_blocked(author, c.publisher_id) then 'blocked'
    when exists (select 1 from public.submissions s
                 where s.work_id = submission_block_reason.work_id and s.publisher_id = c.publisher_id
                   and s.status in ('submitted', 'in_review', 'on_hold', 'selected')) then 'duplicate_active'
    when exists (select 1 from public.submissions s
                 where s.work_id = submission_block_reason.work_id and s.publisher_id = c.publisher_id
                   and s.status in ('rejected', 'withdrawn'))
         and not (select p.resubmission_allowed from public.publishers p where p.id = c.publisher_id)
      then 'resubmission_not_allowed'
  end;
$$;
revoke execute on function public.submission_block_reason(uuid, uuid, public.calls, timestamptz)
  from public, anon, authenticated;

-- Shown before sending (S-24/S-25). submission_id is the existing active submission, for its link.
create function public.submission_eligibility(version_id uuid, call_ids uuid[])
returns table (call_id uuid, reason text, submission_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  work uuid;
begin
  select v.work_id into work from public.manuscript_versions v
  join public.works w on w.id = v.work_id
  where v.id = submission_eligibility.version_id and w.owner_id = auth.uid();
  if work is null then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return query
  -- Every requested id gets a row, so a hidden or unknown call looks the same as a closed one.
  select requested.id, r.reason,
    case when r.reason = 'duplicate_active' then
      (select s.id from public.submissions s where s.work_id = work and s.publisher_id = c.publisher_id
         and s.status in ('submitted', 'in_review', 'on_hold', 'selected'))
    end
  from unnest(submission_eligibility.call_ids) requested (id)
  left join public.calls c on c.id = requested.id
  cross join lateral (select case when c.id is null then 'call_not_open'
                                  else public.submission_block_reason(auth.uid(), work, c, now()) end as reason) r;
end;
$$;

-- materials: {"synopsis": "<storage path>", "sample": "<storage path>", "author_intro": "<text>"}, keys optional.
-- Repeating a request with the same idempotency_key returns the submission it created, so an unknown
-- outcome is resolved before a new attempt. Every rule is checked again on each call.
create function public.submit_manuscript(call_id uuid, version_id uuid, genre_id uuid, materials jsonb,
  idempotency_key uuid, rights_declared boolean, contact_consent boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  work uuid;
  c public.calls;
  phone text;
  email text;
  synopsis text := nullif(btrim(materials ->> 'synopsis'), '');
  sample text := nullif(btrim(materials ->> 'sample'), '');
  intro text := nullif(btrim(materials ->> 'author_intro'), '');
  reason text;
  new_id uuid;
  violated text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select s.id into new_id from public.submissions s
  where s.idempotency_key = submit_manuscript.idempotency_key and s.author_id = auth.uid();
  if new_id is not null then
    return new_id;
  end if;

  select v.work_id into work from public.manuscript_versions v
  join public.works w on w.id = v.work_id
  where v.id = submit_manuscript.version_id and w.owner_id = auth.uid();
  if work is null then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  -- The share lock makes a concurrent cancel or edit of the call wait until this submission commits.
  select * into c from public.calls where id = submit_manuscript.call_id for share;
  if c.id is null then
    raise exception 'call_not_open';
  end if;
  reason := public.submission_block_reason(auth.uid(), work, c, clock_timestamp());
  if reason = 'duplicate_active' then
    -- A concurrent request with the same key may have committed since the first lookup.
    select s.id into new_id from public.submissions s
    where s.idempotency_key = submit_manuscript.idempotency_key and s.author_id = auth.uid();
    if new_id is not null then
      return new_id;
    end if;
  end if;
  if reason is not null then
    raise exception '%', reason;
  end if;

  select pc.contact_email, pc.phone into email, phone from public.private_contacts pc where pc.user_id = auth.uid();
  if phone is null then
    raise exception 'missing_phone';
  end if;
  if not coalesce(rights_declared, false) or not coalesce(contact_consent, false) then
    raise exception 'missing_consent';
  end if;

  if jsonb_typeof(coalesce(materials, '{}')) <> 'object'
     or exists (select 1 from jsonb_each(coalesce(materials, '{}')) m
                where m.key not in ('synopsis', 'sample', 'author_intro') or jsonb_typeof(m.value) <> 'string') then
    raise exception 'invalid_material';
  end if;
  if (c.req_synopsis and synopsis is null) or (c.req_sample and sample is null)
     or (c.req_author_intro and intro is null) then
    raise exception 'missing_material';
  end if;
  -- A material PDF must be one this author uploaded through manuscript-upload.
  if exists (select 1 from unnest(array[synopsis, sample]) path
             where path is not null
               and (path not like auth.uid()::text || '/materials/%'
                    or not exists (select 1 from storage.objects o where o.bucket_id = 'manuscripts' and o.name = path))) then
    raise exception 'invalid_material';
  end if;
  if (c.req_genre and submit_manuscript.genre_id is null)
     or (submit_manuscript.genre_id is not null
         and not exists (select 1 from public.genres g where g.id = submit_manuscript.genre_id))
     or (submit_manuscript.genre_id is not null and exists (select 1 from public.call_genres cg where cg.call_id = c.id)
         and not exists (select 1 from public.call_genres cg where cg.call_id = c.id and cg.genre_id = submit_manuscript.genre_id)) then
    raise exception 'invalid_genre';
  end if;

  begin
    insert into public.submissions (author_id, work_id, version_id, publisher_id, call_id, genre_id, contact_email,
      contact_phone, rights_declared_at, contact_consent_at, accepted_policy, idempotency_key)
    values (auth.uid(), work, submit_manuscript.version_id, c.publisher_id, c.id, submit_manuscript.genre_id, email,
      phone, now(), now(),
      jsonb_build_object(
        'requirements', jsonb_build_object('full_manuscript', c.req_full_manuscript, 'synopsis', c.req_synopsis,
          'sample', c.req_sample, 'genre', c.req_genre, 'author_intro', c.req_author_intro),
        'sharing_policy', (select p.sharing_policy from public.publishers p where p.id = c.publisher_id)),
      submit_manuscript.idempotency_key)
    returning id into new_id;
    insert into public.submission_materials (submission_id, kind, body, storage_path)
    select new_id, m.kind, m.body, m.path
    from (values ('synopsis'::public.material_kind, null, synopsis), ('sample', null, sample),
                 ('author_intro', intro, null)) m (kind, body, path)
    where coalesce(m.body, m.path) is not null;
  exception
    when unique_violation then
      -- A concurrent request with the same key committed first: return what it created, whichever
      -- unique index Postgres happened to check first.
      select s.id into new_id from public.submissions s
      where s.idempotency_key = submit_manuscript.idempotency_key and s.author_id = auth.uid();
      if new_id is not null then
        return new_id;
      end if;
      get stacked diagnostics violated = constraint_name;
      if violated = 'submissions_one_active' then
        raise exception 'duplicate_active';
      end if;
      raise;
    when check_violation then
      raise exception 'invalid_material';
  end;

  insert into public.submission_status_history (submission_id, from_status, to_status, changed_by)
  values (new_id, null, 'submitted', auth.uid());
  perform public.enqueue_event('submission_status_changed', new_id,
    'submission_status_changed:' || new_id || ':submitted', array[c.publisher_id], '{in_app}');
  return new_id;
end;
$$;

create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'account', (select to_jsonb(a) from public.accounts a where a.id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'private_contacts', (select to_jsonb(c) from public.private_contacts c where c.user_id = uid),
    'publisher', (select to_jsonb(p) - 'reviewed_by' from public.publishers p where p.id = uid),
    'publisher_genres', (select coalesce(jsonb_agg(g.code), '[]') from public.publisher_genres pg
                         join public.genres g on g.id = pg.genre_id where pg.publisher_id = uid),
    'blocks', (select coalesce(jsonb_agg(b), '[]') from public.blocks b where b.blocker_id = uid),
    'works', (select coalesce(jsonb_agg(w), '[]') from public.works w where w.owner_id = uid),
    'work_authors', (select coalesce(jsonb_agg(wa), '[]') from public.work_authors wa where wa.author_id = uid),
    'work_publishers', (select coalesce(jsonb_agg(wp), '[]') from public.work_publishers wp where wp.publisher_id = uid),
    'account_deletion_request', (select to_jsonb(d) from public.account_deletion_requests d where d.account_id = uid),
    'manuscript_versions', (select coalesce(jsonb_agg(mv), '[]') from public.manuscript_versions mv
                            join public.works w on w.id = mv.work_id where w.owner_id = uid),
    'calls', (select coalesce(jsonb_agg(c), '[]') from public.calls c where c.publisher_id = uid),
    'submissions', (select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object(
                      'materials', (select coalesce(jsonb_agg(m), '[]') from public.submission_materials m
                                    where m.submission_id = s.id),
                      'history', (select coalesce(jsonb_agg(h), '[]') from public.submission_status_history h
                                  where h.submission_id = s.id))), '[]')
                    from public.submissions s where s.author_id = uid)
  );
end;
$$;
