import { revalidateTag } from "next/cache";
import { geocodeMissing } from "@/lib/geocode";
import { dueRefreshes, runOsmImport } from "@/lib/osm-import";
import { OSM_GROUPS, osmCity, osmGroup } from "@/lib/osm-import-core";

// Daily: the monthly OpenStreetMap refresh, a few city/tag groups at a time (oldest first, each
// at most every 25 days, only cities imported before): new places are added, places OSM no longer
// has are marked closed. Overpass is often busy: several mirrors with growing pauses, a busy group
// is tried once more at the end, else it waits for the next day.
// First, hand-entered workplaces still without coordinates get geocoded (lib/geocode.ts).
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const started = Date.now();
  const geocoded = await geocodeMissing(40, 60_000);
  const due = await dueRefreshes(OSM_GROUPS.map((g) => g.key), 6);
  const done = [];
  for (const d of due) {
    if (Date.now() - started > 150_000) break;
    const city = osmCity(d.city);
    const group = osmGroup(d.group);
    if (!city || !group) continue;
    const summary = await runOsmImport({ city, group, triggeredBy: "cron" });
    done.push({ ...d, ...summary });
  }
  // Busy groups once more while there is time (the mirrors' busy spells are often short).
  for (const d of done.filter((x) => x.error === "busy")) {
    if (Date.now() - started > 150_000) break;
    const city = osmCity(d.city);
    const group = osmGroup(d.group);
    if (!city || !group) continue;
    done.push({ ...d, retry: true, ...(await runOsmImport({ city, group, triggeredBy: "cron" })) });
  }
  if (done.some((d) => d.created || d.gone)) revalidateTag("locations", { expire: 0 });
  return Response.json({ geocoded, done });
}
