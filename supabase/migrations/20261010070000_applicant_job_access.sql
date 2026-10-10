-- Applicants keep seeing the jobs they applied to after those close.
create function private.has_applied(p_job_id uuid) returns boolean
language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.job_applications
    where job_id = p_job_id and user_id = (select auth.uid()))
$$;

create policy "Applicants read applied jobs" on public.jobs for select to authenticated
  using (private.has_applied(id));
