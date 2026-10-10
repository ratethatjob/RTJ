-- RateThatJob – initial schema (SPEC.md section 4 and 10).
--
-- Privacy rules enforced here:
--   * reviews, invites and verifications are never readable by anon/employers
--     directly; the public reads safe columns through public_* views.
--   * employers only see invite counts through invite_batch_stats(), and the
--     received count only when it is >= 5.
--   * employers can dispute unverified reviews but never delete reviews.
-- Background jobs and admin tools use the service role (bypasses RLS).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.workplace_category as enum ('restaurant', 'retail', 'warehouse', 'factory', 'office');
create type public.display_mode as enum ('generated', 'username');
create type public.entity_link_source as enum ('document', 'registry', 'claim', 'admin');
create type public.org_role as enum ('owner', 'hr', 'location_manager');
create type public.plan_type as enum ('free', 'pro');
create type public.billing_interval as enum ('month', 'year');
create type public.plan_status as enum ('active', 'trialing', 'past_due', 'canceled');
create type public.review_relationship as enum ('applicant', 'trial_shift', 'current', 'former');
create type public.work_type as enum ('permanent', 'temporary');
create type public.publish_mode as enum ('now', 'delayed', 'after_leaving');
create type public.verification_level as enum ('none', 'document', 'invited', 'application');
create type public.review_status as enum ('draft', 'pending_moderation', 'scheduled', 'published', 'rejected', 'removed');
create type public.verification_doc_type as enum ('payslip', 'contract', 'employment_letter', 'other');
create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.case_status as enum ('open', 'resolved', 'rejected');
create type public.invite_channel as enum ('email', 'sms', 'link');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Lowercase ASCII slug: "Andrássy út 12" -> "andrassy-ut-12".
create function public.slugify(value text) returns text
language sql immutable strict
set search_path = '' as $$
  select trim(both '-' from regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary,
                              regexp_replace(value, '[''’]', '', 'g'))),
    '[^a-z0-9]+', '-', 'g'))
$$;

-- Paths that can never be a company slug (they are app routes or locales).
create function public.is_reserved_slug(slug text) returns boolean
language sql immutable strict
set search_path = '' as $$
  select slug = any (array[
    'app', 'business', 'employers', 'search', 'city', 'api', 'embed', 'r',
    'login', 'signup', 'sign-in', 'sign-up', 'logout', 'account', 'settings',
    'about', 'privacy', 'terms', 'help', 'blog', 'contact', 'press', 'jobs',
    'admin', 'static', 'widget', 'sitemap', 'robots', 'rate', 'review', 'reviews',
    'en', 'hu', 'de', 'fr', 'es', 'it', 'pl', 'ro', 'sk', 'cs', 'nl', 'pt'
  ])
$$;

-- "Quiet Oak 42" style anonymous names.
create function public.generate_display_name() returns text
language sql volatile
set search_path = '' as $$
  select (array['Quiet','Brave','Swift','Calm','Bold','Bright','Gentle','Steady','Clever','Lucky',
                'Sunny','Silver','Golden','Wild','Kind','Proud','Quick','Wise','Fair','Happy'])[1 + floor(random() * 20)::int]
      || ' '
      || (array['Oak','River','Fern','Birch','Pine','Maple','Cedar','Willow','Stone','Brook',
                'Meadow','Harbor','Falcon','Otter','Fox','Robin','Heron','Comet','Ember','Cloud'])[1 + floor(random() * 20)::int]
      || ' '
      || (1 + floor(random() * 99)::int)::text
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_mode public.display_mode not null default 'generated',
  generated_name text not null default public.generate_display_name(),
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  avatar_seed text not null default substr(md5(random()::text), 1, 12),
  preferred_locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (display_mode = 'generated' or username is not null)
);

create function public.handle_new_user() returns trigger
language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Employers (orgs) – defined before companies, which reference them
-- ---------------------------------------------------------------------------

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null,
  -- Only used for location managers.
  location_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on public.org_members (user_id);

