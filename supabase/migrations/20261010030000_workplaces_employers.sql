-- Workplaces added by reviewers, employer claims, invite links.

-- ---------------------------------------------------------------------------
-- Add a missing workplace
-- ---------------------------------------------------------------------------

alter table public.companies add column created_by uuid references auth.users (id) on delete set null;
alter table public.locations add column created_by uuid references auth.users (id) on delete set null;

-- Creates (or finds) a company + location. Max 10 new workplaces per user per day.
create function public.create_workplace(
  p_company text, p_address text, p_city text, p_country text, p_category public.workplace_category
) returns uuid
language plpgsql security definer
set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  company_name text := btrim(p_company);
  base_slug text := public.slugify(btrim(p_company));
  loc_slug text := public.slugify(btrim(p_address));
  c_id uuid;
  l_id uuid;
  n int := 1;
  candidate text;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if length(company_name) not between 2 and 100 or length(btrim(p_address)) not between 2 and 150
     or length(btrim(p_city)) not between 2 and 80 or p_country !~ '^[A-Z]{2}$'
     or base_slug = '' or loc_slug = '' then
    raise exception 'invalid workplace' using errcode = '22023';
  end if;
  if (select count(*) from public.locations
      where created_by = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many new workplaces' using errcode = '54000';
  end if;

  -- Reuse a company with the same name, otherwise find a free slug.
  select id into c_id from public.companies where lower(name) = lower(company_name) limit 1;
  if c_id is null then
    candidate := base_slug;
    while public.is_reserved_slug(candidate)
          or exists (select 1 from public.companies where slug = candidate) loop
      n := n + 1;
      candidate := base_slug || '-' || n;
    end loop;
    insert into public.companies (name, slug, category, created_by)
    values (company_name, candidate, p_category, uid)
    returning id into c_id;
  end if;

  select id into l_id from public.locations where company_id = c_id and slug = loc_slug;
  if l_id is null then
    insert into public.locations (company_id, name, slug, address, city, country, category, created_by)
    values (c_id, company_name, loc_slug, btrim(p_address), btrim(p_city), p_country, p_category, uid)
    returning id into l_id;
  end if;
  return l_id;
end $$;

revoke execute on function public.create_workplace(text, text, text, text, public.workplace_category) from public, anon;
grant execute on function public.create_workplace(text, text, text, text, public.workplace_category) to authenticated;

-- ---------------------------------------------------------------------------
-- Employer claims (approved by an admin with private.approve_claim)
-- ---------------------------------------------------------------------------

create type public.claim_method as enum ('email_domain', 'phone', 'document');

create table public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  org_name text not null check (length(org_name) between 2 and 120),
  contact_name text not null check (length(contact_name) between 2 and 120),
  job_title text check (length(job_title) <= 120),
  business_email text check (business_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (length(phone) <= 40),
  method public.claim_method not null,
  note text check (length(note) <= 2000),
  status public.case_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index claim_requests_one_open on public.claim_requests (location_id, user_id) where status = 'open';
create trigger set_updated_at before update on public.claim_requests
  for each row execute function public.set_updated_at();

alter table public.claim_requests enable row level security;
create policy "Own claims" on public.claim_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Request claim" on public.claim_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open');

-- Admin: approve a claim. Creates the org (or reuses the requester's own org),
-- makes the requester owner, links the company and adds a free plan row.
create function private.approve_claim(p_claim_id uuid) returns uuid
language plpgsql security definer
set search_path = '' as $$
declare
  c public.claim_requests;
  o_id uuid;
  comp_id uuid;
  existing_owner uuid;
begin
  select * into c from public.claim_requests where id = p_claim_id and status = 'open' for update;
  if c.id is null then raise exception 'claim not open'; end if;

  select company_id into comp_id from public.locations where id = c.location_id;
  select owner_org_id into existing_owner from public.companies where id = comp_id;

  if existing_owner is not null then
    o_id := existing_owner;
  else
    select org_id into o_id from public.org_members
    where user_id = c.user_id and role = 'owner' limit 1;
    if o_id is null then
      insert into public.orgs (name) values (c.org_name) returning id into o_id;
    end if;
    update public.companies set owner_org_id = o_id, claimed_at = now() where id = comp_id;
  end if;

  insert into public.org_members (org_id, user_id, role)
  values (o_id, c.user_id, 'owner')
  on conflict (org_id, user_id) do nothing;

  insert into public.location_plans (location_id, org_id)
  select l.id, o_id from public.locations l where l.company_id = comp_id
  on conflict (location_id) do nothing;

  update public.claim_requests set status = 'resolved' where id = p_claim_id;
  return o_id;
end $$;

-- ---------------------------------------------------------------------------
-- Invite links
-- ---------------------------------------------------------------------------

-- Returns the shareable invite link token for a location (creating it once).
create function public.location_invite_token(p_location_id uuid) returns text
language plpgsql security definer
set search_path = '' as $$
declare
  b_id uuid;
  tok text;
  o_id uuid;
begin
  if not private.can_manage_location(p_location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select i.token into tok
  from public.invites i join public.invite_batches b on b.id = i.batch_id
  where b.location_id = p_location_id and i.channel = 'link' and i.used_at is null
    and b.channel_mix ? 'shareable'
  order by i.created_at limit 1;
  if tok is not null then return tok; end if;

  select c.owner_org_id into o_id
  from public.locations l join public.companies c on c.id = l.company_id
  where l.id = p_location_id;

  insert into public.invite_batches (location_id, org_id, channel_mix, created_by)
  values (p_location_id, o_id, '{"shareable": true}', (select auth.uid()))
  returning id into b_id;
  insert into public.invites (batch_id, channel) values (b_id, 'link') returning token into tok;
  return tok;
end $$;

revoke execute on function public.location_invite_token(uuid) from public, anon;
grant execute on function public.location_invite_token(uuid) to authenticated;

-- Public info for an invite landing page: only the workplace, never the batch.
create function public.invite_location(p_token text) returns uuid
language sql stable security definer
set search_path = '' as $$
  select b.location_id
  from public.invites i join public.invite_batches b on b.id = i.batch_id
  where i.token = p_token
$$;

grant execute on function public.invite_location(text) to anon, authenticated;

-- Marks the caller's freshly submitted review as invited. Shareable links
-- get one child invite per review so each invite is used at most once.
create function public.attach_invite(p_review_id uuid, p_token text) returns boolean
language plpgsql security definer
set search_path = '' as $$
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

  -- Invited reviews always get a random delay so the employer can't match
  -- a new review to the person who just used the link (SPEC 5.4).
  update public.reviews set
    invite_id = child,
    verification_level = 'invited',
    publish_at = case
      when status = 'scheduled' and publish_at is not null
        then greatest(publish_at, now() + make_interval(days => 2 + floor(random() * 13)::int))
      else publish_at
    end
  where id = r.id;
  return true;
end $$;

revoke execute on function public.attach_invite(uuid, text) from public, anon;
grant execute on function public.attach_invite(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Employer replies record which member wrote them (never client-supplied)
-- ---------------------------------------------------------------------------

create function private.set_reply_member() returns trigger
language plpgsql security definer
set search_path = '' as $$
begin
  select m.id into new.org_member_id
  from public.reviews r
  join public.locations l on l.id = r.location_id
  join public.companies c on c.id = l.company_id
  join public.org_members m on m.org_id = c.owner_org_id
  where r.id = new.review_id and m.user_id = (select auth.uid())
  limit 1;
  return new;
end $$;

create trigger set_reply_member before insert or update on public.employer_replies
  for each row execute function private.set_reply_member();
