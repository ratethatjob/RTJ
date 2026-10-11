-- Email invites (SPEC 7): employers paste addresses or upload a CSV, we email each person a
-- single-use invite in their language and one reminder after 5 days. Addresses are encrypted
-- by the app (contact_encrypted) and keyed-hashed (contact_hash); the encrypted address is
-- cleared after the reminder, after the invite is used, on unsubscribe, or after 7 days.
-- Employers only ever see batch totals, and reviews received only from 5.

alter table public.invites add column locale text check (locale in ('en', 'hu'));

create index invites_email_pending on public.invites (sent_at)
  where channel = 'email' and contact_encrypted is not null;
create index invites_contact_hash on public.invites (contact_hash) where contact_hash is not null;

-- Unsubscribed addresses (hash only). No policies: server-side only.
create table public.invite_suppressions (
  contact_hash text primary key,
  created_at timestamptz not null default now()
);
alter table public.invite_suppressions enable row level security;

-- Creates one email batch for a location. p_invites: [{hash, enc, locale}] (max 200).
-- Skips unsubscribed addresses and anyone invited to this location in the last 90 days.
-- Limits: 500 email invites per location and 2 000 per org in 24 hours.
-- Returns the new invites without their tokens (the server reads those with the service role).
create function public.create_email_invites(p_location_id uuid, p_invites jsonb)
returns table (id uuid, contact_hash text, locale text)
language plpgsql security definer
set search_path = '' as $$
declare
  o_id uuid;
  items jsonb;
  n int;
  b_id uuid;
begin
  if not private.can_manage_location(p_location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_invites) <> 'array' or jsonb_array_length(p_invites) > 200 then
    raise exception 'too many' using errcode = '22023';
  end if;
  select c.owner_org_id into o_id
  from public.locations l join public.companies c on c.id = l.company_id
  where l.id = p_location_id;
  if o_id is null then raise exception 'not claimed' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('h', s.h, 'e', s.e, 'l', s.l)), '[]') into items
  from (
    select distinct on (x ->> 'hash') x ->> 'hash' as h, x ->> 'enc' as e,
           case when x ->> 'locale' = 'hu' then 'hu' else 'en' end as l
    from jsonb_array_elements(p_invites) x
    where x ->> 'hash' ~ '^[0-9a-f]{64}$'
      and length(coalesce(x ->> 'enc', '')) between 1 and 1000
  ) s
  where not exists (select 1 from public.invite_suppressions su where su.contact_hash = s.h)
    and not exists (
      select 1 from public.invites i join public.invite_batches b on b.id = i.batch_id
      where b.location_id = p_location_id and i.contact_hash = s.h
        and i.created_at > now() - interval '90 days');
  n := jsonb_array_length(items);
  if n = 0 then return; end if;

  if n + (select count(*) from public.invites i join public.invite_batches b on b.id = i.batch_id
          where b.location_id = p_location_id and i.channel = 'email'
            and i.created_at > now() - interval '1 day') > 500
     or n + (select count(*) from public.invites i join public.invite_batches b on b.id = i.batch_id
             where b.org_id = o_id and i.channel = 'email'
               and i.created_at > now() - interval '1 day') > 2000 then
    raise exception 'invite limit' using errcode = '54000';
  end if;

  insert into public.invite_batches (location_id, org_id, channel_mix, created_by)
  values (p_location_id, o_id, jsonb_build_object('email', n), (select auth.uid()))
  returning invite_batches.id into b_id;

  return query
  insert into public.invites (batch_id, channel, contact_hash, contact_encrypted, locale)
  select b_id, 'email', x ->> 'h', x ->> 'e', x ->> 'l'
  from jsonb_array_elements(items) x
  returning invites.id, invites.contact_hash, invites.locale;
end $$;

-- Service role: marks invites as sent (or reminded, which also clears the address)
-- and refreshes the batches' sent counts.
create function public.invite_mark_sent(p_ids uuid[], p_reminder boolean default false) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  if p_reminder then
    update public.invites set reminded_at = now(), contact_encrypted = null where id = any (p_ids);
  else
    update public.invites set sent_at = now() where id = any (p_ids) and sent_at is null;
    update public.invite_batches b
    set sent_count = (select count(*) from public.invites i where i.batch_id = b.id and i.sent_at is not null)
    where b.id in (select batch_id from public.invites where id = any (p_ids));
  end if;
end $$;

-- Service role: the preferred language of people who already have an account.
create function public.invite_known_locales(p_emails text[])
returns table (email text, locale text)
language sql stable security definer
set search_path = '' as $$
  select lower(u.email), p.preferred_locale
  from auth.users u join public.profiles p on p.user_id = u.id
  where lower(u.email) = any (p_emails) and p.preferred_locale in ('en', 'hu')
$$;

-- Unsubscribe link in every invite email (the token proves the recipient).
-- Stops every pending email to that address and blocks future invites.
create function public.invite_unsubscribe(p_token text) returns boolean
language plpgsql security definer
set search_path = '' as $$
declare h text;
begin
  select contact_hash into h from public.invites where token = p_token and channel = 'email';
  if h is null then return false; end if;
  insert into public.invite_suppressions (contact_hash) values (h) on conflict do nothing;
  update public.invites set contact_encrypted = null where contact_hash = h and contact_encrypted is not null;
  return true;
end $$;

-- Clears addresses once they are no longer needed (used, reminded, or older than 7 days).
create function private.purge_invite_contacts() returns int
language sql security definer
set search_path = '' as $$
  with cleared as (
    update public.invites set contact_encrypted = null
    where contact_encrypted is not null
      and (used_at is not null or reminded_at is not null
           or coalesce(sent_at, created_at) < now() - interval '7 days')
    returning 1
  )
  select count(*)::int from cleared
$$;

-- Employer view: one row per email batch. Reviews received only from 5 per batch.
create function public.invite_batch_list(p_location_id uuid)
returns table (id uuid, created_at timestamptz, sent bigint, reviews_received bigint)
language plpgsql stable security definer
set search_path = '' as $$
begin
  if not private.can_manage_location(p_location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  select b.id, b.created_at, b.sent_count::bigint,
         case when r.n >= 5 then r.n end
  from public.invite_batches b
  cross join lateral (
    select count(*)::bigint as n
    from public.reviews x join public.invites i on i.id = x.invite_id
    where i.batch_id = b.id and x.status = 'published'
  ) r
  where b.location_id = p_location_id and b.channel_mix ? 'email'
  order by b.created_at desc
  limit 50;
end $$;

revoke execute on function public.create_email_invites(uuid, jsonb) from public, anon;
grant execute on function public.create_email_invites(uuid, jsonb) to authenticated;
revoke execute on function public.invite_mark_sent(uuid[], boolean) from public, anon, authenticated;
grant execute on function public.invite_mark_sent(uuid[], boolean) to service_role;
revoke execute on function public.invite_known_locales(text[]) from public, anon, authenticated;
grant execute on function public.invite_known_locales(text[]) to service_role;
grant execute on function public.invite_unsubscribe(text) to anon, authenticated;
revoke execute on function public.invite_batch_list(uuid) from public, anon;
grant execute on function public.invite_batch_list(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-invite-contacts', '41 5 * * *', 'select private.purge_invite_contacts()');
  end if;
end $$;
