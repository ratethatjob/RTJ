-- Subscription lifecycle fixes and billing notices.
--
-- 1) A workplace added later to a company the org already manages gets its plan row and its
--    one-time 30-day trial (before, it showed in the dashboard without a plan, so a Pro
--    subscription for it was charged but never switched Pro on).
-- 2) A location leaving an org (deleted, or moved to another org) while its Stripe subscription
--    runs: the subscription is queued for cancellation (done by the daily /api/cron/emails).
-- 3) billing_notices: one-off billing emails that aren't in-app notifications – the yearly renewal
--    reminder 7 days before (process_renewals(), daily) and the cancellation confirmation.

create function private.location_joins_org() returns trigger
language plpgsql security definer
set search_path = '' as $$
declare o uuid;
begin
  select owner_org_id into o from public.companies where id = new.company_id;
  if o is null then return new; end if;
  insert into public.location_plans (location_id, org_id) values (new.id, o)
  on conflict (location_id) do nothing;
  perform private.start_trials(o, new.company_id);
  return new;
end $$;

create trigger location_joins_org after insert on public.locations
  for each row execute function private.location_joins_org();

-- Backfill: managed locations without a plan row, and their trial (once per location).
insert into public.location_plans (location_id, org_id)
select l.id, c.owner_org_id
from public.locations l
join public.companies c on c.id = l.company_id
where c.owner_org_id is not null
on conflict (location_id) do nothing;

select private.start_trials(c.owner_org_id, c.id)
from public.companies c
where c.owner_org_id is not null;

-- ---------------------------------------------------------------------------
-- 2) Subscriptions of locations that left the org: cancelled by the daily cron.
-- ---------------------------------------------------------------------------

create table public.stripe_cancel_queue (
  subscription_id text primary key,
  location_id uuid,
  reason text not null,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  error text
);
alter table public.stripe_cancel_queue enable row level security;

create function private.queue_subscription_cancel() returns trigger
language plpgsql security definer
set search_path = '' as $$
begin
  if old.stripe_subscription_id is not null
     and coalesce(old.stripe_status, '') in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete') then
    insert into public.stripe_cancel_queue (subscription_id, location_id, reason)
    values (old.stripe_subscription_id, old.location_id, lower(tg_op))
    on conflict (subscription_id) do nothing;
  end if;
  if tg_op = 'UPDATE' then
    -- The new org starts without the old org's subscription (the paid period is kept).
    new.stripe_subscription_id := null;
    new.stripe_status := null;
    new.stripe_period_end := null;
    new.cancel_at_period_end := false;
    return new;
  end if;
  return old;
end $$;

create trigger queue_subscription_cancel_delete after delete on public.location_plans
  for each row execute function private.queue_subscription_cancel();
create trigger queue_subscription_cancel_move before update of org_id on public.location_plans
  for each row when (old.org_id is distinct from new.org_id)
  execute function private.queue_subscription_cancel();

-- ---------------------------------------------------------------------------
-- 3) Billing notices (emailed once to the org's owners and HR by /api/cron/emails or the webhook).
-- ---------------------------------------------------------------------------

create table public.billing_notices (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  kind text not null check (kind in ('renewal_upcoming', 'subscription_canceled')),
  -- What the notice is about (period end, Stripe event id): one notice per ref.
  ref text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  unique (location_id, kind, ref)
);
alter table public.billing_notices enable row level security;

-- Yearly subscriptions renewing within 7 days get one reminder per renewal.
create function public.process_renewals(p_now timestamptz default now()) returns int
language sql security definer
set search_path = '' as $$
  with added as (
    insert into public.billing_notices (location_id, org_id, kind, ref, data)
    select p.location_id, p.org_id, 'renewal_upcoming', p.stripe_period_end::text,
           private.location_info(p.location_id)
             || jsonb_build_object('renews_at', p.stripe_period_end, 'currency', p.billing_currency)
    from public.location_plans p
    where p.billing_interval = 'year'
      and p.stripe_status = 'active'
      and not p.cancel_at_period_end
      and p.stripe_period_end > p_now
      and p.stripe_period_end <= p_now + interval '7 days'
    on conflict (location_id, kind, ref) do nothing
    returning 1
  )
  select count(*)::int from added
$$;
revoke execute on function public.process_renewals(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('process-renewals', '17 6 * * *', 'select public.process_renewals()');
  end if;
end $$;
