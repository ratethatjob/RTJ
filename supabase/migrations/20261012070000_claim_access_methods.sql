-- Access requests ("claims") are verified in one of three ways, each with a photo ID of the person:
--   email_domain   – the signed-in (code-verified) email's domain matches the company website
--   document       – company registry extract / trade license naming the person
--   authorization  – letter of authorization from the company (form in /public/forms)
-- The phone method is no longer offered: the enum value stays (no DROP), new requests can't use it.
-- Files stay in the private "claim-documents" bucket (<user id>/<claim id>/…) and are deleted
-- after the decision.

alter type public.claim_method add value if not exists 'authorization';

alter table public.claim_requests
  add column id_document_path text check (length(id_document_path) <= 300);

create or replace function private.claim_defaults() returns trigger
language plpgsql security definer
set search_path = '' as $$
declare prefix text := new.user_id::text || '/' || new.id::text || '/%';
begin
  new.account_email := (select email from auth.users where id = new.user_id);
  if new.method = 'email_domain' then new.business_email := new.account_email; end if;
  if (new.document_path is not null and new.document_path not like prefix)
     or (new.id_document_path is not null and new.id_document_path not like prefix) then
    raise exception 'invalid document path' using errcode = '22023';
  end if;
  if new.method::text = 'phone' then
    raise exception 'method not offered' using errcode = '22023';
  end if;
  if new.phone is null or length(btrim(new.phone)) < 6
     or (new.website is null and not new.no_website)
     or new.id_document_path is null
     or (new.method::text = 'email_domain' and new.website is null)
     or (new.method::text in ('document', 'authorization') and new.document_path is null) then
    raise exception 'claim incomplete' using errcode = '22023';
  end if;
  return new;
end $$;

-- Same decision as before; both document references go with it (the server deletes the files).
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
  update public.claim_requests set document_path = null, id_document_path = null where id = p_claim_id;
end $$;
