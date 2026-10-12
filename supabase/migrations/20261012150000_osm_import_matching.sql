-- OpenStreetMap import, Google ↔ OSM matching and merging duplicates (lib/osm-import.ts,
-- lib/place-match.ts, lib/place-ensure.ts).
--
-- * locations.created_via: where a workplace came from (search, rate, claim, jobs, osm_import,
--   manual, admin_import), for the admin's daily counts.
-- * OSM import: osm_tag (e.g. "shop=bakery"), first import and last refresh that still saw it,
--   osm_gone_at when a refresh no longer finds it (closed); companies.brand_wikidata groups a chain.
-- * nearby_locations(): candidates within a radius for the matching rules (which live in
--   TypeScript, unit-tested); attach_place_ref() links a Google place id or an OSM id to a match.
-- * Admin: import runs log, possible duplicates (near + similar name), merge, daily new workplaces.

alter table public.locations
  add column if not exists created_via text,
  add column if not exists osm_tag text,
  add column if not exists imported_at timestamptz,
  add column if not exists osm_seen_at timestamptz,
  add column if not exists osm_gone_at timestamptz;
create index if not exists locations_lat_lng on public.locations (lat, lng) where lat is not null;
create index if not exists locations_created on public.locations (created_at);
create index if not exists locations_osm_city on public.locations (lower(city), osm_tag) where osm_tag is not null;

alter table public.companies add column if not exists brand_wikidata text;
create unique index if not exists companies_brand_wikidata on public.companies (brand_wikidata)
  where brand_wikidata is not null;

-- Workplaces created before this: best guess of where they came from.
update public.locations set created_via = case
  when google_place_id is not null or osm_id is not null then 'search'
  when is_seeded then 'admin_import'
  else 'manual' end
where created_via is null;

-- ---------------------------------------------------------------------------
-- Map places: 30 new workplaces an hour per person (was 10 a day), so picking a place can create
-- it right away in every flow. Same bodies as before otherwise.
-- ---------------------------------------------------------------------------

create or replace function public.workplace_from_place(
  p_user_id uuid, p_place_id text, p_name text, p_address text, p_city text, p_country text,
  p_category public.workplace_category, p_lat double precision, p_lng double precision
) returns uuid
language plpgsql security definer
set search_path = '' as $$
declare
  l_id uuid;
  c_id uuid;
  c_name text := btrim(p_name);
  loc_slug text := public.slugify(btrim(p_address));
  n int := 1;
