-- DEMO DATA for showing how the site works. Not real companies, people or reviews.
-- Every row is marked: companies.is_demo / orgs.is_demo, demo users have raw_app_meta_data.demo = true
-- (emails @demo.ratethatjob.invalid). Remove everything with: select private.purge_demo();
-- (or the admin "Demo data" tab). Needs migration 20261011210000_demo_data.sql.

do $$
declare
  spec jsonb := $json$[
    {"slug": "demo-placeholder-bistro", "name": "Placeholder Bistro", "category": "restaurant",
     "positions": ["Line cook", "Waiter", "Barista", "Kitchen porter"],
     "locations": [
       {"slug": "andrassy-ut-1", "address": "Andrássy út 1", "city": "Budapest", "country": "HU", "plan": "paid",
        "scores": [5,4,5,4,4,5,4,3,5,4,4,5], "verified": 11, "replies": 3},
       {"slug": "marina-walk-1", "address": "Marina Walk 1", "city": "Dubai", "country": "AE", "plan": "paid",
        "scores": [5,5,5,5,4,5,5,5,5,5,5,4,5,5,5], "verified": 12, "replies": 2}]},
    {"slug": "demo-sample-supermarket", "name": "Sample Supermarket", "category": "retail",
     "positions": ["Cashier", "Shelf stacker", "Shift lead"],
     "locations": [
       {"slug": "vaci-ut-10", "address": "Váci út 10", "city": "Budapest", "country": "HU", "plan": "free",
        "scores": [2,1,3,2,2,3,1,2,4], "verified": 3, "replies": 1},
       {"slug": "al-wasl-road-20", "address": "Al Wasl Road 20", "city": "Dubai", "country": "AE", "plan": "free",
        "scores": [4,3,4], "verified": 1, "replies": 0}]},
    {"slug": "demo-example-logistics", "name": "Example Logistics Hub", "category": "warehouse",
     "positions": ["Warehouse picker", "Forklift driver", "Packer"],
     "locations": [
       {"slug": "soroksari-ut-99", "address": "Soroksári út 99", "city": "Budapest", "country": "HU", "plan": "expired",
        "scores": [4,3,4,3,4,4,3,4], "verified": 4, "replies": 1},
       {"slug": "dubai-investments-park", "address": "Dubai Investments Park 3", "city": "Dubai", "country": "AE", "plan": "free",
        "scores": [], "verified": 0, "replies": 0}]},
    {"slug": "demo-mock-office", "name": "Mock Office Co", "category": "office",
     "positions": ["Office coordinator", "Receptionist", "Sales assistant"],
     "locations": [
       {"slug": "business-bay-tower-5", "address": "Business Bay Tower 5", "city": "Dubai", "country": "AE", "plan": "trial",
        "scores": [4,4,5,3,4,4], "verified": 3, "replies": 1},
       {"slug": "bartok-bela-ut-5", "address": "Bartók Béla út 5", "city": "Budapest", "country": "HU", "plan": "free",
        "scores": [4,4,3,4,5], "verified": 2, "replies": 0}]}
  ]$json$;
  bodies_good text[] := array[
    'Demo review: friendly team, pay always arrives on time and the schedule is posted two weeks ahead.',
    'Demó értékelés: rendes vezető, a túlórát kifizetik, és időben megvan a beosztás.',
    'Demo review: busy shifts, but managers listen and the overtime is paid.'];
  bodies_mid text[] := array[
    'Demo review: okay place to work, though the schedule sometimes changes at short notice.',
    'Demó értékelés: elfogadható hely, de a beosztás néha az utolsó pillanatban változik.'];
  bodies_bad text[] := array[
    'Demo review: pay was late twice and the promised hours were cut.',
    'Demó értékelés: kétszer késett a fizetés, és nem kaptam meg az ígért óraszámot.'];
  replies text[] := array[
    'Demo reply: thank you for the feedback – we have shared it with the whole team.',
    'Demó válasz: köszönjük a visszajelzést, átbeszéltük a csapattal.',
    'Demo reply: we are sorry about this and have changed how we plan the rota.'];
  users uuid[] := '{}';
  uid uuid;
  co jsonb;
  lo jsonb;
  c_id uuid;
  o_id uuid;
  l_id uuid;
  r_id uuid;
  s int;
  i int;
  n int;
  locs jsonb := '{}';
  tone text[];
