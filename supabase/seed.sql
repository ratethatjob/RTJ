-- Local development seed: illustrative data matching lib/data/sample.ts.

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'quiet.oak@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000002', 'brave.river@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000003', 'swift.fern@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000004', 'marco@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000005', 'calm.birch@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000006', 'bold.pine@example.com', 'authenticated', 'authenticated');

-- Profiles are created by the on_auth_user_created trigger; pin the names.
update public.profiles set generated_name = v.name
from (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 'Quiet Oak 42'),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'Brave River 7'),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'Swift Fern 19'),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'Calm Birch 3'),
  ('00000000-0000-4000-a000-000000000006'::uuid, 'Bold Pine 11')
) as v(id, name)
where user_id = v.id;
update public.profiles set display_mode = 'username', username = 'chef_marco'
where user_id = '00000000-0000-4000-a000-000000000004';

insert into public.companies (id, name, slug, category) values
  ('00000000-0000-4000-b000-000000000001', 'Joe''s Pizzeria', 'joes-pizzeria', 'restaurant'),
  ('00000000-0000-4000-b000-000000000002', 'Example Logistics', 'example-logistics', 'warehouse'),
  ('00000000-0000-4000-b000-000000000003', 'Example Market', 'example-market', 'retail');

insert into public.locations (id, company_id, name, slug, address, city, country, category, is_seeded) values
  ('7d1c2a0e-0000-4000-8000-000000000001', '00000000-0000-4000-b000-000000000001', 'Joe''s Pizzeria', 'w-46th-st', 'W 46th St', 'New York', 'US', 'restaurant', true),
  ('7d1c2a0e-0000-4000-8000-000000000002', '00000000-0000-4000-b000-000000000002', 'Example Logistics', 'soroksari-ut-48', 'Soroksári út 48', 'Budapest', 'HU', 'warehouse', true),
  ('7d1c2a0e-0000-4000-8000-000000000003', '00000000-0000-4000-b000-000000000003', 'Example Market', 'andrassy-ut-12', 'Andrássy út 12', 'Budapest', 'HU', 'retail', true);

insert into public.legal_entities (id, name, country, registry_id, registry_source) values
  ('00000000-0000-4000-c000-000000000001', 'Example Trade LLC', 'US', 'NY-0000001', 'example'),
  ('00000000-0000-4000-c000-000000000002', 'Example Logistics Kft.', 'HU', '01-09-000000', 'e-cegjegyzek');

insert into public.location_entity_links (location_id, legal_entity_id, source, confidence, confirmations_count, verified_at) values
  ('7d1c2a0e-0000-4000-8000-000000000001', '00000000-0000-4000-c000-000000000001', 'document', 0.9, 3, now()),
  ('7d1c2a0e-0000-4000-8000-000000000002', '00000000-0000-4000-c000-000000000002', 'registry', 1, 1, now());

insert into public.reviews (
  id, user_id, location_id, relationship, period_start, period_end, position, work_type,
  overall, manager, pay, schedule, environment,
  paid_on_time, paid_as_promised, overtime_paid, hours_as_promised, would_return,
  got_reply, reply_days, body, original_language, verification_level, status, published_at
) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-a000-000000000001', '7d1c2a0e-0000-4000-8000-000000000001',
   'former', '2024-03-01', '2026-01-31', 'Line cook', 'permanent', 4, 4, 3, 3, 5,
   true, true, false, null, true, null, null,
   'Jó csapat, és a vezető korrekt. Hétvégén nagyon pörgős, a túlórát gyakran nem fizették ki, de a bér mindig időben jött.',
   'hu', 'document', 'published', now() - interval '8 months'),
  ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-a000-000000000002', '7d1c2a0e-0000-4000-8000-000000000001',
   'applicant', '2026-05-04', null, 'Server', 'permanent', null, null, null, null, null,
   null, null, null, null, null, false, null,
   'Applied online and did a short interview. Never heard back.', 'en', 'none', 'published', now() - interval '4 months'),
  ('00000000-0000-4000-d000-000000000003', '00000000-0000-4000-a000-000000000003', '7d1c2a0e-0000-4000-8000-000000000001',
   'current', '2025-09-01', null, 'Delivery', 'temporary', 2, 3, 3, 1, 3,
   null, null, false, false, null, null, null,
   'Los turnos cambian la noche anterior casi todas las semanas. Es difícil planear algo fuera del trabajo.',
   'es', 'invited', 'published', now() - interval '3 months'),
  ('00000000-0000-4000-d000-000000000004', '00000000-0000-4000-a000-000000000004', '7d1c2a0e-0000-4000-8000-000000000001',
   'current', '2023-06-01', null, 'Pizzaiolo', 'permanent', 5, 5, 4, 4, 5,
   true, true, true, true, true, null, null, null, null, 'invited', 'published', now() - interval '2 months'),
  ('00000000-0000-4000-d000-000000000005', '00000000-0000-4000-a000-000000000005', '7d1c2a0e-0000-4000-8000-000000000001',
   'applicant', '2026-06-10', null, 'Server', 'permanent', null, null, null, null, null,
   null, null, null, null, null, true, 2,
   'Quick reply, trial shift two days later. Clear about the pay.', 'en', 'none', 'published', now() - interval '4 months'),
  ('00000000-0000-4000-d000-000000000101', '00000000-0000-4000-a000-000000000006', '7d1c2a0e-0000-4000-8000-000000000002',
   'former', '2025-10-01', '2026-03-31', 'Picker', 'temporary', 3, 3, 4, 2, 3,
   true, true, null, false, false, null, null,
   'A fizetés rendben volt, de a beosztást mindig az utolsó pillanatban kaptuk meg.',
   'hu', 'document', 'published', now() - interval '6 months');

insert into public.review_translations (review_id, locale, body, model) values
  ('00000000-0000-4000-d000-000000000001', 'en', 'Great team and the manager is fair. Weekends get very busy and overtime was often not paid out, but the pay always came on time.', 'seed'),
  ('00000000-0000-4000-d000-000000000002', 'hu', 'Online jelentkeztem, volt egy rövid interjú. Soha nem válaszoltak.', 'seed'),
  ('00000000-0000-4000-d000-000000000003', 'en', 'Shifts are changed the night before almost every week. Hard to plan anything outside work.', 'seed'),
  ('00000000-0000-4000-d000-000000000003', 'hu', 'A beosztást szinte minden héten előző este módosítják. Nehéz bármit tervezni munkán kívül.', 'seed'),
  ('00000000-0000-4000-d000-000000000005', 'hu', 'Gyors válasz, két nappal később próbanap. A bért világosan elmondták.', 'seed'),
  ('00000000-0000-4000-d000-000000000101', 'en', 'Pay was fine, but we always got the schedule at the last minute.', 'seed');

insert into public.employer_replies (id, review_id, body, original_language) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-d000-000000000001',
   'Thank you. Since March all overtime is paid with the next payslip.', 'en');
insert into public.reply_translations (reply_id, locale, body, model) values
  ('00000000-0000-4000-e000-000000000001', 'hu', 'Köszönjük. Március óta minden túlórát a következő fizetéssel együtt kifizetünk.', 'seed');

select public.recompute_location_scores(id) from public.locations;
