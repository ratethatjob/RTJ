-- Jobs (SPEC phase 3): job posts per location, CV-free applications, and the
-- ghosting metric measured from real applications.

create type public.job_status as enum ('draft', 'open', 'closed');
create type public.job_schedule as enum ('full_time', 'part_time', 'shifts', 'flexible');
create type public.pay_period as enum ('hour', 'day', 'week', 'month', 'year');
create type public.application_status as enum
  ('submitted', 'viewed', 'interviewing', 'rejected', 'hired', 'withdrawn');
create type public.start_when as enum ('now', 'two_weeks', 'later');

-- Org that owns the location's company (null when unclaimed).
create function private.location_org(p_location_id uuid) returns uuid
language sql stable security definer
set search_path = '' as $$
  select c.owner_org_id
  from public.locations l join public.companies c on c.id = l.company_id
  where l.id = p_location_id
$$;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 120),
  work_type public.work_type not null default 'permanent',
  schedule public.job_schedule not null default 'full_time',
  pay_min numeric(12,2) check (pay_min >= 0),
  pay_max numeric(12,2) check (pay_max >= 0),
  pay_currency text check (pay_currency ~ '^[A-Z]{3}$'),
  pay_period public.pay_period,
  description text not null check (length(btrim(description)) between 1 and 8000),
  -- One optional question of the employer's own ("Do you have a food handler card?").
  question text check (length(question) <= 300),
  status public.job_status not null default 'draft',
  published_at timestamptz,
  closes_at date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pay_min is null or pay_max is null or pay_max >= pay_min),
  check ((pay_min is null and pay_max is null) or (pay_currency is not null and pay_period is not null))
);
create index on public.jobs (location_id, status);
create index on public.jobs (org_id);
create trigger set_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- First time a job opens it gets its publish date.
create function private.on_job_status() returns trigger
language plpgsql
set search_path = '' as $$
begin
  if new.status = 'open' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;
create trigger set_published_at before insert or update of status on public.jobs
  for each row execute function private.on_job_status();

alter table public.jobs enable row level security;
create policy "Public reads open jobs" on public.jobs for select
  using (status = 'open' and (closes_at is null or closes_at >= current_date));
create policy "Managers read jobs" on public.jobs for select to authenticated
  using (private.can_manage_location(location_id));
create policy "Managers create jobs" on public.jobs for insert to authenticated
  with check (private.can_manage_location(location_id)
              and org_id = private.location_org(location_id)
              and created_by = (select auth.uid()));
create policy "Managers edit jobs" on public.jobs for update to authenticated
  using (private.can_manage_location(location_id))
  with check (private.can_manage_location(location_id) and org_id = private.location_org(location_id));

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (length(phone) between 6 and 40),
  start_when public.start_when not null,
  experience boolean not null,
  answer text check (length(answer) <= 1000),
  message text check (length(message) <= 2000),
  status public.application_status not null default 'submitted',
  status_changed_at timestamptz,
  -- First decision the employer communicated (interview, rejection, hire).
  first_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, user_id),
  check (email is not null or phone is not null)
);
create index on public.job_applications (user_id);
create trigger set_updated_at before update on public.job_applications
  for each row execute function public.set_updated_at();

create function private.is_open_job(p_job_id uuid) returns boolean
language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.jobs
    where id = p_job_id and status = 'open' and (closes_at is null or closes_at >= current_date))
$$;

alter table public.job_applications enable row level security;
-- Applicants see and create their own. Employers only go through the functions
-- below, which never return the applicant's user id.
create policy "Applicants read own" on public.job_applications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Applicants apply" on public.job_applications for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'submitted'
              and first_reply_at is null and status_changed_at is null
              and private.is_open_job(job_id));
revoke update on public.job_applications from authenticated, anon;

-- Applications for one job, for its managers.
create function public.job_applications_for(p_job_id uuid)
returns table (
  id uuid, full_name text, email text, phone text, start_when public.start_when,
  experience boolean, answer text, message text, status public.application_status,
  created_at timestamptz, first_reply_at timestamptz
)
language sql stable security definer
set search_path = '' as $$
  select a.id, a.full_name, a.email, a.phone, a.start_when, a.experience, a.answer, a.message,
         a.status, a.created_at, a.first_reply_at
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  where a.job_id = p_job_id and private.can_manage_location(j.location_id)
    and a.status <> 'withdrawn'
  order by a.created_at desc
$$;

-- Totals per job for the employer's job list.
create function public.job_application_counts(p_job_ids uuid[])
returns table (job_id uuid, total int, new_count int)
language sql stable security definer
set search_path = '' as $$
  select a.job_id, count(*)::int, count(*) filter (where a.status = 'submitted')::int
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  where a.job_id = any (p_job_ids) and private.can_manage_location(j.location_id)
    and a.status <> 'withdrawn'
  group by a.job_id
$$;

