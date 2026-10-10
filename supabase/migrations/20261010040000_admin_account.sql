-- Admin queues, account self-service, city slugs.

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
create policy "Admins see admins" on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

create function private.is_admin() returns boolean
language sql stable security definer
set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;

-- Admins read the queues directly.
create policy "Admins read claims" on public.claim_requests for select to authenticated
  using (private.is_admin());
create policy "Admins read reviews" on public.reviews for select to authenticated
  using (private.is_admin());
create policy "Admins read verifications" on public.verifications for select to authenticated
  using (private.is_admin());
create policy "Admins read disputes" on public.disputes for select to authenticated
  using (private.is_admin());
create policy "Admins read reports" on public.reports for select to authenticated
  using (private.is_admin());

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    create policy "Admins read verification files" on storage.objects
      for select to authenticated
      using (bucket_id = 'verifications' and private.is_admin());
    create policy "Admins delete verification files" on storage.objects
      for delete to authenticated
      using (bucket_id = 'verifications' and private.is_admin());
  end if;
end $$;

create function private.require_admin() returns void
language plpgsql stable security definer
set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
end $$;

-- Claims
create function public.admin_decide_claim(p_claim_id uuid, p_approve boolean) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  if p_approve then
    perform private.approve_claim(p_claim_id);
  else
    update public.claim_requests set status = 'rejected' where id = p_claim_id and status = 'open';
  end if;
end $$;

-- Moderation queue: reviews held in pending_moderation.
create function public.admin_moderate_review(p_review_id uuid, p_approve boolean) returns void
language plpgsql security definer
set search_path = '' as $$
declare
  r public.reviews;
  published_count int;
begin
  perform private.require_admin();
  select * into r from public.reviews where id = p_review_id and status = 'pending_moderation' for update;
  if r.id is null then return; end if;
  if not p_approve then
    update public.reviews set status = 'rejected' where id = r.id;
    return;
  end if;
  select count(*) into published_count from public.reviews
  where location_id = r.location_id and status = 'published';
  update public.reviews set
    status = 'scheduled',
    publish_at = case
      when r.publish_mode = 'after_leaving' and r.period_end is null then null
      when r.publish_mode = 'delayed' or r.invite_id is not null or published_count < 5
        then now() + make_interval(days => 2 + floor(random() * 13)::int)
      else now()
    end
  where id = r.id;
end $$;

-- Verification documents. Approving upgrades the review and can link the
-- legal entity read from the document to the location.
create function public.admin_decide_verification(
  p_verification_id uuid, p_approve boolean, p_legal_entity text default null, p_country text default null
) returns void
language plpgsql security definer
set search_path = '' as $$
declare
  v public.verifications;
  r public.reviews;
  e_id uuid;
begin
  perform private.require_admin();
  select * into v from public.verifications where id = p_verification_id and status = 'pending' for update;
  if v.id is null then return; end if;
  select * into r from public.reviews where id = v.review_id;

  update public.verifications set
    status = case when p_approve then 'approved'::public.verification_status else 'rejected' end,
    reviewed_by = (select auth.uid()),
    detected_legal_entity = nullif(btrim(p_legal_entity), '')
  where id = v.id;

  if p_approve then
    if r.verification_level = 'none' then
      update public.reviews set verification_level = 'document' where id = r.id;
    end if;
    if nullif(btrim(p_legal_entity), '') is not null then
      select id into e_id from public.legal_entities
      where lower(name) = lower(btrim(p_legal_entity)) limit 1;
      if e_id is null then
        insert into public.legal_entities (name, country)
        select btrim(p_legal_entity), coalesce(p_country, l.country)
        from public.locations l where l.id = r.location_id
        returning id into e_id;
      end if;
      insert into public.location_entity_links (location_id, legal_entity_id, source, confirmations_count, confidence)
      values (r.location_id, e_id, 'document', 1, 0.4)
      on conflict (location_id, legal_entity_id) do update set
        confirmations_count = public.location_entity_links.confirmations_count + 1,
        confidence = least(1, public.location_entity_links.confidence + 0.3),
        -- 2–3 independent documents verify the link (SPEC 6).
        verified_at = case
          when public.location_entity_links.confirmations_count + 1 >= 2
            then coalesce(public.location_entity_links.verified_at, now())
          else public.location_entity_links.verified_at
        end;
    end if;
    if r.status = 'published' then perform public.recompute_location_scores(r.location_id); end if;
  end if;
