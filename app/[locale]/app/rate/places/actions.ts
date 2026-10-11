"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { isOsmId, osmAutocomplete, type SearchArea } from "@/lib/osm";
import { autocomplete, type PlaceDetails, placesConfigured } from "@/lib/places";
import { rateLimited } from "@/lib/rate-limit";
import { isAreaId, parseGeo, SEARCH_AREAS } from "@/lib/search-areas";
import { placeDetailsAny } from "@/lib/workplaces";

export type Suggestion = { placeId: string; main: string; secondary: string; locationId: string | null };

// OSM ids are stored without the "osm:" prefix.
const osmKey = (id: string) => id.slice(4);

/** Workplaces already on RateThatJob for these Google place ids or OSM ids. */
async function knownLocations(supabase: Awaited<ReturnType<typeof getUser>>["supabase"], ids: string[]) {
  const osm = ids.filter(isOsmId);
  const google = ids.filter((id) => !isOsmId(id));
  const [g, o] = await Promise.all([
    google.length ? supabase.rpc("locations_by_place", { p_place_ids: google }) : { data: [] },
    osm.length ? supabase.rpc("locations_by_osm", { p_osm_ids: osm.map(osmKey) }) : { data: [] },
  ]);
  return new Map<string, string>([
    ...((g.data ?? []) as { place_id: string; location_id: string }[]).map((r) => [r.place_id, r.location_id] as const),
    ...((o.data ?? []) as { osm_id: string; location_id: string }[]).map((r) => [`osm:${r.osm_id}`, r.location_id] as const),
  ]);
}

/** Signed-in user id, or the visitor's IP address, as the rate-limit key. */
async function caller() {
  const { supabase, user } = await getUser();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return { supabase, key: user ? `u:${user.id}` : `ip:${ip}` };
}

/** Where to look first: the person's pick, their browser location (rounded), or Vercel's IP location,
 *  else the page language (hu → Budapest). "any" searches everywhere. */
async function resolveArea(choice: string, locale: string): Promise<SearchArea | null> {
  if (choice === "any") return null;
  if (isAreaId(choice)) return { ...SEARCH_AREAS[choice], strict: true };
  const geo = parseGeo(choice);
  if (geo) return geo;
  const h = await headers();
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lon = Number(h.get("x-vercel-ip-longitude"));
  if (h.get("x-vercel-ip-latitude") && Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon, country: h.get("x-vercel-ip-country") ?? undefined };
  }
  return locale === "hu" ? { ...SEARCH_AREAS.budapest } : null;
}

/** Map suggestions (Google, or OpenStreetMap without a Google key), marked when already on RateThatJob. */
export async function searchPlaces(
  input: string,
  sessionToken: string,
  areaChoice = "auto",
): Promise<{ suggestions?: Suggestion[]; error?: "generic" }> {
  const text = input.trim().slice(0, 100);
  if (text.length < 3) return { suggestions: [] };
  // Works before signing in: limited per person, or per IP address for visitors.
  const { supabase, key } = await caller();
  if (rateLimited(`places-search:${key}`, 60)) return { suggestions: [] };
  // OSM's free services ask for fair use.
  if (!placesConfigured && rateLimited(`osm-search:${key}`, 30)) return { suggestions: [] };
  try {
    const locale = await getLocale();
    const area = await resolveArea(String(areaChoice).slice(0, 40), locale);
    const found = placesConfigured
      ? await autocomplete(text, locale, sessionToken, area)
      : await osmAutocomplete(text, locale, area);
    const known = await knownLocations(supabase, found.map((f) => f.placeId));
    return {
      suggestions: found.map((f) => ({
        placeId: f.placeId,
        main: f.main,
        secondary: f.secondary,
        locationId: known.get(f.placeId) ?? null,
      })),
    };
  } catch (e) {
    console.error("searchPlaces", e);
    return { error: "generic" };
  }
}

/** Picks a suggestion: an existing workplace, or the place details to confirm. */
export async function choosePlace(
  placeId: string,
  sessionToken: string,
): Promise<{ locationId?: string; place?: PlaceDetails; error?: "generic" }> {
  const { supabase, key } = await caller();
  const existing = (await knownLocations(supabase, [placeId])).get(placeId);
  if (existing) return { locationId: existing };
  if (rateLimited(`place-details:${key}`, isOsmId(placeId) ? 10 : 20)) return { error: "generic" };
  const place = await placeDetailsAny(placeId, await getLocale(), sessionToken).catch(() => null);
  return place ? { place } : { error: "generic" };
}
