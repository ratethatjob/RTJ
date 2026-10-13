import { HEADERS, NOMINATIM, nominatimSlot } from "@/lib/osm";
import { adminClient } from "@/lib/supabase/admin";
import {
  addressFromReverse,
  boundaryQuery,
  boundaryRings,
  groupTags,
  type OsmCity,
  type OsmElement,
  type OsmGroup,
  type OsmRow,
  overpassQuery,
  type Ring,
  rowsFromElements,
} from "@/lib/osm-import-core";
import { normalizeBusinessName, pickMatch } from "@/lib/place-match";

// OpenStreetMap import, server side (service role): one city and tag group per run. Fetches from
// Overpass (or takes the elements a script fetched), keeps the named, open places with a street
// address inside the city boundary, then for each: already ours (same OSM id) → seen; one of ours
// within 75 m with a matching name or brand (e.g. created from a Google pick) → the OSM id is added;
// else a new workplace ("Not rated yet"). Places the refresh no longer finds are marked closed.
// Data © OpenStreetMap contributors, ODbL.

const USER_AGENT = "RateThatJob/1.0 (https://ratethatjob.com; dev@ratethatjob.com)";
// Public Overpass servers, tried in turn: each is often "too busy" for a while.
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
// Waits between tries (growing): the servers' busy spells are short.
const BACKOFF_MS = [5_000, 15_000, 30_000];

export class OverpassBusy extends Error {}

/** One Overpass query, asked politely of each mirror in turn with a growing pause. */
export async function overpass(query: string, attempts = OVERPASS.length): Promise<OsmElement[]> {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(OVERPASS[i % OVERPASS.length], {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (res?.ok) {
      const json = (await res.json().catch(() => null)) as { elements?: OsmElement[] } | null;
      if (json?.elements) return json.elements;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)]));
  }
  throw new OverpassBusy("Overpass is busy");
}

/** The city's boundary rings: stored after the first fetch (boundaries rarely change). */
export async function cityRings(city: OsmCity, boundary?: OsmElement): Promise<Ring[]> {
  const db = adminClient();
  if (!db) throw new Error("no database");
  if (!boundary) {
    const { data } = await db.from("osm_city_areas").select("rings, fetched_at").eq("city", city.slug).maybeSingle();
    if (data && Date.now() - new Date(data.fetched_at).getTime() < 180 * 86400_000) return data.rings as Ring[];
  }
  const rel = boundary?.id === city.relation ? boundary : (await overpass(boundaryQuery(city))).find((e) => e.type === "relation");
  const rings = rel ? boundaryRings(rel) : [];
  if (!rings.length) throw new Error("no boundary");
  await db.from("osm_city_areas").upsert({ city: city.slug, rings, fetched_at: new Date().toISOString() });
  return rings;
}

export type RunSummary = {
  runId: string | null;
  fetched: number;
  created: number;
  matched: number;
  known: number;
  skipped: number;
  gone: number;
  skipReasons: Record<string, number>;
  error?: "busy" | "failed";
};

type Candidate = {
  i: number;
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  company_name: string;
  brand_wikidata: string | null;
  osm_id: string | null;
  google_place_id: string | null;
};

const chunks = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** Same chain: the same Wikidata brand, or (with a brand tag) the same normalized company name. */
function sameChain(row: OsmRow, c: Candidate) {
  if (row.brand_wikidata && c.brand_wikidata) return row.brand_wikidata === c.brand_wikidata;
  return row.chain && normalizeBusinessName(row.company) === normalizeBusinessName(c.company_name);
}

/** Create or attach: one of ours within 75 m with a matching name/brand (Google picks,
 *  hand-entered) gets the OSM id, else a new workplace. */
async function matchActions(fresh: OsmRow[]): Promise<Record<string, unknown>[]> {
  const db = adminClient();
  if (!db) return [];
  // Ours within reach (Google picks, hand-entered): match by name/brand within 75 m.
  const candidates = new Map<number, Candidate[]>();
  for (const [n, part] of chunks(fresh, 500).entries()) {
    const points = part.map((r, j) => ({ i: n * 500 + j, lat: r.lat, lng: r.lng }));
    const { data } = await db.rpc("nearby_locations", { p_points: points, p_radius_m: 120 });
    for (const c of (data ?? []) as Candidate[]) {
      if (c.osm_id) continue; // another OSM object already
      candidates.set(c.i, [...(candidates.get(c.i) ?? []), c]);
    }
  }
  const used = new Set<string>();
  const actions: Record<string, unknown>[] = [];
  fresh.forEach((r, i) => {
    // Brand keys only matter as "the same chain or not".
    const key = r.brand ?? "chain";
    const cands = (candidates.get(i) ?? [])
      .filter((c) => !used.has(c.id))
      .map((c) => ({ ...c, brand: sameChain(r, c) ? key : null }));
    const branded = r.chain || Boolean(r.brand_wikidata);
    const { same } = pickMatch({ name: r.name, address: r.address, lat: r.lat, lng: r.lng, brand: branded ? key : null }, cands);
    if (same) {
      used.add(same.id);
      actions.push({
        action: "attach",
        location_id: same.id,
        osm_id: r.osm_id,
        osm_tag: r.osm_tag,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        // Created from a Google pick: the address and position come from OSM from now on.
        refresh: Boolean(same.google_place_id),
      });
    } else {
      actions.push({ action: "create", ...r });
    }
  });

  return actions;
}

