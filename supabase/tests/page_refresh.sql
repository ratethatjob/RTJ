-- Page refresh queue test (migration 20261012180000_page_refresh.sql). One transaction, rolled
-- back (so no ping leaves: pg_net sends only after commit). Checks: publishing (one statement,
-- several rows), unpublishing and deleting a published review queue its location; changes that
-- don't touch published state queue nothing; take_page_refresh() returns and clears the queue.
begin;
do $t$
declare loc uuid; r1 uuid; r2 uuid; n int; slug text;
begin
  select id into loc from public.locations limit 1;
  perform public.take_page_refresh();
  insert into public.reviews (location_id, relationship, period_start, position, work_type, status, overall)
    values (loc, 'former', '2025-01-01', 'x', 'permanent', 'draft', 4) returning id into r1;
  insert into public.reviews (location_id, relationship, period_start, position, work_type, status, overall)
    values (loc, 'former', '2025-01-01', 'x', 'permanent', 'draft', 4) returning id into r2;
  if exists (select 1 from public.page_refresh_queue) then raise exception 'draft insert queued'; end if;
  update public.reviews set position = 'y' where id = r1;
  if exists (select 1 from public.page_refresh_queue) then raise exception 'unrelated update queued'; end if;
  update public.reviews set status = 'published', published_at = now() where id in (r1, r2);
  select count(*) into n from public.page_refresh_queue where location_id = loc;
  if n <> 1 then raise exception 'publish queued % rows', n; end if;
  select count(*), min(company_slug) into n, slug from public.take_page_refresh();
  if n <> 1 or slug is null then raise exception 'take returned % %', n, slug; end if;
  if exists (select 1 from public.page_refresh_queue) then raise exception 'queue not cleared'; end if;
  update public.reviews set status = 'removed' where id = r1;
  if not exists (select 1 from public.page_refresh_queue where location_id = loc) then raise exception 'removal not queued'; end if;
  perform public.take_page_refresh();
  delete from public.reviews where id = r2;
  if not exists (select 1 from public.page_refresh_queue where location_id = loc) then raise exception 'delete not queued'; end if;
  raise notice 'page refresh OK';
end $t$;
rollback;