begin
  select id into l_id from public.locations where google_place_id = p_place_id;
  if l_id is not null then return l_id; end if;

  if length(c_name) not between 2 and 100 or length(btrim(p_address)) not between 2 and 150
     or length(btrim(p_city)) not between 2 and 80 or p_country !~ '^[A-Z]{2}$'
     or loc_slug = '' or public.slugify(c_name) = '' then
    raise exception 'invalid place' using errcode = '22023';
  end if;
  if p_user_id is not null and (select count(*) from public.locations
      where created_by = p_user_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too many new workplaces' using errcode = '54000';
  end if;

  select id into c_id from public.companies where lower(name) = lower(c_name) limit 1;
  if c_id is null then
    insert into public.companies (name, slug, category, created_by)
    values (c_name, private.free_company_slug(c_name), p_category, p_user_id)
    returning id into c_id;
  end if;

  select id into l_id from public.locations
  where company_id = c_id and slug = loc_slug and google_place_id is null;
  if l_id is not null then
    update public.locations set google_place_id = p_place_id,
      lat = coalesce(lat, p_lat), lng = coalesce(lng, p_lng)
    where id = l_id;
    return l_id;
  end if;

  while exists (select 1 from public.locations where company_id = c_id and slug = loc_slug) loop
    n := n + 1;
    loc_slug := public.slugify(btrim(p_address)) || '-' || n;
  end loop;
  insert into public.locations
    (company_id, name, slug, address, city, country, category, lat, lng, google_place_id, created_by)
  values (c_id, c_name, loc_slug, btrim(p_address), btrim(p_city), p_country, p_category,
          p_lat, p_lng, p_place_id, p_user_id)
  returning id into l_id;
  return l_id;
end $$;

create or replace function public.workplace_from_osm(
  p_user_id uuid, p_osm_id text, p_name text, p_address text, p_city text, p_country text,
  p_category public.workplace_category, p_lat double precision, p_lng double precision
) returns uuid
language plpgsql security definer
set search_path = '' as $$
declare
  l_id uuid;
  c_id uuid;
  c_name text := btrim(p_name);
  loc_slug text := public.slugify(btrim(p_address));
  n int := 1;
begin
  select id into l_id from public.locations where osm_id = p_osm_id;
  if l_id is not null then return l_id; end if;

  if p_osm_id !~ '^(node|way|relation)/[0-9]{1,15}$'
     or length(c_name) not between 2 and 100 or length(btrim(p_address)) not between 2 and 150
     or length(btrim(p_city)) not between 2 and 80 or p_country !~ '^[A-Z]{2}$'
     or loc_slug = '' or public.slugify(c_name) = '' then
    raise exception 'invalid place' using errcode = '22023';
  end if;
  if p_user_id is not null and (select count(*) from public.locations
      where created_by = p_user_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too many new workplaces' using errcode = '54000';
  end if;

  select id into c_id from public.companies where lower(name) = lower(c_name) limit 1;
  if c_id is null then
    insert into public.companies (name, slug, category, created_by)
    values (c_name, private.free_company_slug(c_name), p_category, p_user_id)
    returning id into c_id;
  end if;

  select id into l_id from public.locations
  where company_id = c_id and slug = loc_slug and osm_id is null;
  if l_id is not null then
    update public.locations set osm_id = p_osm_id,
      lat = coalesce(lat, p_lat), lng = coalesce(lng, p_lng)
    where id = l_id;
    return l_id;
  end if;

  while exists (select 1 from public.locations where company_id = c_id and slug = loc_slug) loop
    n := n + 1;
    loc_slug := public.slugify(btrim(p_address)) || '-' || n;
  end loop;
  insert into public.locations
    (company_id, name, slug, address, city, country, category, lat, lng, osm_id, created_by)
  values (c_id, c_name, loc_slug, btrim(p_address), btrim(p_city), p_country, p_category,
          p_lat, p_lng, p_osm_id, p_user_id)
  returning id into l_id;
  return l_id;
end $$;

-- Lower case without accents ("Kávé" → "kave"), for name similarity.
create or replace function private.fold(p text) returns text
language sql immutable parallel safe
set search_path = '' as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, '')))
$$;
create index if not exists locations_name_fold_trgm on public.locations using gin (private.fold(name) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Matching helpers (service role only; the rules are in lib/place-match.ts).
-- ---------------------------------------------------------------------------

-- Workplaces within p_radius_m of each point: [{i, lat, lng}] → one row per (i, workplace).
create or replace function public.nearby_locations(p_points jsonb, p_radius_m int default 120)
returns table (
  i int, id uuid, name text, address text, city text, lat double precision, lng double precision,
  company_name text, brand_wikidata text, osm_id text, google_place_id text, distance_m double precision
)
language sql stable security definer
set search_path = '' as $$
  with pts as (
    select (p->>'i')::int as i, (p->>'lat')::float8 as plat, (p->>'lng')::float8 as plng
    from jsonb_array_elements(p_points) p
    where jsonb_typeof(p_points) = 'array' and jsonb_array_length(p_points) <= 2000
  )
  select pts.i, l.id, l.name, l.address, l.city, l.lat, l.lng, c.name, c.brand_wikidata, l.osm_id,
         l.google_place_id, d.m
  from pts
  join public.locations l
    on l.lat between pts.plat - p_radius_m / 111320.0 and pts.plat + p_radius_m / 111320.0
   and l.lng between pts.plng - p_radius_m / (111320.0 * cos(radians(pts.plat)))
                 and pts.plng + p_radius_m / (111320.0 * cos(radians(pts.plat)))
  join public.companies c on c.id = l.company_id
  cross join lateral (
    select 2 * 6371000 * asin(sqrt(
      power(sin(radians(l.lat - pts.plat) / 2), 2)
      + cos(radians(pts.plat)) * cos(radians(l.lat)) * power(sin(radians(l.lng - pts.plng) / 2), 2)
    )) as m
  ) d
  where d.m <= p_radius_m and not c.is_demo
$$;
revoke execute on function public.nearby_locations(jsonb, int) from public, anon, authenticated;
grant execute on function public.nearby_locations(jsonb, int) to service_role;

-- Workplaces with a similar name (no accents, any case), for search suggestions without
-- coordinates: [{i, name}] → up to 10 candidates each; the address check is done in TypeScript.
create or replace function public.locations_like_names(p_items jsonb)
returns table (i int, id uuid, name text, address text, city text)
language sql stable security definer
set search_path = '' as $$
  with items as (
    select (x->>'i')::int as i, private.fold(left(x->>'name', 100)) as q
    from jsonb_array_elements(p_items) x
    where jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) <= 20
  )
  select items.i, m.id, m.name, m.address, m.city
  from items
  cross join lateral (
    select l.id, l.name, l.address, l.city
    from public.locations l
    join public.companies c on c.id = l.company_id
    where not c.is_demo
      and (extensions.similarity(private.fold(l.name), items.q) >= 0.3
           or private.fold(l.name) like split_part(items.q, ' ', 1) || '%')
    order by extensions.similarity(private.fold(l.name), items.q) desc
    limit 10
  ) m
