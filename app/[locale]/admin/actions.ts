"use server";

import { updateTag } from "next/cache";
import { expireWorkplaces } from "@/lib/cache";
import { getUser } from "@/lib/auth";
import { isCategory } from "@/lib/categories";
import { sendClaimEmail } from "@/lib/claim-emails";
import { type InvoiceCheck, stripe, syncAllInvoiceSetups } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/admin";
import { osmDetails } from "@/lib/osm";
import { classifyPlace, placeTypeInfo } from "@/lib/place-types";
import { placeTypes } from "@/lib/places";
import { type RunSummary, runOsmImport } from "@/lib/osm-import";
import { osmCity, osmGroup } from "@/lib/osm-import-core";

type Result = { ok?: true; error?: true };

type ClaimInfo = { user_id: string; account_email: string | null; locale: string; locations: { name: string; address: string } | null };

async function claimInfo(supabase: Awaited<ReturnType<typeof getUser>>["supabase"], id: string) {
  const { data } = await supabase
    .from("claim_requests")
    .select("user_id, account_email, locale, locations(name, address)")
    .eq("id", id)
    .single();
  const c = data as unknown as ClaimInfo | null;
  return c && { ...c, mail: { email: c.account_email, locale: c.locale, location: [c.locations?.name, c.locations?.address].filter(Boolean).join(", ") } };
}

export async function decideClaim(id: string, approve: boolean): Promise<Result> {
  const { supabase } = await getUser();
  const claim = await claimInfo(supabase, id);
  const { error } = await supabase.rpc("admin_decide_claim", { p_claim_id: id, p_approve: approve });
  if (error || !claim) return { error: true };
  // Documents are deleted as soon as the claim is decided.
  const folder = `${claim.user_id}/${id}`;
  const { data: files } = await supabase.storage.from("claim-documents").list(folder);
  if (files?.length) await supabase.storage.from("claim-documents").remove(files.map((f) => `${folder}/${f.name}`));
  await sendClaimEmail(claim.mail, approve ? "approved" : "rejected");
  expireWorkplaces();
  return { ok: true };
}

/** Keeps the claim open and asks the claimant for more (shown on /business, sent by email). */
export async function requestClaimInfo(id: string, message: string): Promise<Result> {
  const text = message.trim().slice(0, 2000);
  if (!text) return { error: true };
  const { supabase } = await getUser();
  const claim = await claimInfo(supabase, id);
  const { error } = await supabase.rpc("admin_claim_request_info", { p_claim_id: id, p_body: text });
  if (error || !claim) return { error: true };
  await sendClaimEmail(claim.mail, "info", text);
  return { ok: true };
}

export async function moderateReview(id: string, approve: boolean): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("admin_moderate_review", { p_review_id: id, p_approve: approve });
  return error ? { error: true } : { ok: true };
}

export async function decideVerification(
  id: string,
  approve: boolean,
  legalEntity: string,
): Promise<Result> {
  const { supabase } = await getUser();
  const { data: v } = await supabase
    .from("verifications")
    .select("storage_path, reviews(location_id)")
    .eq("id", id)
    .single();
  const { error } = await supabase.rpc("admin_decide_verification", {
    p_verification_id: id,
    p_approve: approve,
    p_legal_entity: legalEntity.trim() || null,
  });
  if (error) return { error: true };
  // The document is deleted as soon as it has been decided.
  if (v?.storage_path) await supabase.storage.from("verifications").remove([v.storage_path]);
  const loc = (v?.reviews as unknown as { location_id: string } | null)?.location_id;
  if (loc) {
    updateTag(`reviews:${loc}`);
    expireWorkplaces();
  }
  return { ok: true };
}

export async function decideDispute(id: string, removeReview: boolean): Promise<Result> {
  const { supabase } = await getUser();
  const { data: d } = await supabase.from("disputes").select("reviews(location_id)").eq("id", id).single();
  const { error } = await supabase.rpc("admin_decide_dispute", {
    p_dispute_id: id,
    p_remove_review: removeReview,
  });
  if (error) return { error: true };
  const loc = (d?.reviews as unknown as { location_id: string } | null)?.location_id;
  if (loc && removeReview) {
    updateTag(`reviews:${loc}`);
    expireWorkplaces();
  }
  return { ok: true };
}

