import { cacheLife } from "next/cache";
import { categoryFromOsm } from "@/lib/categories";
import { regionName } from "@/lib/intl-names";
import { recordPlacesCall } from "@/lib/places-usage";
import type { PlaceDetails, PlaceSuggestion } from "@/lib/places";

// OpenStreetMap workplace search, used while there is no GOOGLE_PLACES_API_KEY.
// Search-as-you-type: Photon (komoot), since Nominatim's usage policy forbids autocomplete.
// Details of the picked place: one Nominatim lookup, at most one request per second.
// Both identify us with a User-Agent, are cached and only receive the typed text.
// Suggestion ids are "osm:node/123" so the actions can tell them from Google place ids.

const PHOTON = process.env.PHOTON_API_BASE ?? "https://photon.komoot.io";
const NOMINATIM = process.env.NOMINATIM_API_BASE ?? "https://nominatim.openstreetmap.org";
const HEADERS = { "User-Agent": "RateThatJob/1.0 (+https://ratethatjob.com)" };

export const OSM_PREFIX = "osm:";
const TYPES: Record<string, "node" | "way" | "relation"> = { N: "node", W: "way", R: "relation" };
const OSM_ID = /^(node|way|relation)\/\d{1,15}$/;

export const isOsmId = (id: string) => id.startsWith(OSM_PREFIX) && OSM_ID.test(id.slice(OSM_PREFIX.length));

// Roads, areas and places aren't workplaces.
const SKIP_KEYS = ["highway", "boundary", "place", "landuse", "natural", "waterway", "railway", "route"];

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    country?: string;
    countrycode?: string;
  };
};

/** Full address under each result: street and number, postcode and city, country. */
export function suggestionsFromPhoton(data: { features?: PhotonFeature[] }, locale = "en"): PlaceSuggestion[] {
  // Country in the page's language ("Magyarország" on /hu), whatever language Photon answered in.
  const countryName = (code?: string, fallback?: string) => (code ? regionName(code, locale, fallback) : fallback);
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties;
    const type = TYPES[p.osm_type ?? ""];
    if (!type || !p.osm_id || !p.name || SKIP_KEYS.includes(p.osm_key ?? "")) continue;
    const id = `${OSM_PREFIX}${type}/${p.osm_id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const street = streetLine(p.street, p.housenumber, p.countrycode);
    const city = [p.postcode, p.city ?? p.district].filter(Boolean).join(" ");
    out.push({ placeId: id, main: p.name, secondary: [street, city, countryName(p.countrycode, p.country)].filter(Boolean).join(", "), country: p.countrycode?.toUpperCase() });
  }
  return out;
}

/** Results near this point come first; with `country`, other countries are left out when there are local ones. */
export type SearchArea = { lat: number; lon: number; country?: string; strict?: boolean };

export async function osmAutocomplete(input: string, locale: string, area: SearchArea | null): Promise<PlaceSuggestion[]> {
  "use cache";
  cacheLife("days");
  // Photon has no Hungarian: local names in Hungary, English elsewhere (Arabic-only names otherwise in the UAE).
  const local = locale === "hu" && (!area?.country || area.country === "HU");
  const qs = new URLSearchParams({ q: input, limit: area?.strict ? "15" : "8", lang: local ? "default" : "en" });
  if (area) {
    qs.set("lat", area.lat.toFixed(2));
    qs.set("lon", area.lon.toFixed(2));
    qs.set("zoom", "12");
  }
  for (const key of SKIP_KEYS) qs.append("osm_tag", `!${key}`);
  await recordPlacesCall("osm", "autocomplete");
  const res = await fetch(`${PHOTON}/api/?${qs}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const found = suggestionsFromPhoton(await res.json(), locale);
  if (!area?.strict || !area.country) return found;
  const inCountry = found.filter((f) => f.country === area.country);
  return (inCountry.length ? inCountry : found).slice(0, 8);
}

// Nominatim allows one request per second; spaced out per server instance (lookups are rare and cached).
let nextSlot = 0;
async function nominatimSlot() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

type NominatimPlace = {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  category?: string;
  type?: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string>;
};

export function detailsFromNominatim(p: NominatimPlace): PlaceDetails | null {
  if (!p.osm_type || !p.osm_id || !OSM_ID.test(`${p.osm_type}/${p.osm_id}`)) return null;
  const a = p.address ?? {};
  const country = (a.country_code ?? "").toUpperCase();
  const name = p.name || a[p.type ?? ""] || a.amenity || a.shop || "";
  const lat = Number(p.lat);
  const lng = Number(p.lon);
  return {
    placeId: `${OSM_PREFIX}${p.osm_type}/${p.osm_id}`,
    name,
    address: streetLine(a.road ?? a.pedestrian ?? a.square, a.house_number, country) || (a.suburb ?? ""),
    city: a.city || a.town || a.village || a.municipality || "",
    country,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    category: categoryFromOsm(p.category ?? "", p.type ?? ""),
    types: p.category && p.type ? [`${p.category}=${p.type}`] : [],
  };
}

export async function osmDetails(id: string, locale: string): Promise<PlaceDetails | null> {
  "use cache";
  cacheLife("days");
  if (!isOsmId(id)) return null;
  const [type, num] = id.slice(OSM_PREFIX.length).split("/");
  const qs = new URLSearchParams({
    osm_ids: `${type[0].toUpperCase()}${num}`,
    format: "jsonv2",
    addressdetails: "1",
    "accept-language": locale,
  });
  await nominatimSlot();
  await recordPlacesCall("osm", "details");
  const res = await fetch(`${NOMINATIM}/lookup?${qs}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const [place] = (await res.json()) as NominatimPlace[];
  return place ? detailsFromNominatim(place) : null;
}

// Countries that write the house number first ("350 5th Ave").
const NUMBER_FIRST = new Set(["US", "CA", "GB", "IE", "AU", "NZ", "FR"]);

function streetLine(street?: string, number?: string, country?: string) {
  if (!street) return "";
  const parts = NUMBER_FIRST.has((country ?? "").toUpperCase()) ? [number, street] : [street, number];
  return parts.filter(Boolean).join(" ");
}
