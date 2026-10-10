"use server";

import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
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
  revalidateTag(`reviews:${locationId}`, "max");
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

const METHODS = ["email_domain", "phone", "document"] as const;

export async function submitClaim(form: {
  locationId: string;
  orgName: string;
  contactName: string;
  jobTitle: string;
  method: string;
  businessEmail: string;
  phone: string;
  note: string;
}): Promise<{ ok?: true; error?: "invalid" | "exists" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const method = form.method as (typeof METHODS)[number];
  const email = form.businessEmail.trim();
  const phone = form.phone.trim();
  if (
    form.orgName.trim().length < 2 ||
    form.contactName.trim().length < 2 ||
    !METHODS.includes(method) ||
    (method === "email_domain" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) ||
    (method === "phone" && phone.length < 6)
  ) {
    return { error: "invalid" };
  }
  const { error } = await supabase.from("claim_requests").insert({
    location_id: form.locationId,
    user_id: user.id,
    org_name: form.orgName.trim().slice(0, 120),
    contact_name: form.contactName.trim().slice(0, 120),
    job_title: form.jobTitle.trim().slice(0, 120) || null,
    method,
    business_email: email || null,
    phone: phone.slice(0, 40) || null,
    note: form.note.trim().slice(0, 2000) || null,
  });
  if (error) return { error: error.code === "23505" ? "exists" : "generic" };
  return { ok: true };
}

/** Asks to activate Pro for a location (paid by invoice until online payment is connected). */
export async function requestPro(locationId: string, interval: "month" | "year"): Promise<{ ok?: true; error?: true }> {
  if (interval !== "month" && interval !== "year") return { error: true };
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("request_pro", { p_location_id: locationId, p_interval: interval });
  return error ? { error: true } : { ok: true };
}
