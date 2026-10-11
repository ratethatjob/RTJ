import type { Category } from "@/lib/data/types";
import { categoryFromGoogle } from "@/lib/categories";

// Google Places API (New), server side only. Off until GOOGLE_PLACES_API_KEY is set.
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE = process.env.PLACES_API_BASE ?? "https://places.googleapis.com";

export const placesConfigured = Boolean(KEY);

export type PlaceSuggestion = { placeId: string; main: string; secondary: string; country?: string };
export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  category: Category | null;
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
    }));
}

type Component = { longText: string; shortText: string; types: string[] };

// Countries that write the house number first ("350 5th Ave").
const NUMBER_FIRST = new Set(["US", "CA", "GB", "IE", "AU", "NZ", "FR"]);

export async function placeDetails(placeId: string, locale: string, sessionToken?: string): Promise<PlaceDetails | null> {
  if (!KEY || !/^[\w-]{10,300}$/.test(placeId)) return null;
  const qs = new URLSearchParams({ languageCode: locale, ...(sessionToken && { sessionToken }) });
  const res = await fetch(`${BASE}/v1/places/${encodeURIComponent(placeId)}?${qs}`, {
    headers: {
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location,types,primaryType",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const p = (await res.json()) as {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    addressComponents?: Component[];
    location?: { latitude: number; longitude: number };
    types?: string[];
    primaryType?: string;
  };
  const part = (type: string, short = false) => {
    const c = p.addressComponents?.find((x) => x.types.includes(type));
    return c ? (short ? c.shortText : c.longText) : "";
  };
  const country = part("country", true).toUpperCase();
  const route = part("route");
  const number = part("street_number");
  const street = route
    ? (NUMBER_FIRST.has(country) ? [number, route] : [route, number]).filter(Boolean).join(" ")
    : (p.formattedAddress?.split(",")[0] ?? "");
  const city = part("locality") || part("postal_town") || part("administrative_area_level_2");
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "",
    address: street.trim(),
    city,
    country,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    category: categoryFromGoogle(p.types ?? [], p.primaryType),
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
