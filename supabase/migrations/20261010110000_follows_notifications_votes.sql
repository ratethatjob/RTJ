-- Follow workplaces, in-app notifications, helpful votes, admin metrics.

-- ---------------------------------------------------------------------------
-- Follows (toggled, never removed, so history stays simple)
-- ---------------------------------------------------------------------------

create table public.follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, location_id)
);
create index on public.follows (location_id) where active;
create trigger set_updated_at before update on public.follows
  for each row execute function public.set_updated_at();
alter table public.follows enable row level security;
create policy "Own follows" on public.follows for select to authenticated
  using (user_id = (select auth.uid()));

-- Returns the new state (true = following).
create function public.toggle_follow(p_location_id uuid) returns boolean
language plpgsql security definer
set search_path = '' as $$
declare uid uuid := (select auth.uid()); state boolean;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.follows (user_id, location_id) values (uid, p_location_id)
  on conflict (user_id, location_id) do update set active = not public.follows.active
  returning active into state;
  return state;
end $$;
revoke execute on function public.toggle_follow(uuid) from public, anon;
grant execute on function public.toggle_follow(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications (in-app; email can be added on top later)
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'review_published', 'reply', 'application_status', 'followed_review', 'followed_job', 'new_application')),
  -- Display data captured when the event happened: names, paths, ids.
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "Own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create function public.mark_notifications_read() returns void
language sql security definer
set search_path = '' as $$
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and read_at is null
$$;
revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

create function private.location_info(p_location_id uuid) returns jsonb
language sql stable security definer
set search_path = '' as $$
  select jsonb_build_object('location_id', l.id, 'location', l.name, 'address', l.address,
                            'path', '/' || c.slug || '/' || l.slug)
  from public.locations l join public.companies c on c.id = l.company_id
  where l.id = p_location_id
$$;

-- Managers who should hear about a location (owner/HR, or its location managers).
create function private.location_managers(p_location_id uuid) returns setof uuid
language sql stable security definer
set search_path = '' as $$
  select m.user_id from public.org_members m
  where m.org_id = private.location_org(p_location_id)
    and (m.role in ('owner', 'hr') or (m.role = 'location_manager' and p_location_id = any (m.location_ids)))
$$;

create function private.notify_review_published() returns trigger
language plpgsql security definer
set search_path = '' as $$
declare info jsonb := private.location_info(new.location_id);
begin
  if new.user_id is not null then
    insert into public.notifications (user_id, kind, data)
    values (new.user_id, 'review_published', info || jsonb_build_object('review_id', new.id));
  end if;
  insert into public.notifications (user_id, kind, data)
  select f.user_id, 'followed_review', info || jsonb_build_object('review_id', new.id)
  from public.follows f
  where f.location_id = new.location_id and f.active and f.user_id is distinct from new.user_id;
  return null;
end $$;
create trigger notify_published after update of status on public.reviews
  for each row when (new.status = 'published' and old.status is distinct from 'published')
  execute function private.notify_review_published();

create function private.notify_reply() returns trigger
language plpgsql security definer
set search_path = '' as $$
declare r public.reviews;
begin
  select * into r from public.reviews where id = new.review_id;
  if r.user_id is not null then
    insert into public.notifications (user_id, kind, data)
    values (r.user_id, 'reply', private.location_info(r.location_id) || jsonb_build_object('review_id', r.id));
  end if;
  return null;
end $$;
create trigger notify_reply after insert on public.employer_replies
  for each row execute function private.notify_reply();

create function private.notify_application() returns trigger
language plpgsql security definer
set search_path = '' as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = new.job_id;
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, data)
    select uid, 'new_application',
           private.location_info(j.location_id) || jsonb_build_object('job_id', j.id, 'job', j.title)
    from private.location_managers(j.location_id) uid;
  elsif new.status in ('interviewing', 'rejected', 'hired') and new.status is distinct from old.status then
    insert into public.notifications (user_id, kind, data)
    values (new.user_id, 'application_status',
            private.location_info(j.location_id)
              || jsonb_build_object('job_id', j.id, 'job', j.title, 'status', new.status));
  end if;
  return null;
end $$;
create trigger notify_application after insert or update of status on public.job_applications
  for each row execute function private.notify_application();

create function private.notify_job_opened() returns trigger
language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, data)
  select f.user_id, 'followed_job',
         private.location_info(new.location_id) || jsonb_build_object('job_id', new.id, 'job', new.title)
  from public.follows f
  where f.location_id = new.location_id and f.active;
  return null;
end $$;
-- Only the first time a job goes live (published_at is set once).
create trigger notify_job_opened after insert or update of published_at on public.jobs
  for each row when (new.published_at is not null)
  execute function private.notify_job_opened();

-- ---------------------------------------------------------------------------
-- Helpful votes: one per person and review, not on your own review.
-- ---------------------------------------------------------------------------

create table public.review_votes (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
alter table public.review_votes enable row level security;
create policy "Own votes" on public.review_votes for select to authenticated
  using (user_id = (select auth.uid()));

create function public.vote_helpful(p_review_id uuid) returns int
language plpgsql security definer
set search_path = '' as $$
declare uid uuid := (select auth.uid()); n int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if exists (select 1 from public.reviews where id = p_review_id and status = 'published'
             and user_id is distinct from uid) then
    insert into public.review_votes (review_id, user_id) values (p_review_id, uid)
    on conflict do nothing;
  end if;
  select count(*) into n from public.review_votes where review_id = p_review_id;
  return n;
end $$;
revoke execute on function public.vote_helpful(uuid) from public, anon;
grant execute on function public.vote_helpful(uuid) to authenticated;

-- Appended column keeps the view replaceable.
create or replace view public.public_reviews with (security_invoker = false) as
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
  r.published_at,
  (select count(*) from public.review_votes v where v.review_id = r.id)::int as helpful_count
from public.reviews r
left join public.profiles p on p.user_id = r.user_id
left join public.employer_replies er on er.review_id = r.id
where r.status = 'published';

-- ---------------------------------------------------------------------------
-- Admin metrics: the PMF signals from SPEC 11.
-- ---------------------------------------------------------------------------

create function public.admin_metrics() returns jsonb
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'months', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', to_char(m, 'YYYY-MM'),
        'reviews', (select count(*) from public.reviews where status = 'published' and date_trunc('month', published_at) = m),
        'verified', (select count(*) from public.reviews where status = 'published' and verification_level <> 'none' and date_trunc('month', published_at) = m),
        'users', (select count(*) from auth.users where date_trunc('month', created_at) = m),
        'applications', (select count(*) from public.job_applications where date_trunc('month', created_at) = m)
      ) order by m), '[]')
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
    ),
    'locations', (select count(*) from public.locations),
    'claimed_locations', (select count(*) from public.locations l join public.companies c on c.id = l.company_id where c.claimed_at is not null),
    'rated_locations', (select count(*) from public.location_scores where review_count > 0),
    'invites_used', (select count(*) from public.reviews where invite_id is not null),
    'invite_links', (select count(*) from public.invites),
    'open_jobs', (select count(*) from public.jobs where status = 'open'),
    'embeds', (select count(distinct domain) from public.embed_referrers)
  );
end $$;
revoke execute on function public.admin_metrics() from public, anon;
grant execute on function public.admin_metrics() to authenticated;
