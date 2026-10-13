-- Hand-entered workplaces (owner's decision):
-- * Geocoding: the typed address gets coordinates from OpenStreetMap (lib/geocode.ts, Nominatim
--   with a Photon fallback), so "Near you", city hubs and the duplicate check (75 m + name) work
--   for them too. Not found → no coordinates, geocode_status = 'not_found'. Places still without
--   coordinates are retried by the daily /api/cron/osm job (geocode_status null).
-- * Admin list "New hand-entered workplaces": OK / Edit / Merge (admin_merge_locations) / Hide.
--   Hidden = not public (left out of public_locations), nothing is deleted.
-- * Employers correct their own location's name, address and city (update_my_location); a field
--   an admin edited is locked (locked_fields), like a category an admin set.

alter table public.locations
  add column if not exists geocode_status text check (geocode_status in ('ok', 'not_found')),
  add column if not exists geocoded_at timestamptz,
  add column if not exists hidden_at timestamptz,
  add column if not exists manual_reviewed_at timestamptz,
  add column if not exists locked_fields text[] not null default '{}';

-- Map places and imports come with their position.
update public.locations set geocode_status = 'ok' where lat is not null and geocode_status is null;

create index if not exists locations_manual_new on public.locations (created_at desc)
  where created_via = 'manual' and manual_reviewed_at is null;

-- Same view, hidden workplaces left out.
create or replace view public.public_locations with (security_invoker = false) as
 SELECT l.id,
    c.slug AS company_slug,
    c.name AS company_name,
    l.slug,
    l.name,
    l.address,
    l.city,
    l.country,
    l.category,
    l.is_seeded,
    c.claimed_at IS NOT NULL AS claimed,
    ( SELECT e.name
           FROM public.location_entity_links k
             JOIN public.legal_entities e ON e.id = k.legal_entity_id
          WHERE k.location_id = l.id AND k.verified_at IS NOT NULL
          ORDER BY k.confidence DESC, k.verified_at
         LIMIT 1) AS legal_entity_name,
    s.overall,
    s.manager,
    s.pay,
    s.schedule,
    s.environment,
    s.paid_on_time_pct,
    s.paid_as_promised_pct,
    s.overtime_paid_pct,
    s.hours_as_promised_pct,
    s.reply_rate_pct,
    s.avg_reply_days,
    COALESCE(s.review_count, 0) AS review_count,
    COALESCE(s.verified_count, 0) AS verified_count,
    s.updated_at AS scores_updated_at,
    public.slugify(l.city) AS city_slug,
    l.updated_at,
    COALESCE(s.invited_count, 0) AS invited_count,
    COALESCE(s.application_count, 0) AS application_count,
    private.pro_active(l.id) AS index_active,
    c.is_demo,
    l.place_type,
    l.place_type_en,
    l.place_type_hu,
    l.osm_id IS NOT NULL AS from_osm
   FROM public.locations l
     JOIN public.companies c ON c.id = l.company_id
     LEFT JOIN public.location_scores s ON s.location_id = l.id
  WHERE (l.osm_gone_at IS NULL OR COALESCE(s.review_count, 0) > 0)
    AND l.hidden_at IS NULL;

-- The geocoder's result (service role). Not found: a hand-entered place loses an old position
-- (its address changed), a map place keeps the map's.
create or replace function public.set_location_geocode(p_location_id uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql security definer
set search_path = '' as $$
begin
  if p_lat is not null and p_lng is not null then
    if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'invalid position' using errcode = '22023';
    end if;
    update public.locations set lat = p_lat, lng = p_lng, geocode_status = 'ok', geocoded_at = now()
    where id = p_location_id;
  else
    update public.locations set
      geocode_status = 'not_found',
      geocoded_at = now(),
      lat = case when google_place_id is null and osm_id is null then null else lat end,
      lng = case when google_place_id is null and osm_id is null then null else lng end
    where id = p_location_id;
  end if;
end $$;
revoke all on function public.set_location_geocode(uuid, double precision, double precision) from public, anon, authenticated;
grant execute on function public.set_location_geocode(uuid, double precision, double precision) to service_role;

-- Workplaces the geocoder hasn't tried yet (service role, daily cron).
create or replace function public.locations_to_geocode(p_limit int default 25)
returns table (id uuid, address text, city text, country text)
language sql stable security definer
set search_path = '' as $$
  select l.id, l.address, l.city, l.country from public.locations l
  where l.lat is null and l.geocode_status is null
  order by l.created_at
  limit least(p_limit, 100)
$$;
revoke all on function public.locations_to_geocode(int) from public, anon, authenticated;
grant execute on function public.locations_to_geocode(int) to service_role;

-- Admin list: hand-entered workplaces not yet checked (p_hidden: the hidden ones), with who added
-- them and the closest possible duplicate (within 75 m with a similar name; without a position:
-- same city, more similar name).
create or replace function public.admin_manual_locations(p_hidden boolean default false, p_limit int default 100)
returns table (
  id uuid, name text, address text, city text, country text, category text, path text,
  created_at timestamptz, created_by_email text, geocode_status text, has_position boolean, hidden_at timestamptz,
  reviews int, dup_id uuid, dup_name text, dup_address text, dup_path text, dup_distance_m double precision
)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select l.id, l.name, l.address, l.city, l.country, l.category::text, '/' || c.slug || '/' || l.slug,
         l.created_at, u.email::text, l.geocode_status, l.lat is not null, l.hidden_at,
         coalesce(s.review_count, 0)::int,
         d.id, d.name, d.address, d.path, d.m
  from public.locations l
  join public.companies c on c.id = l.company_id
  left join auth.users u on u.id = l.created_by
  left join public.location_scores s on s.location_id = l.id
  left join lateral (
    select o.id, o.name, o.address, '/' || oc.slug || '/' || o.slug as path, dist.m
    from public.locations o
    join public.companies oc on oc.id = o.company_id
    cross join lateral (
      select case when l.lat is not null and o.lat is not null then 2 * 6371000 * asin(sqrt(
        power(sin(radians(o.lat - l.lat) / 2), 2)
        + cos(radians(l.lat)) * cos(radians(o.lat)) * power(sin(radians(o.lng - l.lng) / 2), 2)
      )) end as m,
      extensions.similarity(private.fold(l.name), private.fold(o.name)) as v
    ) dist
    where o.id <> l.id and not oc.is_demo and o.hidden_at is null
      and not exists (select 1 from public.duplicate_dismissals x
                      where x.a = least(l.id, o.id) and x.b = greatest(l.id, o.id))
      and (
        (l.lat is not null and o.lat between l.lat - 0.0007 and l.lat + 0.0007
          and o.lng between l.lng - 0.001 and l.lng + 0.001 and dist.m <= 75 and dist.v >= 0.4)
        or (l.lat is null and private.fold(o.city) = private.fold(l.city) and dist.v >= 0.5)
      )
    order by dist.v desc, dist.m nulls last
    limit 1
  ) d on true
  where l.created_via = 'manual' and not c.is_demo
    and case when p_hidden then l.hidden_at is not null else l.manual_reviewed_at is null and l.hidden_at is null end
  order by l.created_at desc
  limit least(p_limit, 200);
end $$;
revoke all on function public.admin_manual_locations(boolean, int) from public, anon;
grant execute on function public.admin_manual_locations(boolean, int) to authenticated;

-- OK (also shows a hidden one again) / Hide.
create or replace function public.admin_review_manual(p_location_id uuid, p_action text)
returns void
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  if p_action = 'ok' then
    update public.locations set manual_reviewed_at = now(), hidden_at = null where id = p_location_id;
  elsif p_action = 'hide' then
    update public.locations set manual_reviewed_at = now(), hidden_at = now() where id = p_location_id;
  else
    raise exception 'invalid action' using errcode = '22023';
  end if;
  if not found then raise exception 'not found' using errcode = '22023'; end if;
end $$;
revoke all on function public.admin_review_manual(uuid, text) from public, anon;
grant execute on function public.admin_review_manual(uuid, text) to authenticated;

create or replace function private.valid_location_fields(p_name text, p_address text, p_city text)
returns boolean
language sql immutable
set search_path = '' as $$
  select length(btrim(p_name)) between 2 and 100
     and length(btrim(p_address)) between 2 and 150
     and length(btrim(p_city)) between 2 and 80
$$;

-- Admin edit: name, address, city; every field the admin changes is locked for the employer.
-- Returns whether the address or city changed (the app then geocodes it again).
create or replace function public.admin_edit_location(p_location_id uuid, p_name text, p_address text, p_city text)
returns boolean
language plpgsql security definer
set search_path = '' as $$
declare
  l public.locations;
  changed text[] := '{}';
begin
  perform private.require_admin();
  if not private.valid_location_fields(p_name, p_address, p_city) then
    raise exception 'invalid workplace' using errcode = '22023';
  end if;
  select * into l from public.locations where id = p_location_id for update;
  if l.id is null then raise exception 'not found' using errcode = '22023'; end if;
  if btrim(p_name) <> l.name then changed := array_append(changed, 'name'); end if;
  if btrim(p_address) <> l.address then changed := array_append(changed, 'address'); end if;
  if btrim(p_city) <> l.city then changed := array_append(changed, 'city'); end if;
  update public.locations set
    name = btrim(p_name), address = btrim(p_address), city = btrim(p_city),
    locked_fields = array(select distinct f from unnest(locked_fields || changed) f order by f),
    manual_reviewed_at = coalesce(manual_reviewed_at, now()),
    geocode_status = case when changed && array['address', 'city'] then null else geocode_status end
  where id = l.id;
  return changed && array['address', 'city'];
end $$;
revoke all on function public.admin_edit_location(uuid, text, text, text) from public, anon;
grant execute on function public.admin_edit_location(uuid, text, text, text) to authenticated;

-- The employer corrects its own location (owner/HR, or its location manager). A field an admin
-- edited can't be changed ('locked'). Returns whether the address or city changed.
create or replace function public.update_my_location(p_location_id uuid, p_name text, p_address text, p_city text)
returns boolean
language plpgsql security definer
set search_path = '' as $$
declare
  l public.locations;
  moved boolean;
begin
  if not private.can_manage_location(p_location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not private.valid_location_fields(p_name, p_address, p_city) then
    raise exception 'invalid workplace' using errcode = '22023';
  end if;
  select * into l from public.locations where id = p_location_id for update;
  if ('name' = any (l.locked_fields) and btrim(p_name) <> l.name)
     or ('address' = any (l.locked_fields) and btrim(p_address) <> l.address)
     or ('city' = any (l.locked_fields) and btrim(p_city) <> l.city) then
    raise exception 'locked' using errcode = '22023';
  end if;
  moved := btrim(p_address) <> l.address or btrim(p_city) <> l.city;
  update public.locations set
    name = btrim(p_name), address = btrim(p_address), city = btrim(p_city),
    geocode_status = case when moved then null else geocode_status end
  where id = l.id;
  return moved;
end $$;
revoke all on function public.update_my_location(uuid, text, text, text) from public, anon;
grant execute on function public.update_my_location(uuid, text, text, text) to authenticated;

-- Admin overview: the new hand-entered workplaces as a to-do counter (the rest unchanged).
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Budapest')::date;
begin
  perform private.require_admin();
  return (
    with real_locations as (
      select l.* from public.locations l join public.companies c on c.id = l.company_id where not c.is_demo
    ),
    real_reviews as (
      select r.* from public.reviews r join real_locations l on l.id = r.location_id
    ),
    plans as (
      select p.*, coalesce(p.billing_currency, case when l.country = 'HU' then 'huf' else 'eur' end) as currency,
        -- Paid Pro: an active Stripe subscription past its trial, or an invoice paid until a future date.
        (p.paid_until > now() and (p.trial_ends_at is null or p.paid_until > p.trial_ends_at)) as paid,
        (p.trial_ends_at > now() and not coalesce(p.paid_until > p.trial_ends_at, false)) as trial
      from public.location_plans p join real_locations l on l.id = p.location_id
    ),
    real_users as (
      select u.* from auth.users u where coalesce(u.raw_app_meta_data->>'demo', 'false') <> 'true'
    )
    select jsonb_build_object(
      'reviews', jsonb_build_object(
        'total', (select count(*) from real_reviews where status <> 'draft'),
        'published', (select count(*) from real_reviews where status = 'published'),
        'scheduled', (select count(*) from real_reviews where status = 'scheduled'),
        'scheduled_from', (select min(publish_at) from real_reviews where status = 'scheduled'),
        'scheduled_to', (select max(publish_at) from real_reviews where status = 'scheduled'),
        'pending', (select count(*) from real_reviews where status = 'pending_moderation' and hold_reason is null),
        'held', (select count(*) from real_reviews where status = 'pending_moderation' and hold_reason is not null),
        'rejected', (select count(*) from real_reviews where status = 'rejected'),
        'removed', (select count(*) from real_reviews where status = 'removed'),
        'new_today', (select count(*) from real_reviews where status <> 'draft'
                        and (created_at at time zone 'Europe/Budapest')::date = today),
        'new_7', (select count(*) from real_reviews where status <> 'draft' and created_at > now() - interval '7 days'),
        'new_30', (select count(*) from real_reviews where status <> 'draft' and created_at > now() - interval '30 days')
      ),
      'workplaces', jsonb_build_object(
        'total', (select count(*) from real_locations where osm_gone_at is null),
        'rated', (select count(*) from real_locations l join public.location_scores s on s.location_id = l.id
                  where s.review_count > 0),
        'new_30_by_source', (select coalesce(jsonb_object_agg(via, n), '{}') from (
          select coalesce(created_via, 'unknown') as via, count(*) as n from real_locations
          where created_at > now() - interval '30 days' group by 1) x)
      ),
      'companies', jsonb_build_object(
        'claims_open', (select count(*) from public.claim_requests where status = 'open'),
        'claims_approved', (select count(*) from public.claim_requests where status = 'resolved'),
        'trial', (select count(*) from plans where trial),
        'pro', (select count(*) from plans where paid),
        'canceling', (select count(*) from plans where paid and cancel_at_period_end),
        'canceled', (select count(*) from plans where stripe_status = 'canceled' and not paid),
        'past_due', (select count(*) from plans where stripe_status in ('past_due', 'unpaid')),
        -- Paying locations per currency and interval (cancelled-at-period-end ones stop renewing).
        'paying', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'interval', coalesce(billing_interval::text, 'month'), 'n', n)), '[]')
                   from (select currency, billing_interval, count(*) as n from plans
                         where paid and not cancel_at_period_end group by 1, 2) x)
      ),
      'users', jsonb_build_object(
        'total', (select count(*) from real_users),
        'active_7', (select count(*) from real_users where last_sign_in_at > now() - interval '7 days'),
        'new_7', (select count(*) from real_users where created_at > now() - interval '7 days'),
        'new_30', (select count(*) from real_users where created_at > now() - interval '30 days')
      ),
      'jobs', jsonb_build_object(
        'active', (select count(*) from public.jobs j join real_locations l on l.id = j.location_id
                   where j.status = 'open' and j.published_at is not null and (j.closes_at is null or j.closes_at >= today)),
        'expired', (select count(*) from public.jobs j join real_locations l on l.id = j.location_id
                    where j.published_at is not null and (j.status = 'closed' or j.closes_at < today)),
        -- Paid job package orders in the last 30 days (Stripe: amount in the smallest unit; bank
        -- transfer marked paid by an admin: no amount, priced by the app from the package).
        'orders_30', (select coalesce(jsonb_agg(jsonb_build_object(
            'amount', o.amount, 'currency', lower(o.currency), 'tier', o.tier, 'previous_tier', o.previous_tier, 'country', l.country)), '[]')
          from public.job_orders o join public.jobs j on j.id = o.job_id join real_locations l on l.id = j.location_id
          where o.status = 'paid' and o.decided_at > now() - interval '30 days')
      ),
      'todo', jsonb_build_object(
        'moderation', (select count(*) from public.reviews where status = 'pending_moderation'),
        'claims', (select count(*) from public.claim_requests where status = 'open'),
        'verifications', (select count(*) from public.verifications where status = 'pending'),
        'reports', (select count(*) from public.reports where status = 'open'),
        'disputes', (select count(*) from public.disputes where status = 'open'),
        'categories', (select count(*) from (
          select l.id from public.locations l
          where (l.category_source in ('name', 'ai', 'generic') or l.category_confidence = 'low' or l.category_source is null)
            and l.category_source is distinct from 'admin' and l.category_source is distinct from 'owner'
          union
          select location_id from public.category_reports where resolved_at is null) x),
        'duplicates', (select count(*) from public.admin_duplicate_pairs(200)),
        'manual', (select count(*) from real_locations
                   where created_via = 'manual' and manual_reviewed_at is null and hidden_at is null)
      ),
      'trend', (select jsonb_agg(jsonb_build_object(
          'day', d,
          'reviews', (select count(*) from real_reviews r where r.status <> 'draft'
                      and (r.created_at at time zone 'Europe/Budapest')::date = d),
          'workplaces', (select count(*) from real_locations l where (l.created_at at time zone 'Europe/Budapest')::date = d)
        ) order by d)
        from generate_series(today - 29, today, interval '1 day') g(dd), lateral (select dd::date as d) x)
    )
  );
end $$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
