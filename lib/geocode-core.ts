// Pure part of geocoding a hand-entered address (lib/geocode.ts does the requests): the query
// sent to Nominatim / Photon and how the answer is read. Unit-tested in geocode-core.test.ts.

export type GeocodeInput = { address: string; city: string; country: string };
export type Position = { lat: number; lng: number };

/** Nominatim structured search: street + city in one country, the best match only. */
export function nominatimQuery(w: GeocodeInput): URLSearchParams {
  return new URLSearchParams({
    street: w.address.trim(),
    city: w.city.trim(),
    countrycodes: w.country.toLowerCase(),
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
  });
}

/** Photon free text (fallback when Nominatim finds nothing). */
export function photonQuery(w: GeocodeInput): URLSearchParams {
  return new URLSearchParams({ q: `${w.address.trim()}, ${w.city.trim()}`, limit: "5" });
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function position(lat: unknown, lng: unknown): Position | null {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

type NominatimHit = { lat?: string; lon?: string; address?: Record<string, string> };

/** The first hit, when it is in the right country. */
export function fromNominatim(hits: NominatimHit[], w: GeocodeInput): Position | null {
  const hit = hits?.[0];
  if (!hit) return null;
  const cc = hit.address?.country_code;
  if (cc && cc.toUpperCase() !== w.country.toUpperCase()) return null;
  return position(hit.lat, hit.lon);
}

type PhotonHit = {
  geometry?: { coordinates?: [number, number] };
  properties?: { countrycode?: string; city?: string; town?: string; village?: string; district?: string; county?: string; street?: string; name?: string };
};

/** The first Photon hit in the right country and the typed city (a street name alone can be in
 *  any town, so a hit elsewhere is no answer). */
export function fromPhoton(data: { features?: PhotonHit[] }, w: GeocodeInput): Position | null {
  const city = fold(w.city);
  for (const f of data?.features ?? []) {
    const p = f.properties ?? {};
    if ((p.countrycode ?? "").toUpperCase() !== w.country.toUpperCase()) continue;
    const places = [p.city, p.town, p.village, p.district, p.county].filter(Boolean).map((s) => fold(s as string));
    if (!places.some((c) => c === city || c.startsWith(city) || city.startsWith(c))) continue;
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const pos = position(lat, lng);
    if (pos) return pos;
  }
  return null;
}
