-- User reports, admin seeding import and slug changes, employer profiles.

-- ---------------------------------------------------------------------------
-- Reports: one open report per person and review; admins decide.
-- ---------------------------------------------------------------------------

create unique index reports_one_open on public.reports (review_id, reporter_id)
  where status = 'open' and review_id is not null;

create function public.admin_decide_report(p_report_id uuid, p_remove_review boolean) returns void
language plpgsql security definer
set search_path = '' as $$
declare r public.reports; loc uuid;
begin
  perform private.require_admin();
  select * into r from public.reports where id = p_report_id and status = 'open' for update;
  if r.id is null then return; end if;
  -- Every open report on the same review is settled together.
  update public.reports
  set status = case when p_remove_review then 'resolved'::public.case_status else 'rejected' end
  where status = 'open' and review_id is not distinct from r.review_id and reply_id is not distinct from r.reply_id;
  if p_remove_review and r.review_id is not null then
    update public.reviews set status = 'removed' where id = r.review_id returning location_id into loc;
    if loc is not null then perform public.recompute_location_scores(loc); end if;
  end if;
end $$;

revoke execute on function public.admin_decide_report(uuid, boolean) from public, anon;
grant execute on function public.admin_decide_report(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Seeding: admins import workplaces (CSV rows as JSON).
-- Row keys: company, name, address, city, country, category, lat, lng, google_place_id
-- ---------------------------------------------------------------------------

create function private.free_company_slug(p_name text) returns text
language plpgsql stable security definer
set search_path = '' as $$
declare base text := public.slugify(p_name); candidate text := base; n int := 1;
begin
  while public.is_reserved_slug(candidate) or exists (select 1 from public.companies where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end $$;

create function public.admin_import_locations(p_rows jsonb) returns jsonb
language plpgsql security definer
set search_path = '' as $$
declare
  row jsonb;
  c_name text; l_name text; addr text; cty text; ctry text; cat public.workplace_category;
  place text; loc_slug text;
  c_id uuid;
  created int := 0; skipped int := 0; failed int := 0;
begin
  perform private.require_admin();
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'invalid rows' using errcode = '22023';
  end if;
  for row in select * from jsonb_array_elements(p_rows) loop
    begin
      c_name := btrim(row->>'company');
      l_name := coalesce(nullif(btrim(row->>'name'), ''), c_name);
      addr := btrim(row->>'address');
      cty := btrim(row->>'city');
      ctry := upper(btrim(row->>'country'));
      cat := (row->>'category')::public.workplace_category;
      place := nullif(btrim(row->>'google_place_id'), '');
      loc_slug := public.slugify(addr);
      if length(c_name) not between 2 and 100 or length(addr) not between 2 and 150
         or length(cty) not between 2 and 80 or ctry !~ '^[A-Z]{2}$' or loc_slug = ''
         or public.slugify(c_name) = '' then
        failed := failed + 1;
        continue;
      end if;
      if place is not null and exists (select 1 from public.locations where google_place_id = place) then
        skipped := skipped + 1;
        continue;
      end if;
      select id into c_id from public.companies where lower(name) = lower(c_name) limit 1;
      if c_id is null then
        insert into public.companies (name, slug, category)
        values (c_name, private.free_company_slug(c_name), cat)
        returning id into c_id;
      end if;
      if exists (select 1 from public.locations where company_id = c_id and slug = loc_slug) then
        skipped := skipped + 1;
        continue;
      end if;
      insert into public.locations
        (company_id, name, slug, address, city, country, category, lat, lng, google_place_id, is_seeded)
      values (c_id, l_name, loc_slug, addr, cty, ctry, cat,
              nullif(row->>'lat', '')::double precision, nullif(row->>'lng', '')::double precision,
              place, true);
      created := created + 1;
    exception when others then
      failed := failed + 1;
    end;
  end loop;
  return jsonb_build_object('created', created, 'skipped', skipped, 'failed', failed);
end $$;

revoke execute on function public.admin_import_locations(jsonb) from public, anon;
grant execute on function public.admin_import_locations(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Slug changes keep old URLs working (301 via slug_redirects).
-- A company redirect ("/old") also covers its location paths ("/old/x").
-- ---------------------------------------------------------------------------

create function private.add_redirect(p_old text, p_new text) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  if p_old = p_new then return; end if;
  -- Collapse chains: anything pointing at the old path now points at the new one.
  update public.slug_redirects set new_path = p_new where new_path = p_old;
  insert into public.slug_redirects (old_path, new_path) values (p_old, p_new)
  on conflict (old_path) do update set new_path = excluded.new_path;
end $$;

create function public.admin_set_company_slug(p_company_id uuid, p_slug text) returns void
language plpgsql security definer
set search_path = '' as $$
declare old_slug text;
begin
  perform private.require_admin();
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or public.is_reserved_slug(p_slug)
     or exists (select 1 from public.companies where slug = p_slug and id <> p_company_id) then
    raise exception 'invalid slug' using errcode = '22023';
  end if;
  select slug into old_slug from public.companies where id = p_company_id for update;
  if old_slug is null then raise exception 'not found' using errcode = '22023'; end if;
  update public.companies set slug = p_slug where id = p_company_id;
  perform private.add_redirect('/' || old_slug, '/' || p_slug);
end $$;

create function public.admin_set_location_slug(p_location_id uuid, p_slug text) returns void
language plpgsql security definer
set search_path = '' as $$
declare old_slug text; c_slug text; c_id uuid;
begin
  perform private.require_admin();
  select l.slug, c.slug, c.id into old_slug, c_slug, c_id
  from public.locations l join public.companies c on c.id = l.company_id
  where l.id = p_location_id for update of l;
  if old_slug is null then raise exception 'not found' using errcode = '22023'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or exists (select 1 from public.locations where company_id = c_id and slug = p_slug and id <> p_location_id) then
    raise exception 'invalid slug' using errcode = '22023';
  end if;
  update public.locations set slug = p_slug where id = p_location_id;
  perform private.add_redirect('/' || c_slug || '/' || old_slug, '/' || c_slug || '/' || p_slug);
end $$;

revoke execute on function public.admin_set_company_slug(uuid, text) from public, anon;
revoke execute on function public.admin_set_location_slug(uuid, text) from public, anon;
grant execute on function public.admin_set_company_slug(uuid, text) to authenticated;
grant execute on function public.admin_set_location_slug(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Employer profile per location: about, benefits, website, photos.
-- ---------------------------------------------------------------------------

create table public.location_profiles (
  location_id uuid primary key references public.locations (id) on delete cascade,
  about text check (length(about) <= 2000),
  website text check (website ~* '^https?://[^\s]+$' and length(website) <= 300),
  benefits text[] not null default '{}' check (cardinality(benefits) <= 12),
  -- Paths in the public "profile-photos" bucket, "<location id>/<file>".
  photos text[] not null default '{}' check (cardinality(photos) <= 6),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.location_profiles
  for each row execute function public.set_updated_at();

alter table public.location_profiles enable row level security;
create policy "Public read" on public.location_profiles for select using (true);
create policy "Managers create profile" on public.location_profiles for insert to authenticated
  with check (private.can_manage_location(location_id));
create policy "Managers edit profile" on public.location_profiles for update to authenticated
  using (private.can_manage_location(location_id))
  with check (private.can_manage_location(location_id));

-- Storage folder name → location the caller manages.
create function private.can_manage_location_folder(p_folder text) returns boolean
language sql stable security definer
set search_path = '' as $$
  select p_folder ~* '^[0-9a-f-]{36}$' and private.can_manage_location(p_folder::uuid)
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('profile-photos', 'profile-photos', true, 5242880,
            array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    create policy "Managers upload profile photos" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'profile-photos'
                  and private.can_manage_location_folder((storage.foldername(name))[1]));
  end if;
end $$;