export async function decideReport(id: string, removeReview: boolean): Promise<Result> {
  const { supabase } = await getUser();
  const { data: r } = await supabase.from("reports").select("reviews(location_id)").eq("id", id).single();
  const { error } = await supabase.rpc("admin_decide_report", { p_report_id: id, p_remove_review: removeReview });
  if (error) return { error: true };
  const loc = (r?.reviews as unknown as { location_id: string } | null)?.location_id;
  if (loc && removeReview) {
    updateTag(`reviews:${loc}`);
    expireWorkplaces();
  }
  return { ok: true };
}

export type ImportRow = Record<string, string>;

export async function importLocations(
  rows: ImportRow[],
): Promise<{ created: number; skipped: number; failed: number } | { error: true }> {
  const { supabase } = await getUser();
  const { data, error } = await supabase.rpc("admin_import_locations", { p_rows: rows });
  if (error) return { error: true };
  expireWorkplaces();
  return data as { created: number; skipped: number; failed: number };
}

export async function setSlug(kind: "company" | "location", id: string, slug: string): Promise<Result> {
  const { supabase } = await getUser();
  const { error } =
    kind === "company"
      ? await supabase.rpc("admin_set_company_slug", { p_company_id: id, p_slug: slug })
      : await supabase.rpc("admin_set_location_slug", { p_location_id: id, p_slug: slug });
  if (error) return { error: true };
  expireWorkplaces();
  updateTag("redirects");
  return { ok: true };
}

export async function setLocationCategory(id: string, category: string): Promise<Result> {
  if (!isCategory(category)) return { error: true };
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("admin_set_location_category", { p_location_id: id, p_category: category });
  if (error) return { error: true };
  expireWorkplaces();
  return { ok: true };
}

/** Bulk fix on the Workplaces tab: several workplaces into one main category. */
export async function bulkSetCategory(ids: string[], category: string): Promise<Result> {
  if (!isCategory(category) || !ids.length || ids.length > 200) return { error: true };
  const { supabase } = await getUser();
  for (const id of ids) {
    const { error } = await supabase.rpc("admin_set_location_category", { p_location_id: id, p_category: category });
    if (error) return { error: true };
  }
  expireWorkplaces();
  return { ok: true };
}

/** Fills the exact place type (and the category, unless a person chose it) from map data: Google
 *  Places for workplaces with a place id (one small details call each), OpenStreetMap for OSM ones,
 *  the name for the rest. 40 per click, oldest first; admins only. */
export async function backfillPlaceTypes(): Promise<{ ok?: true; error?: true; done?: number; left?: number }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: true };
  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  const db = adminClient();
  if (!admin || !db) return { error: true };
  const { data: rows } = await db
    .from("locations")
    .select("id, name, google_place_id, osm_id, category_source")
    .is("place_type", null)
    .or("category_source.is.null,category_source.neq.none")
    .order("created_at")
    .limit(40);
  let done = 0;
  for (const l of rows ?? []) {
    const c = l.google_place_id
      ? await placeTypes(l.google_place_id, l.name, "hu").catch(() => null)
      : l.osm_id
        ? await osmDetails(`osm:${l.osm_id}`, "hu").catch(() => null)
        : null;
    const named = classifyPlace({ name: l.name });
    const info = placeTypeInfo(c?.placeType ?? named.placeType);
    // A person's or an admin's choice stays; map data only fills the exact type then.
    const chosen = l.category_source === "user" || l.category_source === "admin";
    const category = chosen ? null : (c?.category ?? named.category);
    const source = chosen ? l.category_source : c?.category ? c.categorySource : named.source;
    await db
      .from("locations")
      .update({
        place_type: c?.placeType ?? named.placeType,
        place_type_en: info?.en ?? c?.placeTypeLabel.en ?? null,
        place_type_hu: info?.hu ?? c?.placeTypeLabel.hu ?? null,
        // "none": checked but nothing found, so it isn't fetched again.
        category_source: source ?? "none",
        category_confidence: chosen ? "high" : (c?.category ? c.confidence : named.confidence) ?? "low",
        ...(category && { category }),
      })
      .eq("id", l.id);
    done += 1;
  }
  const { count } = await db
    .from("locations")
    .select("id", { count: "exact", head: true })
    .is("place_type", null)
    .or("category_source.is.null,category_source.neq.none");
  if (done) expireWorkplaces();
  return { ok: true, done, left: count ?? 0 };
}

