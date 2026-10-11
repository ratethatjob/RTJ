"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { domainCheck, normalizeWebsite } from "@/lib/claim-check";
import { translateReply } from "@/lib/translation-jobs";

export async function postReply(
  reviewId: string,
  locationId: string,
  body: string,
): Promise<{ ok?: true; error?: true }> {
  const text = body.trim();
  if (!text || text.length > 3000) return { error: true };
  const { supabase, user } = await getUser();
  if (!user) return { error: true };
  const { data, error } = await supabase
    .from("employer_replies")
    .upsert(
      { review_id: reviewId, body: text, original_language: await getLocale() },
      { onConflict: "review_id" },
    )
    .select("id")
    .single();
  if (error) return { error: true };
  updateTag(`reviews:${locationId}`);
  after(() => translateReply(data.id));
  return { ok: true };
}

export async function disputeReview(
  reviewId: string,
  orgId: string,
  reason: string,
): Promise<{ ok?: true; error?: true }> {
  const text = reason.trim();
  if (!text || text.length > 2000) return { error: true };
  const { supabase, user } = await getUser();
  if (!user) return { error: true };
  const { error } = await supabase
    .from("disputes")
    .insert({ review_id: reviewId, org_id: orgId, reason: text, created_by: user.id });
  return error ? { error: true } : { ok: true };
}

const METHODS = ["email_domain", "document", "authorization"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Is the uploaded file really in the claimant's folder for this claim? */
async function documentExists(supabase: Awaited<ReturnType<typeof getUser>>["supabase"], path: string) {
  const folder = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data } = await supabase.storage.from("claim-documents").list(folder, { search: name });
  return Boolean(data?.some((f) => f.name === name));
}

export async function submitClaim(form: {
  id: string;
  locationId: string;
  orgName: string;
  contactName: string;
  jobTitle: string;
  method: string;
  phone: string;
  website: string;
  noWebsite: boolean;
  documentPath: string;
  idDocumentPath: string;
  note: string;
}): Promise<{ ok?: true; error?: "invalid" | "exists" | "domain" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const method = form.method as (typeof METHODS)[number];
  const phone = form.phone.trim();
  const website = form.noWebsite ? null : normalizeWebsite(form.website);
  const documentPath = method === "email_domain" ? "" : form.documentPath;
  const idDocumentPath = form.idDocumentPath;
  const inFolder = (path: string) => path.startsWith(`${user.id}/${form.id}/`);
  if (
    !UUID.test(form.id) ||
    form.orgName.trim().length < 2 ||
    form.contactName.trim().length < 2 ||
    !METHODS.includes(method) ||
    phone.replace(/\D/g, "").length < 6 ||
    (!form.noWebsite && !website) ||
    !inFolder(idDocumentPath) ||
    !(await documentExists(supabase, idDocumentPath)) ||
    (method !== "email_domain" && (!inFolder(documentPath) || !(await documentExists(supabase, documentPath))))
  ) {
    return { error: "invalid" };
  }
  // Business email: the signed-in address must be on the company website's domain (never freemail).
  if (method === "email_domain" && !domainCheck(user.email ?? null, website)?.match) return { error: "domain" };
  const { error } = await supabase.from("claim_requests").insert({
    id: form.id,
    location_id: form.locationId,
    user_id: user.id,
    org_name: form.orgName.trim().slice(0, 120),
    contact_name: form.contactName.trim().slice(0, 120),
    job_title: form.jobTitle.trim().slice(0, 120) || null,
    method,
    phone: phone.slice(0, 40),
    website,
    no_website: form.noWebsite,
    document_path: documentPath || null,
    id_document_path: idDocumentPath,
    note: form.note.trim().slice(0, 2000) || null,
    locale: (await getLocale()) === "hu" ? "hu" : "en",
  });
  if (error) return { error: error.code === "23505" ? "exists" : error.code === "22023" ? "invalid" : "generic" };
  return { ok: true };
}

/** The claimant answers an admin's question, optionally with a (new) document. */
export async function replyToClaim(
  claimId: string,
  body: string,
  documentPath: string,
): Promise<{ ok?: true; error?: "invalid" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const text = body.trim().slice(0, 2000);
  if (documentPath && (!documentPath.startsWith(`${user.id}/${claimId}/`) || !(await documentExists(supabase, documentPath)))) {
    return { error: "invalid" };
  }
  if (!text && !documentPath) return { error: "invalid" };
  const { data: old, error } = await supabase.rpc("claim_reply", {
    p_claim_id: claimId,
    p_body: text,
    p_document_path: documentPath || null,
  });
  if (error) return { error: "generic" };
  if (old) await supabase.storage.from("claim-documents").remove([old as string]);
  return { ok: true };
}

/** Asks to activate Pro for a location (paid by invoice until online payment is connected). */
export async function requestPro(locationId: string, interval: "month" | "year"): Promise<{ ok?: true; error?: true }> {
  if (interval !== "month" && interval !== "year") return { error: true };
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("request_pro", { p_location_id: locationId, p_interval: interval });
  return error ? { error: true } : { ok: true };
}
