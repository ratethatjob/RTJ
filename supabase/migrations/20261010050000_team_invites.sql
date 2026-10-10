-- Team members: owners invite colleagues with a single-use link.

create table public.org_member_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  role public.org_role not null,
  location_ids uuid[] not null default '{}',
  token text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role <> 'location_manager' or cardinality(location_ids) > 0)
);
create index on public.org_member_invites (org_id);
create trigger set_updated_at before update on public.org_member_invites
  for each row execute function public.set_updated_at();

alter table public.org_member_invites enable row level security;
create policy "Owner manages member invites" on public.org_member_invites for all to authenticated
  using (private.has_org_role(org_id, '{owner}'))
  with check (private.has_org_role(org_id, '{owner}') and created_by = (select auth.uid()));

-- What the invite link page shows before joining.
create function public.member_invite_info(p_token text)
returns table (org_name text, role public.org_role, valid boolean)
language sql stable security definer
set search_path = '' as $$
  select o.name, i.role, i.used_at is null and i.expires_at > now()
  from public.org_member_invites i
  join public.orgs o on o.id = i.org_id
  where i.token = p_token
$$;

-- Joins the org from an invite link. Returns the org id.
create function public.accept_member_invite(p_token text) returns uuid
language plpgsql security definer
set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  i public.org_member_invites;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into i from public.org_member_invites
  where token = p_token and used_at is null and expires_at > now()
  for update;
  if i.id is null then raise exception 'invalid invite' using errcode = '22023'; end if;
  if exists (select 1 from public.org_members where user_id = uid and org_id <> i.org_id) then
    raise exception 'member of another org' using errcode = '23505';
  end if;
  insert into public.org_members (org_id, user_id, role, location_ids)
  values (i.org_id, uid, i.role, case when i.role = 'location_manager' then i.location_ids else '{}' end)
  on conflict (org_id, user_id) do nothing;
  update public.org_member_invites set used_at = now(), used_by = uid where id = i.id;
  return i.org_id;
end $$;

-- Members with their sign-in email, for owners and HR of the org.
create function public.org_team(p_org_id uuid)
returns table (id uuid, user_id uuid, role public.org_role, location_ids uuid[], email text, created_at timestamptz)
language sql stable security definer
set search_path = '' as $$
  select m.id, m.user_id, m.role, m.location_ids, coalesce(u.email, u.phone), m.created_at
  from public.org_members m
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org_id and private.has_org_role(p_org_id, '{owner,hr}')
  order by m.created_at
$$;

revoke execute on function public.member_invite_info(text) from public, anon;
revoke execute on function public.accept_member_invite(text) from public, anon;
revoke execute on function public.org_team(uuid) from public, anon;
grant execute on function public.member_invite_info(text) to authenticated;
grant execute on function public.accept_member_invite(text) to authenticated;
grant execute on function public.org_team(uuid) to authenticated;
