-- Proof documents (owner's decision): access-request documents (registry extract / trade license,
-- letter of authorization, photo ID) and review proofs (payslip, contract …) are kept for 30 days
-- after the decision, then deleted by a daily job (/api/cron/documents: storage object + path).
-- Admins open them only through short-lived signed links; every open is logged. After deletion a
-- short record stays: document type, who checked it, when, result — no file, no personal data.
-- Replaces "deleted as soon as decided" (admin_decide_claim no longer clears the paths).

alter table public.claim_requests
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references auth.users (id) on delete set null,
  add column if not exists documents_delete_at timestamptz,
  add column if not exists documents_deleted_at timestamptz;

alter table public.verifications
  add column if not exists decided_at timestamptz,
  add column if not exists delete_at timestamptz;

-- Already decided before this migration: their files were deleted at the decision.
update public.verifications set decided_at = coalesce(decided_at, updated_at), deleted_at = coalesce(deleted_at, updated_at)
where status <> 'pending';
update public.claim_requests set decided_at = coalesce(decided_at, updated_at), documents_deleted_at = coalesce(documents_deleted_at, updated_at)
where status::text <> 'open' and document_path is null and id_document_path is null;

-- The record that stays after deletion.
create table if not exists public.document_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('claim', 'review')),
  source_id uuid not null,
  doc_type text not null,
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz,
  result text not null,
  deleted_at timestamptz not null default now()
);
alter table public.document_records enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'document_records' and policyname = 'Admins read document records') then
    create policy "Admins read document records" on public.document_records
      for select to authenticated using (private.is_admin());
  end if;
end $$;

-- Every time an admin opens a document.
create table if not exists public.document_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('claim', 'review')),
  source_id uuid not null,
  file text not null check (file in ('company', 'id', 'proof')),
  bucket text not null,
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists document_access_log_source on public.document_access_log (kind, source_id, created_at desc);
alter table public.document_access_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'document_access_log' and policyname = 'Admins read the document log') then
    create policy "Admins read the document log" on public.document_access_log
      for select to authenticated using (private.is_admin());
  end if;
end $$;

create or replace function public.admin_decide_claim(p_claim_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_approve then
    perform private.approve_claim(p_claim_id);
  else
    update public.claim_requests set status = 'rejected' where id = p_claim_id and status = 'open';
  end if;
  -- No longer clears the document paths: they stay 30 days (claim_decided), then the daily job.
end $$;

-- Any decision (admin button or `select private.approve_claim(…)`) stamps the date and the
-- deletion date of the documents.
create or replace function private.claim_decided()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status::text = 'open' and new.status::text <> 'open' then
    new.decided_at := now();
    new.decided_by := (select auth.uid());
    new.documents_delete_at := case
      when new.document_path is not null or new.id_document_path is not null then now() + interval '30 days'
    end;
  end if;
  return new;
end $$;

create or replace trigger claim_decided
  before update of status on public.claim_requests
  for each row execute function private.claim_decided();

-- Verifications: stamp the decision and the deletion date (the RPC itself stays as it is).
create or replace function private.verification_decided()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status <> 'pending' then
    new.decided_at := now();
    new.delete_at := case when new.storage_path is not null and new.deleted_at is null then now() + interval '30 days' end;
  end if;
  return new;
end $$;

create or replace trigger verification_decided
  before update of status on public.verifications
  for each row execute function private.verification_decided();

-- An admin opens a document: logged, returns where it is (the app then signs a 60-second link).
-- Nothing once the file is deleted.
create or replace function public.admin_open_document(p_kind text, p_id uuid, p_file text)
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  b text;
  p text;
begin
  perform private.require_admin();
  if p_kind = 'claim' and p_file in ('company', 'id') then
    b := 'claim-documents';
    select case when p_file = 'company' then c.document_path else c.id_document_path end into p
    from public.claim_requests c where c.id = p_id and c.documents_deleted_at is null;
  elsif p_kind = 'review' and p_file = 'proof' then
    b := 'verifications';
    select v.storage_path into p from public.verifications v where v.id = p_id and v.deleted_at is null;
  end if;
  if p is null then return; end if;
  insert into public.document_access_log (admin_id, kind, source_id, file, bucket, path)
  values ((select auth.uid()), p_kind, p_id, p_file, b, p);
  return query select b, p;
end $$;

revoke all on function public.admin_open_document(text, uuid, text) from public, anon;
grant execute on function public.admin_open_document(text, uuid, text) to authenticated;

-- Daily job (service role): what is due for deletion …
create or replace function public.documents_due(p_limit int default 200)
returns table (kind text, id uuid, bucket text, paths text[])
language sql
stable
security definer
set search_path = ''
as $$
  (select 'claim', c.id, 'claim-documents',
          array_remove(array[c.document_path, c.id_document_path], null)
   from public.claim_requests c
   where c.documents_deleted_at is null and c.documents_delete_at <= now()
   order by c.documents_delete_at
   limit p_limit)
  union all
  (select 'review', v.id, 'verifications', array[v.storage_path]
   from public.verifications v
   where v.deleted_at is null and v.delete_at <= now() and v.storage_path is not null
   order by v.delete_at
   limit p_limit)
$$;

-- … and, once the storage objects are gone, the paths go too and the short record is written.
create or replace function public.document_deleted(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.claim_requests;
  v public.verifications;
begin
  if p_kind = 'claim' then
    select * into c from public.claim_requests where id = p_id and documents_deleted_at is null for update;
    if c.id is null then return; end if;
    if c.document_path is not null then
      insert into public.document_records (kind, source_id, doc_type, checked_by, checked_at, result)
      values ('claim', c.id, case when c.method::text = 'authorization' then 'authorization' else 'registry_extract' end,
              c.decided_by, c.decided_at, c.status::text);
    end if;
    if c.id_document_path is not null then
      insert into public.document_records (kind, source_id, doc_type, checked_by, checked_at, result)
      values ('claim', c.id, 'photo_id', c.decided_by, c.decided_at, c.status::text);
    end if;
    update public.claim_requests set document_path = null, id_document_path = null, documents_deleted_at = now()
    where id = c.id;
  elsif p_kind = 'review' then
    select * into v from public.verifications where id = p_id and deleted_at is null for update;
    if v.id is null then return; end if;
    insert into public.document_records (kind, source_id, doc_type, checked_by, checked_at, result)
    values ('review', v.id, v.doc_type::text, v.reviewed_by, v.decided_at, v.status::text);
    update public.verifications set storage_path = null, deleted_at = now() where id = v.id;
  end if;
end $$;

revoke all on function public.documents_due(int) from public, anon, authenticated;
revoke all on function public.document_deleted(text, uuid) from public, anon, authenticated;
grant execute on function public.documents_due(int) to service_role;
grant execute on function public.document_deleted(text, uuid) to service_role;
