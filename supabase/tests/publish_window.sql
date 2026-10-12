-- Publishing window test (migration 20261012160000_publish_window.sql), run against a database
-- that has the migration: psql "$POSTGRES_URL_NON_POOLING" -f supabase/tests/publish_window.sql
-- Everything happens in one transaction that is rolled back; any failed check raises an error.
-- Checks: every review goes live 3–12 days later (spread over the whole window), reviews from one
-- invite batch share one moment, a batch moment < 3 days away is replaced, and after_leaving /
-- delayed can't be stored (insert or update).
begin;
do $t$
declare
  loc uuid; org uuid; bat uuid; inv1 uuid; inv2 uuid; r1 uuid; r2 uuid; r3 uuid; mn timestamptz; mx timestamptz; t1 timestamptz; t2 timestamptz; t3 timestamptz; m text;
begin
  select min(x), max(x) into mn, mx from (select private.random_publish_at() x from generate_series(1,5000)) s;
  if mn < now() + interval '3 days' or mx > now() + interval '12 days' then raise exception 'window % %', mn, mx; end if;
  if mn > now() + interval '3 days 12 hours' or mx < now() + interval '11 days 12 hours' then raise exception 'not spread % %', mn, mx; end if;
  select id into loc from public.locations limit 1;
  insert into public.orgs (name) values ('dryrun') returning id into org;
  insert into public.invite_batches (location_id, org_id, channel_mix) values (loc, org, '{"email":1}') returning id into bat;
  insert into public.invites (batch_id, channel) values (bat, 'email') returning id into inv1;
  insert into public.invites (batch_id, channel) values (bat, 'email') returning id into inv2;
  insert into public.reviews (location_id, relationship, period_start, position, work_type, publish_mode, status, invite_id, overall)
    values (loc, 'former', '2025-01-01', 'x', 'permanent', 'after_leaving', 'draft', inv1, 4) returning id, publish_mode into r1, m;
  if m <> 'now' then raise exception 'after_leaving kept'; end if;
  insert into public.reviews (location_id, relationship, period_start, position, work_type, publish_mode, status, invite_id, overall)
    values (loc, 'former', '2025-01-01', 'x', 'permanent', 'delayed', 'draft', inv2, 4) returning id into r2;
  insert into public.reviews (location_id, relationship, period_start, position, work_type, status, overall)
    values (loc, 'former', '2025-01-01', 'x', 'permanent', 'draft', 4) returning id into r3;
  update public.reviews set publish_mode = 'after_leaving' where id = r3;
  if (select publish_mode from public.reviews where id = r3) <> 'now' then raise exception 'update kept after_leaving'; end if;
  update public.reviews set status = 'pending_moderation' where id in (r1, r2, r3);
  select publish_at into t1 from public.reviews where id = r1;
  select publish_at into t2 from public.reviews where id = r2;
  select publish_at into t3 from public.reviews where id = r3;
  if t1 is null or t1 <> t2 then raise exception 'batch not grouped % %', t1, t2; end if;
  if t1 <> (select publish_group_at from public.invite_batches where id = bat) then raise exception 'group not stored'; end if;
  if t3 < now() + interval '3 days' or t3 > now() + interval '12 days' or t1 < now() + interval '3 days' then raise exception 'bad dates % %', t1, t3; end if;
  -- a group moment less than 3 days away is replaced
  update public.invite_batches set publish_group_at = now() + interval '1 day' where id = bat;
  t2 := private.review_publish_at(r2);
  if t2 < now() + interval '3 days' then raise exception 'stale group reused'; end if;
  raise notice 'publish window OK (batch %, single %)', t1, t3;
end $t$;
rollback;
