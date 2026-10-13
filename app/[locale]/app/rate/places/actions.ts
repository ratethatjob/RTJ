"use server";

import { getLocale } from "next-intl/server";
import { osmAutocomplete } from "@/lib/osm";
import { autocomplete, placesProvider } from "@/lib/places";
import { expireWorkplaces } from "@/lib/cache";
import { searchLocations } from "@/lib/data";
import { rateLimited } from "@/lib/rate-limit";
import { getLocationById } from "@/lib/data";
import { ensureLocationFromPlace, type PlaceCandidate } from "@/lib/place-ensure";
import { caller, knownOrMatched, resolveArea } from "@/lib/place-search";

export type Suggestion = {
  placeId: string;
  main: string;
  secondary: string;
  locationId: string | null;
  placeType?: string | null;
};

export type OwnResult = {
  id: string;
  name: string;
  address: string;
  city: string;
  score: number | null;
  reviewCount: number;
};

/** One search for the workplace finder: workplaces already on RateThatJob first, then map places
 *  (Google, or OpenStreetMap without a Google key) that aren't on RateThatJob yet. */
export async function findWorkplaces(
  input: string,
  sessionToken: string,
  areaChoice = "auto",
): Promise<{ own: OwnResult[]; map: Suggestion[]; error?: "generic" }> {
  const text = input.trim().slice(0, 100);
  if (text.length < 2) return { own: [], map: [] };
  // Works before signing in: limited per person, or per IP address for visitors.
  const { supabase, key } = await caller();
  if (rateLimited(`places-search:${key}`, 60)) return { own: [], map: [] };

  const own: OwnResult[] = (await searchLocations(text).catch(() => [])).slice(0, 8).map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    city: l.city,
    score: l.scores?.overall ?? null,
    reviewCount: l.scores?.reviewCount ?? 0,
  }));
  const provider = await placesProvider();
  // OSM's free services ask for fair use.
  if (!provider || text.length < 3 || (provider === "osm" && rateLimited(`osm-search:${key}`, 30))) {
    return { own, map: [] };
  }
  try {
    const locale = await getLocale();
    const area = await resolveArea(String(areaChoice).slice(0, 40), locale);
    const found = provider === "google"
      ? await autocomplete(text, locale, sessionToken, area)
      : await osmAutocomplete(text, locale, area);
    const known = await knownOrMatched(supabase, found);
    // A map place we already have (same place id, or the same name and address) shows as ours.
    const shown = new Set(own.map((o) => o.id));
    for (const id of new Set(known.values())) {
      if (shown.has(id)) continue;
      const l = await getLocationById(id);
      if (!l) continue;
      shown.add(id);
      own.push({ id, name: l.name, address: l.address, city: l.city, score: l.scores?.overall ?? null, reviewCount: l.scores?.reviewCount ?? 0 });
    }
    const map = found
      .filter((f) => !known.has(f.placeId))
      .map((f) => ({ placeId: f.placeId, main: f.main, secondary: f.secondary, placeType: f.placeType ?? null, locationId: null }));
    return { own, map };
  } catch (e) {
    console.error("findWorkplaces", e);
    return { own, map: [], error: "generic" };
  }
}

/** Picks a map suggestion in the finder: the workplace is created (or matched) right away, in the
 *  review and the claim flow alike; close but unsure matches come back as candidates to ask about. */
export async function pickPlace(
  placeId: string,
  sessionToken: string,
  mode: "rate" | "claim",
  choice?: { confirm?: string; force?: boolean },
): Promise<{ locationId?: string; candidates?: PlaceCandidate[]; error?: "limit" | "noAddress" | "generic"; name?: string }> {
  const result = await ensureLocationFromPlace(placeId, {
    via: mode,
    locale: await getLocale(),
    sessionToken,
    confirm: choice?.confirm,
    force: choice?.force,
  });
  if ("candidates" in result) return { candidates: result.candidates };
  if ("error" in result) {
    if (result.error === "invalid") return { error: result.reason === "not_found" ? "generic" : "noAddress", name: result.name };
    return { error: result.error };
  }
  if (result.created) expireWorkplaces();
  return { locationId: result.locationId };
}
