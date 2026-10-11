-- Stripe payments.
--   Pro: a Stripe subscription per location (Checkout in subscription mode), one Stripe customer
--   per org. The webhook mirrors the subscription into location_plans; paid_until follows the
--   paid period, so the existing "currently unavailable" logic applies when payment stops.
--   Job ads: a job goes live (or moves up a package) only through a paid job_order – paid by card
--   (Checkout, webhook) or marked paid by an admin (bank transfer).
-- Webhook events are recorded once in stripe_events (idempotency).

-- orgs.stripe_customer_id already exists (initial schema). Owners may only rename their org:
-- the Stripe customer (and is_demo) are set by the server.
revoke update on public.orgs from authenticated, anon;
grant update (name) on public.orgs to authenticated;

alter table public.location_plans
  add column stripe_subscription_id text unique,
  add column stripe_status text,
  add column stripe_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false,
  add column billing_currency text;

alter table public.job_orders
  add column amount bigint,
  add column currency text,
  add column paid_via text check (paid_via in ('stripe', 'manual')),
  add column stripe_session_id text,
  add column stripe_payment_intent text;
create index job_orders_pending_job on public.job_orders (job_id) where status = 'pending';

create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- ---------------------------------------------------------------------------
-- Jobs: going live and package upgrades need a paid order.
-- ---------------------------------------------------------------------------

-- Signed-in users can't publish a never-published job or raise a published job's package
-- themselves; fulfill_job_order (running as the owner) does it once the order is paid.
-- Reopening a closed job that was paid for stays free.
create function private.guard_job_payment() returns trigger
language plpgsql
set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.status = 'open' then raise exception 'payment required' using errcode = '42501'; end if;
  elsif old.published_at is null and new.status = 'open' then
    raise exception 'payment required' using errcode = '42501';
  elsif old.published_at is not null and new.tier > old.tier then
    raise exception 'payment required' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_job_payment before insert or update on public.jobs
  for each row execute function private.guard_job_payment();

-- Orders now exist before the job goes live, so publishing no longer creates one.
create or replace function private.on_job_published() returns trigger
language plpgsql security definer
set search_path = '' as $$
begin
  return null;
end $$;

-- The order to pay for publishing (any package) or for an upgrade (the difference).
-- Reuses the job's pending order. A draft takes the chosen package right away.
create function public.request_job_order(p_job_id uuid, p_tier public.job_tier)
returns table (order_id uuid, tier public.job_tier, previous_tier public.job_tier)
language plpgsql security definer
set search_path = '' as $$
declare
  j public.jobs;
  prev public.job_tier;
  o_id uuid;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if j.id is null or not private.can_manage_location(j.location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if j.published_at is null then
    update public.jobs set tier = p_tier where id = j.id and jobs.tier <> p_tier;
  elsif p_tier <= j.tier then
    raise exception 'package can only be upgraded' using errcode = '22023';
  else
    prev := j.tier;
  end if;

  select o.id into o_id from public.job_orders o
  where o.job_id = j.id and o.status = 'pending' order by o.created_at desc limit 1;
  if o_id is null then
    insert into public.job_orders (job_id, org_id, tier, previous_tier, created_by)
    values (j.id, j.org_id, p_tier, prev, (select auth.uid()))
    returning id into o_id;
  else
    update public.job_orders
    set tier = p_tier, previous_tier = prev, amount = null, currency = null, stripe_session_id = null
    where id = o_id;
  end if;
  return query select o_id, p_tier, prev;
end $$;

-- Marks the order paid and applies it: a draft goes live with the package, a live job moves up.
-- Returns false when it was already paid (webhook retries, double clicks).
create function private.fulfill_job_order(
  p_order_id uuid, p_via text, p_session_id text default null, p_payment_intent text default null,
  p_amount bigint default null, p_currency text default null
) returns boolean
language plpgsql security definer
set search_path = '' as $$
declare
  o public.job_orders;
begin
  select * into o from public.job_orders where id = p_order_id for update;
  if o.id is null or o.status = 'paid' then return false; end if;
  update public.job_orders
  set status = 'paid', decided_at = now(), paid_via = p_via,
      stripe_session_id = coalesce(p_session_id, stripe_session_id),
      stripe_payment_intent = coalesce(p_payment_intent, stripe_payment_intent),
      amount = coalesce(p_amount, amount), currency = coalesce(p_currency, currency)
  where id = o.id;
  update public.jobs
  set tier = case when published_at is null or o.tier > tier then o.tier else tier end,
      status = case when published_at is null then 'open'::public.job_status else status end
  where id = o.job_id;
  return true;
end $$;

-- Service role (webhook): paid by card.
create function public.stripe_fulfill_job_order(
  p_order_id uuid, p_session_id text, p_payment_intent text, p_amount bigint, p_currency text
) returns boolean
language sql security definer
set search_path = '' as $$
  select private.fulfill_job_order(p_order_id, 'stripe', p_session_id, p_payment_intent, p_amount, p_currency)
$$;

-- Service role: a Checkout session was opened for the order (amount in the smallest unit).
create function public.stripe_job_checkout_started(
  p_order_id uuid, p_session_id text, p_amount bigint, p_currency text
) returns void
language sql security definer
set search_path = '' as $$
  update public.job_orders set stripe_session_id = p_session_id, amount = p_amount, currency = p_currency
  where id = p_order_id and status = 'pending'
$$;

-- Admin: paid by bank transfer (applies the order) or cancelled.
create or replace function public.admin_decide_order(p_order_id uuid, p_paid boolean) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  if p_paid then
    perform private.fulfill_job_order(p_order_id, 'manual');
  else
    update public.job_orders set status = 'cancelled', decided_at = now()
    where id = p_order_id and status = 'pending';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Pro subscriptions
-- ---------------------------------------------------------------------------

-- Service role (webhook): mirrors one Stripe subscription into the location's plan.
-- 'active' extends paid_until to the end of the paid period; while 'trialing' our own trial
-- covers it; past_due/canceled don't extend, so Pro ends with the last paid period.
create function public.stripe_sync_subscription(
  p_location_id uuid, p_subscription_id text, p_customer_id text, p_status text,
  p_period_end timestamptz, p_cancel_at_period_end boolean, p_interval text, p_currency text
) returns uuid
language plpgsql security definer
set search_path = '' as $$
declare
  p public.location_plans;
begin
  select * into p from public.location_plans where location_id = p_location_id for update;
  if p.id is null then return null; end if;
  -- An old subscription's events don't overwrite a newer one.
  if p.stripe_subscription_id is not null and p.stripe_subscription_id <> p_subscription_id
     and coalesce(p.stripe_status, '') in ('active', 'trialing', 'past_due')
     and p_status not in ('active', 'trialing') then
    return p.org_id;
  end if;
  update public.location_plans set
    stripe_subscription_id = p_subscription_id,
    stripe_status = p_status,
    stripe_period_end = p_period_end,
    cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
    billing_currency = coalesce(p_currency, billing_currency),
    billing_interval = coalesce(p_interval::public.billing_interval, billing_interval),
    paid_until = case when p_status = 'active' and p_period_end is not null
                      then greatest(coalesce(paid_until, p_period_end), p_period_end) else paid_until end,
    plan = case when p_status in ('active', 'trialing') then 'pro'::public.plan_type else plan end,
    status = case p_status
               when 'active' then 'active'
               when 'trialing' then 'trialing'
               when 'past_due' then 'past_due'
               when 'unpaid' then 'past_due'
               when 'canceled' then 'canceled'
               when 'incomplete_expired' then 'canceled'
               else status::text end::public.plan_status
  where id = p.id;
  update public.orgs set stripe_customer_id = p_customer_id
  where id = p.org_id and stripe_customer_id is null and p_customer_id is not null;
  return p.org_id;
end $$;

-- Pro is on during our trial, a paid period, or a Stripe subscription that is active/trialing.
create or replace function private.pro_active(p_location_id uuid) returns boolean
language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.location_plans p
    where p.location_id = p_location_id
      and (p.trial_ends_at > now() or p.paid_until > now() or p.stripe_status in ('active', 'trialing')))