$$;
revoke execute on function public.locations_like_names(jsonb) from public, anon, authenticated;
grant execute on function public.locations_like_names(jsonb) to service_role;

-- Links a map place to the workplace it matched: the Google place id or the OSM id, when that
-- workplace has none yet and no other workplace has this one.
create or replace function public.attach_place_ref(p_location_id uuid, p_place_id text, p_osm_id text)
returns boolean
language plpgsql security definer
set search_path = '' as $$
begin
  if p_place_id is not null then
    if exists (select 1 from public.locations where google_place_id = p_place_id) then
      return exists (select 1 from public.locations where id = p_location_id and google_place_id = p_place_id);
    end if;
    update public.locations set google_place_id = p_place_id
    where id = p_location_id and google_place_id is null;
    return found;
  end if;
  if p_osm_id is not null and p_osm_id ~ '^(node|way|relation)/[0-9]{1,15}$' then
    if exists (select 1 from public.locations where osm_id = p_osm_id) then
      return exists (select 1 from public.locations where id = p_location_id and osm_id = p_osm_id);
    end if;
    update public.locations set osm_id = p_osm_id
    where id = p_location_id and osm_id is null;
    return found;
  end if;
  return false;
end $$;
revoke execute on function public.attach_place_ref(uuid, text, text) from public, anon, authenticated;
grant execute on function public.attach_place_ref(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- OpenStreetMap import.
-- ---------------------------------------------------------------------------

create table if not exists public.osm_import_runs (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  grp text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched int not null default 0,
  created int not null default 0,
  matched int not null default 0,
  known int not null default 0,
  skipped int not null default 0,
  gone int not null default 0,
  skip_reasons jsonb not null default '{}'::jsonb,
  error text,
  triggered_by text
);
create index if not exists osm_import_runs_started on public.osm_import_runs (started_at desc);
alter table public.osm_import_runs enable row level security;

-- City boundaries from OSM (outer rings as [lat, lng] points), fetched once and reused.
create table if not exists public.osm_city_areas (
  city text primary key,
  rings jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.osm_city_areas enable row level security;

-- Short-lived tokens for running the import from outside (scripts/osm-import.ts → /api/osm/import),
-- stored as SHA-256 hashes; created by hand with SQL, besides the CRON_SECRET.
create table if not exists public.import_tokens (
  token_hash text primary key,
  expires_at timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.import_tokens enable row level security;

-- One batch of decided rows (lib/osm-import.ts decides; this only writes):
--   {action: "seen", osm_id}                       already ours: refresh osm_seen_at
--   {action: "attach", location_id, osm_id, ...}   matched one of ours (Google or by hand): add the
--                                                  OSM id; "refresh" also takes OSM's address/position
--   {action: "create", osm_id, name, company, brand_wikidata, address, city, country, lat, lng,
--    category, place_type, place_type_en, place_type_hu, confidence, osm_tag}
create or replace function public.osm_import_apply(p_rows jsonb)
returns jsonb
language plpgsql security definer
set search_path = '' as $$
declare
  r jsonb;
  c_id uuid;
  l_id uuid;
  c_name text;
  brand text;
  loc_slug text;
  base_slug text;
  n int;
  created int := 0; attached int := 0; seen int := 0; failed int := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'invalid rows' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if r->>'action' = 'seen' then
        update public.locations set osm_seen_at = now(), osm_gone_at = null,
          osm_tag = coalesce(osm_tag, r->>'osm_tag')
        where osm_id = r->>'osm_id';
        seen := seen + 1;

      elsif r->>'action' = 'attach' then
        if exists (select 1 from public.locations where osm_id = r->>'osm_id') then
          seen := seen + 1;
          continue;
        end if;
        update public.locations set
          osm_id = r->>'osm_id', osm_tag = r->>'osm_tag', osm_seen_at = now(), osm_gone_at = null,
          address = case when (r->>'refresh')::boolean then coalesce(r->>'address', address) else address end,
          lat = case when (r->>'refresh')::boolean or lat is null then (r->>'lat')::float8 else lat end,
          lng = case when (r->>'refresh')::boolean or lng is null then (r->>'lng')::float8 else lng end
        where id = (r->>'location_id')::uuid and osm_id is null;
        if found then attached := attached + 1; else failed := failed + 1; end if;

      elsif r->>'action' = 'create' then
        if exists (select 1 from public.locations where osm_id = r->>'osm_id') then
          seen := seen + 1;
          continue;
        end if;
        c_name := btrim(r->>'company');
        brand := nullif(r->>'brand_wikidata', '');
        c_id := null;
        -- A chain is one company: by brand:wikidata, else by the brand name (only with a brand tag).
        if brand is not null then
          select id into c_id from public.companies where brand_wikidata = brand;
          if c_id is null then
            select id into c_id from public.companies
            where lower(name) = lower(c_name) and brand_wikidata is null limit 1;
            if c_id is not null then
              update public.companies set brand_wikidata = brand where id = c_id;
            end if;
          end if;
        elsif (r->>'chain')::boolean then
          select id into c_id from public.companies where lower(name) = lower(c_name) limit 1;
        end if;
        if c_id is null then
          insert into public.companies (name, slug, category, brand_wikidata)
          values (c_name, private.free_company_slug(c_name), (r->>'category')::public.workplace_category, brand)
          returning id into c_id;
        end if;
        base_slug := public.slugify(r->>'address');
        loc_slug := base_slug;
        n := 1;
        while exists (select 1 from public.locations where company_id = c_id and slug = loc_slug) loop
          n := n + 1;
          loc_slug := base_slug || '-' || n;
        end loop;
        insert into public.locations
          (company_id, name, slug, address, city, country, category, lat, lng, osm_id, osm_tag,
           place_type, place_type_en, place_type_hu, category_source, category_confidence,
           created_via, imported_at, osm_seen_at)
        values (c_id, btrim(r->>'name'), loc_slug, btrim(r->>'address'), btrim(r->>'city'),
          r->>'country', (r->>'category')::public.workplace_category,
          (r->>'lat')::float8, (r->>'lng')::float8, r->>'osm_id', r->>'osm_tag',
          r->>'place_type', r->>'place_type_en', r->>'place_type_hu', 'osm', r->>'confidence',
          'osm_import', now(), now());
        created := created + 1;
      end if;
    exception when others then
      failed := failed + 1;
    end;
  end loop;
  return jsonb_build_object('created', created, 'attached', attached, 'seen', seen, 'failed', failed);
end $$;
revoke execute on function public.osm_import_apply(jsonb) from public, anon, authenticated;
grant execute on function public.osm_import_apply(jsonb) to service_role;

-- After a complete refresh of one city and tag group: imported places it no longer found are
-- marked closed (osm_gone_at); found again later, a refresh clears it.
create or replace function public.osm_mark_gone(p_city text, p_tags text[], p_before timestamptz)
returns int
language sql security definer
set search_path = '' as $$
  with gone as (
    update public.locations set osm_gone_at = now()
    where osm_id is not null and osm_gone_at is null and osm_tag = any (p_tags)
      and lower(city) = lower(p_city) and osm_seen_at < p_before
    returning 1
  )
  select count(*)::int from gone
$$;
revoke execute on function public.osm_mark_gone(text, text[], timestamptz) from public, anon, authenticated;
grant execute on function public.osm_mark_gone(text, text[], timestamptz) to service_role;

-- Public pages: an imported place that closed and never got a review disappears.
create or replace view public.public_locations with (security_invoker = false) as
select
  l.id,
  c.slug as company_slug,
  c.name as company_name,
  l.slug,
  l.name,
  l.address,
  l.city,
  l.country,
  l.category,
  l.is_seeded,
  c.claimed_at is not null as claimed,
  (select e.name
     from public.location_entity_links k
     join public.legal_entities e on e.id = k.legal_entity_id
    where k.location_id = l.id and k.verified_at is not null
    order by k.confidence desc, k.verified_at
    limit 1) as legal_entity_name,
  s.overall, s.manager, s.pay, s.schedule, s.environment,
  s.paid_on_time_pct, s.paid_as_promised_pct, s.overtime_paid_pct, s.hours_as_promised_pct,
  s.reply_rate_pct, s.avg_reply_days,
  coalesce(s.review_count, 0) as review_count,
  coalesce(s.verified_count, 0) as verified_count,
  s.updated_at as scores_updated_at,
  public.slugify(l.city) as city_slug,
  l.updated_at,
  coalesce(s.invited_count, 0) as invited_count,
  coalesce(s.application_count, 0) as application_count,
  private.pro_active(l.id) as index_active,
  c.is_demo,
  l.place_type,
  l.place_type_en,
  l.place_type_hu,
  l.osm_id is not null as from_osm
from public.locations l
join public.companies c on c.id = l.company_id
left join public.location_scores s on s.location_id = l.id
where l.osm_gone_at is null or coalesce(s.review_count, 0) > 0;

-- Categories present in a city (for the city hub's chips; a city can hold thousands of workplaces).
create or replace function public.city_categories(p_city_slug text)
returns table (category public.workplace_category, city text, n int)
language sql stable security definer
set search_path = '' as $$
  select p.category, min(p.city), count(*)::int
  from public.public_locations p
  where p.city_slug = p_city_slug and not p.is_demo
  group by p.category
  order by count(*) desc
$$;
grant execute on function public.city_categories(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: import log, duplicates, merge, daily counts.
-- ---------------------------------------------------------------------------

create or replace function public.admin_osm_runs(p_limit int default 40)
returns setof public.osm_import_runs
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query select * from public.osm_import_runs order by started_at desc limit least(p_limit, 200);
end $$;
grant execute on function public.admin_osm_runs(int) to authenticated;

-- Per city: imported workplaces, how many still have no review, closed ones, last refresh.
create or replace function public.admin_osm_summary()
returns table (city text, imported int, unrated int, gone int, last_run timestamptz)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select l.city, count(*)::int,
         count(*) filter (where coalesce(s.review_count, 0) = 0)::int,
         count(*) filter (where l.osm_gone_at is not null)::int,
         max(l.osm_seen_at)
  from public.locations l
  left join public.location_scores s on s.location_id = l.id
  where l.created_via = 'osm_import'
  group by l.city
  order by count(*) desc;
end $$;
grant execute on function public.admin_osm_summary() to authenticated;

-- "OSM-imported, no reviews yet" list for the Workplaces tab.
create or replace function public.admin_osm_unrated(p_city text default null, p_limit int default 50)
returns table (id uuid, company_slug text, slug text, name text, address text, city text,
               category public.workplace_category, place_type text, osm_id text, imported_at timestamptz)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select l.id, c.slug, l.slug, l.name, l.address, l.city, l.category, l.place_type, l.osm_id, l.imported_at
  from public.locations l
  join public.companies c on c.id = l.company_id
  left join public.location_scores s on s.location_id = l.id
  where l.created_via = 'osm_import' and coalesce(s.review_count, 0) = 0
    and (p_city is null or lower(l.city) = lower(p_city))
  order by l.imported_at desc, l.name
  limit least(p_limit, 500);
end $$;
grant execute on function public.admin_osm_unrated(text, int) to authenticated;

-- New workplaces per day and source.
create or replace function public.admin_new_locations(p_days int default 14)
returns table (day date, via text, count int)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select (l.created_at at time zone 'Europe/Budapest')::date, coalesce(l.created_via, 'unknown'), count(*)::int
  from public.locations l
  join public.companies c on c.id = l.company_id
  where l.created_at > now() - make_interval(days => least(p_days, 90)) and not c.is_demo
  group by 1, 2
  order by 1 desc, 2;
end $$;
grant execute on function public.admin_new_locations(int) to authenticated;

create table if not exists public.duplicate_dismissals (
  a uuid not null references public.locations (id) on delete cascade,
  b uuid not null references public.locations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b)
);
alter table public.duplicate_dismissals enable row level security;

-- Pairs of workplaces within 75 m with a similar name (or the same company); the admin decides.
create or replace function public.admin_duplicate_pairs(p_limit int default 50)
returns table (a uuid, a_name text, a_address text, a_path text, a_reviews int, a_via text,
               b uuid, b_name text, b_address text, b_path text, b_reviews int, b_via text,
               distance_m double precision, similarity real)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select l1.id, l1.name, l1.address, '/' || c1.slug || '/' || l1.slug, coalesce(s1.review_count, 0)::int, l1.created_via,
         l2.id, l2.name, l2.address, '/' || c2.slug || '/' || l2.slug, coalesce(s2.review_count, 0)::int, l2.created_via,
         d.m, sim.v
  from public.locations l1
  join public.locations l2
    on l2.id > l1.id
   and l2.lat between l1.lat - 0.0007 and l1.lat + 0.0007
   and l2.lng between l1.lng - 0.001 and l1.lng + 0.001
  join public.companies c1 on c1.id = l1.company_id
  join public.companies c2 on c2.id = l2.company_id
  left join public.location_scores s1 on s1.location_id = l1.id
  left join public.location_scores s2 on s2.location_id = l2.id
  cross join lateral (
    select 2 * 6371000 * asin(sqrt(
      power(sin(radians(l2.lat - l1.lat) / 2), 2)
      + cos(radians(l1.lat)) * cos(radians(l2.lat)) * power(sin(radians(l2.lng - l1.lng) / 2), 2)
    )) as m
  ) d
  cross join lateral (
    select extensions.similarity(private.fold(l1.name), private.fold(l2.name)) as v
  ) sim
  where l1.lat is not null and d.m <= 75 and not c1.is_demo and not c2.is_demo
    and (sim.v >= 0.4 or (c1.id = c2.id and l1.address = l2.address))
    and not exists (select 1 from public.duplicate_dismissals x where x.a = l1.id and x.b = l2.id)
  order by sim.v desc, d.m
  limit least(p_limit, 200);
end $$;
grant execute on function public.admin_duplicate_pairs(int) to authenticated;

create or replace function public.admin_dismiss_duplicate(p_a uuid, p_b uuid)
returns void
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  insert into public.duplicate_dismissals (a, b) values (least(p_a, p_b), greatest(p_a, p_b))
  on conflict do nothing;
end $$;
grant execute on function public.admin_dismiss_duplicate(uuid, uuid) to authenticated;

-- Merges p_drop into p_keep: reviews, jobs, follows, claims, invites, reports, legal entity links,
-- embed domains, the employer profile (when the kept one has none) and team location rights move
-- over; the map ids and position fill gaps; the old URL redirects (301) to the kept one. A managed
-- workplace (plan) can only be the one kept.
create or replace function public.admin_merge_locations(p_keep uuid, p_drop uuid)
returns text
language plpgsql security definer
set search_path = '' as $$
declare
  k public.locations;
  d public.locations;
  k_path text;
  d_path text;
  d_company uuid;
  d_company_slug text;
  k_company_slug text;
  d_place text;
  d_osm text;
begin
  perform private.require_admin();
  if p_keep = p_drop then raise exception 'same workplace' using errcode = '22023'; end if;
  select * into k from public.locations where id = p_keep for update;
  select * into d from public.locations where id = p_drop for update;
  if k.id is null or d.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.location_plans where location_id = p_drop) then
    raise exception 'keep the managed workplace' using errcode = '22023';
  end if;

  select slug into k_company_slug from public.companies where id = k.company_id;
  select slug into d_company_slug from public.companies where id = d.company_id;
  k_path := '/' || k_company_slug || '/' || k.slug;
  d_path := '/' || d_company_slug || '/' || d.slug;
  d_company := d.company_id;

  update public.reviews set location_id = p_keep where location_id = p_drop;
  update public.jobs set location_id = p_keep where location_id = p_drop;
  update public.claim_requests set location_id = p_keep where location_id = p_drop;
  update public.invite_batches set location_id = p_keep where location_id = p_drop;
  update public.plan_orders set location_id = p_keep where location_id = p_drop;
  update public.category_reports set location_id = p_keep where location_id = p_drop;
  update public.follows f set location_id = p_keep
  where f.location_id = p_drop
    and not exists (select 1 from public.follows g where g.user_id = f.user_id and g.location_id = p_keep);
  update public.location_entity_links x set location_id = p_keep
  where x.location_id = p_drop
    and not exists (select 1 from public.location_entity_links y where y.location_id = p_keep and y.legal_entity_id = x.legal_entity_id);
  update public.embed_referrers x set location_id = p_keep
  where x.location_id = p_drop
    and not exists (select 1 from public.embed_referrers y where y.location_id = p_keep and y.domain = x.domain);
  if not exists (select 1 from public.location_profiles where location_id = p_keep) then
    update public.location_profiles set location_id = p_keep where location_id = p_drop;
  end if;
  update public.org_members
  set location_ids = (select array_agg(distinct x) from unnest(array_replace(location_ids, p_drop, p_keep)) x)
  where p_drop = any (location_ids);
  update public.org_member_invites
  set location_ids = (select array_agg(distinct x) from unnest(array_replace(location_ids, p_drop, p_keep)) x)
  where p_drop = any (location_ids);

  -- Map ids and position: the kept one takes what it lacks.
  d_place := d.google_place_id;
  d_osm := d.osm_id;
  delete from public.duplicate_dismissals where a = p_drop or b = p_drop;
  delete from public.locations where id = p_drop;
  update public.locations set
    google_place_id = coalesce(google_place_id, d_place),
    osm_id = coalesce(osm_id, d_osm),
    osm_tag = coalesce(osm_tag, d.osm_tag),
    osm_seen_at = greatest(osm_seen_at, d.osm_seen_at),
    lat = coalesce(lat, d.lat),
    lng = coalesce(lng, d.lng)
  where id = p_keep;

  perform private.add_redirect(d_path, k_path);
  -- The dropped workplace's company, now empty and unclaimed, goes too; its URL redirects.
  if not exists (select 1 from public.locations where company_id = d_company)
     and (select owner_org_id is null and claimed_at is null from public.companies where id = d_company) then
    begin
      delete from public.companies where id = d_company;
      perform private.add_redirect('/' || d_company_slug, '/' || k_company_slug);
    exception when foreign_key_violation then
      null;
    end;
  end if;
  perform public.recompute_location_scores(p_keep);
  return k_path;
end $$;
grant execute on function public.admin_merge_locations(uuid, uuid) to authenticated;