-- ---------------------------------------------------------------------------
-- Companies & locations
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and not public.is_reserved_slug(slug)),
  category public.workplace_category,
  website text,
  logo_url text,
  claimed_at timestamptz,
  owner_org_id uuid references public.orgs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_name_trgm on public.companies using gin (name extensions.gin_trgm_ops);
create index on public.companies (owner_org_id);

create table public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  registry_id text,
  registry_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country, registry_id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  address text not null,
  city text not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  lat double precision,
  lng double precision,
  google_place_id text unique,
  category public.workplace_category not null,
  is_seeded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);
create index locations_name_trgm on public.locations using gin (name extensions.gin_trgm_ops);
create index on public.locations (lower(city), category);

-- "Joe's Pizzeria" (location) is operated by "Example Trade LLC" (legal entity).
create table public.location_entity_links (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities (id) on delete cascade,
  source public.entity_link_source not null,
  confidence real not null default 0 check (confidence between 0 and 1),
  confirmations_count int not null default 0,
  -- Set after 2–3 independent document confirmations, a registry match or a claim.
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, legal_entity_id)
);

create table public.slug_redirects (
  id uuid primary key default gen_random_uuid(),
  old_path text not null unique,
  new_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.location_plans (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null unique references public.locations (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  plan public.plan_type not null default 'free',
  stripe_subscription_item_id text unique,
  billing_interval public.billing_interval,
  status public.plan_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Invites (defined before reviews, which reference them)
-- ---------------------------------------------------------------------------

create table public.invite_batches (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  channel_mix jsonb not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  sent_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Never readable by employers. Contact data is encrypted by the app and
-- deleted (set null) after the reminder window.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.invite_batches (id) on delete cascade,
  channel public.invite_channel not null,
  contact_encrypted text,
  contact_hash text,
  token text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  sent_at timestamptz,
  reminded_at timestamptz,
  opened_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, contact_hash)
);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  -- Null after the author deletes their account and keeps the review ("Former member").
  user_id uuid references auth.users (id) on delete set null,
  location_id uuid not null references public.locations (id) on delete cascade,

  relationship public.review_relationship not null,
  period_start date not null,
  period_end date,
  position text not null check (length(position) between 1 and 80),
  work_type public.work_type not null,

  -- 1–5. Category ratings are optional; overall is required except for applicants.
  overall smallint check (overall between 1 and 5),
  manager smallint check (manager between 1 and 5),
  pay smallint check (pay between 1 and 5),
  schedule smallint check (schedule between 1 and 5),
  environment smallint check (environment between 1 and 5),

  paid_as_promised boolean,
  paid_on_time boolean,
  overtime_paid boolean,
  hours_as_promised boolean,
  would_return boolean,

  got_reply boolean,
  reply_days int check (reply_days >= 0),
  interview_rounds int check (interview_rounds >= 0),

  -- One optional free-text field ("Anything others should know?"), any language.
  body text check (length(body) <= 5000),
  original_language text,

  publish_mode public.publish_mode not null default 'now',
  publish_at timestamptz,
  published_at timestamptz,

  verification_level public.verification_level not null default 'none',
  invite_id uuid references public.invites (id) on delete set null,
  status public.review_status not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (relationship = 'applicant' or overall is not null or status = 'draft'),
  check (period_end is null or period_end >= period_start)
);
create index on public.reviews (location_id, status, published_at desc);
create index on public.reviews (user_id);
create unique index reviews_one_invite_use on public.reviews (invite_id) where invite_id is not null;

create table public.review_translations (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  locale text not null,
  body text not null,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, locale)
);

create table public.employer_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  org_member_id uuid references public.org_members (id) on delete set null,
  body text not null check (length(body) between 1 and 3000),
  original_language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reply_translations (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null references public.employer_replies (id) on delete cascade,
  locale text not null,
  body text not null,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reply_id, locale)
);

