-- Move RLS helper functions out of the exposed API schema so they can't be
-- called through /rest/v1/rpc. Policies reference functions by OID, so they
-- keep working after the move.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.has_org_role(uuid, public.org_role[]) set schema private;
alter function public.can_manage_location(uuid) set schema private;
alter function public.is_published_review(uuid) set schema private;
alter function public.can_reply_to_review(uuid) set schema private;
alter function public.can_dispute_review(uuid, uuid) set schema private;

-- Bodies that call other helpers by name.
create or replace function private.can_reply_to_review(p_review_id uuid) returns boolean
language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.reviews r
    where r.id = p_review_id and r.status = 'published'
      and private.can_manage_location(r.location_id))
$$;

create or replace function private.can_dispute_review(p_review_id uuid, p_org_id uuid) returns boolean
language sql stable security definer
set search_path = '' as $$
  select private.has_org_role(p_org_id, '{owner,hr}') and exists (
    select 1 from public.reviews r
    join public.locations l on l.id = r.location_id
    join public.companies c on c.id = l.company_id
    where r.id = p_review_id
      and r.status = 'published'
      and r.verification_level = 'none'
      and c.owner_org_id = p_org_id)
$$;

create or replace function public.invite_batch_stats(p_location_id uuid)
returns table (invites_sent bigint, reviews_received bigint)
language plpgsql stable security definer
set search_path = '' as $$
declare received bigint;
begin
  if not private.can_manage_location(p_location_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select count(*) into received
  from public.reviews r
  join public.invites i on i.id = r.invite_id
  join public.invite_batches b on b.id = i.batch_id
  where b.location_id = p_location_id and r.status = 'published';

  return query
    select coalesce(sum(b.sent_count), 0)::bigint,
           case when received >= 5 then received else null end
    from public.invite_batches b
    where b.location_id = p_location_id;
end $$;

-- Trigger-only function.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter function public.set_updated_at() set search_path = '';

comment on view public.public_reviews is
  'Intentionally runs as owner: exposes only safe columns of published reviews, never user_id or invite_id.';
comment on view public.public_locations is
  'Intentionally runs as owner: public directory data plus aggregated scores.';
