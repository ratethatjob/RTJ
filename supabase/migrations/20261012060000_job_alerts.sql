-- Optional consent to emails about jobs near the reviewer (asked when signing in to send a review,
-- off by default, can be turned off on the account page). job_alerts_at records when it last changed.

alter table public.profiles
  add column job_alerts boolean not null default false,
  add column job_alerts_at timestamptz;

grant update (job_alerts) on public.profiles to authenticated;

create function private.stamp_job_alerts() returns trigger
language plpgsql
set search_path = '' as $$
begin
  if new.job_alerts is distinct from old.job_alerts then new.job_alerts_at := now(); end if;
  return new;
end $$;

create trigger stamp_job_alerts before update of job_alerts on public.profiles
  for each row execute function private.stamp_job_alerts();
