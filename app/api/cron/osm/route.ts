import { revalidateTag } from "next/cache";
import { dueRefreshes, runOsmImport } from "@/lib/osm-import";
import { OSM_GROUPS, osmCity, osmGroup } from "@/lib/osm-import-core";

// Daily: the monthly OpenStreetMap refresh, a few city/tag groups at a time (oldest first, each
// at most every 25 days, only cities imported before): new places are added, places OSM no longer
// has are marked closed. Overpass is often busy; a busy group simply waits for the next day.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const started = Date.now();
  const due = await dueRefreshes(OSM_GROUPS.map((g) => g.key), 6);
  const done = [];
  for (const d of due) {
    if (Date.now() - started > 200_000) break;
    const city = osmCity(d.city);
    const group = osmGroup(d.group);
    if (!city || !group) continue;
    const summary = await runOsmImport({ city, group, triggeredBy: "cron" });
    done.push({ ...d, ...summary });
  }
  if (done.some((d) => d.created || d.gone)) revalidateTag("locations", { expire: 0 });
  return Response.json({ done });
}
