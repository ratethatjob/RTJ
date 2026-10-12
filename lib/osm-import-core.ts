// OpenStreetMap import, the parts without I/O: which cities and tags, the Overpass queries, turning
// OSM objects into workplace rows (named, open, with a street address, no private persons), the
// city boundary test. Used by lib/osm-import.ts (server) and scripts/osm-import.ts (CLI); only
// relative imports so the script runs with plain Node. Unit-tested in lib/osm-import-core.test.ts.

import type { Category } from "./categories.ts";
import { normalizeBusinessName } from "./place-match.ts";
import { classifyPlace, placeTypeInfo, typeFromOsm } from "./place-types.ts";

export type OsmCity = {
  slug: string;
  name: string;
  /** OSM relation of the city boundary. */
  relation: number;
  /** south, west, north, east: the Overpass bounding box (bbox queries stay fast when the
   *  public servers are busy; the boundary polygon then keeps only places inside the city). */
  bbox: [number, number, number, number];
};

// Budapest and the 10 largest cities after it.
export const OSM_CITIES: OsmCity[] = [
  { slug: "budapest", name: "Budapest", relation: 37244, bbox: [47.34, 18.92, 47.62, 19.34] },
  { slug: "debrecen", name: "Debrecen", relation: 1444234, bbox: [47.4, 21.45, 47.67, 21.85] },
  { slug: "szeged", name: "Szeged", relation: 1025105, bbox: [46.18, 19.97, 46.35, 20.28] },
  { slug: "miskolc", name: "Miskolc", relation: 1440895, bbox: [48.02, 20.6, 48.17, 20.9] },
  { slug: "pecs", name: "Pécs", relation: 575380, bbox: [45.99, 18.1, 46.15, 18.37] },
  { slug: "gyor", name: "Győr", relation: 1440627, bbox: [47.6, 17.53, 47.75, 17.8] },
  { slug: "nyiregyhaza", name: "Nyíregyháza", relation: 1447608, bbox: [47.85, 21.6, 48.08, 21.85] },
  { slug: "kecskemet", name: "Kecskemét", relation: 1130433, bbox: [46.8, 19.55, 47.0, 19.85] },
  { slug: "szekesfehervar", name: "Székesfehérvár", relation: 1361450, bbox: [47.12, 18.3, 47.27, 18.53] },
  { slug: "szombathely", name: "Szombathely", relation: 1131673, bbox: [47.18, 16.53, 47.3, 16.7] },
  { slug: "szolnok", name: "Szolnok", relation: 1273068, bbox: [47.11, 20.1, 47.23, 20.3] },
];

export const osmCity = (slug: string) => OSM_CITIES.find((c) => c.slug === slug) ?? null;

export type OsmGroup = { key: string; tags: [string, string[]][] };

// Workplaces in our categories, in small groups: one Overpass query each. Left out on purpose:
// doctors, lawyers, accountants and crafts (often a private person's name), guest houses and
// private rooms (private hosts), places of worship, parking, stations.
export const OSM_GROUPS: OsmGroup[] = [
  { key: "food", tags: [["amenity", ["restaurant", "fast_food", "cafe", "bar", "pub", "biergarten", "nightclub", "ice_cream", "food_court"]]] },
  { key: "grocery", tags: [["shop", ["supermarket", "convenience", "bakery", "pastry", "confectionery", "greengrocer", "butcher", "alcohol", "wholesale", "mall", "department_store", "chemist"]]] },
  { key: "retail", tags: [["shop", ["clothes", "shoes", "electronics", "mobile_phone", "furniture", "doityourself", "hardware", "books", "gift", "jewelry", "sports", "bicycle", "pet", "florist", "toys", "optician", "tobacco"]]] },
  { key: "services", tags: [["shop", ["car", "car_repair", "car_parts", "tyres", "hairdresser", "barber", "beauty", "cosmetics", "massage", "laundry", "dry_cleaning", "travel_agency", "pet_grooming"]]] },
  { key: "care", tags: [["amenity", ["pharmacy", "dentist", "clinic", "hospital", "kindergarten", "childcare", "school", "college", "university", "language_school", "driving_school", "veterinary", "nursing_home"]]] },
  { key: "public", tags: [["amenity", ["bank", "post_office", "cinema", "theatre", "casino", "fuel", "car_wash", "car_rental", "library", "marketplace"]]] },
  { key: "hotels", tags: [["tourism", ["hotel", "motel", "hostel"]]] },
  { key: "leisure", tags: [["leisure", ["fitness_centre", "sports_centre", "swimming_pool", "bowling_alley", "escape_game", "water_park"]]] },
  { key: "offices", tags: [["office", ["insurance", "employment_agency", "it", "telecommunication", "company"]]] },
  { key: "industry", tags: [["industrial", ["warehouse", "logistics", "factory"]], ["building", ["warehouse"]], ["man_made", ["works"]]] },
];

export const osmGroup = (key: string) => OSM_GROUPS.find((g) => g.key === key) ?? null;

/** "shop=bakery" strings of a group (stored on each imported workplace as osm_tag). */
export const groupTags = (g: OsmGroup) => g.tags.flatMap(([k, vs]) => vs.map((v) => `${k}=${v}`));

/** One small Overpass query: named objects with the group's tags inside the city's box. */
export function overpassQuery(city: OsmCity, group: OsmGroup): string {
  const [s, w, n, e] = city.bbox;
  const parts = group.tags.map(([k, vs]) =>
    vs.length === 1 ? `nwr[name]["${k}"="${vs[0]}"];` : `nwr[name]["${k}"~"^(${vs.join("|")})$"];`,
  );
  return `[out:json][timeout:25][bbox:${s},${w},${n},${e}];(${parts.join("")});out center tags;`;
}