begin
  if exists (select 1 from public.companies where is_demo) then
    raise exception 'Demo data is already loaded. Remove it first: select private.purge_demo();';
  end if;

  -- 15 demo reviewers (they can't sign in: the email domain doesn't exist).
  for i in 1..15 loop
    insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            format('demo-reviewer-%s@demo.ratethatjob.invalid', i),
            '{"provider": "email", "providers": ["email"], "demo": true}', '{}',
            now() - interval '420 days', now())
    returning id into uid;
    users := users || uid;
  end loop;

  for co in select * from jsonb_array_elements(spec) loop
    insert into public.orgs (name, is_demo) values (co ->> 'name', true) returning id into o_id;
    insert into public.companies (name, slug, category, claimed_at, owner_org_id, is_demo)
    values (co ->> 'name', co ->> 'slug', (co ->> 'category')::public.workplace_category, now() - interval '60 days', o_id, true)
    returning id into c_id;

    for lo in select * from jsonb_array_elements(co -> 'locations') loop
      insert into public.locations (company_id, name, slug, address, city, country, category)
      values (c_id, co ->> 'name', lo ->> 'slug', lo ->> 'address', lo ->> 'city', lo ->> 'country',
              (co ->> 'category')::public.workplace_category)
      returning id into l_id;
      locs := locs || jsonb_build_object(co ->> 'slug' || '/' || (lo ->> 'slug'), l_id);

      -- Plans: paid Pro, an active trial, an expired trial (embeds say "unavailable"), or none.
      insert into public.location_plans (location_id, org_id, plan, status, trial_started_at, trial_ends_at, paid_until,
                                         trial_notice, billing_interval)
      values (l_id, o_id,
              case when lo ->> 'plan' in ('paid', 'trial') then 'pro' else 'free' end::public.plan_type,
              case lo ->> 'plan' when 'trial' then 'trialing' when 'expired' then 'past_due' else 'active' end::public.plan_status,
              case when lo ->> 'plan' in ('trial', 'expired') then now() - interval '40 days' + case when lo ->> 'plan' = 'trial' then interval '30 days' else interval '0' end end,
              case lo ->> 'plan' when 'trial' then now() + interval '20 days' when 'expired' then now() - interval '10 days' end,
              case when lo ->> 'plan' = 'paid' then now() + interval '1 year' end,
              case when lo ->> 'plan' = 'expired' then 0 end,
              case when lo ->> 'plan' = 'paid' then 'year' end::public.billing_interval);
      if lo ->> 'plan' in ('trial', 'expired') then
        insert into public.location_trials (location_id, started_at)
        select l_id, trial_started_at from public.location_plans where location_id = l_id;
      end if;

      n := jsonb_array_length(lo -> 'scores');
      for i in 1..n loop
        s := (lo -> 'scores' ->> (i - 1))::int;
        tone := case when s >= 4 then bodies_good when s = 3 then bodies_mid else bodies_bad end;
        insert into public.reviews (
          user_id, location_id, relationship, period_start, period_end, position, work_type,
          overall, manager, pay, schedule, environment,
          paid_as_promised, paid_on_time, overtime_paid, hours_as_promised, would_return,
          body, original_language, publish_mode, published_at, verification_level, status, created_at)
        values (
          users[i], l_id,
          case when i % 3 = 0 then 'former' else 'current' end::public.review_relationship,
          current_date - (200 + i * 25),
          case when i % 3 = 0 then current_date - (20 + i * 5) end,
          (co -> 'positions' ->> (i % jsonb_array_length(co -> 'positions'))),
          case when i % 4 = 0 then 'temporary' else 'permanent' end::public.work_type,
          s,
          greatest(1, least(5, s + (i % 3) - 1)),
          greatest(1, least(5, s - (i % 2))),
          greatest(1, least(5, s + ((i + 1) % 3) - 1)),
          greatest(1, least(5, s + (i % 2))),
          s >= 3 or i % 3 = 0,
          s >= 4 or (s = 3 and i % 2 = 0),
          s >= 4 and i % 5 <> 0,
          s >= 3 and i % 4 <> 1,
          s >= 4,
          case when i % 2 = 1 then tone[1 + (i % array_length(tone, 1))] end,
          case when i % 2 = 1 then case when tone[1 + (i % array_length(tone, 1))] like 'Demó%' then 'hu' else 'en' end end,
          'now', now() - make_interval(days => 3 + i * 19),
          case when i <= (lo ->> 'verified')::int then case when i % 2 = 0 then 'invited' else 'document' end else 'none' end::public.verification_level,
          'published', now() - make_interval(days => 4 + i * 19))
        returning id into r_id;
        if i <= (lo ->> 'replies')::int then
          insert into public.employer_replies (review_id, body, original_language)
          values (r_id, replies[1 + (i % 3)], case when replies[1 + (i % 3)] like 'Demó%' then 'hu' else 'en' end);
        end if;
      end loop;

      perform public.recompute_location_scores(l_id);
    end loop;
  end loop;

  -- Open jobs: quick and CV apply, all three packages (pro = featured).
  insert into public.jobs (location_id, org_id, title, work_type, schedule, pay_min, pay_max, pay_currency, pay_period,
                           description, responsibilities, requirements, offers, apply_mode, questions, tier, status)
  select (locs ->> j.loc)::uuid, l.org_id, j.title, j.work_type::public.work_type, j.schedule::public.job_schedule,
         j.pay_min, j.pay_max, j.currency, j.period::public.pay_period,
         'Demo job ad – not a real position. ' || j.description,
         j.resp, j.req, j.offers, j.mode::public.apply_mode, j.questions::jsonb, j.tier::public.job_tier, 'open'
  from (values
    ('demo-placeholder-bistro/andrassy-ut-1', 'Line cook', 'permanent', 'shifts', 2600, 3000, 'HUF', 'hour',
     'Prep and cook on a busy line. Evening and weekend shifts, rota two weeks ahead.',
     array['Prep and cook dishes on the line', 'Keep the station clean'], array['Kitchen experience'], array['Paid every two weeks', 'Staff meal every shift'],
     'quick', '[{"id":"weekends","text":"Can you work on weekends?","type":"yes_no","required":true,"must":"yes"},{"id":"foodcard","text":"Do you have a valid food handler card?","type":"yes_no","required":true,"must":"yes"},{"id":"startsoon","text":"Can you start within 2 weeks?","type":"yes_no","required":true,"must":null}]', 'pro'),
    ('demo-placeholder-bistro/andrassy-ut-1', 'Waiter', 'permanent', 'part_time', 2200, 2500, 'HUF', 'hour',
     'Serve guests at lunch and dinner. Part-time, flexible days.',
     array['Take orders and serve', 'Set up and close the floor'], array['Friendly with guests'], array['Tips shared fairly'],
     'quick', '[{"id":"language","text":"Do you speak English at a conversational level?","type":"yes_no","required":true,"must":"yes"},{"id":"evenings","text":"Can you work evenings?","type":"yes_no","required":true,"must":null}]', 'standard'),
    ('demo-placeholder-bistro/marina-walk-1', 'Barista', 'permanent', 'full_time', 4500, 5500, 'AED', 'month',
     'Make coffee for a busy marina café.',
     array['Prepare drinks', 'Keep the bar clean'], array['Barista experience'], array['Visa and accommodation support'],
     'quick', '[{"id":"workpermit","text":"Do you have the right to work in the UAE?","type":"yes_no","required":true,"must":"yes"},{"id":"experience","text":"Do you have at least 1 year of similar experience?","type":"yes_no","required":true,"must":null}]', 'basic'),
    ('demo-sample-supermarket/vaci-ut-10', 'Cashier', 'permanent', 'shifts', 2100, null, 'HUF', 'hour',
     'Work the tills in a large supermarket.',
     array['Serve customers at the till'], array['Reliable and punctual'], array['Discount on shopping'],
     'quick', '[{"id":"shifts","text":"Can you work in rotating shifts?","type":"yes_no","required":true,"must":"yes"}]', 'standard'),
    ('demo-example-logistics/soroksari-ut-99', 'Warehouse picker', 'temporary', 'shifts', 2300, 2700, 'HUF', 'hour',
     'Pick and pack orders in a modern warehouse.',
     array['Pick orders with a scanner', 'Pack and label parcels'], array['Can lift up to 20 kg'], array['Night shift bonus'],
     'quick', '[{"id":"lifting","text":"Can you lift up to 20 kg?","type":"yes_no","required":true,"must":"yes"},{"id":"nights","text":"Can you work night shifts?","type":"yes_no","required":true,"must":null}]', 'pro'),
    ('demo-example-logistics/dubai-investments-park', 'Forklift driver', 'permanent', 'full_time', 3500, 4200, 'AED', 'month',
     'Operate forklifts in a distribution centre.',
     array['Load and unload trucks'], array['Valid forklift licence'], array['Transport to the site'],
     'cv', '[{"id":"licence","text":"Do you have a valid forklift licence?","type":"yes_no","required":true,"must":"yes"}]', 'basic'),
    ('demo-mock-office/business-bay-tower-5', 'Office coordinator', 'permanent', 'full_time', 9000, 11000, 'AED', 'month',
     'Keep a busy office running smoothly.',
     array['Manage the calendar and visitors', 'Order supplies'], array['Organised, good English'], array['Hybrid work two days a week'],
     'cv', '[]', 'pro'),
    ('demo-mock-office/bartok-bela-ut-5', 'Receptionist', 'permanent', 'part_time', 380000, null, 'HUF', 'month',
     'Welcome visitors and answer calls.',
     array['Greet visitors', 'Answer the phone'], array['Good Hungarian and English'], array['Meal vouchers'],
     'cv', '[{"id":"motivation","text":"Why would you like to work with us?","type":"text","required":false,"must":null}]', 'standard')
  ) as j(loc, title, work_type, schedule, pay_min, pay_max, currency, period, description, resp, req, offers, mode, questions, tier)
  join public.location_plans l on l.location_id = (locs ->> j.loc)::uuid;

  -- The publish trigger creates job orders: mark the demo ones settled so they stay out of the queue.
  update public.job_orders o set status = 'paid', decided_at = now()
  from public.jobs j join public.locations l on l.id = j.location_id join public.companies c on c.id = l.company_id
  where o.job_id = j.id and c.is_demo;
end $$;

-- Demo jobs: ad language and expected languages.
update public.jobs j set ad_language = v.ad, languages = v.langs::jsonb
from (values
  ('Line cook', 'hu', '[{"code":"hu","level":"conversational"}]'),
  ('Waiter', 'en', '[{"code":"en","level":"conversational"},{"code":"hu","level":"basic"}]'),
  ('Barista', 'en', '[{"code":"en","level":"fluent"}]'),
  ('Cashier', 'hu', '[{"code":"hu","level":"conversational"}]'),
  ('Warehouse picker', 'hu', '[]'),
  ('Forklift driver', 'en', '[{"code":"en","level":"basic"},{"code":"hi","level":"conversational"}]'),
  ('Office coordinator', 'en', '[{"code":"en","level":"fluent"},{"code":"ar","level":"basic"}]'),
  ('Receptionist', 'hu', '[{"code":"hu","level":"native"},{"code":"en","level":"conversational"}]')
) as v(title, ad, langs), public.locations l, public.companies c
where j.title = v.title and l.id = j.location_id and c.id = l.company_id and c.is_demo;

select private.demo_summary();
