-- Google Places: one workplace per place id. The server fetches the place
-- details itself and calls this with the service role, so users can't
-- attach made-up data to a real place id.

create function public.workplace_from_place(
  p_user_id uuid,
  p_place_id text,
  p_name text,
  p_address text,
  p_city text,
  p_country text,
  p_category public.workplace_category,
  p_lat double precision,
  p_lng double precision
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
      where created_by = p_user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many new workplaces' using errcode = '54000';
  end if;

  select id into c_id from public.companies where lower(name) = lower(c_name) limit 1;
  if c_id is null then
    insert into public.companies (name, slug, category, created_by)
    values (c_name, private.free_company_slug(c_name), p_category, p_user_id)
    returning id into c_id;
  end if;

  -- Same company and address typed in by hand earlier: attach the place id to it.
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

revoke execute on function public.workplace_from_place(uuid, text, text, text, text, text, public.workplace_category, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.workplace_from_place(uuid, text, text, text, text, text, public.workplace_category, double precision, double precision)
  to service_role;

-- Known place ids, so search can say "already on RateThatJob".
create function public.locations_by_place(p_place_ids text[])
returns table (place_id text, location_id uuid)
language sql stable security definer
set search_path = '' as $$
  select google_place_id, id from public.locations where google_place_id = any (p_place_ids)
$$;
grant execute on function public.locations_by_place(text[]) to anon, authenticated;