/** The city boundary with member geometry. */
export const boundaryQuery = (city: OsmCity) => `[out:json][timeout:25];rel(${city.relation});out geom;`;

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[];
};

export type Ring = [number, number][];

/** Outer rings of a boundary relation (ways joined end to end), as [lat, lng] points. */
export function boundaryRings(rel: OsmElement): Ring[] {
  const ways = (rel.members ?? [])
    .filter((m) => m.type === "way" && m.role !== "inner" && m.geometry && m.geometry.length > 1)
    .map((m) => m.geometry!.map((p) => [p.lat, p.lon] as [number, number]));
  const key = (p: [number, number]) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
  const rings: Ring[] = [];
  while (ways.length) {
    const ring = ways.shift()!;
    let grown = true;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && grown) {
      grown = false;
      const end = key(ring[ring.length - 1]);
      const i = ways.findIndex((w) => key(w[0]) === end || key(w[w.length - 1]) === end);
      if (i >= 0) {
        const next = ways.splice(i, 1)[0];
        ring.push(...(key(next[0]) === end ? next : [...next].reverse()).slice(1));
        grown = true;
      }
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

/** Point in polygon (even-odd over all rings). */
export function insideRings(rings: Ring[], lat: number, lng: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i];
      const [yj, xj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

export type OsmRow = {
  osm_id: string;
  osm_tag: string;
  name: string;
  /** Company name: the brand for chains, else the place's own name. */
  company: string;
  brand_wikidata: string | null;
  /** A brand tag without a Wikidata id still groups the chain by name. */
  chain: boolean;
  /** Chain key for matching: Wikidata id or the normalized brand. */
  brand: string | null;
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  category: Category;
  place_type: string;
  place_type_en: string | null;
  place_type_hu: string | null;
  confidence: string;
};

export type Skip = "no_name" | "closed" | "person" | "no_address" | "outside" | "unknown_type" | "duplicate";

const CLOSED_PREFIX = /^(disused|abandoned|was|razed|demolished|removed|destroyed):/;

/** A workplace row from an OSM object, or why it is skipped. Only business data is read: name,
 *  brand, address, position and type, never phone numbers, e-mail addresses or opening hours. */
export function rowFromElement(
  e: OsmElement,
  group: OsmGroup,
  city: OsmCity,
  rings: Ring[] | null,
): OsmRow | Skip {
  const t = e.tags ?? {};
  const name = (t.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) return "no_name";
  if (
    Object.keys(t).some((k) => CLOSED_PREFIX.test(k)) ||
    ["yes"].includes(t.disused ?? "") ||
    ["yes"].includes(t.abandoned ?? "") ||
    /^(closed|off)$/i.test(t.opening_hours ?? "") ||
    t.end_date
  ) {
    return "closed";
  }
  // Private practices named after a person ("Dr. Kiss Anna fogorvos").
  if (/(^|\s)dr\.?\s/i.test(name) || /\b(e\.?\s?v\.?|egyéni vállalkozó)$/i.test(name)) return "person";

  const street = (t["addr:street"] ?? t["addr:place"] ?? "").trim();
  const number = (t["addr:housenumber"] ?? "").trim();
  if (!street || !number) return "no_address";

  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  if (lat == null || lng == null) return "outside";
  if (rings && rings.length && !insideRings(rings, lat, lng)) return "outside";

  const tag = group.tags.flatMap(([k, vs]) => (vs.includes(t[k]) ? [[k, t[k]] as const] : []))[0];
  if (!tag) return "unknown_type";
  const c = classifyPlace({ name, osm: { key: tag[0], value: tag[1] } });
  const type = c.placeType ?? typeFromOsm(tag[0], tag[1]);
  const info = placeTypeInfo(type);
  if (!c.category || !type || !info) return "unknown_type";

  const brandName = (t.brand ?? "").trim();
  const wikidata = /^Q\d+$/.test(t["brand:wikidata"] ?? "") ? t["brand:wikidata"]! : null;
  return {
    osm_id: `${e.type}/${e.id}`,
    osm_tag: `${tag[0]}=${tag[1]}`,
    name,
    company: brandName || name,
    brand_wikidata: wikidata,
    chain: Boolean(brandName),
    brand: wikidata ?? (brandName ? normalizeBusinessName(brandName) : null),
    address: `${street} ${number}`.slice(0, 150),
    city: city.name,
    country: "HU",
    lat,
    lng,
    category: c.category,
    place_type: type,
    place_type_en: info.en,
    place_type_hu: info.hu,
    confidence: c.confidence ?? "medium",
  };
}

/** Rows for a group's Overpass answer: the same object once, the same named place once (a shop
 *  drawn both as a point and as a building), with a count of what was skipped and why. */
export function rowsFromElements(elements: OsmElement[], group: OsmGroup, city: OsmCity, rings: Ring[] | null) {
  const rows: OsmRow[] = [];
  const skipped: Partial<Record<Skip, number>> = {};
  const seen = new Set<string>();
  const near = new Map<string, OsmRow[]>();
  const cell = (lat: number, lng: number) => `${Math.round(lat * 2000)}:${Math.round(lng * 1400)}`;
  for (const e of elements) {
    const r = rowFromElement(e, group, city, rings);
    let reason: Skip | null = typeof r === "string" ? r : null;
    if (typeof r !== "string") {
      const key = `${normalizeBusinessName(r.name)}|${cell(r.lat, r.lng)}`;
      if (seen.has(r.osm_id) || near.has(key)) reason = "duplicate";
      else {
        seen.add(r.osm_id);
        near.set(key, [r]);
        rows.push(r);
      }
    }
    if (reason) skipped[reason] = (skipped[reason] ?? 0) + 1;
  }
  return { rows, skipped };
}
