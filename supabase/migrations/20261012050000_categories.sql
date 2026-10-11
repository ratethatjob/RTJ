-- About 30 workplace categories (lib/categories.ts). New enum values only; the old five stay.
-- Values added here can't be used in this transaction: existing rows are remapped in the next migration.

alter type public.workplace_category add value if not exists 'fast_food';
alter type public.workplace_category add value if not exists 'bar';
alter type public.workplace_category add value if not exists 'hotel';
alter type public.workplace_category add value if not exists 'supermarket';
alter type public.workplace_category add value if not exists 'construction';
alter type public.workplace_category add value if not exists 'tech';
alter type public.workplace_category add value if not exists 'healthcare';
alter type public.workplace_category add value if not exists 'dental';
alter type public.workplace_category add value if not exists 'pharmacy';
alter type public.workplace_category add value if not exists 'beauty';
alter type public.workplace_category add value if not exists 'fitness';
alter type public.workplace_category add value if not exists 'education';
alter type public.workplace_category add value if not exists 'childcare';
alter type public.workplace_category add value if not exists 'elderly_care';
alter type public.workplace_category add value if not exists 'cleaning';
alter type public.workplace_category add value if not exists 'security';
alter type public.workplace_category add value if not exists 'delivery';
alter type public.workplace_category add value if not exists 'automotive';
alter type public.workplace_category add value if not exists 'call_center';
alter type public.workplace_category add value if not exists 'finance';
alter type public.workplace_category add value if not exists 'public_sector';
alter type public.workplace_category add value if not exists 'agriculture';
alter type public.workplace_category add value if not exists 'events';
alter type public.workplace_category add value if not exists 'other';

-- Admin override of a workplace's category (Workplaces tab). A one-location company follows it.
create function public.admin_set_location_category(p_location_id uuid, p_category public.workplace_category)
returns void
language plpgsql security definer
set search_path = '' as $$
declare c_id uuid;
begin
  perform private.require_admin();
  update public.locations set category = p_category where id = p_location_id returning company_id into c_id;
  if c_id is null then raise exception 'not found' using errcode = '22023'; end if;
  update public.companies set category = p_category
  where id = c_id and (select count(*) from public.locations where company_id = c_id) = 1;
end $$;

revoke execute on function public.admin_set_location_category(uuid, public.workplace_category) from public, anon;
grant execute on function public.admin_set_location_category(uuid, public.workplace_category) to authenticated;
