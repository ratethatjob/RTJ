-- The founder becomes admin automatically once dev@ratethatjob.com is confirmed (first sign-in).

create function private.grant_founder_admin() returns trigger
language plpgsql security definer
set search_path = '' as $$
begin
  if lower(new.email) = 'dev@ratethatjob.com' and new.email_confirmed_at is not null then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return null;
end $$;

create trigger grant_founder_admin after insert or update of email_confirmed_at, email on auth.users
  for each row execute function private.grant_founder_admin();