export async function runOsmImport(opts: {
  city: OsmCity;
  group: OsmGroup;
  /** Elements fetched elsewhere (scripts/osm-import.ts); else Overpass is asked now. */
  elements?: OsmElement[];
  /** The city's boundary relation with geometry, fetched by the script too. */
  boundary?: OsmElement;
  triggeredBy: string;
}): Promise<RunSummary> {
  const { city, group } = opts;
  const db = adminClient();
  const summary: RunSummary = { runId: null, fetched: 0, created: 0, matched: 0, known: 0, skipped: 0, gone: 0, skipReasons: {} };
  if (!db) return { ...summary, error: "failed" };
  const startedAt = new Date().toISOString();
  const { data: run } = await db
    .from("osm_import_runs")
    .insert({ city: city.slug, grp: group.key, triggered_by: opts.triggeredBy, started_at: startedAt, queues_unaddressed: true })
    .select("id")
    .single();
  summary.runId = run?.id ?? null;
  const finish = async (error?: string) => {
    if (summary.runId) {
      await db
        .from("osm_import_runs")
        .update({
          finished_at: new Date().toISOString(),
          fetched: summary.fetched,
          created: summary.created,
          matched: summary.matched,
          known: summary.known,
          skipped: summary.skipped,
          gone: summary.gone,
          skip_reasons: summary.skipReasons,
          error: error ?? null,
        })
        .eq("id", summary.runId);
    }
  };

  try {
    const rings = await cityRings(city, opts.boundary);
    const elements = opts.elements ?? (await overpass(overpassQuery(city, group)));
    summary.fetched = elements.length;
    const { rows, unaddressed, skipped } = rowsFromElements(elements, group, city, rings, true);
    summary.skipReasons = skipped;

    // Already ours by OSM id.
    const known = new Set<string>();
    for (const part of chunks([...rows, ...unaddressed].map((r) => r.osm_id), 300)) {
      const { data } = await db.from("locations").select("osm_id").in("osm_id", part);
      for (const r of data ?? []) known.add(r.osm_id as string);
    }
    const fresh = rows.filter((r) => !known.has(r.osm_id));
    // Unaddressed ones already ours (from the queue) are seen, not skipped.
    const knownUnaddressed = unaddressed.filter((r) => known.has(r.osm_id)).length;
    if (knownUnaddressed) summary.skipReasons = { ...skipped, no_address: (skipped.no_address ?? 0) - knownUnaddressed };

    const actions: Record<string, unknown>[] = [
      ...rows.filter((r) => known.has(r.osm_id)).map((r) => ({ action: "seen", osm_id: r.osm_id, osm_tag: r.osm_tag })),
      // Imported earlier through the address queue: still in OSM, still ours.
      ...unaddressed.filter((r) => known.has(r.osm_id)).map((r) => ({ action: "seen", osm_id: r.osm_id, osm_tag: r.osm_tag })),
      ...(await matchActions(fresh)),
    ];

    // Without a street address: queued for reverse geocoding (fillAddresses), an earlier answer kept.
    const queue = unaddressed.filter((r) => !known.has(r.osm_id));
    for (const part of chunks(queue, 500)) {
      await db.from("osm_address_queue").upsert(
        part.map((r) => ({ osm_id: r.osm_id, city: city.slug, grp: group.key, row: r, lat: r.lat, lng: r.lng })),
        { onConflict: "osm_id", ignoreDuplicates: true },
      );
    }

    let failed = 0;
    for (const part of chunks(actions, 400)) {
      const { data, error } = await db.rpc("osm_import_apply", { p_rows: part });
      if (error) throw error;
      const res = data as { created: number; attached: number; seen: number; failed: number };
      summary.created += res.created;
      summary.matched += res.attached;
      summary.known += res.seen;
      failed += res.failed;
    }
    if (failed) summary.skipReasons = { ...summary.skipReasons, failed };
    summary.skipped = Object.values(summary.skipReasons).reduce((a, b) => a + (b ?? 0), 0);

    // A complete answer: what OSM no longer has in this city and group is marked closed.
    if (elements.length > 0) {
      const { data } = await db.rpc("osm_mark_gone", { p_city: city.name, p_tags: groupTags(group), p_before: startedAt });
      summary.gone = (data as number) ?? 0;
    }
    await finish();
    return summary;
  } catch (e) {
    const busy = e instanceof OverpassBusy;
    console.error("osm import", city.slug, group.key, e);
    await finish(busy ? "Overpass busy" : String((e as Error)?.message ?? e).slice(0, 300));
    return { ...summary, error: busy ? "busy" : "failed" };
  }
}

