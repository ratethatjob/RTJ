// Visitor areas: preset cities for the map search's "Near" select and the home page's
// "near you" section. Names are in the "Places.areas" messages ("Home.near.in" for "in Budapest").
// `slugs`: city_slug values of workplaces in that city; `zones`: IANA time zones that point there.

export const SEARCH_AREAS = {
  budapest: { lat: 47.4979, lon: 19.0402, country: "HU", slugs: ["budapest"], zones: ["Europe/Budapest"] },
  debrecen: { lat: 47.5316, lon: 21.6273, country: "HU", slugs: ["debrecen"], zones: [] },
  szeged: { lat: 46.253, lon: 20.1414, country: "HU", slugs: ["szeged"], zones: [] },
  pecs: { lat: 46.0727, lon: 18.2323, country: "HU", slugs: ["pecs"], zones: [] },
  gyor: { lat: 47.6875, lon: 17.6504, country: "HU", slugs: ["gyor"], zones: [] },
  miskolc: { lat: 48.1035, lon: 20.7784, country: "HU", slugs: ["miskolc"], zones: [] },
  dubai: { lat: 25.2048, lon: 55.2708, country: "AE", slugs: ["dubai"], zones: ["Asia/Dubai"] },
  abudhabi: { lat: 24.4539, lon: 54.3773, country: "AE", slugs: ["abu-dhabi"], zones: [] },
  sharjah: { lat: 25.3463, lon: 55.4209, country: "AE", slugs: ["sharjah"], zones: [] },
  vienna: { lat: 48.2082, lon: 16.3738, country: "AT", slugs: ["vienna", "wien"], zones: ["Europe/Vienna"] },
  london: { lat: 51.5072, lon: -0.1276, country: "GB", slugs: ["london"], zones: ["Europe/London"] },
  newyork: { lat: 40.7128, lon: -74.006, country: "US", slugs: ["new-york", "new-york-city"], zones: ["America/New_York"] },
} as const;

/** Cookies: the visitor's choice (shared by the map search and the home page) and the browser's
 *  time zone, so the server can tell without asking for the location. Functional, one year. */
export const AREA_COOKIE = "rtj_area";
export const TZ_COOKIE = "rtj_tz";

export type SearchAreaId = keyof typeof SEARCH_AREAS;

/** "auto" (IP or page language), "any", a preset id, or "geo:47.50,19.04" from the browser (only when allowed). */
export type AreaChoice = "auto" | "any" | SearchAreaId | `geo:${string}`;

export const isAreaId = (v: string): v is SearchAreaId => Object.hasOwn(SEARCH_AREAS, v);

/** Nearest preset within `maxKm`, for a browser location or IP coordinates. */
export function nearestArea(lat: number, lon: number, maxKm = 150): SearchAreaId | null {
  let best: SearchAreaId | null = null;
  let bestKm = maxKm;
  for (const [id, a] of Object.entries(SEARCH_AREAS) as [SearchAreaId, (typeof SEARCH_AREAS)[SearchAreaId]][]) {
    const dLat = ((a.lat - lat) * Math.PI) / 180;
    const dLon = ((a.lon - lon) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((a.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const km = 12742 * Math.asin(Math.sqrt(h));
    if (km < bestKm) [best, bestKm] = [id, km];
  }
  return best;
}

export const areaForZone = (zone: string): SearchAreaId | null =>
  (Object.entries(SEARCH_AREAS).find(([, a]) => (a.zones as readonly string[]).includes(zone))?.[0] as SearchAreaId) ?? null;

export const areaForCitySlug = (slug: string): SearchAreaId | null =>
  (Object.entries(SEARCH_AREAS).find(([, a]) => (a.slugs as readonly string[]).includes(slug))?.[0] as SearchAreaId) ?? null;

export const parseGeo = (v: string) => {
  const m = /^geo:(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(v);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
};