-- Files live in the private "verifications" storage bucket and are deleted
-- after the decision (max 30 days).
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  storage_path text,
  doc_type public.verification_doc_type not null,
  detected_legal_entity text,
  status public.verification_status not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Employers may dispute unverified reviews only.
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  reason text not null check (length(reason) between 1 and 2000),
  status public.case_status not null default 'open',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.reviews (id) on delete cascade,
  reply_id uuid references public.employer_replies (id) on delete cascade,
  reporter_id uuid references auth.users (id) on delete set null,
  reason text not null check (length(reason) between 1 and 2000),
  status public.case_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(review_id, reply_id) = 1)
);

-- ---------------------------------------------------------------------------
-- Aggregates – rolling 12 months, written by recompute_location_scores()
-- ---------------------------------------------------------------------------

create table public.location_scores (
  location_id uuid primary key references public.locations (id) on delete cascade,
  overall numeric(2,1),
  manager numeric(2,1),
  pay numeric(2,1),
  schedule numeric(2,1),
  environment numeric(2,1),
  -- Share of "yes" answers, 0–100.
  paid_on_time_pct smallint,
  paid_as_promised_pct smallint,
  overtime_paid_pct smallint,
  hours_as_promised_pct smallint,
  would_return_pct smallint,
  -- Ghosting metric from applicant reviews.
  reply_rate_pct smallint,
  avg_reply_days numeric(4,1),
  review_count int not null default 0,
  verified_count int not null default 0,
  invited_count int not null default 0,
  -- Change in overall vs. the same window ending 90 days ago.
  overall_trend numeric(2,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Verified reviews weigh 1.0, unverified 0.5 (SPEC 6).
create function public.recompute_location_scores(p_location_id uuid) returns void
language plpgsql security definer
set search_path = '' as $$
declare
  w_now timestamptz := now();
begin
  with r as (
    select *, case when verification_level = 'none' then 0.5 else 1.0 end as w
    from public.reviews
    where location_id = p_location_id
      and status = 'published'
      and published_at > w_now - interval '12 months'
  ),
  prev as (
    select sum(overall * case when verification_level = 'none' then 0.5 else 1.0 end)
         / nullif(sum(case when verification_level = 'none' then 0.5 else 1.0 end)
                  filter (where overall is not null), 0) as overall
    from public.reviews
    where location_id = p_location_id
      and status = 'published'
      and published_at > w_now - interval '15 months'
      and published_at <= w_now - interval '90 days'
  ),
  agg as (
    select
      round(sum(overall * w) / nullif(sum(w) filter (where overall is not null), 0), 1) as overall,
      round(sum(manager * w) / nullif(sum(w) filter (where manager is not null), 0), 1) as manager,
      round(sum(pay * w) / nullif(sum(w) filter (where pay is not null), 0), 1) as pay,
      round(sum(schedule * w) / nullif(sum(w) filter (where schedule is not null), 0), 1) as schedule,
      round(sum(environment * w) / nullif(sum(w) filter (where environment is not null), 0), 1) as environment,
      round(100 * sum(w) filter (where paid_on_time) / nullif(sum(w) filter (where paid_on_time is not null), 0))::smallint as paid_on_time_pct,
      round(100 * sum(w) filter (where paid_as_promised) / nullif(sum(w) filter (where paid_as_promised is not null), 0))::smallint as paid_as_promised_pct,
      round(100 * sum(w) filter (where overtime_paid) / nullif(sum(w) filter (where overtime_paid is not null), 0))::smallint as overtime_paid_pct,
      round(100 * sum(w) filter (where hours_as_promised) / nullif(sum(w) filter (where hours_as_promised is not null), 0))::smallint as hours_as_promised_pct,
      round(100 * sum(w) filter (where would_return) / nullif(sum(w) filter (where would_return is not null), 0))::smallint as would_return_pct,
      round(100.0 * count(*) filter (where relationship = 'applicant' and got_reply)
            / nullif(count(*) filter (where relationship = 'applicant' and got_reply is not null), 0))::smallint as reply_rate_pct,
      round(avg(reply_days) filter (where relationship = 'applicant' and got_reply), 1) as avg_reply_days,
      count(*)::int as review_count,
      count(*) filter (where verification_level <> 'none')::int as verified_count,
      count(*) filter (where verification_level = 'invited')::int as invited_count
    from r
  )
  insert into public.location_scores as s (
    location_id, overall, manager, pay, schedule, environment,
    paid_on_time_pct, paid_as_promised_pct, overtime_paid_pct, hours_as_promised_pct, would_return_pct,
    reply_rate_pct, avg_reply_days, review_count, verified_count, invited_count, overall_trend
  )
  select p_location_id, a.overall, a.manager, a.pay, a.schedule, a.environment,
         a.paid_on_time_pct, a.paid_as_promised_pct, a.overtime_paid_pct, a.hours_as_promised_pct, a.would_return_pct,
         a.reply_rate_pct, a.avg_reply_days, a.review_count, a.verified_count, a.invited_count,
         round(a.overall - p.overall, 1)
  from agg a, prev p
  on conflict (location_id) do update set
    overall = excluded.overall, manager = excluded.manager, pay = excluded.pay,
    schedule = excluded.schedule, environment = excluded.environment,
    paid_on_time_pct = excluded.paid_on_time_pct, paid_as_promised_pct = excluded.paid_as_promised_pct,
    overtime_paid_pct = excluded.overtime_paid_pct, hours_as_promised_pct = excluded.hours_as_promised_pct,
    would_return_pct = excluded.would_return_pct, reply_rate_pct = excluded.reply_rate_pct,
    avg_reply_days = excluded.avg_reply_days, review_count = excluded.review_count,
    verified_count = excluded.verified_count, invited_count = excluded.invited_count,
    overall_trend = excluded.overall_trend, updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'orgs', 'org_members', 'companies', 'legal_entities', 'locations',
    'location_entity_links', 'slug_redirects', 'location_plans', 'invite_batches', 'invites',
    'reviews', 'review_translations', 'employer_replies', 'reply_translations',
    'verifications', 'disputes', 'reports'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create function public.has_org_role(p_org_id uuid, p_roles public.org_role[]) returns boolean
language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = (select auth.uid()) and role = any (p_roles)
  )
$$;

-- Owner/HR of the company's org, or a location manager assigned to it.
create function public.can_manage_location(p_location_id uuid) returns boolean
language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1
    from public.locations l
    join public.companies c on c.id = l.company_id
    join public.org_members m on m.org_id = c.owner_org_id
    where l.id = p_location_id
      and m.user_id = (select auth.uid())
      and (m.role in ('owner', 'hr')
           or (m.role = 'location_manager' and l.id = any (m.location_ids)))
  )
