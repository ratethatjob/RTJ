import type { SupabaseClient } from "@supabase/supabase-js";
import { isCategory } from "@/lib/categories";
import { categorize } from "@/lib/categorize";
import { COUNTRIES } from "@/lib/countries";
import { isOsmId, osmDetails } from "@/lib/osm";
import { placeDetails } from "@/lib/places";
import { adminClient } from "@/lib/supabase/admin";

// A workplace the reviewer picked or typed before signing in. It is created in the database only
// when the review is sent (signed in), so drafts never leave empty workplaces behind.
export type PendingWorkplace =
  | { kind: "place"; placeId: string; category: string }
  | { kind: "manual"; company: string; address: string; city: string; country: string; category: string };

export type WorkplaceError = "invalid" | "limit" | "generic";

const errorFor = (code: string | undefined): WorkplaceError =>
  code === "54000" ? "limit" : code === "22023" ? "invalid" : "generic";

export const placeDetailsAny = (id: string, locale: string, sessionToken?: string) =>
  isOsmId(id) ? osmDetails(id, locale) : placeDetails(id, locale, sessionToken);

/** Shape check only (no lookups), for pages that show a pending workplace. */
export function parsePendingWorkplace(value: unknown): PendingWorkplace | null {
  if (!value || typeof value !== "object") return null;
  const w = value as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof w[k] === "string" ? (w[k] as string).trim().slice(0, max) : "");
  const category = str("category", 40);
  if (category !== "" && !isCategory(category)) return null;
  if (w.kind === "place") {
    const placeId = str("placeId", 300);
    return /^(osm:(node|way|relation)\/\d+|[\w-]{10,300})$/.test(placeId) ? { kind: "place", placeId, category } : null;
  }
  if (w.kind === "manual") {
    const m = {
      kind: "manual" as const,
      company: str("company", 100),
      address: str("address", 150),
      city: str("city", 80),
      country: str("country", 2),
      category,
    };
    const valid =
      m.company.length >= 2 &&
      m.address.length >= 2 &&
      m.city.length >= 2 &&
      COUNTRIES.includes(m.country as (typeof COUNTRIES)[number]);
    return valid ? m : null;
  }
  return null;
}

/** Hand-entered workplace, as the signed-in user (create_workplace applies the per-user limits). */
export async function createManualWorkplace(
  supabase: SupabaseClient,
  w: Extract<PendingWorkplace, { kind: "manual" }>,
): Promise<{ id?: string; error?: WorkplaceError }> {
  const { data, error } = await supabase.rpc("create_workplace", {
    p_company: w.company,
    p_address: w.address,
    p_city: w.city,
    p_country: w.country,
    // "Let us decide": Claude picks from the name (Other without AI).
    p_category: isCategory(w.category) ? w.category : await categorize({ name: w.company, city: w.city }),
  });
  if (error) return { error: errorFor(error.code) };
  return { id: data as string };
}

/** Workplace from Google's or OpenStreetMap's data, fetched again here (never taken from the client). */
export async function createPlaceWorkplace(
  userId: string,
  w: Extract<PendingWorkplace, { kind: "place" }>,
  locale: string,
): Promise<{ id?: string; error?: WorkplaceError }> {
  const db = adminClient();
  if (!db) return { error: "generic" };
  const place = await placeDetailsAny(w.placeId, locale).catch(() => null);
  if (!place || !place.name || !place.address || !place.city || !place.country) return { error: "invalid" };
  const osm = isOsmId(place.placeId);
  const { data, error } = await db.rpc(osm ? "workplace_from_osm" : "workplace_from_place", {
    p_user_id: userId,
    // OSM ids are stored without the "osm:" prefix.
    ...(osm ? { p_osm_id: place.placeId.slice(4) } : { p_place_id: place.placeId }),
    p_name: place.name,
    p_address: place.address,
    p_city: place.city,
    p_country: place.country,
    // "Let us decide": the map type, else Claude from the name and map types.
    p_category: isCategory(w.category)
      ? w.category
      : (place.category ?? (await categorize({ name: place.name, city: place.city, types: place.types }))),
    p_lat: place.lat,
    p_lng: place.lng,
  });
  if (error) return { error: errorFor(error.code) };
  return { id: data as string };
}
