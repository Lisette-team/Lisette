begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users (id,email,raw_user_meta_data) values
 ('10000000-0000-0000-0000-000000000001','sharing-author@test.local','{"display_name":"Author"}'),
 ('10000000-0000-0000-0000-000000000002','sharing-pub1@test.local','{"display_name":"P1","account_kind":"publisher","publisher_kind":"publishing_house"}'),
 ('10000000-0000-0000-0000-000000000003','sharing-pub2@test.local','{"display_name":"P2","account_kind":"publisher","publisher_kind":"publishing_house"}'),
 ('10000000-0000-0000-0000-000000000004','sharing-reader@test.local','{"display_name":"Reader"}');
update public.profiles set author_enabled=true where id='10000000-0000-0000-0000-000000000001';
insert into public.works (id,title,owner_id,source,visibility) values ('20000000-0000-0000-0000-000000000001','Work','10000000-0000-0000-0000-000000000001','author','public');
insert into public.manuscript_versions (id,work_id,storage_path,sha256,byte_size,page_count) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','test/file.pdf',repeat('a',64),100,2);
insert into public.calls (id,publisher_id,title,opens_at,accepted_languages) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','P1',now(),'{ro}'),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','P2',now(),'{ro}');
insert into public.submissions (id,author_id,work_id,version_id,publisher_id,call_id,contact_email,contact_phone,rights_declared_at,contact_consent_at,accepted_policy,idempotency_key) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','a@test.local','123',now(),now(),'{"sharing_policy":"synopsis_and_excerpt_approval"}',gen_random_uuid()),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002','a@test.local','123',now(),now(),'{"sharing_policy":"synopsis_and_excerpt_approval"}',gen_random_uuid());
insert into storage.objects(bucket_id,name) values ('excerpt-images','10000000-0000-0000-0000-000000000001/page.png');
select lives_ok($$select public.create_processed_share('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','beta_pages','own_work',null,'p. 1','followers','30000000-0000-0000-0000-000000000001',1,1,null,null,'derived/image.pdf','10000000-0000-0000-0000-000000000001/page.png')$$,'page share accepts an uploaded own image');
select throws_ok($$select public.create_processed_share('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','beta_pages','own_work',null,'p. 1–2','public','30000000-0000-0000-0000-000000000001',1,2,null,null,'derived/all.pdf')$$,'P0001','invalid_pages','page share cannot include the entire manuscript');
select set_config('test.fragment',public.create_processed_share('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','excerpt','own_work',null,'fata schimbata','public','30000000-0000-0000-0000-000000000001',1,1,0.3,'fată originala',null)::text,true);
select set_config('test.pages',public.create_processed_share('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','beta_pages','own_work',null,'p. 1','followers','30000000-0000-0000-0000-000000000001',1,1,null,null,'derived/test.pdf')::text,true);
select is((select count(*) from public.sharing_decisions d join public.sharing_requests r on r.id=d.request_id join public.text_versions v on v.id=r.text_version_id where v.excerpt_id=current_setting('test.pages')::uuid),2::bigint,'page range requires applicable excerpt approvals');
select set_config('test.page_version',(select id::text from public.text_versions where excerpt_id=current_setting('test.pages')::uuid),true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select ok(not public.can_read_shared_pages(current_setting('test.page_version')::uuid),'pending pages cannot be read');
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';
select ok(public.can_read_shared_pages(current_setting('test.page_version')::uuid),'active approving publication can read exact pages');
select is((select x->'diff'->0->>'found' from jsonb_array_elements(public.sharing_workspace()->'requests') x where x->>'excerptId'=current_setting('test.fragment')),'true','diff ignores diacritics on a matching word');
select public.decide_sharing((select id from public.sharing_requests where text_version_id=current_setting('test.page_version')::uuid),'50000000-0000-0000-0000-000000000001',true);
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select public.decide_sharing((select id from public.sharing_requests where text_version_id=current_setting('test.page_version')::uuid),'50000000-0000-0000-0000-000000000002',true);
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$select public.publish_excerpt(current_setting('test.page_version')::uuid)$$,'pages publish after all required approvals');
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select ok(not public.can_view_content(current_setting('test.pages')::uuid),'non-follower cannot read followers pages');
select public.set_follow('10000000-0000-0000-0000-000000000001',true);
select ok(public.can_view_content(current_setting('test.pages')::uuid),'follower can read published pages');
select throws_ok($$select * from public.share_private$$,'42501',null,'reader cannot fetch private subset path or source text');
select * from finish();
rollback;