$$;

-- Same as before, but no trial notices for locations that already subscribed.
create or replace function public.process_trials(p_now timestamptz default now()) returns int
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
      and coalesce(p.stripe_status, '') not in ('active', 'trialing')
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

-- ---------------------------------------------------------------------------
-- Admin views
-- ---------------------------------------------------------------------------

-- Pending job orders and the ones paid in the last 30 days, with the Stripe references.
create function public.admin_job_order_list()
returns table (
  id uuid, created_at timestamptz, status text, tier public.job_tier, previous_tier public.job_tier,
  job_id uuid, job_title text, location text, address text, country text, org_name text,
  amount bigint, currency text, paid_via text, decided_at timestamptz,
  stripe_session_id text, stripe_payment_intent text, stripe_customer_id text
)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select o.id, o.created_at, o.status, o.tier, o.previous_tier, j.id, j.title, l.name, l.address, l.country,
         g.name, o.amount, o.currency, o.paid_via, o.decided_at,
         o.stripe_session_id, o.stripe_payment_intent, g.stripe_customer_id
  from public.job_orders o
  join public.jobs j on j.id = o.job_id
  join public.locations l on l.id = j.location_id
  join public.orgs g on g.id = o.org_id
  where o.status = 'pending' or (o.status = 'paid' and o.decided_at > now() - interval '30 days')
  order by o.status = 'pending' desc, coalesce(o.decided_at, o.created_at) desc;
end $$;

-- Locations with a Stripe subscription.
create function public.admin_stripe_subscriptions()
returns table (
  location_id uuid, location text, address text, org_name text, stripe_status text,
  billing_interval public.billing_interval, billing_currency text, paid_until timestamptz,
  stripe_period_end timestamptz, cancel_at_period_end boolean,
  stripe_subscription_id text, stripe_customer_id text
)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select l.id, l.name, l.address, g.name, p.stripe_status, p.billing_interval, p.billing_currency,
         p.paid_until, p.stripe_period_end, p.cancel_at_period_end, p.stripe_subscription_id, g.stripe_customer_id
  from public.location_plans p
  join public.locations l on l.id = p.location_id
  join public.orgs g on g.id = p.org_id
  where p.stripe_subscription_id is not null
  order by p.stripe_status = 'past_due' desc, l.name;
end $$;

revoke execute on function public.request_job_order(uuid, public.job_tier) from public, anon;
grant execute on function public.request_job_order(uuid, public.job_tier) to authenticated;
revoke execute on function public.stripe_fulfill_job_order(uuid, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.stripe_fulfill_job_order(uuid, text, text, bigint, text) to service_role;
revoke execute on function public.stripe_job_checkout_started(uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.stripe_job_checkout_started(uuid, text, bigint, text) to service_role;
revoke execute on function public.stripe_sync_subscription(uuid, text, text, text, timestamptz, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.stripe_sync_subscription(uuid, text, text, text, timestamptz, boolean, text, text)
  to service_role;
revoke execute on function public.admin_job_order_list() from public, anon;
grant execute on function public.admin_job_order_list() to authenticated;
revoke execute on function public.admin_stripe_subscriptions() from public, anon;
grant execute on function public.admin_stripe_subscriptions() to authenticated;