end $$;

-- Disputes: keep the review, or remove it.
create function public.admin_decide_dispute(p_dispute_id uuid, p_remove_review boolean) returns void
language plpgsql security definer
set search_path = '' as $$
declare d public.disputes; loc uuid;
begin
  perform private.require_admin();
  select * into d from public.disputes where id = p_dispute_id and status = 'open' for update;
  if d.id is null then return; end if;
  update public.disputes set status = case when p_remove_review then 'resolved'::public.case_status else 'rejected' end
  where id = d.id;
  if p_remove_review then
    update public.reviews set status = 'removed' where id = d.review_id returning location_id into loc;
    perform public.recompute_location_scores(loc);
  end if;
end $$;

revoke execute on function public.admin_decide_claim(uuid, boolean) from public, anon;
revoke execute on function public.admin_moderate_review(uuid, boolean) from public, anon;
revoke execute on function public.admin_decide_verification(uuid, boolean, text, text) from public, anon;
revoke execute on function public.admin_decide_dispute(uuid, boolean) from public, anon;
grant execute on function public.admin_decide_claim(uuid, boolean) to authenticated;
grant execute on function public.admin_moderate_review(uuid, boolean) to authenticated;
grant execute on function public.admin_decide_verification(uuid, boolean, text, text) to authenticated;
grant execute on function public.admin_decide_dispute(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Account self-service
-- ---------------------------------------------------------------------------

-- "Only after I leave this job": the author marks the job as ended.
create function public.mark_job_ended(p_review_id uuid, p_end date) returns void
language plpgsql security definer
set search_path = '' as $$
declare r public.reviews;
begin
  select * into r from public.reviews
  where id = p_review_id and user_id = (select auth.uid()) and relationship = 'current' for update;
  if r.id is null or p_end < r.period_start or p_end > now()::date then
    raise exception 'invalid' using errcode = '22023';
  end if;
  update public.reviews set
    relationship = 'former',
    period_end = p_end,
    publish_at = case
      when status = 'scheduled' and publish_at is null
        then now() + make_interval(days => 2 + floor(random() * 13)::int)
      else publish_at
    end
  where id = r.id;
end $$;

-- Deletes the caller's account. Reviews are kept as "Former member" or removed.
create function public.delete_my_account(p_keep_reviews boolean) returns void
language plpgsql security definer
set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  loc uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not p_keep_reviews then
    for loc in
      delete from public.reviews where user_id = uid returning location_id
    loop
      perform public.recompute_location_scores(loc);
    end loop;
  end if;
  delete from auth.users where id = uid;
end $$;

revoke execute on function public.mark_job_ended(uuid, date) from public, anon;
revoke execute on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.mark_job_ended(uuid, date) to authenticated;
grant execute on function public.delete_my_account(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- City slugs for city hubs (appended column keeps the view replaceable)
-- ---------------------------------------------------------------------------

create or replace view public.public_locations with (security_invoker = false) as
select
  l.id,
  c.slug as company_slug,
  c.name as company_name,
  l.slug,
  l.name,
  l.address,
  l.city,
  l.country,
  l.category,
  l.is_seeded,
  c.claimed_at is not null as claimed,
  (select e.name
     from public.location_entity_links k
     join public.legal_entities e on e.id = k.legal_entity_id
    where k.location_id = l.id and k.verified_at is not null
    order by k.confidence desc, k.verified_at
    limit 1) as legal_entity_name,
  s.overall, s.manager, s.pay, s.schedule, s.environment,
  s.paid_on_time_pct, s.paid_as_promised_pct, s.overtime_paid_pct, s.hours_as_promised_pct,
  s.reply_rate_pct, s.avg_reply_days,
  coalesce(s.review_count, 0) as review_count,
  coalesce(s.verified_count, 0) as verified_count,
  s.updated_at as scores_updated_at,
  public.slugify(l.city) as city_slug,
  l.updated_at,
  coalesce(s.invited_count, 0) as invited_count
from public.locations l
join public.companies c on c.id = l.company_id
left join public.location_scores s on s.location_id = l.id;
