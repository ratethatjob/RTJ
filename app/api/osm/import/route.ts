import { revalidateTag } from "next/cache";
import { importAllowed } from "@/lib/import-auth";
import { runOsmImport } from "@/lib/osm-import";
import { type OsmElement, osmCity, osmGroup } from "@/lib/osm-import-core";

// One city and tag group of the OpenStreetMap import, with the Overpass answer the caller
// fetched (scripts/osm-import.ts waits out busy Overpass servers; a function can't).
// POST {city, group, elements, boundary?} with "Authorization: Bearer <CRON_SECRET or import token>".
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await importAllowed(request))) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { city?: string; group?: string; elements?: OsmElement[]; boundary?: OsmElement } | null;
  const city = osmCity(String(body?.city ?? ""));
  const group = osmGroup(String(body?.group ?? ""));
  if (!city || !group || !Array.isArray(body?.elements)) return Response.json({ error: "invalid" }, { status: 400 });
  const summary = await runOsmImport({ city, group, elements: body.elements, boundary: body.boundary, triggeredBy: "script" });
  if (summary.created || summary.matched) revalidateTag("locations", { expire: 0 });
  return Response.json(summary, { status: summary.error ? 502 : 200 });
}
