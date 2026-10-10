-- Where an application came from: our own site, or a jobs widget on the employer's website.

alter table public.job_applications
  add column source text not null default 'site' check (source in ('site', 'embed'));
