-- Employer statistics and early warnings. Aggregates only, n >= 5 (SPEC 10).

-- Category averages: last 60 days vs. the 12 months before that (weighted like the scores).
create function private.category_windows(p_location_id uuid)
returns table (category text, recent numeric, recent_n int, baseline numeric, baseline_n int)
language sql stable security definer
set search_path = '' as $$
  with r as (
    select published_at > now() - interval '60 days' as is_recent,
           case when verification_level = 'none' then 0.5 else 1.0 end as w,
           overall, manager, pay, schedule, environment
    from public.reviews
    where location_id = p_location_id and status = 'published'
      and published_at > now() - interval '14 months'
  ),
  v as (
    select is_recent, w, c.category, c.value
    from r cross join lateral (values
      ('overall', r.overall), ('manager', r.manager), ('pay', r.pay),
      ('schedule', r.schedule), ('environment', r.environment)) as c(category, value)
    where c.value is not null
  )
  select category,
         case when count(*) filter (where is_recent) >= 5
              then round(sum(value * w) filter (where is_recent) / sum(w) filter (where is_recent), 1) end,
         (count(*) filter (where is_recent))::int,
         case when count(*) filter (where not is_recent) >= 5
              then round(sum(value * w) filter (where not is_recent) / sum(w) filter (where not is_recent), 1) end,
         (count(*) filter (where not is_recent))::int
  from v group by category
$$;

-- Monthly volume and average for the last 12 months, plus category windows.
create function public.location_stats(p_location_id uuid) returns jsonb
language plpgsql stable security definer
set search_path = '' as $$
begin
  if not private.can_manage_location(p_location_id) then
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
               round(sum(overall * case when verification_level = 'none' then 0.5 else 1.0 end)
                     / nullif(sum(case when verification_level = 'none' then 0.5 else 1.0 end) filter (where overall is not null), 0), 1) as avg
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

-- Early warnings: a category down 0.5 or more in the last 60 days.
create function public.early_warnings(p_location_ids uuid[])
returns table (location_id uuid, category text, recent numeric, baseline numeric, delta numeric)
language sql stable security definer
set search_path = '' as $$
  select l.id, c.category, c.recent, c.baseline, c.recent - c.baseline
  from unnest(p_location_ids) as l(id)
  cross join lateral private.category_windows(l.id) c
  where private.can_manage_location(l.id)
    and c.recent is not null and c.baseline is not null
    and c.recent - c.baseline <= -0.5
  order by c.recent - c.baseline
$$;

revoke execute on function public.location_stats(uuid) from public, anon;
revoke execute on function public.early_warnings(uuid[]) from public, anon;
grant execute on function public.location_stats(uuid) to authenticated;
grant execute on function public.early_warnings(uuid[]) to authenticated;
