import type { Category } from "@/lib/data/types";
import { type CategorySource, classifyPlace, placeTypeInfo } from "@/lib/place-types";
import { parseGoogleAddress } from "@/lib/place-address";
import { recordPlacesCall } from "@/lib/places-usage";

// Google Places API (New), server side only. Off until GOOGLE_PLACES_API_KEY is set.
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE = process.env.PLACES_API_BASE ?? "https://places.googleapis.com";

export const placesConfigured = Boolean(KEY);

export type PlaceSuggestion = {
  placeId: string;
  main: string;
  secondary: string;
  country?: string;
  /** Exact type key for the label in the list ("barber_shop"), when the map gives one. */
  placeType?: string | null;
};
export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  category: Category | null;
  /** Exact type and its labels (our table, else the map's own label in the request language). */
  placeType: string | null;
  placeTypeLabel: { en: string | null; hu: string | null };
  categorySource: CategorySource | null;
  /** False: the category is a suggestion (shown with "check it" next to the dropdown). */
  certain: boolean;
  /** How sure the rules (or the AI) are; null category or "low" = a person must choose. */
  confidence: "high" | "medium" | "low" | null;
  /** Map types or tags ("restaurant", "shop=bakery"), a hint for the AI category guess. */
  types: string[];
};

export async function autocomplete(
  input: string,
  locale: string,
  sessionToken: string,
  area: { lat: number; lon: number } | null = null,
): Promise<PlaceSuggestion[]> {
  if (!KEY) return [];
  // Prefer places within ~30 km of the chosen or detected area.
  const locationBias = area
    ? { circle: { center: { latitude: area.lat, longitude: area.lon }, radius: 30000 } }
    : undefined;
  await recordPlacesCall("google", "autocomplete");
  const res = await fetch(`${BASE}/v1/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY },
    body: JSON.stringify({ input, languageCode: locale, sessionToken, includeQueryPredictions: false, locationBias }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`places autocomplete ${res.status}`);
  const data = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        types?: string[];
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .map((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
      // Suggestions carry no primary type: the types and the name decide (bakeries are only "food_store").
      placeType: classifyPlace({
        name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        types: p.types ?? [],
      }).placeType,
    }));
}

export async function placeDetails(placeId: string, locale: string, sessionToken?: string): Promise<PlaceDetails | null> {
  if (!KEY || !/^[\w-]{10,300}$/.test(placeId)) return null;
  const qs = new URLSearchParams({ languageCode: locale, ...(sessionToken && { sessionToken }) });
  await recordPlacesCall("google", "details");
  const res = await fetch(`${BASE}/v1/places/${encodeURIComponent(placeId)}?${qs}`, {
    headers: {
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location,types,primaryType,primaryTypeDisplayName",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const p = (await res.json()) as {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    addressComponents?: { longText: string; shortText: string; types: string[] }[];
    location?: { latitude: number; longitude: number };
    types?: string[];
    primaryType?: string;
    primaryTypeDisplayName?: { text: string; languageCode?: string };
  };
  // Gaps in Google's address (no locality, no street) are filled from the components, then from
  // OpenStreetMap at the place's position (lib/place-address.ts, reverseAddress).
  const parsed = parseGoogleAddress(p);
  const { addressFrom } = parsed;
  let { address, city, country } = parsed;
  const lat = p.location?.latitude ?? null;
  const lng = p.location?.longitude ?? null;
  if ((addressFrom !== "street" || !city || !country) && lat != null && lng != null) {
    const { reverseAddress } = await import("@/lib/geocode");
    const rev = await reverseAddress(lat, lng, locale);
    if (rev) {
      const sameStreet = rev.street && address && rev.street.toLowerCase().startsWith(address.toLowerCase());
      if (rev.street && (addressFrom === "formatted" || addressFrom === "area" || addressFrom === null || sameStreet)) address = rev.street;
      if (!city) city = rev.city;
      if (!country) country = rev.country;
    }
  }
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "",
    address,
    city,
    country,
    lat,
    lng,
    ...classified(p.displayName?.text ?? "", p.primaryType, p.types ?? [], p.primaryTypeDisplayName?.text ?? null, locale),
    types: p.types ?? [],
  };
}

export type PlacesProvider = "google" | "osm";

/** Map search: Google when GOOGLE_PLACES_API_KEY is set, otherwise OpenStreetMap (lib/osm.ts).
 *  Shown only when places can also be saved (service-role key set). */
export async function placesProvider(): Promise<PlacesProvider | null> {
  const { adminClient } = await import("@/lib/supabase/admin");
  if (adminClient() === null) return null;
  return placesConfigured ? "google" : "osm";
}

/** Category and exact type from Google's types and the name (lib/place-types.ts). */
function classified(name: string, primaryType: string | undefined, types: string[], mapLabel: string | null, locale: string) {
  const c = classifyPlace({ name, primaryType, types });
  const info = placeTypeInfo(c.placeType);
  // Our own labels for known types; for others Google's label, in the language we asked for.
  const ownLabel = c.placeType === (primaryType ?? null) ? mapLabel : null;
  return {
    category: c.category,
    placeType: c.placeType,
    placeTypeLabel: {
      en: info?.en ?? (locale === "en" ? ownLabel : null),
      hu: info?.hu ?? (locale === "hu" ? ownLabel : null),
    },
    categorySource: c.source,
    certain: c.certain,
    confidence: c.confidence,
  };
}

/** Google's short description and website of a place: what the AI gets when the type and the name
 *  don't decide. One extra call, only for those places. */
export async function placeContext(placeId: string): Promise<{ summary: string | null; website: string | null }> {
  const empty = { summary: null, website: null };
  if (!KEY || !/^[\w-]{10,300}$/.test(placeId)) return empty;
  await recordPlacesCall("google", "details");
  const res = await fetch(`${BASE}/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, {
    headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "editorialSummary,websiteUri" },
    cache: "no-store",
  });
  if (!res.ok) return empty;
  const p = (await res.json()) as { editorialSummary?: { text: string }; websiteUri?: string };
  return { summary: p.editorialSummary?.text ?? null, website: p.websiteUri ?? null };
}

/** Google's label of a place's primary type in one language (one extra call; only for types our
 *  table doesn't know, when the workplace is saved). */
export async function primaryTypeLabel(placeId: string, locale: string): Promise<string | null> {
  if (!KEY || !/^[\w-]{10,300}$/.test(placeId)) return null;
  await recordPlacesCall("google", "details");
  const res = await fetch(`${BASE}/v1/places/${encodeURIComponent(placeId)}?languageCode=${locale}`, {
    headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "primaryTypeDisplayName" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const p = (await res.json()) as { primaryTypeDisplayName?: { text: string } };
  return p.primaryTypeDisplayName?.text ?? null;
}

/** Fresh map data for an existing workplace (admin backfill): types only, no address fields. */
export async function placeTypes(placeId: string, name: string, locale: string) {
  if (!KEY || !/^[\w-]{10,300}$/.test(placeId)) return null;
  await recordPlacesCall("google", "details");
  const res = await fetch(`${BASE}/v1/places/${encodeURIComponent(placeId)}?languageCode=${locale}`, {
    headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "types,primaryType,primaryTypeDisplayName" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const p = (await res.json()) as { types?: string[]; primaryType?: string; primaryTypeDisplayName?: { text: string } };
  return classified(name, p.primaryType, p.types ?? [], p.primaryTypeDisplayName?.text ?? null, locale);
}