/** After data changed outside the app (a migration, SQL): every public workplace and job page
 *  is rendered fresh on its next request. Admins only. */
export async function refreshPublicPages(): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { error: true };
  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return { error: true };
  expireWorkplaces(["redirects"]);
  return { ok: true };
}

export async function linkEntity(
  locationId: string,
  name: string,
  country: string,
  registryId: string,
): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("admin_link_entity", {
    p_location_id: locationId,
    p_name: name,
    p_country: country.toUpperCase(),
    p_registry_id: registryId || null,
  });
  if (error) return { error: true };
  expireWorkplaces();
  return { ok: true };
}

export async function unverifyEntity(linkId: string): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("admin_unverify_entity", { p_link_id: linkId });
  if (error) return { error: true };
  expireWorkplaces();
  return { ok: true };
}

/** Paid by transfer: the job goes live (or moves up a package), same as a card payment. */
export async function decideOrder(id: string, paid: boolean): Promise<Result> {
  const { supabase } = await getUser();
  const { data: order } = await supabase.rpc("admin_job_order_list");
  const jobId = ((order ?? []) as { id: string; job_id: string }[]).find((o) => o.id === id)?.job_id;
  const { error } = await supabase.rpc("admin_decide_order", { p_order_id: id, p_paid: paid });
  if (error) return { error: true };
  // An open card Checkout for this order can't be paid any more (cancelled, or paid by transfer).
  const s = stripe();
  const db = adminClient();
  if (s && db) {
    const { data: row } = await db.from("job_orders").select("stripe_session_id").eq("id", id).maybeSingle();
    if (row?.stripe_session_id) {
      try {
        const session = await s.checkout.sessions.retrieve(row.stripe_session_id);
        if (session.status === "open") await s.checkout.sessions.expire(session.id);
      } catch (e) {
        console.error("decideOrder expire", e);
      }
    }
  }
  if (paid) {
    updateTag("jobs");
    if (jobId) updateTag(`job:${jobId}`);
  }
  return { ok: true };
}

export async function decidePlanOrder(id: string, paid: boolean): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("admin_decide_plan_order", { p_order_id: id, p_paid: paid });
  if (error) return { error: true };
  expireWorkplaces();
  return { ok: true };
}

/** Deletes every demo row (companies, reviews, jobs, plans, demo users). */
export async function purgeDemo(): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("admin_purge_demo");
  if (error) return { error: true };
  expireWorkplaces();
  updateTag("jobs");
  return { ok: true };
}

/** Syncs every Stripe customer's tax status, invoice footer and our TRN now, and returns what
 *  their next invoices will carry. Admins only. */
export async function syncStripeInvoices(): Promise<{ rows?: InvoiceCheck[]; error?: true }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: true };
  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  const s = stripe();
  const db = adminClient();
  if (!admin || !s || !db) return { error: true };
  try {
    return { rows: await syncAllInvoiceSetups(s, db) };
  } catch (e) {
    console.error("syncStripeInvoices", e);
    return { error: true };
  }
}

async function isAdminUser() {
  const { supabase, user } = await getUser();
  if (!user) return false;
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return Boolean(data);
}

/** One city + tag group of the OpenStreetMap import (the admin's "Import / refresh" runs every
 *  group of a city one after the other). Overpass is often busy: then this one is "busy". */
export async function osmImportGroup(city: string, group: string): Promise<RunSummary | { error: "busy" | "failed" }> {
  if (!(await isAdminUser())) return { error: "failed" };
  const c = osmCity(city);
  const g = osmGroup(group);
  if (!c || !g) return { error: "failed" };
  const summary = await runOsmImport({ city: c, group: g, triggeredBy: "admin" });
  if (summary.created || summary.matched || summary.gone) expireWorkplaces();
  return summary;
}

/** Possible duplicates: keep one, the other's reviews, followers, jobs and team rights move over. */
export async function mergeLocations(keep: string, drop: string): Promise<{ ok?: true; error?: "managed" | "generic" }> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("admin_merge_locations", { p_keep: keep, p_drop: drop });
  if (error) return { error: error.message.includes("managed") ? "managed" : "generic" };
  expireWorkplaces(["redirects"]);
  return { ok: true };
}

export async function dismissDuplicate(a: string, b: string): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("admin_dismiss_duplicate", { p_a: a, p_b: b });
  return error ? { error: true } : { ok: true };
}
