-- Audit fixes.
-- 1. A job order's package never changes after it is created: choosing another package makes a
--    new order and cancels the old pending one. A Checkout opened for the old order still applies
--    only that order's own package when it is paid (fulfill_job_order reads o.tier), so paying the
--    Standard price can no longer publish a Pro ad.
-- 2. Statistics and early warnings need Pro in the database too, not only in the UI.

create or replace function public.request_job_order(p_job_id uuid, p_tier public.job_tier)
returns table (order_id uuid, tier public.job_tier, previous_tier public.job_tier)
language plpgsql security definer
set search_path = '' as $$
declare
  j public.jobs;
  prev public.job_tier;
  o_id uuid;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if j.id is null or not private.can_manage_location(j.location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if j.published_at is null then
    update public.jobs set tier = p_tier where id = j.id and jobs.tier <> p_tier;
  elsif p_tier <= j.tier then
    raise exception 'package can only be upgraded' using errcode = '22023';
  else
    prev := j.tier;
  end if;

  -- Reuse the pending order only when it is for exactly the same package change.
  select o.id into o_id from public.job_orders o
  where o.job_id = j.id and o.status = 'pending'
    and o.tier = p_tier and o.previous_tier is not distinct from prev
  order by o.created_at desc limit 1;
  update public.job_orders o set status = 'cancelled', decided_at = now()
  where o.job_id = j.id and o.status = 'pending' and o.id is distinct from o_id;
  if o_id is null then
    insert into public.job_orders (job_id, org_id, tier, previous_tier, created_by)
    values (j.id, j.org_id, p_tier, prev, (select auth.uid()))
    returning id into o_id;
  end if;
  return query select o_id, p_tier, prev;
end $$;

create or replace function public.location_stats(p_location_id uuid) returns jsonb
language plpgsql stable security definer
set search_path = '' as $$
begin
  if not private.can_manage_location(p_location_id) or not private.pro_active(p_location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'months', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'month', to_char(m, 'YYYY-MM'),
               'reviews', coalesce(s.n, 0),
               'overall', case when s.n >= 5 then s.avg end)
             order by m), '[]')
      from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as m
      left join (
        select date_trunc('month', published_at) as month, count(*)::int as n,
               round(sum(overall * case when verification_level = 'none' then 0.5 else 1.0 end)
                     / nullif(sum(case when verification_level = 'none' then 0.5 else 1.0 end) filter (where overall is not null), 0), 1) as avg
        from public.reviews
        where location_id = p_location_id and status = 'published'
          and published_at >= date_trunc('month', now()) - interval '11 months'
        group by 1
      ) s on s.month = m
    ),
    'categories', (
      select coalesce(jsonb_agg(to_jsonb(c)), '[]') from private.category_windows(p_location_id) c
    )
  );
end $$;

create or replace function public.early_warnings(p_location_ids uuid[])
returns table (location_id uuid, category text, recent numeric, baseline numeric, delta numeric)
language sql stable security definer
set search_path = '' as $$
  select l.id, c.category, c.recent, c.baseline, c.recent - c.baseline
  from unnest(p_location_ids) as l(id)
  cross join lateral private.category_windows(l.id) c
  where private.can_manage_location(l.id) and private.pro_active(l.id)
    and c.recent is not null and c.baseline is not null
    and c.recent - c.baseline <= -0.5
  order by c.recent - c.baseline
$$;

-- ---------------------------------------------------------------------------
-- 3. Reviews can't skip moderation through the API.
--    The app never updates reviews as the author (mark_job_ended and attach_invite are RPCs), so
--    authors lose UPDATE: a held review can no longer be released by its author. Direct inserts
--    get a fresh created_at and no hold/publish fields. A review is published only after the AI
--    check ran (ai_checked_at, set by the server; the daily cron catches up), or a human approved it.
revoke update on public.reviews from authenticated;

alter table public.reviews add column if not exists ai_checked_at timestamptz;
-- Existing reviews went through the old flow; updated_at stays as it was.
alter table public.reviews disable trigger set_updated_at;
update public.reviews set ai_checked_at = coalesce(published_at, now()) where ai_checked_at is null;
alter table public.reviews enable trigger set_updated_at;

create or replace function private.review_insert_defaults() returns trigger
language plpgsql
set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
    new.hold_reason := null;
    new.publish_at := null;
    new.published_at := null;
    new.ai_checked_at := null;
  end if;
  return new;
end $$;

drop trigger if exists review_insert_defaults on public.reviews;
create trigger review_insert_defaults before insert on public.reviews
  for each row execute function private.review_insert_defaults();

create or replace function public.publish_due_reviews() returns int
language plpgsql security definer
set search_path = '' as $$
declare
  loc uuid;
  n int := 0;
begin
  for loc in
    with published as (
      update public.reviews
      set status = 'published', published_at = now()
      where status = 'scheduled' and publish_at <= now() and ai_checked_at is not null
      returning location_id
    )
    select distinct location_id from published
  loop
    perform public.recompute_location_scores(loc);
    n := n + 1;
  end loop;
  return n;
end $$;

-- AI hold keeps an earlier rule reason (e.g. "burst + ai:spam").
create or replace function public.hold_review(p_review_id uuid, p_reason text) returns void
language sql security definer
set search_path = '' as $$
  update public.reviews
  set hold_reason = left(case when hold_reason is null or hold_reason = p_reason then p_reason
                              else hold_reason || ' + ' || p_reason end, 200),
      status = 'pending_moderation', publish_at = null
  where id = p_review_id and status in ('pending_moderation', 'scheduled')
