-- Score of a review (owner's decision): the average of every answer the reviewer gave, the
-- "Overall" stars and the four categories (manager, pay, schedule, environment), not the
-- "Overall" stars alone. A 5 overall with 4 for pay is 4.8, not 5.0. Applicants answer only
-- "Overall", so theirs stays that one number. The location score averages these (verified
-- reviews weight 1.0, unverified 0.5), as before.

alter table public.reviews
  add column if not exists score numeric generated always as (
    (coalesce(overall, 0) + coalesce(manager, 0) + coalesce(pay, 0) + coalesce(schedule, 0) + coalesce(environment, 0))::numeric
    / nullif(num_nonnulls(overall, manager, pay, schedule, environment), 0)
  ) stored;

-- Same view, with the score (rounded for display).
create or replace view public.public_reviews with (security_invoker = false) as
 SELECT r.id,
    r.location_id,
        CASE
            WHEN r.user_id IS NULL THEN 'Former member'::text
            WHEN p.display_mode = 'username'::public.display_mode THEN p.username
            ELSE p.generated_name
        END AS display_name,
    r."position",
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
    COALESCE(( SELECT jsonb_object_agg(t.locale, t.body) AS jsonb_object_agg
           FROM public.review_translations t
          WHERE t.review_id = r.id), '{}'::jsonb) AS translations,
    er.body AS reply_body,
    er.original_language AS reply_language,
    COALESCE(( SELECT jsonb_object_agg(t.locale, t.body) AS jsonb_object_agg
           FROM public.reply_translations t
          WHERE t.reply_id = er.id), '{}'::jsonb) AS reply_translations,
    r.published_at,
    (( SELECT count(*) AS count
           FROM public.review_votes v
          WHERE v.review_id = r.id))::integer AS helpful_count,
    round(r.score, 1) AS score
   FROM public.reviews r
     LEFT JOIN public.profiles p ON p.user_id = r.user_id
     LEFT JOIN public.employer_replies er ON er.review_id = r.id
  WHERE r.status = 'published'::public.review_status;

create or replace function public.recompute_location_scores(p_location_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
    select sum(score * case when verification_level = 'none' then 0.5 else 1.0 end)
         / nullif(sum(case when verification_level = 'none' then 0.5 else 1.0 end)
                  filter (where score is not null), 0) as overall
    from public.reviews
    where location_id = p_location_id
      and status = 'published'
      and published_at > w_now - interval '15 months'
      and published_at <= w_now - interval '90 days'
  ),
  agg as (
    select
      round(sum(score * w) / nullif(sum(w) filter (where score is not null), 0), 1) as overall,
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

-- Business statistics: the monthly score is the same review score.
create or replace function public.location_stats(p_location_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_location(p_location_id) or not private.pro_active(p_location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'months', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'month', to_char(m, 'YYYY-MM'),
               'reviews', coalesce(s.n, 0),
               'overall', case when s.n >= 5 then s.avg end)
             order by m), '[]')
      from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as m
      left join (
        select date_trunc('month', published_at) as month, count(*)::int as n,
               round(sum(score * case when verification_level = 'none' then 0.5 else 1.0 end)
                     / nullif(sum(case when verification_level = 'none' then 0.5 else 1.0 end) filter (where score is not null), 0), 1) as avg
        from public.reviews
        where location_id = p_location_id and status = 'published'
          and published_at >= date_trunc('month', now()) - interval '11 months'
        group by 1
      ) s on s.month = m
    ),
    'categories', (
      select coalesce(jsonb_agg(to_jsonb(c)), '[]') from private.category_windows(p_location_id) c
    )
  );
end $$;

-- Every location with published reviews, once.
select public.recompute_location_scores(l.id)
from public.locations l
where exists (select 1 from public.reviews r where r.location_id = l.id and r.status = 'published');
