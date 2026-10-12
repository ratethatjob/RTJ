-- Two-level workplace classification (lib/place-types.ts): new main categories, and the exact
-- place type (Google Places type, or the type our OSM/name rules point to) with its labels.
-- The new enum values are used in 20261012120100_place_types_remap.sql (a value added here can't
-- be used in the same transaction).

alter type public.workplace_category add value if not exists 'cafe';
alter type public.workplace_category add value if not exists 'hair';
alter type public.workplace_category add value if not exists 'veterinary';

alter table public.locations
  add column if not exists place_type text,
  add column if not exists place_type_en text,
  add column if not exists place_type_hu text,
  -- How the main category was set: google_primary, google_types, osm, name, generic, ai, user, admin.
  add column if not exists category_source text;

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
  l.place_type_hu
from public.locations l
join public.companies c on c.id = l.company_id
left join public.location_scores s on s.location_id = l.id;