$$;

-- Admin approval: the same delays as the automatic path ("In a few weeks" = 14–28 days).
create or replace function public.admin_moderate_review(p_review_id uuid, p_approve boolean) returns void
language plpgsql security definer
set search_path = '' as $$
declare
  r public.reviews;
  published_count int;
begin
  perform private.require_admin();
  select * into r from public.reviews where id = p_review_id and status = 'pending_moderation' for update;
  if r.id is null then return; end if;
  if not p_approve then
    update public.reviews set status = 'rejected' where id = r.id;
    return;
  end if;
  select count(*) into published_count from public.reviews
  where location_id = r.location_id and status = 'published';
  update public.reviews set
    status = 'scheduled',
    ai_checked_at = coalesce(ai_checked_at, now()),
    publish_at = case
      when r.publish_mode = 'after_leaving' and r.period_end is null then null
      when r.publish_mode = 'delayed' then now() + make_interval(days => 14 + floor(random() * 15)::int)
      when r.invite_id is not null or published_count < 5
        then now() + make_interval(days => 2 + floor(random() * 13)::int)
      else now()
    end
  where id = r.id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. The 12-month window moves every night, not only when a review is published.
create or replace function private.recompute_recent_scores() returns int
language plpgsql security definer
set search_path = '' as $$
declare
  loc uuid;
  n int := 0;
begin
  for loc in
    select location_id from public.location_scores
    union
    select distinct location_id from public.reviews
    where status = 'published' and published_at > now() - interval '15 months'
  loop
    perform public.recompute_location_scores(loc);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function private.recompute_recent_scores() from public, anon, authenticated;

-- Trial and renewal notices are written before the daily email cron can run (Vercel runs it
-- anywhere within the 06:00 hour).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('recompute-scores', '53 2 * * *', 'select private.recompute_recent_scores()');
    perform cron.schedule('process-trials', '7 4 * * *', 'select public.process_trials()');
    perform cron.schedule('process-renewals', '17 4 * * *', 'select public.process_renewals()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Embedding sites are recorded by the server only (service role), at most 20 new domains a
--    day per location.
create or replace function public.record_embed_view(p_location_id uuid, p_domain text) returns void
language sql security definer
set search_path = '' as $$
  insert into public.embed_referrers (location_id, domain)
  select p_location_id, lower(p_domain)
  where lower(p_domain) ~ '^[a-z0-9.-]{3,253}$'
    and exists (select 1 from public.locations where id = p_location_id)
    and (exists (select 1 from public.embed_referrers e where e.location_id = p_location_id and e.domain = lower(p_domain))
         or (select count(*) from public.embed_referrers e
             where e.location_id = p_location_id and e.first_seen > now() - interval '1 day') < 20)
  on conflict (location_id, domain) do update
    set views = public.embed_referrers.views + 1, last_seen = now()
$$;
revoke execute on function public.record_embed_view(uuid, text) from public, anon, authenticated;
grant execute on function public.record_embed_view(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Admin metrics without demo data; invites = all invites sent; invited reviews = published.
create or replace function public.admin_metrics() returns jsonb
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'months', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', to_char(m, 'YYYY-MM'),
        'reviews', (select count(*) from public.reviews r join public.locations l on l.id = r.location_id
                    join public.companies c on c.id = l.company_id
                    where not c.is_demo and r.status = 'published' and date_trunc('month', r.published_at) = m),
        'verified', (select count(*) from public.reviews r join public.locations l on l.id = r.location_id
                     join public.companies c on c.id = l.company_id
                     where not c.is_demo and r.status = 'published' and r.verification_level <> 'none'
                       and date_trunc('month', r.published_at) = m),
        'users', (select count(*) from auth.users u
                  where coalesce(u.raw_app_meta_data->>'demo', 'false') <> 'true' and date_trunc('month', u.created_at) = m),
        'applications', (select count(*) from public.job_applications a join public.jobs j on j.id = a.job_id
                         join public.locations l on l.id = j.location_id join public.companies c on c.id = l.company_id
                         where not c.is_demo and date_trunc('month', a.created_at) = m)
      ) order by m), '[]')
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
    ),
    'locations', (select count(*) from public.locations l join public.companies c on c.id = l.company_id where not c.is_demo),
    'claimed_locations', (select count(*) from public.locations l join public.companies c on c.id = l.company_id
                          where not c.is_demo and c.claimed_at is not null),
    'rated_locations', (select count(*) from public.location_scores s join public.locations l on l.id = s.location_id
                        join public.companies c on c.id = l.company_id where not c.is_demo and s.review_count > 0),
    'invites_used', (select count(*) from public.reviews r join public.locations l on l.id = r.location_id
                     join public.companies c on c.id = l.company_id
                     where not c.is_demo and r.invite_id is not null and r.status = 'published'),
    'invite_links', (select count(*) from public.invites),
    'open_jobs', (select count(*) from public.jobs j join public.locations l on l.id = j.location_id
                  join public.companies c on c.id = l.company_id where not c.is_demo and j.status = 'open'),
    'embeds', (select count(distinct domain) from public.embed_referrers)
  );
end $$;
