create or replace function public.create_post(body text default null, image_paths text[] default null,
  work_id uuid default null, reshare_of uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  text_body text := nullif(btrim(create_post.body), '');
  image_count int := coalesce(cardinality(create_post.image_paths), 0);
  new_id uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if image_count > 4 then
    raise exception 'a post has at most four images' using errcode = '22023';
  end if;
  if text_body is null and image_count = 0 and create_post.reshare_of is null then
    raise exception 'a post needs text, an image or a reshare' using errcode = '22023';
  end if;
  if create_post.work_id is not null
     and not exists (select 1 from public.works w where w.id = create_post.work_id and w.visibility = 'public') then
    raise exception 'only a public work can be linked' using errcode = '42501';
  end if;
  if create_post.reshare_of is not null and (not public.can_view_content(create_post.reshare_of) or exists (select 1 from public.excerpts e where e.content_id=create_post.reshare_of and e.audience <> 'public')) then
    raise exception 'this content cannot be reshared' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(create_post.image_paths) path
    where path not like uid::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'public-media' and o.name = path)
  ) then
    raise exception 'images must be uploaded by the poster' using errcode = '42501';
  end if;

  insert into public.contents (kind, account_id, work_id) values ('post', uid, create_post.work_id)
  returning id into new_id;
  insert into public.posts (content_id, body, reshare_of) values (new_id, text_body, create_post.reshare_of);
  insert into public.post_images (content_id, storage_path, position)
  select new_id, path, (n - 1)::smallint from unnest(create_post.image_paths) with ordinality as t(path, n);
  return new_id;
end;
$$;

