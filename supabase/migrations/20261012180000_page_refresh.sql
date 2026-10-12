-- Public pages are cached ("use cache", lib/data). Reviews go live inside the database (pg_cron
-- publish_due_reviews(), admin decisions, SQL by hand), where the app can't expire its cache, so a
-- published, removed or deleted review left "No reviews yet" (or an old score) on the location,
-- company and city pages for hours. Now every such change queues the location in
-- page_refresh_queue and pings the app once per statement (pg_net, sent after commit):
-- POST /api/revalidate takes the queue (take_page_refresh(), service role) and expires the cache
-- tags. A daily Vercel cron on /api/revalidate drains anything a lost ping left behind.

create extension if not exists pg_net with schema extensions;

create table if not exists public.page_refresh_queue (
  location_id uuid not null,
  queued_at timestamptz not null default now()
);
alter table public.page_refresh_queue enable row level security;

-- Where the app lives (one row; change it here for another domain).
create table if not exists private.app_settings (
  key text primary key,
  value text not null
);
insert into private.app_settings (key, value) values ('site_url', 'https://ratethatjob.com')
on conflict (key) do nothing;

create or replace function private.ping_page_refresh()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  site text := (select value from private.app_settings where key = 'site_url');
begin
  if site is null then return; end if;
  perform net.http_post(
    url := site || '/api/revalidate',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
exception when others then
  -- Never block publishing; the daily cron drains the queue.
  null;
end $$;

create or replace function private.queue_page_refresh_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.page_refresh_queue (location_id)
  select distinct n.location_id
  from new_rows n join old_rows o on o.id = n.id
  where (n.status = 'published') is distinct from (o.status = 'published')
     or (n.status = 'published' and n.location_id is distinct from o.location_id)
  union
  select distinct o.location_id
  from new_rows n join old_rows o on o.id = n.id
  where o.status = 'published' and n.location_id is distinct from o.location_id;
  if found then perform private.ping_page_refresh(); end if;
  return null;
end $$;

create or replace function private.queue_page_refresh_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.page_refresh_queue (location_id)
  select distinct location_id from new_rows where status = 'published';
  if found then perform private.ping_page_refresh(); end if;
  return null;
end $$;

create or replace function private.queue_page_refresh_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.page_refresh_queue (location_id)
  select distinct location_id from old_rows where status = 'published';
  if found then perform private.ping_page_refresh(); end if;
  return null;
end $$;

create or replace trigger page_refresh_update
  after update on public.reviews
  referencing new table as new_rows old table as old_rows
  for each statement execute function private.queue_page_refresh_update();

create or replace trigger page_refresh_insert
  after insert on public.reviews
  referencing new table as new_rows
  for each statement execute function private.queue_page_refresh_insert();

create or replace trigger page_refresh_delete
  after delete on public.reviews
  referencing old table as old_rows
  for each statement execute function private.queue_page_refresh_delete();

-- The app takes what is queued (and clears it): the locations with their company slug and path.
create or replace function public.take_page_refresh(p_limit int default 500)
returns table (location_id uuid, company_slug text, location_slug text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with taken as (
    delete from public.page_refresh_queue q
    where q.location_id in (select distinct x.location_id from public.page_refresh_queue x limit p_limit)
    returning q.location_id
  )
  select distinct t.location_id, c.slug, l.slug
  from taken t
  left join public.locations l on l.id = t.location_id
  left join public.companies c on c.id = l.company_id;
end $$;

revoke all on function public.take_page_refresh(int) from public, anon, authenticated;
grant execute on function public.take_page_refresh(int) to service_role;
revoke all on function private.ping_page_refresh() from public, anon, authenticated;
