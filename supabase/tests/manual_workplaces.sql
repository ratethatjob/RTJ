-- Hand-entered workplaces test (migration 20261013100000_manual_workplaces.sql). One transaction,
-- rolled back. Checks: geocode result (found / not found), the admin list with its duplicate
-- candidate, Hide (out of public_locations) and OK (back), the admin edit locks fields, the
-- employer can change the rest but not a locked field, and others can't change anything.
begin;
do $t$
declare
  admin_id uuid := (select user_id from public.admins limit 1);
  owner_id uuid := (select id from auth.users where id <> (select user_id from public.admins limit 1) limit 1);
  co uuid; org uuid; loc uuid; twin uuid; moved boolean; n int; r record;
begin
  insert into public.companies (name, slug, category) values ('Test Manual Bakery', 'test-manual-bakery-x', 'other') returning id into co;
  insert into public.locations (company_id, name, slug, address, city, country, category, created_via)
    values (co, 'Test Manual Bakery', 'fo-utca-1', 'Fő utca 1', 'Testville', 'HU', 'other', 'manual') returning id into loc;
  insert into public.locations (company_id, name, slug, address, city, country, category, lat, lng)
    values (co, 'Test Manual Bakery Twin', 'fo-utca-2', 'Fő utca 2', 'Testville', 'HU', 'other', 47.5001, 19.0001) returning id into twin;

  perform public.set_location_geocode(loc, null, null);
  if (select geocode_status from public.locations where id = loc) <> 'not_found' then raise exception 'not_found not marked'; end if;
  perform public.set_location_geocode(loc, 47.5, 19.0);
  if (select geocode_status <> 'ok' or lat <> 47.5 from public.locations where id = loc) then raise exception 'position not saved'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  select * into r from public.admin_manual_locations() where id = loc;
  if r.id is null then raise exception 'not listed'; end if;
  if r.dup_id is distinct from twin then raise exception 'duplicate candidate missing'; end if;
  if (public.admin_overview()->'todo'->>'manual')::int < 1 then raise exception 'overview counter'; end if;

  perform public.admin_review_manual(loc, 'hide');
  if exists (select 1 from public.public_locations where id = loc) then raise exception 'hidden still public'; end if;
  if exists (select 1 from public.admin_manual_locations() where id = loc) then raise exception 'hidden still new'; end if;
  if not exists (select 1 from public.admin_manual_locations(true) where id = loc) then raise exception 'hidden list'; end if;
  perform public.admin_review_manual(loc, 'ok');
  if not exists (select 1 from public.public_locations where id = loc) then raise exception 'ok not public'; end if;

  moved := public.admin_edit_location(loc, 'Test Manual Bakery', 'Fő utca 1', 'Testville Central');
  if not moved then raise exception 'city change not reported'; end if;
  if (select locked_fields <> array['city'] or geocode_status is not null from public.locations where id = loc) then
    raise exception 'lock/geocode reset wrong';
  end if;

  -- A stranger can't change it.
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  begin
    perform public.update_my_location(loc, 'X Bakery', 'Fő utca 1', 'Testville Central');
    raise exception 'stranger allowed';
  exception when insufficient_privilege then null;
  end;

  -- The owner can change name and address, not the locked city.
  insert into public.orgs (name) values ('Test Manual Org') returning id into org;
  insert into public.org_members (org_id, user_id, role) values (org, owner_id, 'owner');
  update public.companies set owner_org_id = org where id = co;
  moved := public.update_my_location(loc, 'Test Bakery Renamed', 'Fő utca 3', 'Testville Central');
  if not moved or (select name from public.locations where id = loc) <> 'Test Bakery Renamed' then raise exception 'owner edit'; end if;
  begin
    perform public.update_my_location(loc, 'Test Bakery Renamed', 'Fő utca 3', 'Elsewhere');
    raise exception 'locked field changed';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'manual workplaces OK';
end $t$;
rollback;
