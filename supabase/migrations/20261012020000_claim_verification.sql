-- Verifiable workplace claims: phone and website on every claim, the signed-in (code-verified)
-- email recorded by the database, a registry document for the "document" method in the private
-- "claim-documents" bucket (<user id>/<claim id>/…, deleted after the decision), and
-- "more info" messages between the admin and the claimant while the claim stays open.

alter table public.claim_requests
  add column website text check (length(website) <= 200),
  add column no_website boolean not null default false,
  add column account_email text,
  add column document_path text check (length(document_path) <= 300),
  add column locale text not null default 'en' check (locale in ('en', 'hu'));

-- The account email comes from auth, never from the form; the email method uses it too.
create function private.claim_defaults() returns trigger
language plpgsql security definer
set search_path = '' as $$
begin
  new.account_email := (select email from auth.users where id = new.user_id);
  if new.method = 'email_domain' then new.business_email := new.account_email; end if;
  if new.document_path is not null
     and new.document_path not like new.user_id::text || '/' || new.id::text || '/%' then
    raise exception 'invalid document path' using errcode = '22023';
  end if;
  if new.phone is null or length(btrim(new.phone)) < 6
     or (new.website is null and not new.no_website)
     or (new.method = 'document' and new.document_path is null) then
    raise exception 'claim incomplete' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger claim_defaults before insert on public.claim_requests
  for each row execute function private.claim_defaults();

-- ---------------------------------------------------------------------------
-- Messages: the admin asks for more, the claimant answers (and may add a document).
-- ---------------------------------------------------------------------------

create table public.claim_messages (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claim_requests (id) on delete cascade,
  from_admin boolean not null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index claim_messages_claim on public.claim_messages (claim_id, created_at);
alter table public.claim_messages enable row level security;
create policy "Claimants read their claim messages" on public.claim_messages for select to authenticated
  using (exists (select 1 from public.claim_requests c
                 where c.id = claim_id and c.user_id = (select auth.uid())));
create policy "Admins read claim messages" on public.claim_messages for select to authenticated
  using (private.is_admin());

create function public.admin_claim_request_info(p_claim_id uuid, p_body text) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  if not exists (select 1 from public.claim_requests where id = p_claim_id and status = 'open') then
    raise exception 'claim not open' using errcode = '22023';
  end if;
  insert into public.claim_messages (claim_id, from_admin, body) values (p_claim_id, true, btrim(p_body));
end $$;

-- The claimant's answer. A new document replaces the old one; returns the old path so the
-- server can delete that file.
create function public.claim_reply(p_claim_id uuid, p_body text, p_document_path text default null)
returns text
language plpgsql security definer
set search_path = '' as $$
declare
  c public.claim_requests;
begin
  select * into c from public.claim_requests
  where id = p_claim_id and user_id = (select auth.uid()) and status = 'open' for update;
  if c.id is null then raise exception 'claim not open' using errcode = '42501'; end if;
  if p_document_path is not null
     and p_document_path not like c.user_id::text || '/' || c.id::text || '/%' then
    raise exception 'invalid document path' using errcode = '22023';
  end if;
  if coalesce(btrim(p_body), '') = '' and p_document_path is null then
    raise exception 'empty reply' using errcode = '22023';
  end if;
  if coalesce(btrim(p_body), '') <> '' then
    insert into public.claim_messages (claim_id, from_admin, body) values (c.id, false, btrim(p_body));
  end if;
  if p_document_path is not null then
    update public.claim_requests set document_path = p_document_path where id = c.id;
    return nullif(c.document_path, p_document_path);
  end if;
  return null;
end $$;

-- Same decision as before; the document reference goes with it (the server deletes the files).
create or replace function public.admin_decide_claim(p_claim_id uuid, p_approve boolean) returns void
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  if p_approve then
    perform private.approve_claim(p_claim_id);
  else
    update public.claim_requests set status = 'rejected' where id = p_claim_id and status = 'open';
  end if;
  update public.claim_requests set document_path = null where id = p_claim_id;
end $$;

revoke execute on function public.admin_claim_request_info(uuid, text) from public, anon;
grant execute on function public.admin_claim_request_info(uuid, text) to authenticated;
revoke execute on function public.claim_reply(uuid, text, text) from public, anon;
grant execute on function public.claim_reply(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files under "<user id>/<claim id>/".
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('claim-documents', 'claim-documents', false, 10485760,
            array['application/pdf', 'image/jpeg', 'image/png'])
    on conflict (id) do nothing;

    create policy "Upload own claim documents" on storage.objects for insert to authenticated
      with check (bucket_id = 'claim-documents'
                  and (storage.foldername(name))[1] = (select auth.uid())::text);
    create policy "Read own claim documents" on storage.objects for select to authenticated
      using (bucket_id = 'claim-documents'
             and (storage.foldername(name))[1] = (select auth.uid())::text);
    create policy "Delete own claim documents" on storage.objects for delete to authenticated
      using (bucket_id = 'claim-documents'
             and (storage.foldername(name))[1] = (select auth.uid())::text);
    create policy "Admins read claim documents" on storage.objects for select to authenticated
      using (bucket_id = 'claim-documents' and private.is_admin());
    create policy "Admins delete claim documents" on storage.objects for delete to authenticated
      using (bucket_id = 'claim-documents' and private.is_admin());
  end if;
end $$;
