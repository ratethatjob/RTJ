"use server";

import { getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { expireWorkplaces } from "@/lib/cache";
import { caller, knownLocations, locationHref } from "@/lib/place-search";
import { rateLimited } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";
import { createPlaceWorkplace } from "@/lib/workplaces";

// Main search (/search): opening a picked map place – it becomes a workplace page on the first
// click (one per place, rate-limited). The map results themselves are found on the server
// (findMapPlaces in lib/place-search.ts), with the same session token as this details call.

/** The picked map place's workplace page: the existing one, or a new one created now. */
export async function openMapPlace(placeId: string, sessionToken?: string): Promise<{ href?: string; error?: "limit" | "generic" }> {
  const { supabase, key } = await caller();
  const existing = (await knownLocations(supabase, [placeId])).get(placeId);
  if (existing) {
    const href = await locationHref(existing);
    return href ? { href } : { error: "generic" };
  }
  // Against spam: a few new workplaces per person or IP an hour, and a ceiling for all visitors.
  if (rateLimited(`place-create:${key}`, 5, 3600_000)) return { error: "limit" };
  const db = adminClient();
  if (!db) return { error: "generic" };
  const { count } = await db
    .from("locations")
    .select("id", { count: "exact", head: true })
    .is("created_by", null)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 100) return { error: "limit" };

  const { user } = await getUser();
  const created = await createPlaceWorkplace(user?.id ?? null, { kind: "place", placeId, category: "" }, await getLocale(), sessionToken);
  if (!created.id) return { error: created.error === "limit" ? "limit" : "generic" };
  expireWorkplaces();
  const href = await locationHref(created.id);
  return href ? { href } : { error: "generic" };
}