$$;

create function public.is_published_review(p_review_id uuid) returns boolean
language sql stable security definer
set search_path = '' as $$
  select exists (select 1 from public.reviews where id = p_review_id and status = 'published')
$$;

-- Published review at one of the caller's locations.
create function public.can_reply_to_review(p_review_id uuid) returns boolean
language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.reviews r
    where r.id = p_review_id and r.status = 'published'
      and public.can_manage_location(r.location_id))
$$;

-- Published, unverified review at a location of the given org.
create function public.can_dispute_review(p_review_id uuid, p_org_id uuid) returns boolean
language sql stable security definer
set search_path = '' as $$
  select public.has_org_role(p_org_id, '{owner,hr}') and exists (
    select 1 from public.reviews r
    join public.locations l on l.id = r.location_id
    join public.companies c on c.id = l.company_id
    where r.id = p_review_id
      and r.status = 'published'
      and r.verification_level = 'none'
      and c.owner_org_id = p_org_id)
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.companies enable row level security;
alter table public.legal_entities enable row level security;
alter table public.locations enable row level security;
alter table public.location_entity_links enable row level security;
alter table public.slug_redirects enable row level security;
alter table public.location_plans enable row level security;
alter table public.invite_batches enable row level security;
alter table public.invites enable row level security;
alter table public.reviews enable row level security;
alter table public.review_translations enable row level security;
alter table public.employer_replies enable row level security;
alter table public.reply_translations enable row level security;
alter table public.verifications enable row level security;
alter table public.disputes enable row level security;
alter table public.reports enable row level security;
alter table public.location_scores enable row level security;

