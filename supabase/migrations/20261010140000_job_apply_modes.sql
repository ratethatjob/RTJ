-- Jobs: quick apply (question set, no CV) or CV-based apply; richer job ads.

create type public.apply_mode as enum ('quick', 'cv');

alter table public.jobs
  add column apply_mode public.apply_mode not null default 'quick',
  -- [{ id, text, type: 'yes_no' | 'text', required: bool, must: 'yes' | 'no' | null }]
  add column questions jsonb not null default '[]'
    check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 15),
  add column responsibilities text[] not null default '{}' check (cardinality(responsibilities) <= 15),
  add column requirements text[] not null default '{}' check (cardinality(requirements) <= 15),
  add column offers text[] not null default '{}' check (cardinality(offers) <= 15);

-- The single free-text question becomes the first item of the question set.
update public.jobs
set questions = jsonb_build_array(jsonb_build_object(
  'id', 'q1', 'text', question, 'type', 'text', 'required', true, 'must', null))
where question is not null and questions = '[]';

alter table public.job_applications
  add column answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  add column cv_path text,
  alter column start_when drop not null,
  alter column experience drop not null;

-- Applications for one job, for its managers (never the applicant's user id).
create function public.job_application_list(p_job_id uuid)
returns table (
  id uuid, full_name text, email text, phone text, start_when public.start_when,
  experience boolean, answer text, answers jsonb, cv_path text, message text,
  status public.application_status, created_at timestamptz, first_reply_at timestamptz
)
language sql stable security definer
set search_path = '' as $$
  select a.id, a.full_name, a.email, a.phone, a.start_when, a.experience, a.answer, a.answers,
         a.cv_path, a.message, a.status, a.created_at, a.first_reply_at
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  where a.job_id = p_job_id and private.can_manage_location(j.location_id)
    and a.status <> 'withdrawn'
  order by a.created_at desc
$$;
revoke execute on function public.job_application_list(uuid) from public, anon;
grant execute on function public.job_application_list(uuid) to authenticated;

-- CVs: private bucket, "<job id>/<user id>/<file>". Applicants upload to open jobs;
-- the job's managers and the applicant can read.
create function private.can_read_cv(p_job_folder text, p_user_folder text) returns boolean
language sql stable security definer
set search_path = '' as $$
  select p_user_folder = (select auth.uid())::text
      or (p_job_folder ~* '^[0-9a-f-]{36}$' and exists (
            select 1 from public.jobs j
            where j.id = p_job_folder::uuid and private.can_manage_location(j.location_id)))
$$;

create function private.can_upload_cv(p_job_folder text, p_user_folder text) returns boolean
language sql stable security definer
set search_path = '' as $$
  select p_user_folder = (select auth.uid())::text
     and p_job_folder ~* '^[0-9a-f-]{36}$'
     and private.is_open_job(p_job_folder::uuid)
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('cvs', 'cvs', false, 5242880, array[
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
    on conflict (id) do nothing;

    create policy "Applicants upload CVs" on storage.objects for insert to authenticated
      with check (bucket_id = 'cvs'
                  and private.can_upload_cv((storage.foldername(name))[1], (storage.foldername(name))[2]));
    create policy "Applicants and managers read CVs" on storage.objects for select to authenticated
      using (bucket_id = 'cvs'
             and private.can_read_cv((storage.foldername(name))[1], (storage.foldername(name))[2]));
  end if;
end $$;

-- Appended columns keep the view replaceable.
create or replace view public.public_jobs with (security_invoker = false) as
select
  j.id, j.title, j.work_type, j.schedule, j.pay_min, j.pay_max, j.pay_currency, j.pay_period,
  j.description, j.question, j.published_at, j.closes_at, j.updated_at,
  l.id as location_id, l.slug as location_slug, l.name as location_name, l.address, l.city,
  public.slugify(l.city) as city_slug, l.country, l.category,
  c.slug as company_slug, c.name as company_name,
  j.apply_mode, j.questions, j.responsibilities, j.requirements, j.offers
from public.jobs j
join public.locations l on l.id = j.location_id
join public.companies c on c.id = l.company_id
where j.status = 'open' and (j.closes_at is null or j.closes_at >= current_date);
