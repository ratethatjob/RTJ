import { randomUUID } from "node:crypto";
import { getLocationById } from "@/lib/data";
import { locationPath, slugify } from "@/lib/format";
import { getPathname } from "@/i18n/navigation";
import { osmAutocomplete } from "@/lib/osm";
import { requestPartner } from "@/lib/partner-key";
import { caller, knownOrMatched } from "@/lib/place-search";
import { autocomplete, placesProvider } from "@/lib/places";
import { rateLimitedDb } from "@/lib/rate-limit";
import { areaForCitySlug, SEARCH_AREAS } from "@/lib/search-areas";

// Partner API (docs/partner-api.md): map search for a trusted importer.
// GET /api/partner/places/search?q=Lidl&where=Budapest&locale=hu  with X-RTJ-Partner-Key.
// Returns the map places (Google, or OpenStreetMap without a Google key) with the place id to send
// to POST /api/partner/places, and whether each one is already on RateThatJob.

export async function GET(request: Request) {
  const partner = await requestPartner();
  if (!partner) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (await rateLimitedDb(`partner-search:${partner.id}`, 1000, 3600_000)) {
    return Response.json({ error: "limit" }, { status: 429 });
  }
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const where = (url.searchParams.get("where") ?? "").trim().slice(0, 60);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "hu";
  if (q.length < 3) return Response.json({ error: "query_too_short" }, { status: 400 });
  const provider = await placesProvider();
  if (!provider) return Response.json({ error: "unavailable" }, { status: 503 });

  // A known city keeps the results there; any other place name is added to the query.
  const preset = where ? areaForCitySlug(slugify(where)) : null;
  const area = preset ? { ...SEARCH_AREAS[preset], strict: true } : null;
  const input = where && !preset ? `${q} ${where}` : q;
  const sessionToken = randomUUID();
  try {
    const found = provider === "google" ? await autocomplete(input, locale, sessionToken, area) : await osmAutocomplete(input, locale, area);
    const { supabase } = await caller();
    const known = await knownOrMatched(supabase, found);
    const results = await Promise.all(
      found.map(async (f) => {
        const locationId = known.get(f.placeId) ?? null;
        const location = locationId ? await getLocationById(locationId) : null;
        return {
          placeId: f.placeId,
          name: f.main,
          address: f.secondary,
          placeType: f.placeType ?? null,
          locationId,
          url: location ? `https://ratethatjob.com${getPathname({ href: locationPath(location), locale })}` : null,
        };
      }),
    );
    return Response.json({ provider, sessionToken, results });
  } catch (e) {
    console.error("partner search", e);
    return Response.json({ error: "generic" }, { status: 502 });
  }
}
