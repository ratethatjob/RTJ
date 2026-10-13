import { revalidateTag } from "next/cache";
import { fillAddresses } from "@/lib/osm-import";

// Imported OpenStreetMap places without a street address: their street from Nominatim reverse
// geocoding, about 200 a run (one request a second); found ones become workplaces.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await fillAddresses(240_000);
  if (result.created || result.matched) revalidateTag("locations", { expire: 0 });
  return Response.json(result);
}
