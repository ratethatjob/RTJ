"use server";

import { isCategory } from "@/lib/categories";
import { caller } from "@/lib/place-search";
import { rateLimited } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";

/** "Wrong category? Tell us" from a public location page: stored for the admin's check list.
 *  Anyone may send it; 5 an hour per person or IP address. */
export async function reportCategory(locationId: string, category: string, note: string): Promise<{ ok?: true; error?: true }> {
  if (!/^[0-9a-f-]{36}$/i.test(locationId) || !isCategory(category)) return { error: true };
  const { key } = await caller();
  if (rateLimited(`category-report:${key}`, 5, 3600_000)) return { error: true };
  const db = adminClient();
  if (!db) return { error: true };
  const { error } = await db
    .from("category_reports")
    .insert({ location_id: locationId, suggested_category: category, note: note.trim().slice(0, 500) || null });
  return error ? { error: true } : { ok: true };
}
