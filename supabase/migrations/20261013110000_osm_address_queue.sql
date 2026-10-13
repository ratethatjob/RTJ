-- OpenStreetMap import, places without a street address (owner's decision): instead of being
-- dropped, they wait in osm_address_queue; a daily job asks Nominatim reverse (at most one request
-- a second, User-Agent) for the street at their position and creates or matches them like any
-- other imported place when it gets a street (with or without a house number). No street → they
-- stay out (status 'no_address'). The answer is kept here, so nothing is asked twice.
-- osm_import_runs.queues_unaddressed: runs from before this change are due again, so their
-- unaddressed places get queued too.

create table if not exists public.osm_address_queue (
  osm_id text primary key,
  city text not null,
  grp text not null,
  row jsonb not null,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending' check (status in ('pending', 'found', 'no_address')),
  address text,
  queued_at timestamptz not null default now(),
  checked_at timestamptz
);
create index if not exists osm_address_queue_pending on public.osm_address_queue (queued_at) where status = 'pending';
alter table public.osm_address_queue enable row level security;

alter table public.osm_import_runs add column if not exists queues_unaddressed boolean not null default false;

-- Admin OSM tab: per city, what the reverse geocoding did.
create or replace function public.admin_osm_address_summary()
returns table (city text, pending bigint, found bigint, no_address bigint)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select q.city, count(*) filter (where q.status = 'pending'), count(*) filter (where q.status = 'found'),
         count(*) filter (where q.status = 'no_address')
  from public.osm_address_queue q group by q.city order by q.city;
end $$;
revoke all on function public.admin_osm_address_summary() from public, anon;
grant execute on function public.admin_osm_address_summary() to authenticated;

-- Imported "names" that are descriptions (several words, no capital letter, e.g. "magán szemészeti
-- központ"): the import now skips them; the ones already in are hidden (not deleted).
update public.locations set hidden_at = coalesce(hidden_at, now())
where created_via = 'osm_import' and name = lower(name) and name ~ '\s'
  and not exists (select 1 from public.reviews r where r.location_id = locations.id);
