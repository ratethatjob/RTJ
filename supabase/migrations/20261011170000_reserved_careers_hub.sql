-- /careers-hub (RateThatJob Careers Hub) can't be taken by a company slug.
create or replace function public.is_reserved_slug(slug text) returns boolean
language sql immutable strict
set search_path = '' as $$
  select slug = any (array[
    'app', 'business', 'employers', 'search', 'city', 'api', 'embed', 'r',
    'login', 'signup', 'sign-in', 'sign-up', 'logout', 'account', 'settings',
    'about', 'privacy', 'terms', 'help', 'blog', 'contact', 'press', 'jobs',
    'admin', 'static', 'widget', 'sitemap', 'robots', 'rate', 'review', 'reviews',
    'pricing', 'imprint', 'impresszum', 'cookies', 'legal', 'sitemaps', 'reports',
    'ratethatjob-index', 'career-page', 'careers-hub',
    'en', 'hu', 'de', 'fr', 'es', 'it', 'pl', 'ro', 'sk', 'cs', 'nl', 'pt'
  ])
$$;
