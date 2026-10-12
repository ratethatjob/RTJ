"use server";

import { getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { isOsmId, osmAutocomplete } from "@/lib/osm";
import { autocomplete, type PlaceDetails, placesProvider } from "@/lib/places";
import { expireWorkplaces } from "@/lib/cache";
import { isCategory } from "@/lib/categories";
import { searchLocations } from "@/lib/data";
import { rateLimited } from "@/lib/rate-limit";
import { caller, knownLocations, resolveArea } from "@/lib/place-search";
import { aiCategoryFor, createPlaceWorkplace, placeDetailsAny } from "@/lib/workplaces";

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
    const known = await knownLocations(supabase, found.map((f) => f.placeId));
    const shown = new Set(own.map((o) => o.id));
    const map = found
      .map((f) => ({
        placeId: f.placeId,
        main: f.main,
        secondary: f.secondary,
        placeType: f.placeType ?? null,
        locationId: known.get(f.placeId) ?? null,
      }))
      // A map place that is already on RateThatJob and in the list above appears only once.
      .filter((m) => !m.locationId || !shown.has(m.locationId));
    return { own, map };
  } catch (e) {
    console.error("findWorkplaces", e);
    return { own, map: [], error: "generic" };
  }
}

/** Employer claim flow: creates the picked map place right away and returns it for the claim form. */
export async function claimPlace(
  placeId: string,
  category: string,
): Promise<{ locationId?: string; error?: "invalid" | "limit" | "generic" }> {
  if (category !== "" && !isCategory(category)) return { error: "invalid" };
  const { user } = await getUser();
  if (!user) return { error: "generic" };
  const created = await createPlaceWorkplace(user.id, { kind: "place", placeId, category }, await getLocale());
  if (!created.id) return { error: created.error ?? "generic" };
  expireWorkplaces();
  return { locationId: created.id };
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
  if (!place) return { error: "generic" };
  // The rules don't decide: the AI (with Google's description and website for map places). Low
  // confidence leaves the category empty, so the person has to choose it ("What kind of workplace?").
  if (!place.category || place.confidence === "low") {
    const guess = await aiCategoryFor(place);
    if (guess.confidence === "low") {
      place.category = null;
      place.confidence = "low";
    } else {
      place.category = guess.category;
      place.categorySource = "ai";
      place.confidence = guess.confidence;
    }
    place.certain = false;
  }
  return { place };
}
