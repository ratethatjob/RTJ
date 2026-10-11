-- Existing workplaces into the finer categories, by name (the old five values all still exist).

update public.locations l set category = m.category::public.workplace_category
from public.companies c,
  (values
    ('(fog[aá]szat|dental|dentist|fogorvos)', 'dental'),
    ('(supermarket|szupermarket|grocery|élelmiszer|abc\M)', 'supermarket'),
    ('(gyógyszertár|patika|pharmacy)', 'pharmacy'),
    ('(hotel|szálloda|hostel|panzió)', 'hotel'),
    ('(kórház|klinika|hospital|clinic|rendelő)', 'healthcare')
  ) as m(pattern, category)
where c.id = l.company_id
  and l.category in ('restaurant', 'retail', 'office')
  and (l.name ~* m.pattern or c.name ~* m.pattern);

update public.companies c set category = l.category
from public.locations l
where l.company_id = c.id and c.category is distinct from l.category
  and (select count(*) from public.locations where company_id = c.id) = 1;
