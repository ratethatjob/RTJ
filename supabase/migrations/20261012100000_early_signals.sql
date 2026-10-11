-- Early signals (Pro): anonymous, aggregated themes from reviews that are not published yet
-- (plus the last 60 days of published ones), refreshed daily by /api/cron/signals.
-- Written only by the service role; employers read them through early_signals_for(), which
-- returns nothing but "locked" without Pro (trial or paid) and nothing for other orgs.
-- No counts, scores, dates or text of single reviews are ever stored here.

create table public.early_signals (
  location_id uuid primary key references public.locations (id) on delete cascade,
  -- Hash of the reviews the summary was made from; the AI only runs when it changes.
  input_hash text,
  -- At least 5 reviews waiting to go live (after_leaving and held ones not counted).
  ready boolean not null default false,
  -- [{ "category": "pay", "en": "...", "hu": "..." }], each mentioned by 3+ different reviewers.
  topics jsonb not null default '[]',
  -- [{ "category": "pay", "direction": "worse" | "better" }], from the ratings, no numbers.
  directions jsonb not null default '[]',
  generated_at timestamptz not null default now(),
  -- Last "new theme" email and the theme categories it covered (one email a week at most).
  notified_at timestamptz,
  notified_categories text[] not null default '{}'
);

alter table public.early_signals enable row level security;
-- No policies: only the service role reads and writes the table.

create function public.early_signals_for(p_location_ids uuid[])
returns table (
  location_id uuid,
  unlocked boolean,
  ready boolean,
  topics jsonb,
  directions jsonb,
  generated_at timestamptz
)
language sql stable security definer
set search_path = '' as $$
  select
    l.id,
    pro.active,
    pro.active and coalesce(s.ready, false),
    case when pro.active and coalesce(s.ready, false) then s.topics else '[]'::jsonb end,
    case when pro.active and coalesce(s.ready, false) then s.directions else '[]'::jsonb end,
    case when pro.active then s.generated_at end
  from unnest(p_location_ids) as x (id)
  join public.locations l on l.id = x.id
  cross join lateral (select private.pro_active(l.id) as active) pro
  left join public.early_signals s on s.location_id = l.id
  where private.can_manage_location(l.id)
$$;

revoke all on function public.early_signals_for(uuid[]) from public, anon;
grant execute on function public.early_signals_for(uuid[]) to authenticated;
