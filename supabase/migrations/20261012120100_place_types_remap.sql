-- Existing workplaces into the new main categories by name (the admin Workplaces tab "Exact types
-- from map data" then fills the exact type from Google/OSM). Only where nobody chose by hand.

update public.locations l set category = 'hair', category_source = 'name'
where l.category = 'beauty'
  and lower(public.slugify(l.name)) ~ '(^|-)(borbely|barber|barbershop|fodrasz|fodraszat|hair|hajszalon|hajstudio)(-|$)';

update public.locations l set category = 'cafe', category_source = 'name'
where l.category = 'restaurant'
  and lower(public.slugify(l.name)) ~ '(^|-)(kavezo|kave|coffee|cafe|pekseg|bakery|cukraszda|fagylaltozo|fagyizo|gelato|teahaz)(-|$)';

update public.locations l set category = 'veterinary', category_source = 'name'
where l.category in ('other', 'healthcare')
  and lower(public.slugify(l.name)) ~ '(^|-)(allatorvos|allatorvosi|allatklinika|veterinary)(-|$)';

update public.locations l set category = 'automotive', category_source = 'name'
where l.category in ('other', 'retail')
  and lower(public.slugify(l.name)) ~ '(^|-)(benzinkut|parkolo|parkolas|parking|automoso)(-|$)';

-- An admin's choice is marked, so map data never overrides it.
create or replace function public.admin_set_location_category(p_location_id uuid, p_category public.workplace_category)
returns void
language plpgsql security definer
set search_path = '' as $$
declare c_id uuid;
begin
  perform private.require_admin();
  update public.locations set category = p_category, category_source = 'admin'
  where id = p_location_id returning company_id into c_id;
  if c_id is null then raise exception 'not found' using errcode = '22023'; end if;
  update public.companies set category = p_category
  where id = c_id and (select count(*) from public.locations where company_id = c_id) = 1;
end $$;
