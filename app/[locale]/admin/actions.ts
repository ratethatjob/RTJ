"use server";

import { revalidateTag } from "next/cache";
import { getUser } from "@/lib/auth";

type Result = { ok?: true; error?: true };

export async function decideClaim(id: string, approve: boolean): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("admin_decide_claim", { p_claim_id: id, p_approve: approve });
  if (error) return { error: true };
  revalidateTag("locations", "max");
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
    revalidateTag(`reviews:${loc}`, "max");
    revalidateTag("locations", "max");
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
    revalidateTag(`reviews:${loc}`, "max");
    revalidateTag("locations", "max");
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
    revalidateTag(`reviews:${loc}`, "max");
    revalidateTag("locations", "max");
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
  revalidateTag("locations", "max");
  return data as { created: number; skipped: number; failed: number };
}

export async function setSlug(kind: "company" | "location", id: string, slug: string): Promise<Result> {
  const { supabase } = await getUser();
  const { error } =
    kind === "company"
      ? await supabase.rpc("admin_set_company_slug", { p_company_id: id, p_slug: slug })
      : await supabase.rpc("admin_set_location_slug", { p_location_id: id, p_slug: slug });
  if (error) return { error: true };
  revalidateTag("locations", "max");
  revalidateTag("redirects", "max");
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
  revalidateTag("locations", "max");
  return { ok: true };
}

export async function unverifyEntity(linkId: string): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("admin_unverify_entity", { p_link_id: linkId });
  if (error) return { error: true };
  revalidateTag("locations", "max");
  return { ok: true };
}