-- Public directory data.
create policy "Public read" on public.companies for select using (true);
create policy "Public read" on public.locations for select using (true);
create policy "Public read" on public.legal_entities for select using (true);
create policy "Public read verified links" on public.location_entity_links
  for select using (verified_at is not null);
create policy "Public read" on public.slug_redirects for select using (true);
create policy "Public read" on public.location_scores for select using (true);

-- Profiles: only the owner. Public names go through public_reviews.
create policy "Own profile" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Update own profile" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Orgs and members.
create policy "Members read org" on public.orgs for select to authenticated
  using (public.has_org_role(id, '{owner,hr,location_manager}'));
create policy "Owner updates org" on public.orgs for update to authenticated
  using (public.has_org_role(id, '{owner}'));
create policy "Members read members" on public.org_members for select to authenticated
  using (public.has_org_role(org_id, '{owner,hr,location_manager}'));
create policy "Owner manages members" on public.org_members for all to authenticated
  using (public.has_org_role(org_id, '{owner}'))
  with check (public.has_org_role(org_id, '{owner}'));
create policy "Members read plans" on public.location_plans for select to authenticated
  using (public.has_org_role(org_id, '{owner,hr,location_manager}'));

-- Reviews: authors manage their own unpublished drafts. Publishing,
-- verification levels and invite links are set by server jobs only.
create policy "Author reads own" on public.reviews for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Author creates" on public.reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status in ('draft', 'pending_moderation')
    and verification_level = 'none'
    and invite_id is null
    and published_at is null
  );
create policy "Author edits unpublished" on public.reviews for update to authenticated
  using (user_id = (select auth.uid()) and status in ('draft', 'pending_moderation'))
  with check (
    user_id = (select auth.uid())
    and status in ('draft', 'pending_moderation')
    and verification_level = 'none'
    and invite_id is null
    and published_at is null
  );
create policy "Author deletes own" on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Read translations of published" on public.review_translations for select
  using (public.is_published_review(review_id));

-- Employer replies: anyone reads replies on published reviews; managers of
-- the location write them.
create policy "Read replies on published" on public.employer_replies for select
  using (public.is_published_review(review_id));
create policy "Managers reply" on public.employer_replies for insert to authenticated
  with check (public.can_reply_to_review(review_id));
create policy "Managers edit reply" on public.employer_replies for update to authenticated
  using (public.can_reply_to_review(review_id))
  with check (public.can_reply_to_review(review_id));
create policy "Read reply translations" on public.reply_translations for select using (true);

-- Verification documents: the author uploads and sees status; admins use the service role.
create policy "Author reads own" on public.verifications for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id and r.user_id = (select auth.uid())));
create policy "Author uploads" on public.verifications for insert to authenticated
  with check (
    status = 'pending' and reviewed_by is null
    and exists (select 1 from public.reviews r where r.id = review_id and r.user_id = (select auth.uid())));

-- Disputes: owner/HR, unverified reviews of their own locations only.
create policy "Org reads disputes" on public.disputes for select to authenticated
  using (public.has_org_role(org_id, '{owner,hr}'));
create policy "Org disputes unverified" on public.disputes for insert to authenticated
  with check (
    status = 'open'
    and created_by = (select auth.uid())
    and public.can_dispute_review(review_id, org_id));

