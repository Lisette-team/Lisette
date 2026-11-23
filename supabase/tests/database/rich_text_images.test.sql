begin;
select plan(5);
select is(public.plain_text('<p>One &amp; <strong>two</strong></p><p>three&nbsp;four</p>'), 'One & two three four', 'visible text strips tags and decodes entities');
select ok(char_length(public.plain_text('<p>' || repeat('a',3000) || '</p>')) = 3000, 'post visible length');
select ok(char_length(public.plain_text('<p>' || repeat('a',10000) || '</p>')) = 10000, 'excerpt visible length');
select ok(exists(select 1 from storage.buckets where id='excerpt-images' and not public and file_size_limit=5242880), 'private image bucket');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='text_versions' and column_name='image_path'), 'image belongs to text version');
select * from finish();
rollback;
