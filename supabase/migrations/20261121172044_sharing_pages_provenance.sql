-- The extracted source and private subset path never appear in public text-version rows.
alter table public.text_versions
  add column manuscript_version_id uuid references public.manuscript_versions(id),
  add column page_start integer,
  add column page_end integer,
  add column provenance_score double precision check (provenance_score between 0 and 1),
  add constraint text_version_pages_valid check ((page_start is null and page_end is null) or (page_start > 0 and page_end >= page_start and manuscript_version_id is not null));
create table public.share_private (
  text_version_id uuid primary key references public.text_versions(id) on delete cascade,
  source_text text,
  pages_path text
);
alter table public.share_private enable row level security;
revoke all on public.share_private from anon, authenticated;
