-- Publishing (owner's final decision): nobody picks a time any more. Every review goes live at a
-- uniformly random moment 3–12 days after it is sent (random day and time); reviews from the same
-- invite batch go live together, at one shared moment in the same window. The old rules
-- ("< 5 published → 2–14 days", "delayed" = 14–28 days, "after_leaving" = when the author marks
-- the job ended) all merge into this. The enum values stay (no DROP) but new rows can't use them.

alter table public.invite_batches add column if not exists publish_group_at timestamptz;

-- A random moment 3–12 days from now.
create or replace function private.random_publish_at()
returns timestamptz
language sql
volatile
set search_path = ''
as $$
  select now() + interval '3 days' + random() * interval '9 days'
$$;

-- When a review goes live: its invite batch's shared moment (reused while it is still at least
-- 3 days away, so every review waits at least 3 days; else the batch gets a new one), or its own.
create or replace function private.review_publish_at(p_review_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.invite_batches;
  at timestamptz;
begin
  select ib.* into b
  from public.reviews r
  join public.invites i on i.id = r.invite_id
  join public.invite_batches ib on ib.id = i.batch_id
  where r.id = p_review_id
  for update of ib;
  if b.id is null then
    return private.random_publish_at();
  end if;
  if b.publish_group_at is not null
     and b.publish_group_at >= now() + interval '3 days'
     and b.publish_group_at <= now() + interval '12 days' then
    return b.publish_group_at;
  end if;
  at := private.random_publish_at();
  update public.invite_batches set publish_group_at = at where id = b.id;
  return at;
end $$;

revoke all on function private.random_publish_at() from public, anon, authenticated;
revoke all on function private.review_publish_at(uuid) from public, anon, authenticated;

-- No more chosen timing: "after_leaving" and "delayed" become "now" on every write.
create or replace function private.review_publish_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.publish_mode is distinct from 'now' then
    new.publish_mode := 'now';
  end if;
  return new;
end $$;

create or replace trigger review_publish_mode
  before insert or update of publish_mode on public.reviews
  for each row execute function private.review_publish_mode();

create or replace function private.moderate_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reviews;
  reason text;
begin
  select * into r from public.reviews where id = p_review_id for update;
  if r.status <> 'pending_moderation' or r.hold_reason is not null then return; end if;

  if r.body ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[a-z]{2,}'
     or r.body ~ '(\+?\d[\d\s/().-]{7,}\d)'
     or r.body ~* '(https?://|www\.)' then
    reason := 'contact_details';
  -- Fraud signals (SPEC 6).
  -- Several brand-new accounts reviewing the same place within a day.
  elsif (select count(*) from public.reviews x join auth.users u on u.id = x.user_id
         where x.location_id = r.location_id and x.created_at > now() - interval '24 hours'
           and u.created_at > now() - interval '7 days') >= 3 then
    reason := 'burst';
  -- Account made minutes before reviewing, while another fresh account rated the same place.
  elsif exists (select 1 from auth.users u where u.id = r.user_id and u.created_at > r.created_at - interval '10 minutes')
        and (select count(*) from public.reviews x join auth.users u on u.id = x.user_id
             where x.location_id = r.location_id and x.created_at > now() - interval '24 hours'
               and u.created_at > now() - interval '7 days') >= 2 then
    reason := 'new_account';
  elsif (select count(distinct x.location_id) from public.reviews x
         where x.user_id = r.user_id and x.created_at > now() - interval '24 hours') >= 4 then
    reason := 'many_locations';
  end if;

  if reason is not null then
    update public.reviews set hold_reason = reason where id = p_review_id;
    return; -- manual queue
  end if;

  update public.reviews set
    status = 'scheduled',
    publish_at = private.review_publish_at(p_review_id)
  where id = p_review_id;
end $$;

create or replace function public.admin_moderate_review(p_review_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reviews;
begin
  perform private.require_admin();
  select * into r from public.reviews where id = p_review_id and status = 'pending_moderation' for update;
  if r.id is null then return; end if;
  if not p_approve then
    update public.reviews set status = 'rejected' where id = r.id;
    return;
  end if;
  update public.reviews set
    status = 'scheduled',
    ai_checked_at = coalesce(ai_checked_at, now()),
    publish_at = private.review_publish_at(r.id)
  where id = r.id;
end $$;

create or replace function public.attach_invite(p_review_id uuid, p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  b public.invite_batches;
  r public.reviews;
  child uuid;
begin
  select * into r from public.reviews where id = p_review_id and user_id = (select auth.uid());
  select * into inv from public.invites where token = p_token;
  if r.id is null or inv.id is null or r.invite_id is not null then return false; end if;
  select * into b from public.invite_batches where id = inv.batch_id;
  if b.location_id <> r.location_id then return false; end if;
  -- One invited review per person per batch.
  if exists (
    select 1 from public.reviews x join public.invites i on i.id = x.invite_id
    where x.user_id = r.user_id and i.batch_id = b.id
  ) then return false; end if;

  if b.channel_mix ? 'shareable' then
    insert into public.invites (batch_id, channel, used_at) values (b.id, 'link', now())
    returning id into child;
  else
    if inv.used_at is not null then return false; end if;
    update public.invites set used_at = now() where id = inv.id;
    child := inv.id;
  end if;

  update public.reviews set invite_id = child, verification_level = 'invited' where id = r.id;
  -- Invited reviews go live together with their batch, so the employer can't match a new
  -- review to the person who just used the link (held ones get it on approval).
  update public.reviews set publish_at = private.review_publish_at(r.id)
  where id = r.id and status = 'scheduled';
  return true;
end $$;

-- "I've left this job" is gone from the app; nothing waits for it any more.
revoke execute on function public.mark_job_ended(uuid, date) from public, anon, authenticated;

-- Existing rows: no chosen timing left, and anything scheduled without a date gets one.
update public.reviews set publish_mode = 'now' where publish_mode <> 'now';
update public.reviews set publish_at = private.review_publish_at(id)
where status = 'scheduled' and publish_at is null;
