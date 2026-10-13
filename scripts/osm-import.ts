// OpenStreetMap import for one or more cities, from any computer:
//
//   OSM_IMPORT_TOKEN=<CRON_SECRET or an import token> node scripts/osm-import.ts szeged [group …]
//   (OSM_IMPORT_URL defaults to https://ratethatjob.com; OSM_SAVE_DIR keeps each Overpass answer)
//
// For each tag group it asks Overpass politely (one small query at a time, waiting and retrying
// while the public servers say "too busy"), then posts the answer to /api/osm/import, which does
// the rest exactly like the admin button (filter, classify, match, write, log). Cities and groups:
// lib/osm-import-core.ts. Data © OpenStreetMap contributors, ODbL.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { boundaryQuery, OSM_CITIES, OSM_GROUPS, osmCity, overpassQuery } from "../lib/osm-import-core.ts";

const BASE = process.env.OSM_IMPORT_URL ?? "https://ratethatjob.com";
const TOKEN = process.env.OSM_IMPORT_TOKEN ?? "";
const SAVE = process.env.OSM_SAVE_DIR ?? "";
const HOSTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const UA = "RateThatJob/1.0 (https://ratethatjob.com; dev@ratethatjob.com)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPatiently(query: string): Promise<unknown[]> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const host = HOSTS[attempt % HOSTS.length];
    const res = await fetch(host, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(60_000),
    }).catch(() => null);
    if (res?.ok) {
      const json = (await res.json().catch(() => null)) as { elements?: unknown[] } | null;
      if (json?.elements) return json.elements;
    }
    console.log(`  Overpass busy (${res?.status ?? "no answer"}), waiting…`);
    await sleep(45_000);
  }
  throw new Error("Overpass stayed busy");
}

async function main() {
  const [citySlug, ...groupKeys] = process.argv.slice(2);
  const cities = citySlug === "all" ? OSM_CITIES : [osmCity(citySlug ?? "")].filter((c) => c !== null);
  if (!cities.length || !TOKEN) {
    console.log("Usage: OSM_IMPORT_TOKEN=… node scripts/osm-import.ts <city|all> [group …]");
    console.log("Cities:", OSM_CITIES.map((c) => c.slug).join(", "));
    console.log("Groups:", OSM_GROUPS.map((g) => g.key).join(", "));
    process.exit(1);
  }
  const groups = groupKeys.length ? OSM_GROUPS.filter((g) => groupKeys.includes(g.key)) : OSM_GROUPS;
  for (const city of cities) {
    // The city boundary once per city (the server keeps it).
    console.log(`${city.name} · boundary`);
    let boundary: unknown = (await fetchPatiently(boundaryQuery(city))).find((e) => (e as { type?: string }).type === "relation");
    for (const group of groups) {
      console.log(`${city.name} · ${group.key}`);
      const elements = await fetchPatiently(overpassQuery(city, group));
      if (SAVE) {
        mkdirSync(SAVE, { recursive: true });
        writeFileSync(join(SAVE, `${city.slug}-${group.key}.json`), JSON.stringify({ elements }));
      }
      const res = await fetch(`${BASE}/api/osm/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ city: city.slug, group: group.key, elements, boundary }),
      });
      if (res.ok) boundary = undefined;
      console.log(`  ${elements.length} from OSM →`, res.status, await res.text());
      await sleep(3_000);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
