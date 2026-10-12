import { cookies, headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { isOsmId, osmAutocomplete, type SearchArea } from "@/lib/osm";
import { autocomplete, placesProvider } from "@/lib/places";
import { rateLimited } from "@/lib/rate-limit";
import { getLocationById } from "@/lib/data";
import { locationPath, slugify } from "@/lib/format";
import { getPathname } from "@/i18n/navigation";
import { AREA_COOKIE, areaForCitySlug, isAreaId, parseGeo, SEARCH_AREAS } from "@/lib/search-areas";
import { visitorArea } from "@/lib/visitor-area";

// Shared by the review finder (app/rate/places/actions.ts) and the main search (search/actions.ts).

// OSM ids are stored without the "osm:" prefix.
const osmKey = (id: string) => id.slice(4);

/** Workplaces already on RateThatJob for these Google place ids or OSM ids. */
export async function knownLocations(supabase: Awaited<ReturnType<typeof getUser>>["supabase"], ids: string[]) {
  const osm = ids.filter(isOsmId);
  const google = ids.filter((id) => !isOsmId(id));
  const [g, o] = await Promise.all([
    google.length ? supabase.rpc("locations_by_place", { p_place_ids: google }) : { data: [] },
    osm.length ? supabase.rpc("locations_by_osm", { p_osm_ids: osm.map(osmKey) }) : { data: [] },
  ]);
  return new Map<string, string>([
    ...((g.data ?? []) as { place_id: string; location_id: string }[]).map((r) => [r.place_id, r.location_id] as const),
    ...((o.data ?? []) as { osm_id: string; location_id: string }[]).map((r) => [`osm:${r.osm_id}`, r.location_id] as const),
  ]);
}

/** Signed-in user id, or the visitor's IP address, as the rate-limit key. */
export async function caller() {
  const { supabase, user } = await getUser();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return { supabase, key: user ? `u:${user.id}` : `ip:${ip}` };
}

/** Where to look first: the person's pick, their browser location (rounded), or Vercel's IP location,
 *  else the page language (hu → Budapest). "any" searches everywhere. */
export async function resolveArea(choice: string, locale: string): Promise<SearchArea | null> {
  if (choice === "any") return null;
  if (isAreaId(choice)) return { ...SEARCH_AREAS[choice], strict: true };
  const geo = parseGeo(choice);
  if (geo) return geo;
  const h = await headers();
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lon = Number(h.get("x-vercel-ip-longitude"));
  if (h.get("x-vercel-ip-latitude") && Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon, country: h.get("x-vercel-ip-country") ?? undefined };
  }
  // No IP location: the same guess as the home page (time zone cookie, then page language).
  const visitor = await visitorArea(locale);
  return visitor.kind === "area" ? { ...SEARCH_AREAS[visitor.id] } : null;
}


export type MapResult = {
  placeId: string;
  main: string;
  secondary: string;
  locationId: string | null;
  href: string | null;
  /** Exact type key from the map ("barber_shop"), shown in front of the address. */
  placeType: string | null;
};

/** The workplace page of a known location, in the page language. */
export async function locationHref(locationId: string) {
  const location = await getLocationById(locationId);
  return location ? getPathname({ href: locationPath(location), locale: await getLocale() }) : null;
}

/** Map places for the main search: "where" biases to a known city (and its country) or is added
 *  to the query; empty, the visitor's chosen city (cookie), IP location or language. 3+ characters. */
export async function findMapPlaces(q: string, where: string, sessionToken: string): Promise<MapResult[] | null> {
  const text = q.trim().slice(0, 100);
  if (text.length < 3) return [];
  const provider = await placesProvider();
  if (!provider) return [];
  const { supabase, key } = await caller();
  if (rateLimited(`places-search:${key}`, 60)) return null;
  if (provider === "osm" && rateLimited(`osm-search:${key}`, 30)) return null;
  const locale = await getLocale();
  const place = where.trim().slice(0, 60);
  const preset = place ? areaForCitySlug(slugify(place)) : null;
  const choice = (await cookies()).get(AREA_COOKIE)?.value ?? "auto";
  const area = preset
    ? { ...SEARCH_AREAS[preset], strict: true }
    : place
      ? null
      : await resolveArea(choice.slice(0, 40), locale);
  const input = place && !preset ? `${text} ${place}` : text;
  const found =
    provider === "google"
      ? await autocomplete(input, locale, sessionToken, area)
      : await osmAutocomplete(input, locale, area);
  const known = await knownLocations(supabase, found.map((f) => f.placeId));
  return Promise.all(
    found.map(async (f) => {
      const locationId = known.get(f.placeId) ?? null;
      return {
        placeId: f.placeId,
        main: f.main,
        secondary: f.secondary,
        locationId,
        href: locationId ? await locationHref(locationId) : null,
        placeType: f.placeType ?? null,
      };
    }),
  );
}
