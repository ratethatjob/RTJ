-- Job ad packages (standard posting fee / basic / pro), orders for invoicing,
-- AI candidate summaries, AI follow-up questions, calls and messages to candidates.

create type public.job_tier as enum ('standard', 'basic', 'pro');

alter table public.jobs add column tier public.job_tier not null default 'standard';

-- ---------------------------------------------------------------------------
-- Orders: one when a job is first published, one per upgrade after that.
-- Invoiced manually until online payment is connected.
-- ---------------------------------------------------------------------------

create table public.job_orders (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  tier public.job_tier not null,
  previous_tier public.job_tier,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index on public.job_orders (org_id, created_at desc);
create index on public.job_orders (status, created_at);
alter table public.job_orders enable row level security;
create policy "Org owners and HR read orders" on public.job_orders for select to authenticated
  using (private.has_org_role(org_id, '{owner,hr}'));

-- A published job can only move up a package; every paid step becomes an order.
create function private.check_job_tier() returns trigger
language plpgsql
set search_path = '' as $$
begin
  -- Only the status trigger sets the publish date, so it can't be faked to skip the order.
  if tg_op = 'INSERT' or old.published_at is null then
    new.published_at := null;
  else
    new.published_at := old.published_at;
    if new.tier < old.tier then
      raise exception 'package can only be upgraded' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
-- Runs before set_published_at (triggers fire in name order).
create trigger check_job_tier before insert or update on public.jobs
  for each row execute function private.check_job_tier();

-- published_at is set by a BEFORE trigger, so column-specific AFTER triggers
-- ("update of published_at") never see it change: compare old and new instead.
create function private.on_job_published() returns trigger
language plpgsql security definer
set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.published_at is null then
    insert into public.job_orders (job_id, org_id, tier, created_by)
    values (new.id, new.org_id, new.tier, auth.uid());
  elsif new.tier > old.tier then
    insert into public.job_orders (job_id, org_id, tier, previous_tier, created_by)
    values (new.id, new.org_id, new.tier, old.tier, auth.uid());
  end if;
  return null;
end $$;
create trigger job_orders_on_insert after insert on public.jobs
  for each row when (new.published_at is not null)
  execute function private.on_job_published();
create trigger job_orders_on_update after update on public.jobs
  for each row when (new.published_at is not null
                     and (old.published_at is null or new.tier > old.tier))
  execute function private.on_job_published();

-- Same fix for "new job at a followed place", which missed drafts being published.
drop trigger notify_job_opened on public.jobs;
create trigger notify_job_opened after insert on public.jobs
  for each row when (new.published_at is not null)
  execute function private.notify_job_opened();
create trigger notify_job_published after update on public.jobs
  for each row when (old.published_at is null and new.published_at is not null)
  execute function private.notify_job_opened();

create function public.admin_job_orders()
returns table (
  id uuid, created_at timestamptz, tier public.job_tier, previous_tier public.job_tier,
  job_id uuid, job_title text, location text, address text, country text, org_name text
)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select o.id, o.created_at, o.tier, o.previous_tier, j.id, j.title, l.name, l.address, l.country, g.name
  from public.job_orders o
  join public.jobs j on j.id = o.job_id
  join public.locations l on l.id = j.location_id
  join public.orgs g on g.id = o.org_id
  where o.status = 'pending'
  order by o.created_at;
end $$;

create function public.admin_decide_order(p_order_id uuid, p_paid boolean) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  update public.job_orders
  set status = case when p_paid then 'paid' else 'cancelled' end, decided_at = now()
  where id = p_order_id and status = 'pending';
end $$;

revoke execute on function public.admin_job_orders() from public, anon;
revoke execute on function public.admin_decide_order(uuid, boolean) from public, anon;
grant execute on function public.admin_job_orders() to authenticated;
grant execute on function public.admin_decide_order(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- AI summaries (basic and pro) and AI follow-up questions (pro).
-- Written by the server with the service role; employers read them through
-- job_application_list(), applicants never see the summary.
-- ---------------------------------------------------------------------------

create table public.application_insights (
  application_id uuid primary key references public.job_applications (id) on delete cascade,
  -- { fit, en: { headline, strengths[], concerns[], why, ask[] }, hu: { ... } }
  summary jsonb not null,
  cv_read boolean not null default false,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.application_insights
  for each row execute function public.set_updated_at();
alter table public.application_insights enable row level security;

create table public.application_followups (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  question text not null check (length(question) between 3 and 300),
  answer text check (length(answer) <= 1000),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (application_id, position)
);
alter table public.application_followups enable row level security;
create policy "Applicants read own follow-ups" on public.application_followups for select to authenticated
  using (exists (select 1 from public.job_applications a
                 where a.id = application_id and a.user_id = (select auth.uid())));

-- Applicant answers: { "<follow-up id>": "answer" }.
create function public.answer_followups(p_application_id uuid, p_answers jsonb) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  if not exists (select 1 from public.job_applications
                 where id = p_application_id and user_id = (select auth.uid()) and status <> 'withdrawn') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.application_followups f
  set answer = left(btrim(p_answers ->> f.id::text), 1000), answered_at = now()
  where f.application_id = p_application_id
    and nullif(btrim(p_answers ->> f.id::text), '') is not null;
end $$;
revoke execute on function public.answer_followups(uuid, jsonb) from public, anon;
grant execute on function public.answer_followups(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Messages between the employer and the applicant, and calls.
-- ---------------------------------------------------------------------------

alter table public.job_applications add column last_called_at timestamptz;

create table public.application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  sender text not null check (sender in ('employer', 'applicant')),
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.application_messages (application_id, created_at);
alter table public.application_messages enable row level security;
create policy "Applicants read own thread" on public.application_messages for select to authenticated
  using (exists (select 1 from public.job_applications a
                 where a.id = application_id and a.user_id = (select auth.uid())));
create policy "Applicants reply" on public.application_messages for insert to authenticated
  with check (sender = 'applicant' and author_id = (select auth.uid())
              and exists (select 1 from public.job_applications a
                          where a.id = application_id and a.user_id = (select auth.uid())
                            and a.status <> 'withdrawn'));

create function private.managed_application(p_application_id uuid) returns uuid
language sql stable security definer
set search_path = '' as $$
  select j.location_id
  from public.job_applications a join public.jobs j on j.id = a.job_id
  where a.id = p_application_id and a.status <> 'withdrawn' and private.can_manage_location(j.location_id)
$$;

-- An employer message is a reply to the applicant (ghosting metric).
create function public.send_application_message(p_application_id uuid, p_body text) returns uuid
language plpgsql security definer
set search_path = '' as $$
declare loc uuid := private.managed_application(p_application_id);
declare mid uuid;
declare first boolean;
begin
  if loc is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.application_messages (application_id, sender, author_id, body)
  values (p_application_id, 'employer', auth.uid(), btrim(p_body))
  returning id into mid;
  update public.job_applications set first_reply_at = coalesce(first_reply_at, now())
  where id = p_application_id
  returning first_reply_at = now() into first;
  if first then
    perform public.recompute_location_scores(loc);
  end if;
  return mid;
end $$;

-- Logged when the employer taps "Call". Not counted as a reply: a tap is not a call.
create function public.log_application_call(p_application_id uuid) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  if private.managed_application(p_application_id) is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.job_applications set last_called_at = now() where id = p_application_id;
end $$;

revoke execute on function public.send_application_message(uuid, text) from public, anon;
revoke execute on function public.log_application_call(uuid) from public, anon;
grant execute on function public.send_application_message(uuid, text) to authenticated;
grant execute on function public.log_application_call(uuid) to authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'review_published', 'reply', 'application_status', 'followed_review', 'followed_job', 'new_application',
  'application_message'));

create function private.notify_application_message() returns trigger
language plpgsql security definer
set search_path = '' as $$
declare a public.job_applications;
declare j public.jobs;
declare info jsonb;
begin
  select * into a from public.job_applications where id = new.application_id;
  select * into j from public.jobs where id = a.job_id;
  info := private.location_info(j.location_id)
    || jsonb_build_object('job_id', j.id, 'job', j.title, 'application_id', a.id, 'sender', new.sender);
  if new.sender = 'employer' then
    insert into public.notifications (user_id, kind, data) values (a.user_id, 'application_message', info);
  else
    insert into public.notifications (user_id, kind, data)
    select uid, 'application_message', info || jsonb_build_object('name', a.full_name)
    from private.location_managers(j.location_id) uid;
  end if;
  return null;
end $$;
create trigger notify_application_message after insert on public.application_messages
  for each row execute function private.notify_application_message();

-- ---------------------------------------------------------------------------
-- Employer list of applications, now with AI summary, follow-ups and messages.
-- ---------------------------------------------------------------------------

drop function public.job_application_list(uuid);
create function public.job_application_list(p_job_id uuid)
returns table (
  id uuid, full_name text, email text, phone text, start_when public.start_when,
  experience boolean, answer text, answers jsonb, cv_path text, message text,
  status public.application_status, created_at timestamptz, first_reply_at timestamptz,
  last_called_at timestamptz, insight jsonb, followups jsonb, messages jsonb
)
language sql stable security definer
set search_path = '' as $$
  select a.id, a.full_name, a.email, a.phone, a.start_when, a.experience, a.answer, a.answers,
         a.cv_path, a.message, a.status, a.created_at, a.first_reply_at, a.last_called_at,
         case when j.tier in ('basic', 'pro') then
           (select i.summary || jsonb_build_object('cv_read', i.cv_read, 'updated_at', i.updated_at)
            from public.application_insights i where i.application_id = a.id)
         end,
         coalesce((select jsonb_agg(jsonb_build_object('question', f.question, 'answer', f.answer)
                                    order by f.position)
                   from public.application_followups f where f.application_id = a.id), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body,
                                                       'created_at', m.created_at) order by m.created_at)
                   from public.application_messages m where m.application_id = a.id), '[]')
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  where a.job_id = p_job_id and private.can_manage_location(j.location_id)
    and a.status <> 'withdrawn'
  order by a.created_at desc
$$;
revoke execute on function public.job_application_list(uuid) from public, anon;
grant execute on function public.job_application_list(uuid) to authenticated;

-- Pro jobs are featured in job search.
create or replace view public.public_jobs with (security_invoker = false) as
select
  j.id, j.title, j.work_type, j.schedule, j.pay_min, j.pay_max, j.pay_currency, j.pay_period,
  j.description, j.question, j.published_at, j.closes_at, j.updated_at,
  l.id as location_id, l.slug as location_slug, l.name as location_name, l.address, l.city,
  public.slugify(l.city) as city_slug, l.country, l.category,
  c.slug as company_slug, c.name as company_name,
  j.apply_mode, j.questions, j.responsibilities, j.requirements, j.offers,
  j.tier = 'pro' as featured
from public.jobs j
join public.locations l on l.id = j.location_id
join public.companies c on c.id = l.company_id
where j.status = 'open' and (j.closes_at is null or j.closes_at >= current_date);
