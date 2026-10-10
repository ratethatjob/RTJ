-- Reviewer flow: display name onboarding, review publishing pipeline,
-- verification document storage.

-- ---------------------------------------------------------------------------
-- Profiles: users pick generated name or username; they can't write
-- arbitrary generated names.
-- ---------------------------------------------------------------------------

alter table public.profiles add column name_confirmed_at timestamptz;

revoke update on public.profiles from authenticated, anon;
grant update (display_mode, username, preferred_locale, name_confirmed_at)
  on public.profiles to authenticated;

-- Draws a new "Quiet Oak 42" style name for the caller.
create function public.shuffle_generated_name() returns text
language plpgsql security definer
set search_path = '' as $$
declare new_name text := public.generate_display_name();
begin
  update public.profiles set generated_name = new_name
  where user_id = (select auth.uid());
  return new_name;
end $$;

revoke execute on function public.shuffle_generated_name() from public, anon;
grant execute on function public.shuffle_generated_name() to authenticated;

-- ---------------------------------------------------------------------------
-- Publishing pipeline
--   pending_moderation --moderate_review()--> scheduled | (stays pending)
--   scheduled --publish_due_reviews() (cron)--> published
-- ---------------------------------------------------------------------------

-- Stub moderation: free text containing an email address, phone number or
-- URL waits for manual review; everything else is scheduled. The anonymity
-- guard delays reviews of locations with < 5 published reviews by 2–14 days.
create function private.moderate_review(p_review_id uuid) returns void
language plpgsql security definer
set search_path = '' as $$
declare
  r public.reviews;
  published_count int;
  delay interval;
begin
  select * into r from public.reviews where id = p_review_id for update;
  if r.status <> 'pending_moderation' then return; end if;

  if r.body ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[a-z]{2,}'
     or r.body ~ '(\+?\d[\d\s/().-]{7,}\d)'
     or r.body ~* '(https?://|www\.)' then
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
      -- Waits until the author marks the job as ended.
      when r.publish_mode = 'after_leaving' and r.period_end is null then null
      else now() + delay
    end
  where id = p_review_id;
end $$;

create function private.on_review_submitted() returns trigger
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.moderate_review(new.id);
  return null;
end $$;

create trigger moderate_on_submit
  after insert or update of status on public.reviews
  for each row when (new.status = 'pending_moderation')
  execute function private.on_review_submitted();

-- Publishes scheduled reviews whose time has come and refreshes scores.
create function public.publish_due_reviews() returns int
language plpgsql security definer
set search_path = '' as $$
declare
  loc uuid;
  n int := 0;
begin
  for loc in
    with published as (
      update public.reviews
      set status = 'published', published_at = now()
      where status = 'scheduled' and publish_at <= now()
      returning location_id
    )
    select distinct location_id from published
  loop
    perform public.recompute_location_scores(loc);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.publish_due_reviews() from public, anon, authenticated;

-- Run every 15 minutes where pg_cron is available (Supabase).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('publish-due-reviews', '*/15 * * * *', 'select public.publish_due_reviews()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Verification documents: private bucket, files under "<user id>/".
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('verifications', 'verifications', false, 10485760,
            array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;

    create policy "Upload own verification files" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'verifications'
                  and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;
