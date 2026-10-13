import { type GeocodeInput, type Position, fromNominatim, fromPhoton, nominatimQuery, photonQuery } from "@/lib/geocode-core";
import { addressFromReverse } from "@/lib/osm-import-core";
import { HEADERS, NOMINATIM, PHOTON, nominatimSlot } from "@/lib/osm";
import { rateLimited } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";

// Coordinates for a hand-entered address from OpenStreetMap: Nominatim structured search (at most
// one request a second, User-Agent), Photon as the fallback. Found → lat/lng saved; not found →
// no position, geocode_status 'not_found'; a failed request leaves it untried (null) for the daily
// /api/cron/osm retry. Never throws.

/** Position, null when OSM doesn't know the address, "error" when OSM couldn't be asked. */
export async function geocodeAddress(w: GeocodeInput): Promise<Position | null | "error"> {
  // 60 a minute for all visitors of one server instance (Nominatim allows ~1/s anyway).
  if (rateLimited("geocode", 60)) return "error";
  try {
    await nominatimSlot();
    const res = await fetch(`${NOMINATIM}/search?${nominatimQuery(w)}`, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const found = fromNominatim(await res.json(), w);
    if (found) return found;
    const photon = await fetch(`${PHOTON}/api/?${photonQuery(w)}`, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!photon.ok) throw new Error(`photon ${photon.status}`);
    return fromPhoton(await photon.json(), w);
  } catch (e) {
    console.error(JSON.stringify({ event: "geocode_failed", error: String(e) }));
    return "error";
  }
}

/** Geocodes one workplace from its stored address and saves the result. */
export async function geocodeLocation(id: string): Promise<"ok" | "not_found" | "error"> {
  const db = adminClient();
  if (!db) return "error";
  const { data: l } = await db.from("locations").select("address, city, country").eq("id", id).maybeSingle();
  if (!l) return "error";
  const pos = await geocodeAddress(l as GeocodeInput);
  if (pos === "error") return "error";
  const { error } = await db.rpc("set_location_geocode", { p_location_id: id, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null });
  if (error) return "error";
  console.log(JSON.stringify({ event: "geocoded", id, found: !!pos }));
  return pos ? "ok" : "not_found";
}

/** Workplaces without a position that were never tried (backfill and retries), oldest first. */
export async function geocodeMissing(limit = 25, budgetMs = 60_000) {
  const db = adminClient();
  if (!db) return { ok: 0, not_found: 0, error: 0 };
  const { data } = await db.rpc("locations_to_geocode", { p_limit: limit });
  const counts = { ok: 0, not_found: 0, error: 0 };
  const started = Date.now();
  for (const row of (data ?? []) as { id: string }[]) {
    if (Date.now() - started > budgetMs) break;
    counts[await geocodeLocation(row.id)] += 1;
  }
  return counts;
}

/** Street ("street number" or the street alone), city and country at a position (Nominatim
 *  reverse): fills what a map place lacks. Null when OSM can't be asked or has nothing there. */
export async function reverseAddress(lat: number, lng: number, locale = "hu") {
  if (rateLimited("geocode", 60)) return null;
  try {
    await nominatimSlot();
    const qs = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", addressdetails: "1", zoom: "18", "accept-language": locale });
    const res = await fetch(`${NOMINATIM}/reverse?${qs}`, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address ?? {};
    return {
      street: addressFromReverse(data),
      city: a.city || a.town || a.village || a.municipality || "",
      country: (a.country_code ?? "").toUpperCase(),
    };
  } catch {
    return null;
  }
}
