-- Languages: the job ad's own language and the languages expected from applicants (with level);
-- the original language of application messages.

alter table public.jobs
  add column ad_language text check (ad_language ~ '^[a-z]{2}$'),
  -- [{ code: 'en', level: 'basic' | 'conversational' | 'fluent' | 'native' }]
  add column languages jsonb not null default '[]'
    check (jsonb_typeof(languages) = 'array' and jsonb_array_length(languages) <= 6);

alter table public.application_messages add column original_language text check (original_language ~ '^[a-z]{2}$');
alter table public.job_applications add column message_language text check (message_language ~ '^[a-z]{2}$');

-- Thread messages now carry their language (same columns, richer JSON: no signature change).
create or replace function public.job_application_list(p_job_id uuid)
returns table (
  id uuid, full_name text, email text, phone text, start_when public.start_when,
  experience boolean, answer text, answers jsonb, cv_path text, message text,
  status public.application_status, created_at timestamptz, first_reply_at timestamptz,
  last_called_at timestamptz, insight jsonb, followups jsonb, messages jsonb
)
language sql stable security definer
set search_path = '' as $$
  select a.id, a.full_name, a.email, a.phone, a.start_when, a.experience, a.answer, a.answers,
         a.cv_path, a.message, a.status, a.created_at, a.first_reply_at, a.last_called_at,
         case when j.tier in ('basic', 'pro') then
           (select i.summary || jsonb_build_object('cv_read', i.cv_read, 'updated_at', i.updated_at)
            from public.application_insights i where i.application_id = a.id)
         end,
         coalesce((select jsonb_agg(jsonb_build_object('question', f.question, 'answer', f.answer)
                                    order by f.position)
                   from public.application_followups f where f.application_id = a.id), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body,
                                                       'created_at', m.created_at,
                                                       'original_language', m.original_language)
                                    order by m.created_at)
                   from public.application_messages m where m.application_id = a.id), '[]')
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  where a.job_id = p_job_id and private.can_manage_location(j.location_id)
    and a.status <> 'withdrawn'
  order by a.created_at desc
$$;

-- Language of each applicant's own message, for the job's managers.
create function public.job_application_message_languages(p_job_id uuid)
returns table (id uuid, message_language text)
language sql stable security definer
set search_path = '' as $$
  select a.id, a.message_language
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  where a.job_id = p_job_id and private.can_manage_location(j.location_id)
$$;
revoke execute on function public.job_application_message_languages(uuid) from public, anon;
grant execute on function public.job_application_message_languages(uuid) to authenticated;

-- Employer messages: the sender's language is passed in.
create or replace function public.send_application_message(p_application_id uuid, p_body text, p_language text default null)
returns uuid
language plpgsql security definer
set search_path = '' as $$
declare loc uuid := private.managed_application(p_application_id);
declare mid uuid;
declare first boolean;
begin
  if loc is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.application_messages (application_id, sender, author_id, body, original_language)
  values (p_application_id, 'employer', auth.uid(), btrim(p_body),
          case when p_language ~ '^[a-z]{2}$' then p_language end)
  returning id into mid;
  update public.job_applications set first_reply_at = coalesce(first_reply_at, now())
  where id = p_application_id
  returning first_reply_at = now() into first;
  if first then
    perform public.recompute_location_scores(loc);
  end if;
  return mid;
end $$;
revoke execute on function public.send_application_message(uuid, text, text) from public, anon;
grant execute on function public.send_application_message(uuid, text, text) to authenticated;

create or replace view public.public_jobs with (security_invoker = false) as
select
  j.id, j.title, j.work_type, j.schedule, j.pay_min, j.pay_max, j.pay_currency, j.pay_period,
  j.description, j.question, j.published_at, j.closes_at, j.updated_at,
  l.id as location_id, l.slug as location_slug, l.name as location_name, l.address, l.city,
  public.slugify(l.city) as city_slug, l.country, l.category,
  c.slug as company_slug, c.name as company_name,
  j.apply_mode, j.questions, j.responsibilities, j.requirements, j.offers,
  j.tier = 'pro' as featured,
  c.is_demo,
  j.ad_language, j.languages
from public.jobs j
join public.locations l on l.id = j.location_id
join public.companies c on c.id = l.company_id
where j.status = 'open' and (j.closes_at is null or j.closes_at >= current_date);
