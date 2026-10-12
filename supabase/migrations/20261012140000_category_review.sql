-- Category checks (lib/place-types.ts, lib/categorize.ts):
-- * locations.category_confidence: high / medium / low; the admin's "Categories to check" list shows
--   name- and AI-based ones and every low one.
-- * category_reports: "Wrong category? Tell us" from the public location page (anyone; written by
--   the server with the service role, rate-limited per IP), settled on the admin list.
-- * set_my_location_category(): the employer changes its own location's category (source "owner");
--   a category an admin set stays.

alter table public.locations add column if not exists category_confidence text;

create table if not exists public.category_reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  suggested_category public.workplace_category,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists category_reports_open on public.category_reports (created_at) where resolved_at is null;
alter table public.category_reports enable row level security;

create or replace function public.set_my_location_category(p_location_id uuid, p_category public.workplace_category)
returns void
language plpgsql security definer
set search_path = '' as $$
declare c_id uuid;
begin
  if not private.can_manage_location(p_location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.locations
  set category = p_category, category_source = 'owner', category_confidence = 'high'
  where id = p_location_id and category_source is distinct from 'admin'
  returning company_id into c_id;
  if c_id is null then raise exception 'set by admin' using errcode = '22023'; end if;
  update public.companies set category = p_category
  where id = c_id and (select count(*) from public.locations where company_id = c_id) = 1;
end $$;

revoke execute on function public.set_my_location_category(uuid, public.workplace_category) from public, anon;
grant execute on function public.set_my_location_category(uuid, public.workplace_category) to authenticated;

-- An admin's decision also settles the open reports of that location.
create or replace function public.admin_set_location_category(p_location_id uuid, p_category public.workplace_category)
returns void
language plpgsql security definer
set search_path = '' as $$
declare c_id uuid;
begin
  perform private.require_admin();
  update public.locations set category = p_category, category_source = 'admin', category_confidence = 'high'
  where id = p_location_id returning company_id into c_id;
  if c_id is null then raise exception 'not found' using errcode = '22023'; end if;
  update public.companies set category = p_category
  where id = c_id and (select count(*) from public.locations where company_id = c_id) = 1;
  update public.category_reports set resolved_at = now() where location_id = p_location_id and resolved_at is null;
end $$;

-- Existing classifications: map/AI sources stay as they are, with the matching confidence.
update public.locations set category_confidence = case
    when category_source in ('admin', 'owner', 'user', 'google_primary') then 'high'
    when category_source in ('google_types', 'osm') then 'medium'
    else 'low' end
where category_confidence is null;
