-- Fraud signals and AI moderation holds, admin entity linking, embed referrers.

-- ---------------------------------------------------------------------------
-- Moderation holds: why a review waits in the manual queue.
-- ---------------------------------------------------------------------------

alter table public.reviews add column hold_reason text;

create or replace function private.moderate_review(p_review_id uuid) returns void
language plpgsql security definer
set search_path = '' as $$
declare
  r public.reviews;
  published_count int;
  delay interval;
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

  select count(*) into published_count
  from public.reviews
  where location_id = r.location_id and status = 'published';

  delay := case
    when r.publish_mode = 'delayed' then make_interval(days => 14 + floor(random() * 15)::int)
    when published_count < 5 then make_interval(days => 2 + floor(random() * 13)::int)
    else interval '0'
  end;

  update public.reviews set
    status = 'scheduled',
    publish_at = case
      when r.publish_mode = 'after_leaving' and r.period_end is null then null
      else now() + delay
    end
  where id = p_review_id;
end $$;

-- AI moderation (server job, service role): send a not-yet-published review back to the queue.
create function public.hold_review(p_review_id uuid, p_reason text) returns void
language sql security definer
set search_path = '' as $$
  update public.reviews
  set hold_reason = left(p_reason, 200), status = 'pending_moderation', publish_at = null
  where id = p_review_id and status in ('pending_moderation', 'scheduled')
$$;
revoke execute on function public.hold_review(uuid, text) from public, anon, authenticated;
grant execute on function public.hold_review(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Entity linking: admins confirm "Joe's Pizzeria = Example Trade LLC".
-- ---------------------------------------------------------------------------

create function public.admin_link_entity(
  p_location_id uuid, p_name text, p_country text, p_registry_id text default null
) returns void
language plpgsql security definer
set search_path = '' as $$
declare e_id uuid; nm text := btrim(p_name); reg text := nullif(btrim(p_registry_id), '');
begin
  perform private.require_admin();
  if length(nm) not between 2 and 200 or p_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid entity' using errcode = '22023';
  end if;
  select id into e_id from public.legal_entities
  where (reg is not null and registry_id = reg and country = p_country) or lower(name) = lower(nm)
  order by (registry_id = reg) desc nulls last
  limit 1;
  if e_id is null then
    insert into public.legal_entities (name, country, registry_id, registry_source)
    values (nm, p_country, reg, case when reg is not null then 'admin' end)
    returning id into e_id;
  elsif reg is not null then
    update public.legal_entities set registry_id = coalesce(registry_id, reg) where id = e_id;
  end if;
  insert into public.location_entity_links (location_id, legal_entity_id, source, confidence, verified_at)
  values (p_location_id, e_id, 'admin', 1, now())
  on conflict (location_id, legal_entity_id) do update set
    source = 'admin', confidence = 1, verified_at = coalesce(public.location_entity_links.verified_at, now());
end $$;

-- Withdraws a link without removing its history.
create function public.admin_unverify_entity(p_link_id uuid) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  update public.location_entity_links set verified_at = null, confidence = 0 where id = p_link_id;
end $$;

create policy "Admins read entity links" on public.location_entity_links for select to authenticated
  using (private.is_admin());

revoke execute on function public.admin_link_entity(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_unverify_entity(uuid) from public, anon;
grant execute on function public.admin_link_entity(uuid, text, text, text) to authenticated;
grant execute on function public.admin_unverify_entity(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Index embeds: which websites show a location's badge (no visitor data).
-- ---------------------------------------------------------------------------

create table public.embed_referrers (
  location_id uuid not null references public.locations (id) on delete cascade,
  domain text not null check (domain ~ '^[a-z0-9.-]{3,253}$'),
  views bigint not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (location_id, domain)
);
alter table public.embed_referrers enable row level security;
create policy "Managers read embeds" on public.embed_referrers for select to authenticated
  using (private.can_manage_location(location_id));

create function public.record_embed_view(p_location_id uuid, p_domain text) returns void
language sql security definer
set search_path = '' as $$
  insert into public.embed_referrers (location_id, domain)
  select p_location_id, lower(p_domain)
  where lower(p_domain) ~ '^[a-z0-9.-]{3,253}$'
    and exists (select 1 from public.locations where id = p_location_id)
  on conflict (location_id, domain) do update
    set views = public.embed_referrers.views + 1, last_seen = now()
$$;
revoke execute on function public.record_embed_view(uuid, text) from public;
grant execute on function public.record_embed_view(uuid, text) to anon, authenticated;
