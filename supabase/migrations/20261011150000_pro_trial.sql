-- Pro per location: a 30-day free trial (no card) starts when a claim is approved, once per
-- location; after that Pro is paid (marked by an admin until online payment is connected).
-- The RateThatJob Index embeds, early warnings and statistics need an active trial or payment.

alter table public.location_plans
  add column trial_started_at timestamptz,
  add column trial_ends_at timestamptz,
  add column paid_until timestamptz,
  -- Last trial notice sent: 7 or 1 (days before the end), 0 (ended).
  add column trial_notice smallint;

-- One trial per location, ever (kept even if the location changes org).
create table public.location_trials (
  location_id uuid primary key references public.locations (id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.location_trials enable row level security;

create function private.pro_active(p_location_id uuid) returns boolean
language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.location_plans p
    where p.location_id = p_location_id and (p.trial_ends_at > now() or p.paid_until > now()))
$$;

-- Starts the trial for the company's locations in this org that never had one.
create function private.start_trials(p_org_id uuid, p_company_id uuid) returns void
language sql security definer
set search_path = '' as $$
  with started as (
    insert into public.location_trials (location_id)
    select l.id
    from public.locations l
    join public.location_plans p on p.location_id = l.id and p.org_id = p_org_id
    where l.company_id = p_company_id
    on conflict (location_id) do nothing
    returning location_id, started_at
  )
  update public.location_plans p
  set trial_started_at = s.started_at,
      trial_ends_at = s.started_at + interval '30 days',
      plan = 'pro',
      status = 'trialing'
  from started s
  where p.location_id = s.location_id
$$;

-- Same as before, plus the trial.
create or replace function private.approve_claim(p_claim_id uuid) returns uuid
language plpgsql security definer
set search_path = '' as $$
declare
  c public.claim_requests;
  o_id uuid;
  comp_id uuid;
  existing_owner uuid;
begin
  select * into c from public.claim_requests where id = p_claim_id and status = 'open' for update;
  if c.id is null then raise exception 'claim not open'; end if;

  select company_id into comp_id from public.locations where id = c.location_id;
  select owner_org_id into existing_owner from public.companies where id = comp_id;

  if existing_owner is not null then
    o_id := existing_owner;
  else
    select org_id into o_id from public.org_members
    where user_id = c.user_id and role = 'owner' limit 1;
    if o_id is null then
      insert into public.orgs (name) values (c.org_name) returning id into o_id;
    end if;
    update public.companies set owner_org_id = o_id, claimed_at = now() where id = comp_id;
  end if;

  insert into public.org_members (org_id, user_id, role)
  values (o_id, c.user_id, 'owner')
  on conflict (org_id, user_id) do nothing;

  insert into public.location_plans (location_id, org_id)
  select l.id, o_id from public.locations l where l.company_id = comp_id
  on conflict (location_id) do nothing;

  perform private.start_trials(o_id, comp_id);

  update public.claim_requests set status = 'resolved' where id = p_claim_id;
  return o_id;
end $$;

-- ---------------------------------------------------------------------------
-- Activation requests: invoiced manually until online payment is connected.
-- ---------------------------------------------------------------------------

create table public.plan_orders (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  billing_interval public.billing_interval not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  paid_until timestamptz
);
create unique index plan_orders_one_pending on public.plan_orders (location_id) where status = 'pending';
alter table public.plan_orders enable row level security;
create policy "Org owners and HR read plan orders" on public.plan_orders for select to authenticated
  using (private.has_org_role(org_id, '{owner,hr}'));

create function public.request_pro(p_location_id uuid, p_interval public.billing_interval) returns void
language plpgsql security definer
set search_path = '' as $$
declare o uuid;
begin
  select org_id into o from public.location_plans where location_id = p_location_id;
  if o is null or not private.has_org_role(o, '{owner,hr}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.plan_orders (location_id, org_id, billing_interval, created_by)
  values (p_location_id, o, p_interval, auth.uid())
  on conflict (location_id) where status = 'pending' do update set billing_interval = excluded.billing_interval;
end $$;

create function public.admin_plan_orders()
returns table (
  id uuid, created_at timestamptz, billing_interval public.billing_interval, location_id uuid,
  location text, address text, country text, org_name text,
  trial_ends_at timestamptz, paid_until timestamptz
)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select o.id, o.created_at, o.billing_interval, l.id, l.name, l.address, l.country, g.name,
         p.trial_ends_at, p.paid_until
  from public.plan_orders o
  join public.locations l on l.id = o.location_id
  join public.orgs g on g.id = o.org_id
  left join public.location_plans p on p.location_id = o.location_id
  where o.status = 'pending'
  order by o.created_at;
end $$;

-- Paid: Pro runs one month or year from now, or from the end of the trial or the paid period.
create function public.admin_decide_plan_order(p_order_id uuid, p_paid boolean) returns void
language plpgsql security definer
set search_path = '' as $$
declare
  o public.plan_orders;
  until timestamptz;
begin
  perform private.require_admin();
  select * into o from public.plan_orders where id = p_order_id and status = 'pending' for update;
  if o.id is null then return; end if;
  if p_paid then
    update public.location_plans p
    set paid_until = greatest(now(), coalesce(p.paid_until, now()), coalesce(p.trial_ends_at, now()))
                     + case when o.billing_interval = 'year' then interval '1 year' else interval '1 month' end,
        plan = 'pro',
        status = 'active',
        billing_interval = o.billing_interval
    where p.location_id = o.location_id
    returning p.paid_until into until;
  end if;
  update public.plan_orders
  set status = case when p_paid then 'paid' else 'cancelled' end, decided_at = now(), paid_until = until
  where id = o.id;
end $$;

revoke execute on function public.request_pro(uuid, public.billing_interval) from public, anon;
revoke execute on function public.admin_plan_orders() from public, anon;
revoke execute on function public.admin_decide_plan_order(uuid, boolean) from public, anon;
grant execute on function public.request_pro(uuid, public.billing_interval) to authenticated;
grant execute on function public.admin_plan_orders() to authenticated;
grant execute on function public.admin_decide_plan_order(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Trial notices: 7 and 1 day(s) before the end, and once after it ended unpaid.
-- In-app for owners and HR; emailed by /api/cron/emails when Resend is set up.
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'review_published', 'reply', 'application_status', 'followed_review', 'followed_job', 'new_application',
  'application_message', 'trial_ending', 'trial_ended'));
alter table public.notifications add column emailed_at timestamptz;

create function public.process_trials(p_now timestamptz default now()) returns int
language plpgsql security definer
set search_path = '' as $$
declare
  r record;
  stage smallint;
  days int;
  n int := 0;
begin
  for r in
    select p.* from public.location_plans p
    where p.trial_ends_at is not null
      and coalesce(p.trial_notice, 99) > 0
      and not coalesce(p.paid_until > p.trial_ends_at, false)
  loop
    days := ceil(extract(epoch from r.trial_ends_at - p_now) / 86400)::int;
    stage := case
      when r.trial_ends_at <= p_now then 0
      when days <= 1 and coalesce(r.trial_notice, 99) > 1 then 1
      when days <= 7 and coalesce(r.trial_notice, 99) > 7 then 7
    end;
    continue when stage is null;
    insert into public.notifications (user_id, kind, data)
    select m.user_id,
           case when stage = 0 then 'trial_ended' else 'trial_ending' end,
           private.location_info(r.location_id) || jsonb_build_object('days', greatest(days, 0))
    from public.org_members m
    where m.org_id = r.org_id and m.role in ('owner', 'hr');
    update public.location_plans
    set trial_notice = stage,
        status = case when stage = 0 then 'past_due'::public.plan_status else status end,
        plan = case when stage = 0 then 'free'::public.plan_type else plan end
    where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.process_trials(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('process-trials', '7 6 * * *', 'select public.process_trials()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Public: whether a location's Index is on (shown on embeds instead of the score).
-- ---------------------------------------------------------------------------

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
  coalesce(s.application_count, 0) as application_count,
  private.pro_active(l.id) as index_active
from public.locations l
join public.companies c on c.id = l.company_id
left join public.location_scores s on s.location_id = l.id;
