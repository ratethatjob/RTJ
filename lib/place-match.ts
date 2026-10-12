// Is a map place (Google search suggestion or details, an OpenStreetMap object) a workplace we
// already have? Names and addresses are normalized (lower case, no accents, no company forms or
// shop-format words), then compared: by street + house number when there are no coordinates
// (search suggestions), within 75 m when there are (place details, OSM import, the admin's
// duplicate list). Unit-tested in lib/place-match.test.ts.

/** Within this distance two places with matching names are the same workplace. */
export const MATCH_RADIUS_M = 75;
/** Same workplace from this name score (or the same brand). */
export const NAME_MATCH = 0.5;
/** Below a match but this close: ask the person ("Did you mean …?"). */
export const NAME_MAYBE = 0.35;

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Company forms, shop formats and type words that differ between map sources ("SPAR Szupermarket"
// = "Spar", "Starbucks Coffee" = "Starbucks", "LIDL Magyarország Bt." = "Lidl").
const NOISE = new Set(
  (
    "kft bt zrt nyrt rt kkt kht ev nonprofit llc ltd gmbh inc co sro sa ag plc magyarorszag hungary hu " +
    "uzlet bolt aruhaz shop store market szupermarket supermarket hipermarket hypermarket express expressz " +
    "partner minimarket abc es and the a az " +
    "kavezo kave coffee cafe caffe etterem restaurant bisztro bistro bufe gyorsetterem " +
    "gyogyszertar patika pharmacy pekseg bakery cukraszda fodraszat szalon salon"
  ).split(" "),
);

/** "LIDL Magyarország Bt." → "lidl"; only noise words → the plain name without accents. */
export function normalizeBusinessName(name: string): string {
  const plain = strip(name);
  const kept = plain.split(" ").filter((w) => w && !NOISE.has(w));
  return kept.length ? kept.join(" ") : plain;
}

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of s.split(" ").filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** Trigram similarity (like pg_trgm's similarity()). */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (!ta.size || !tb.size) return 0;
  let both = 0;
  for (const t of ta) if (tb.has(t)) both++;
  return both / (ta.size + tb.size - both);
}

/** 0–1: 1 for the same normalized name, 0.9 when every word of one is in the other
 *  ("Starbucks" ⊂ "Starbucks Oktogon"), else trigram similarity. */
export function nameScore(a: string, b: string): number {
  const na = normalizeBusinessName(a);
  const nb = normalizeBusinessName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wa = na.split(" ");
  const wb = nb.split(" ");
  const [short, long] = wa.length <= wb.length ? [wa, new Set(wb)] : [wb, new Set(wa)];
  if (short.every((w) => long.has(w))) return 0.9;
  return trigramSimilarity(na, nb);
}

const STREET_WORDS: [RegExp, string][] = [
  [/\butca\b|\bu\b/g, "u"],
  [/\bkorut\b|\bkrt\b/g, "krt"],
  [/\bter\b|\btere\b/g, "ter"],
  [/\brakpart\b|\brkp\b/g, "rkp"],
  [/\bsetany\b|\bstny\b/g, "setany"],
  [/\bstreet\b|\bst\b/g, "st"],
  [/\bavenue\b|\bave\b/g, "ave"],
  [/\broad\b|\brd\b/g, "rd"],
];

/** Street and house number from an address line ("Kárász u. 5, Szeged" → karasz u / 5).
 *  Postcode and city parts are skipped; "5/a" and "5 A" → "5a", "12-14" → "12". */
export function normalizeStreet(address: string): { street: string; number: string } | null {
  for (const part of address.split(",")) {
    const s = strip(part.replace(/(\d)\s*\/\s*([a-z])\b/gi, "$1$2"));
    const m = s.match(/^(.*?[a-z].*?)\s+(\d+)\s*([a-z])?\b/);
    if (!m || /^\d{4}\b/.test(s)) continue;
    let street = m[1];
    for (const [re, to] of STREET_WORDS) street = street.replace(re, to);
    return { street: street.replace(/\s+/g, " ").trim(), number: `${m[2]}${m[3] ?? ""}` };
  }
  return null;
}

/** Same street and house number (a missing letter on one side still matches: 5 = 5a). */
export function sameAddress(a: string, b: string): boolean {
  const x = normalizeStreet(a);
  const y = normalizeStreet(b);
  if (!x || !y || x.street !== y.street) return false;
  if (x.number === y.number) return true;
  return parseInt(x.number) === parseInt(y.number) && (/^\d+$/.test(x.number) || /^\d+$/.test(y.number));
}

/** Distance in metres (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export type MatchPlace = {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Chain key: brand:wikidata, or the normalized brand name. */
  brand?: string | null;
};

export type Match = "same" | "maybe" | "different";

/** Whether two places are the same workplace. With coordinates on both sides: within 75 m and a
 *  matching name or brand ("maybe" for a close name); without: the same street and number and a
 *  matching name or brand. */
export function comparePlaces(a: MatchPlace, b: MatchPlace): { match: Match; score: number; distance: number | null } {
  const score = nameScore(a.name, b.name);
  const sameBrand = Boolean(a.brand && b.brand && a.brand === b.brand);
  const named = score >= NAME_MATCH || sameBrand;
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const distance = distanceM({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
    if (distance > MATCH_RADIUS_M) return { match: "different", score, distance };
    if (named) return { match: "same", score, distance };
    return { match: score >= NAME_MAYBE ? "maybe" : "different", score, distance };
  }
  const address = Boolean(a.address && b.address && sameAddress(a.address, b.address));
  return { match: address && named ? "same" : "different", score, distance: null };
}

/** The one workplace a map place is, or the close ones to ask about. */
export function pickMatch<T extends MatchPlace>(place: MatchPlace, candidates: T[]): { same: T | null; maybe: T[] } {
  const rated = candidates
    .map((c) => ({ c, r: comparePlaces(place, c) }))
    .filter((x) => x.r.match !== "different")
    .sort((x, y) => y.r.score - x.r.score || (x.r.distance ?? 0) - (y.r.distance ?? 0));
  const same = rated.filter((x) => x.r.match === "same");
  // Exactly one sure match: that's it. Several (two Spars in one mall): the person decides.
  if (same.length === 1) return { same: same[0].c, maybe: [] };
  return { same: null, maybe: rated.slice(0, 3).map((x) => x.c) };
}
