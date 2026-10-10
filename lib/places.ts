import type { Category } from "@/lib/data/types";

// Google Places API (New), server side only. Off until GOOGLE_PLACES_API_KEY is set.
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE = process.env.PLACES_API_BASE ?? "https://places.googleapis.com";

export const placesConfigured = Boolean(KEY);

export type PlaceSuggestion = { placeId: string; main: string; secondary: string };
export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  category: Category | null;
};

export async function autocomplete(input: string, locale: string, sessionToken: string): Promise<PlaceSuggestion[]> {
  if (!KEY) return [];
  const res = await fetch(`${BASE}/v1/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY },
    body: JSON.stringify({ input, languageCode: locale, sessionToken, includeQueryPredictions: false }),
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
      "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location,types",
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
    category: categoryFromTypes(p.types ?? []),
  };
}

const RESTAURANT = ["restaurant", "cafe", "bar", "bakery", "meal_takeaway", "meal_delivery", "food", "coffee_shop", "pub"];
const RETAIL = ["store", "supermarket", "shopping_mall", "pharmacy", "drugstore", "gas_station", "market"];
const WAREHOUSE = ["storage", "moving_company", "courier_service", "warehouse_store", "logistics_service"];
const OFFICE = ["corporate_office", "accounting", "lawyer", "insurance_agency", "real_estate_agency", "bank", "consultant", "finance"];

/** Best guess from Google place types; the person confirms it. */
export function categoryFromTypes(types: string[]): Category | null {
  const has = (list: string[], suffix?: string) =>
    types.some((t) => list.includes(t) || (suffix ? t.endsWith(suffix) : false));
  if (has(WAREHOUSE)) return "warehouse";
  if (has(RESTAURANT, "_restaurant")) return "restaurant";
  if (has(RETAIL, "_store")) return "retail";
  if (types.includes("manufacturer") || types.includes("factory")) return "factory";
  if (has(OFFICE)) return "office";
  return null;
}

/** The Google search shows only when places can also be saved (service-role key set). */
export async function placesEnabled() {
  if (!placesConfigured) return false;
  const { adminClient } = await import("@/lib/supabase/admin");
  return adminClient() !== null;
}
