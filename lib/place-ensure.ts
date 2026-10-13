import { getUser } from "@/lib/auth";
import { isOsmId } from "@/lib/osm";
import { caller, knownLocations } from "@/lib/place-search";
import { pickMatch } from "@/lib/place-match";
import { requestPartner } from "@/lib/partner-key";
import { rateLimitedDb } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";
import { createPlaceWorkplace, placeDetailsAny } from "@/lib/workplaces";

// A picked map place (Google or OpenStreetMap) becomes a workplace right away, in every flow
// (main search, writing a review, requesting access): the one we already have for this place id,
// one of ours within 75 m with a matching name or brand (the place id is added to it), or a new
// one. Close but unsure: the person is asked "Did you mean …?". Only real place ids (the details
// are fetched here, never taken from the browser); 30 new workplaces an hour per person or IP.

export type PlaceVia = "search" | "rate" | "claim" | "jobs";
/** Why a place can't become a workplace: unknown id, no name, or no location data at all. */
export type InvalidReason = "not_found" | "no_name" | "no_address";
export type PlaceCandidate = { id: string; name: string; address: string; city: string };
export type EnsureResult =
  | { locationId: string; created?: boolean }
  | { candidates: PlaceCandidate[] }
  | { error: "limit" | "generic" }
  | { error: "invalid"; reason: InvalidReason; name?: string };

type Nearby = PlaceCandidate & {
  lat: number;
  lng: number;
  company_name: string;
  brand_wikidata: string | null;
  osm_id: string | null;
  google_place_id: string | null;
};

const PLACE_ID = /^(osm:(node|way|relation)\/\d{1,15}|[\w-]{10,300})$/;

async function nearby(lat: number, lng: number): Promise<Nearby[]> {
  const db = adminClient();
  if (!db) return [];
  const { data } = await db.rpc("nearby_locations", { p_points: [{ i: 0, lat, lng }], p_radius_m: 120 });
  return (data ?? []) as Nearby[];
}

async function attach(locationId: string, placeId: string) {
  const db = adminClient();
  if (!db) return false;
  const osm = isOsmId(placeId);
  const { data } = await db.rpc("attach_place_ref", {
    p_location_id: locationId,
    p_place_id: osm ? null : placeId,
    p_osm_id: osm ? placeId.slice(4) : null,
  });
  return data === true;
}

export async function ensureLocationFromPlace(
  placeId: string,
  opts: {
    via: PlaceVia;
    locale: string;
    sessionToken?: string;
    /** The person answered "Yes, this one" to "Did you mean …?". */
    confirm?: string;
    /** "No, it's a different place": create it even with close candidates. */
    force?: boolean;
  },
): Promise<EnsureResult> {
  if (!PLACE_ID.test(placeId)) return { error: "invalid", reason: "not_found" };
  const { supabase, key } = await caller();
  const existing = (await knownLocations(supabase, [placeId])).get(placeId);
  if (existing) return { locationId: existing };
  const db = adminClient();
  if (!db) return { error: "generic" };

  const partner = await requestPartner();
  // Partner API requests log each step with its time (for tracing slow or stuck requests).
  const t0 = Date.now();
  const step = (name: string) => partner && console.log(JSON.stringify({ event: "partner_step", placeId, step: name, ms: Date.now() - t0 }));
  if (partner) {
    if (await rateLimitedDb(`partner:${partner.id}`, partner.hourlyLimit, 3600_000)) return { error: "limit" };
  } else if (await rateLimitedDb(`place-details:${key}`, 120, 3600_000)) {
    return { error: "limit" };
  }
  const place = await placeDetailsAny(placeId, opts.locale, opts.sessionToken).catch((e) => {
    console.error("place details", placeId, e);
    return null;
  });
  const reason: InvalidReason | null = !place
    ? "not_found"
    : !place.name.trim()
      ? "no_name"
      : !place.address || !place.city || !place.country
        ? "no_address"
        : null;
  if (!place || reason) {
    console.log(
      JSON.stringify({
        event: "place_invalid",
        placeId,
        reason,
        name: place?.name ?? null,
        address: place?.address ?? null,
        city: place?.city ?? null,
        country: place?.country ?? null,
        hasPosition: place?.lat != null,
      }),
    );
    return { error: "invalid", reason: reason ?? "not_found", name: place?.name || undefined };
  }
  const osm = isOsmId(placeId);
  step("details");

  if (place.lat != null && place.lng != null) {
    // Ours already, under another source's id: link instead of creating a duplicate.
    const free = (await nearby(place.lat, place.lng)).filter((c) => (osm ? !c.osm_id : !c.google_place_id));
    step("nearby");
    if (opts.confirm) {
      const chosen = free.find((c) => c.id === opts.confirm);
      if (chosen && (await attach(chosen.id, placeId))) return { locationId: chosen.id };
    } else if (!opts.force) {
      const { same, maybe } = pickMatch({ name: place.name, address: place.address, lat: place.lat, lng: place.lng }, free);
      if (same && (await attach(same.id, placeId))) return { locationId: same.id };
      if (maybe.length) {
        return { candidates: maybe.map((c) => ({ id: c.id, name: c.name, address: c.address, city: c.city })) };
      }
    }
  }

  // New workplace. Against abuse: per person or IP, and a ceiling for all visitors together
  // (a partner key has its own ceiling, checked above).
  if (!partner && (await rateLimitedDb(`place-create:${key}`, 30, 3600_000))) return { error: "limit" };
  const { user } = await getUser();
  step("user");
  if (!user && !partner) {
    const { count } = await db
      .from("locations")
      .select("id", { count: "exact", head: true })
      .is("created_by", null)
      .in("created_via", ["search", "rate", "claim", "jobs"])
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= 300) return { error: "limit" };
  }
  const created = await createPlaceWorkplace(
    user?.id ?? null,
    { kind: "place", placeId, category: "" },
    opts.locale,
    opts.sessionToken,
    { place, via: partner ? "partner" : opts.via, partnerKeyId: partner?.id },
  );
  step("created");
  if (created.id) return { locationId: created.id, created: true };
  if (created.error === "invalid") {
    console.log(JSON.stringify({ event: "place_invalid", placeId, reason: "db", name: place.name, address: place.address, city: place.city, country: place.country }));
    return { error: "invalid", reason: "no_address", name: place.name };
  }
  return { error: created.error ?? "generic" };
}
