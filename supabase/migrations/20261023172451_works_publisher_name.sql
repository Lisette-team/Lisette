-- Publisher name from catalogue metadata, shown as plain text when the publisher has no confirmed
-- work_publishers link (for example, it has no Lisette account).
alter table public.works add column publisher_name text;