create policy "Anyone signed in reports" on public.reports for insert to authenticated
  with check (status = 'open' and reporter_id = (select auth.uid()));

-- Invite batches: managers create and read batches; invites themselves are
-- server-only (no policies => no access).
create policy "Managers read batches" on public.invite_batches for select to authenticated
  using (public.can_manage_location(location_id));
create policy "Managers create batches" on public.invite_batches for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_manage_location(location_id)
    and exists (
      select 1 from public.locations l join public.companies c on c.id = l.company_id
      where l.id = location_id and c.owner_org_id = org_id));

-- Employer-facing invite counts; reviews received only shown when >= 5.
create function public.invite_batch_stats(p_location_id uuid)
returns table (invites_sent bigint, reviews_received bigint)
language plpgsql stable security definer
set search_path = '' as $$
declare received bigint;
begin
  if not public.can_manage_location(p_location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select count(*) into received
  from public.reviews r
  join public.invites i on i.id = r.invite_id
  join public.invite_batches b on b.id = i.batch_id
  where b.location_id = p_location_id and r.status = 'published';

  return query
    select coalesce(sum(b.sent_count), 0)::bigint,
           case when received >= 5 then received else null end
    from public.invite_batches b
    where b.location_id = p_location_id;
end $$;

-- ---------------------------------------------------------------------------
-- Public views (run as owner; expose only safe columns)
-- ---------------------------------------------------------------------------

create view public.public_locations with (security_invoker = false) as
select
  l.id,
  c.slug as company_slug,
  c.name as company_name,
  l.slug,
  l.name,
  l.address,
  l.city,
  l.country,
  l.category,
  l.is_seeded,
  c.claimed_at is not null as claimed,
  (select e.name
     from public.location_entity_links k
     join public.legal_entities e on e.id = k.legal_entity_id
    where k.location_id = l.id and k.verified_at is not null
    order by k.confidence desc, k.verified_at
    limit 1) as legal_entity_name,
  s.overall, s.manager, s.pay, s.schedule, s.environment,
  s.paid_on_time_pct, s.paid_as_promised_pct, s.overtime_paid_pct, s.hours_as_promised_pct,
  s.reply_rate_pct, s.avg_reply_days,
  coalesce(s.review_count, 0) as review_count,
  coalesce(s.verified_count, 0) as verified_count,
  s.updated_at as scores_updated_at
from public.locations l
join public.companies c on c.id = l.company_id
left join public.location_scores s on s.location_id = l.id;

-- Never exposes user_id, invite_id or anything identifying the author.
create view public.public_reviews with (security_invoker = false) as
select
  r.id,
  r.location_id,
  case
    when r.user_id is null then 'Former member'
    when p.display_mode = 'username' then p.username
    else p.generated_name
  end as display_name,
  r.position,
  r.work_type,
  r.relationship,
  r.period_start,
  r.period_end,
  r.overall,
  r.verification_level,
  r.paid_on_time,
  r.paid_as_promised,
  r.overtime_paid,
  r.hours_as_promised,
  r.would_return,
  r.got_reply,
  r.reply_days,
  r.body,
  r.original_language,
  coalesce((select jsonb_object_agg(t.locale, t.body)
              from public.review_translations t where t.review_id = r.id), '{}') as translations,
  er.body as reply_body,
  er.original_language as reply_language,
  coalesce((select jsonb_object_agg(t.locale, t.body)
              from public.reply_translations t where t.reply_id = er.id), '{}') as reply_translations,
  r.published_at
from public.reviews r
left join public.profiles p on p.user_id = r.user_id
left join public.employer_replies er on er.review_id = r.id
where r.status = 'published';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select on public.public_locations, public.public_reviews to anon, authenticated;
revoke execute on function public.recompute_location_scores(uuid) from public, anon, authenticated;
revoke execute on function public.invite_batch_stats(uuid) from public, anon;
grant execute on function public.invite_batch_stats(uuid) to authenticated;