-- Opening the list tells applicants their application was seen.
create function public.mark_applications_viewed(p_job_id uuid) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  if not exists (select 1 from public.jobs where id = p_job_id and private.can_manage_location(location_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.job_applications set status = 'viewed', status_changed_at = now()
  where job_id = p_job_id and status = 'submitted';
end $$;

-- Employer decision. Any decision counts as a reply for the ghosting metric.
create function public.set_application_status(p_application_id uuid, p_status public.application_status)
returns void
language plpgsql security definer
set search_path = '' as $$
declare loc uuid;
begin
  if p_status not in ('interviewing', 'rejected', 'hired') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  select j.location_id into loc
  from public.job_applications a join public.jobs j on j.id = a.job_id
  where a.id = p_application_id and a.status <> 'withdrawn';
  if loc is null or not private.can_manage_location(loc) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.job_applications set
    status = p_status,
    status_changed_at = now(),
    first_reply_at = coalesce(first_reply_at, now())
  where id = p_application_id;
  perform public.recompute_location_scores(loc);
end $$;

create function public.withdraw_application(p_application_id uuid) returns void
language sql security definer
set search_path = '' as $$
  update public.job_applications set status = 'withdrawn', status_changed_at = now()
  where id = p_application_id and user_id = (select auth.uid())
    and status in ('submitted', 'viewed', 'interviewing')
$$;

revoke execute on function public.job_applications_for(uuid) from public, anon;
revoke execute on function public.job_application_counts(uuid[]) from public, anon;
revoke execute on function public.mark_applications_viewed(uuid) from public, anon;
revoke execute on function public.set_application_status(uuid, public.application_status) from public, anon;
revoke execute on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.job_applications_for(uuid) to authenticated;
grant execute on function public.job_application_counts(uuid[]) to authenticated;
grant execute on function public.mark_applications_viewed(uuid) to authenticated;
grant execute on function public.set_application_status(uuid, public.application_status) to authenticated;
grant execute on function public.withdraw_application(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Applicant reviews from people who applied here are "Verified (application)".
-- ---------------------------------------------------------------------------

create function private.verify_applicant_review() returns trigger
language plpgsql security definer
set search_path = '' as $$
begin
  if new.relationship = 'applicant' and new.verification_level = 'none' and exists (
    select 1 from public.job_applications a
    join public.jobs j on j.id = a.job_id
    where a.user_id = new.user_id and j.location_id = new.location_id
  ) then
    update public.reviews set verification_level = 'application' where id = new.id;
  end if;
  return null;
end $$;
-- After insert: the author's insert policy only accepts unverified rows.
create trigger verify_applicant after insert on public.reviews
  for each row execute function private.verify_applicant_review();

-- ---------------------------------------------------------------------------
-- Ghosting metric: from applications once a location has 5 that are decided
-- or older than 14 days (rolling 12 months); otherwise from applicant reviews.
-- ---------------------------------------------------------------------------

alter table public.location_scores add column application_count int not null default 0;

create function private.application_ghosting(p_location_id uuid,
  out reply_rate_pct smallint, out avg_reply_days numeric, out application_count int)
language sql stable security definer
set search_path = '' as $$
  select
    round(100.0 * count(*) filter (where a.first_reply_at is not null) / nullif(count(*), 0))::smallint,
    round((avg(extract(epoch from a.first_reply_at - a.created_at) / 86400)
           filter (where a.first_reply_at is not null))::numeric, 1),
    count(*)::int
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  where j.location_id = p_location_id
    and a.status <> 'withdrawn'
    and a.created_at > now() - interval '12 months'
    and (a.first_reply_at is not null or a.created_at < now() - interval '14 days')
$$;

create or replace function public.recompute_location_scores(p_location_id uuid) returns void
language plpgsql security definer
set search_path = '' as $$
declare
  w_now timestamptz := now();
  g record;
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

  g := private.application_ghosting(p_location_id);
  update public.location_scores set
    application_count = coalesce(g.application_count, 0),
    reply_rate_pct = case when g.application_count >= 5 then g.reply_rate_pct else reply_rate_pct end,
    avg_reply_days = case when g.application_count >= 5 then g.avg_reply_days else avg_reply_days end
  where location_id = p_location_id;
end $$;

-- Applications age past 14 days without an event, so refresh nightly.
create function public.recompute_application_scores() returns int
language plpgsql security definer
set search_path = '' as $$
declare loc uuid; n int := 0;
begin
  for loc in
    select distinct j.location_id from public.jobs j
    join public.job_applications a on a.job_id = j.id
    where a.created_at > now() - interval '13 months'
  loop
    perform public.recompute_location_scores(loc);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.recompute_application_scores() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('recompute-application-scores', '23 3 * * *', 'select public.recompute_application_scores()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Public views
-- ---------------------------------------------------------------------------

create view public.public_jobs with (security_invoker = false) as
select
  j.id, j.title, j.work_type, j.schedule, j.pay_min, j.pay_max, j.pay_currency, j.pay_period,
  j.description, j.question, j.published_at, j.closes_at, j.updated_at,
  l.id as location_id, l.slug as location_slug, l.name as location_name, l.address, l.city,
  public.slugify(l.city) as city_slug, l.country, l.category,
  c.slug as company_slug, c.name as company_name
from public.jobs j
join public.locations l on l.id = j.location_id
join public.companies c on c.id = l.company_id
where j.status = 'open' and (j.closes_at is null or j.closes_at >= current_date);
grant select on public.public_jobs to anon, authenticated;

-- Appended columns keep the view replaceable.
create or replace view public.public_locations with (security_invoker = false) as
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
  s.updated_at as scores_updated_at,
  public.slugify(l.city) as city_slug,
  l.updated_at,
  coalesce(s.invited_count, 0) as invited_count,
  coalesce(s.application_count, 0) as application_count
from public.locations l
join public.companies c on c.id = l.company_id
left join public.location_scores s on s.location_id = l.id;
