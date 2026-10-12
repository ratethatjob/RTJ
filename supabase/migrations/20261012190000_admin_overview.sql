-- Admin "Overview" tab: every live number in one call (admins only). Demo data is left out.
-- Money is returned as counts per currency and interval and as paid orders; the app prices
-- them from lib/site-config.ts (MRR/ARR, job packages), so prices live in one place.

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Budapest')::date;
begin
  perform private.require_admin();
  return (
    with real_locations as (
      select l.* from public.locations l join public.companies c on c.id = l.company_id where not c.is_demo
    ),
    real_reviews as (
      select r.* from public.reviews r join real_locations l on l.id = r.location_id
    ),
    plans as (
      select p.*, coalesce(p.billing_currency, case when l.country = 'HU' then 'huf' else 'eur' end) as currency,
        -- Paid Pro: an active Stripe subscription past its trial, or an invoice paid until a future date.
        (p.paid_until > now() and (p.trial_ends_at is null or p.paid_until > p.trial_ends_at)) as paid,
        (p.trial_ends_at > now() and not coalesce(p.paid_until > p.trial_ends_at, false)) as trial
      from public.location_plans p join real_locations l on l.id = p.location_id
    ),
    real_users as (
      select u.* from auth.users u where coalesce(u.raw_app_meta_data->>'demo', 'false') <> 'true'
    )
    select jsonb_build_object(
      'reviews', jsonb_build_object(
        'total', (select count(*) from real_reviews where status <> 'draft'),
        'published', (select count(*) from real_reviews where status = 'published'),
        'scheduled', (select count(*) from real_reviews where status = 'scheduled'),
        'scheduled_from', (select min(publish_at) from real_reviews where status = 'scheduled'),
        'scheduled_to', (select max(publish_at) from real_reviews where status = 'scheduled'),
        'pending', (select count(*) from real_reviews where status = 'pending_moderation' and hold_reason is null),
        'held', (select count(*) from real_reviews where status = 'pending_moderation' and hold_reason is not null),
        'rejected', (select count(*) from real_reviews where status = 'rejected'),
        'removed', (select count(*) from real_reviews where status = 'removed'),
        'new_today', (select count(*) from real_reviews where status <> 'draft'
                        and (created_at at time zone 'Europe/Budapest')::date = today),
        'new_7', (select count(*) from real_reviews where status <> 'draft' and created_at > now() - interval '7 days'),
        'new_30', (select count(*) from real_reviews where status <> 'draft' and created_at > now() - interval '30 days')
      ),
      'workplaces', jsonb_build_object(
        'total', (select count(*) from real_locations where osm_gone_at is null),
        'rated', (select count(*) from real_locations l join public.location_scores s on s.location_id = l.id
                  where s.review_count > 0),
        'new_30_by_source', (select coalesce(jsonb_object_agg(via, n), '{}') from (
          select coalesce(created_via, 'unknown') as via, count(*) as n from real_locations
          where created_at > now() - interval '30 days' group by 1) x)
      ),
      'companies', jsonb_build_object(
        'claims_open', (select count(*) from public.claim_requests where status = 'open'),
        'claims_approved', (select count(*) from public.claim_requests where status = 'resolved'),
        'trial', (select count(*) from plans where trial),
        'pro', (select count(*) from plans where paid),
        'canceling', (select count(*) from plans where paid and cancel_at_period_end),
        'canceled', (select count(*) from plans where stripe_status = 'canceled' and not paid),
        'past_due', (select count(*) from plans where stripe_status in ('past_due', 'unpaid')),
        -- Paying locations per currency and interval (cancelled-at-period-end ones stop renewing).
        'paying', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'interval', coalesce(billing_interval::text, 'month'), 'n', n)), '[]')
                   from (select currency, billing_interval, count(*) as n from plans
                         where paid and not cancel_at_period_end group by 1, 2) x)
      ),
      'users', jsonb_build_object(
        'total', (select count(*) from real_users),
        'active_7', (select count(*) from real_users where last_sign_in_at > now() - interval '7 days'),
        'new_7', (select count(*) from real_users where created_at > now() - interval '7 days'),
        'new_30', (select count(*) from real_users where created_at > now() - interval '30 days')
      ),
      'jobs', jsonb_build_object(
        'active', (select count(*) from public.jobs j join real_locations l on l.id = j.location_id
                   where j.status = 'open' and j.published_at is not null and (j.closes_at is null or j.closes_at >= today)),
        'expired', (select count(*) from public.jobs j join real_locations l on l.id = j.location_id
                    where j.published_at is not null and (j.status = 'closed' or j.closes_at < today)),
        -- Paid job package orders in the last 30 days (Stripe: amount in the smallest unit; bank
        -- transfer marked paid by an admin: no amount, priced by the app from the package).
        'orders_30', (select coalesce(jsonb_agg(jsonb_build_object(
            'amount', o.amount, 'currency', lower(o.currency), 'tier', o.tier, 'previous_tier', o.previous_tier, 'country', l.country)), '[]')
          from public.job_orders o join public.jobs j on j.id = o.job_id join real_locations l on l.id = j.location_id
          where o.status = 'paid' and o.decided_at > now() - interval '30 days')
      ),
      'todo', jsonb_build_object(
        'moderation', (select count(*) from public.reviews where status = 'pending_moderation'),
        'claims', (select count(*) from public.claim_requests where status = 'open'),
        'verifications', (select count(*) from public.verifications where status = 'pending'),
        'reports', (select count(*) from public.reports where status = 'open'),
        'disputes', (select count(*) from public.disputes where status = 'open'),
        'categories', (select count(*) from (
          select l.id from public.locations l
          where (l.category_source in ('name', 'ai', 'generic') or l.category_confidence = 'low' or l.category_source is null)
            and l.category_source is distinct from 'admin' and l.category_source is distinct from 'owner'
          union
          select location_id from public.category_reports where resolved_at is null) x),
        'duplicates', (select count(*) from public.admin_duplicate_pairs(200))
      ),
      'trend', (select jsonb_agg(jsonb_build_object(
          'day', d,
          'reviews', (select count(*) from real_reviews r where r.status <> 'draft'
                      and (r.created_at at time zone 'Europe/Budapest')::date = d),
          'workplaces', (select count(*) from real_locations l where (l.created_at at time zone 'Europe/Budapest')::date = d)
        ) order by d)
        from generate_series(today - 29, today, interval '1 day') g(dd), lateral (select dd::date as d) x)
    )
  );
end $$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