/** Groups due for the monthly refresh: cities imported before, each group last finished without
 *  an error 25+ days ago (or never, or before the address queue), oldest first. */
export async function dueRefreshes(groups: string[], limit: number): Promise<{ city: string; group: string }[]> {
  const db = adminClient();
  if (!db) return [];
  const { data } = await db
    .from("osm_import_runs")
    .select("city, grp, finished_at, queues_unaddressed")
    .is("error", null)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(5000);
  const last = new Map<string, number>();
  for (const r of data ?? []) {
    // Runs from before the address queue count as never: their unaddressed places get queued too.
    if (!r.queues_unaddressed) continue;
    const key = `${r.city}|${r.grp}`;
    if (!last.has(key)) last.set(key, new Date(r.finished_at as string).getTime());
  }
  const cities = [...new Set((data ?? []).map((r) => r.city as string))];
  const due = cities
    .flatMap((city) => groups.map((group) => ({ city, group, at: last.get(`${city}|${group}`) ?? 0 })))
    .filter((d) => Date.now() - d.at > 25 * 86400_000)
    .sort((a, b) => a.at - b.at);
  return due.slice(0, limit).map(({ city, group }) => ({ city, group }));
}

/** Places without a street address (osm_address_queue): Nominatim reverse at their position, at
 *  most one request a second (nominatimSlot, User-Agent); a street (with or without a house
 *  number) → created or matched like any imported place, none → left out for good. Each answer is
 *  stored, so a place is never asked twice. Stops at the time budget or when Nominatim fails. */
export async function fillAddresses(budgetMs = 240_000, limit = 400) {
  const db = adminClient();
  const result = { checked: 0, found: 0, noAddress: 0, created: 0, matched: 0, left: 0 };
  if (!db) return result;
  const started = Date.now();
  const { data } = await db
    .from("osm_address_queue")
    .select("osm_id, row, lat, lng")
    .eq("status", "pending")
    .order("queued_at")
    .limit(limit);
  const found: OsmRow[] = [];
  for (const q of (data ?? []) as { osm_id: string; row: OsmRow; lat: number; lng: number }[]) {
    if (Date.now() - started > budgetMs) break;
    await nominatimSlot();
    const qs = new URLSearchParams({
      lat: String(q.lat),
      lon: String(q.lng),
      format: "jsonv2",
      addressdetails: "1",
      zoom: "18",
      "accept-language": "hu",
    });
    const res = await fetch(`${NOMINATIM}/reverse?${qs}`, { headers: HEADERS, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res?.ok) break; // try again on the next run
    const address = addressFromReverse(await res.json().catch(() => null));
    result.checked += 1;
    await db
      .from("osm_address_queue")
      .update({ status: address ? "found" : "no_address", address, checked_at: new Date().toISOString() })
      .eq("osm_id", q.osm_id);
    if (address) found.push({ ...q.row, address });
    else result.noAddress += 1;
  }
  result.found = found.length;
  // Not ours yet (an import may have added it meanwhile): create or attach.
  const known = new Set<string>();
  for (const part of chunks(found.map((r) => r.osm_id), 300)) {
    const { data: rows } = await db.from("locations").select("osm_id").in("osm_id", part);
    for (const r of rows ?? []) known.add(r.osm_id as string);
  }
  const actions = await matchActions(found.filter((r) => !known.has(r.osm_id)));
  for (const part of chunks(actions, 400)) {
    const { data: res } = await db.rpc("osm_import_apply", { p_rows: part });
    const r = res as { created: number; attached: number } | null;
    result.created += r?.created ?? 0;
    result.matched += r?.attached ?? 0;
  }
  const { count } = await db.from("osm_address_queue").select("osm_id", { count: "exact", head: true }).eq("status", "pending");
  result.left = count ?? 0;
  console.log(JSON.stringify({ event: "osm_fill_addresses", ...result }));
  return result;
}
