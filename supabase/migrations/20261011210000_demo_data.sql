-- Demo data marking and one-step removal. Demo companies and orgs carry is_demo; demo users have
-- raw_app_meta_data.demo = true. Everything else hangs off demo companies (locations, reviews,
-- replies, jobs, applications, plans) and goes with them. Seed: supabase/demo/seed_demo.sql.

alter table public.companies add column is_demo boolean not null default false;
alter table public.orgs add column is_demo boolean not null default false;

create function private.demo_summary() returns jsonb
language sql stable security definer
set search_path = '' as $$
  select jsonb_build_object(
    'companies', (select count(*) from public.companies where is_demo),
    'locations', (select count(*) from public.locations l join public.companies c on c.id = l.company_id where c.is_demo),
    'reviews', (select count(*) from public.reviews r join public.locations l on l.id = r.location_id
                join public.companies c on c.id = l.company_id where c.is_demo),
    'jobs', (select count(*) from public.jobs j join public.locations l on l.id = j.location_id
             join public.companies c on c.id = l.company_id where c.is_demo),
    'users', (select count(*) from auth.users where raw_app_meta_data ->> 'demo' = 'true'))
$$;

-- Removes every demo row. Also run directly: select private.purge_demo();
create function private.purge_demo() returns jsonb
language plpgsql security definer
set search_path = '' as $$
declare
  before jsonb := private.demo_summary();
begin
  -- Notifications about demo places (real users may have followed one).
  delete from public.notifications n
  where n.data ->> 'location_id' in (
    select l.id::text from public.locations l join public.companies c on c.id = l.company_id where c.is_demo);
  delete from public.companies where is_demo;
  delete from public.orgs where is_demo;
  delete from auth.users where raw_app_meta_data ->> 'demo' = 'true';
  return before;
end $$;

create function public.admin_demo_summary() returns jsonb
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return private.demo_summary();
end $$;

create function public.admin_purge_demo() returns jsonb
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return private.purge_demo();
end $$;

revoke execute on function public.admin_demo_summary() from public, anon;
revoke execute on function public.admin_purge_demo() from public, anon;
grant execute on function public.admin_demo_summary() to authenticated;
grant execute on function public.admin_purge_demo() to authenticated;

-- Public: is_demo, so demo pages are labelled, noindexed and left out of sitemaps.
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
  c.is_demo
from public.locations l
join public.companies c on c.id = l.company_id
left join public.location_scores s on s.location_id = l.id;

create or replace view public.public_jobs with (security_invoker = false) as
select
  j.id, j.title, j.work_type, j.schedule, j.pay_min, j.pay_max, j.pay_currency, j.pay_period,
  j.description, j.question, j.published_at, j.closes_at, j.updated_at,
  l.id as location_id, l.slug as location_slug, l.name as location_name, l.address, l.city,
  public.slugify(l.city) as city_slug, l.country, l.category,
  c.slug as company_slug, c.name as company_name,
  j.apply_mode, j.questions, j.responsibilities, j.requirements, j.offers,
  j.tier = 'pro' as featured,
  c.is_demo
from public.jobs j
join public.locations l on l.id = j.location_id
join public.companies c on c.id = l.company_id
where j.status = 'open' and (j.closes_at is null or j.closes_at >= current_date);
