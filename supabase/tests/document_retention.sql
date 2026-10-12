-- Document retention test (migration 20261012170000_document_retention.sql), run against a
-- database that has the migration: psql "$POSTGRES_URL_NON_POOLING" -f supabase/tests/document_retention.sql
-- One transaction, rolled back. Checks: a decision keeps the files and sets the deletion date 30
-- days ahead; an admin open is logged and returns the path; nothing is due before day 30; after
-- it the job lists the files, document_deleted() clears the paths and leaves a record without
-- files; a deleted document can't be opened any more.
begin;
do $t$
declare
  admin uuid; loc uuid; c uuid; v uuid; rv uuid; d record; n int;
begin
  select user_id into admin from public.admins limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  select id into loc from public.locations limit 1;
  c := gen_random_uuid();
  insert into public.claim_requests (id, location_id, user_id, org_name, contact_name, method, status, phone, no_website, document_path, id_document_path)
    values (c, loc, admin, 'dryrun', 'Dry Run', 'document', 'open', '+36123456', true, admin || '/' || c || '/company.pdf', admin || '/' || c || '/id.jpg');
  insert into public.reviews (location_id, relationship, period_start, position, work_type, status, overall)
    values (loc, 'former', '2025-01-01', 'x', 'permanent', 'draft', 4) returning id into rv;
  insert into public.verifications (review_id, storage_path, doc_type) values (rv, admin || '/proof.pdf', 'payslip') returning id into v;

  update public.claim_requests set status = 'rejected' where id = c;
  update public.verifications set status = 'approved', reviewed_by = admin where id = v;
  select * into d from public.claim_requests where id = c;
  if d.document_path is null or d.documents_delete_at not between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour' then
    raise exception 'claim retention wrong: % %', d.document_path, d.documents_delete_at;
  end if;
  if (select delete_at from public.verifications where id = v) not between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour' then
    raise exception 'verification delete_at wrong';
  end if;

  if (select path from public.admin_open_document('claim', c, 'id')) <> admin || '/' || c || '/id.jpg' then raise exception 'open failed'; end if;
  perform public.admin_open_document('review', v, 'proof');
  select count(*) into n from public.document_access_log where source_id in (c, v) and admin_id = admin;
  if n <> 2 then raise exception 'log has % rows', n; end if;

  if exists (select 1 from public.documents_due() where id in (c, v)) then raise exception 'due too early'; end if;
  update public.claim_requests set documents_delete_at = now() - interval '1 minute' where id = c;
  update public.verifications set delete_at = now() - interval '1 minute' where id = v;
  select count(*) into n from public.documents_due() where id in (c, v);
  if n <> 2 then raise exception 'due lists %', n; end if;
  if (select array_length(paths, 1) from public.documents_due() where id = c) <> 2 then raise exception 'claim paths'; end if;

  perform public.document_deleted('claim', c);
  perform public.document_deleted('review', v);
  if exists (select 1 from public.claim_requests where id = c and (document_path is not null or id_document_path is not null or documents_deleted_at is null)) then raise exception 'claim not cleared'; end if;
  if exists (select 1 from public.verifications where id = v and (storage_path is not null or deleted_at is null)) then raise exception 'proof not cleared'; end if;
  select count(*) into n from public.document_records where source_id in (c, v);
  if n <> 3 then raise exception 'records %', n; end if;
  if exists (select 1 from public.document_records where source_id = c and (result <> 'rejected' or checked_at is null)) then raise exception 'record content'; end if;
  if exists (select 1 from public.documents_due() where id in (c, v)) then raise exception 'still due'; end if;
  if exists (select 1 from public.admin_open_document('claim', c, 'company')) then raise exception 'deleted file opened'; end if;
  raise notice 'document retention OK';
end $t$;
rollback;
