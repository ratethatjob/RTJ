import { cookies, headers } from "next/headers";
import { slugify } from "./format";
import {
  AREA_COOKIE,
  areaForCitySlug,
  areaForZone,
  isAreaId,
  nearestArea,
  parseGeo,
  SEARCH_AREAS,
  type SearchAreaId,
  TZ_COOKIE,
} from "./search-areas";

// Where the visitor probably is, without asking for permission (home page "near you"):
// 1) their own choice (cookie, shared with the map search), 2) Vercel's IP geolocation,
// 3) the browser's time zone (cookie set on the home page), 4) the page language (hu → Budapest).
// The exact browser location is used only when they pick "My location" (rounded, in the cookie).

export type VisitorArea =
  | { kind: "area"; id: SearchAreaId; citySlugs: string[]; country: string }
  | { kind: "city"; city: string; citySlugs: string[]; country: string | null }
  | { kind: "any" };

const fromId = (id: SearchAreaId): VisitorArea => ({
  kind: "area",
  id,
  citySlugs: [...SEARCH_AREAS[id].slugs],
  country: SEARCH_AREAS[id].country,
});

export async function visitorArea(locale: string): Promise<VisitorArea> {
  const jar = await cookies();
  const choice = jar.get(AREA_COOKIE)?.value ?? "auto";
  if (choice === "any") return { kind: "any" };
  if (isAreaId(choice)) return fromId(choice);
  const geo = parseGeo(choice);
  const near = geo && nearestArea(geo.lat, geo.lon);
  if (near) return fromId(near);

  const h = await headers();
  const ipCity = h.get("x-vercel-ip-city");
  if (ipCity) {
    const city = decodeURIComponent(ipCity);
    const preset = areaForCitySlug(slugify(city));
    if (preset) return fromId(preset);
    const lat = Number(h.get("x-vercel-ip-latitude"));
    const lon = Number(h.get("x-vercel-ip-longitude"));
    const close = Number.isFinite(lat) && Number.isFinite(lon) ? nearestArea(lat, lon, 40) : null;
    if (close) return fromId(close);
    return { kind: "city", city, citySlugs: [slugify(city)], country: h.get("x-vercel-ip-country") };
  }

  const zone = jar.get(TZ_COOKIE)?.value;
  const byZone = zone ? areaForZone(zone) : null;
  if (byZone) return fromId(byZone);
  return locale === "hu" ? fromId("budapest") : { kind: "any" };
}
