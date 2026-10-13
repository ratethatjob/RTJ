import { revalidateTag } from "next/cache";
import { getLocationById } from "@/lib/data";
import { locationPath } from "@/lib/format";
import { getPathname } from "@/i18n/navigation";
import { requestPartner } from "@/lib/partner-key";
import { ensureLocationFromPlace } from "@/lib/place-ensure";

// Partner API (docs/partner-api.md): one map place → its workplace on RateThatJob, for a trusted
// importer with X-RTJ-Partner-Key. POST {placeId, sessionToken?, locale?, confirm?, force?}.
// The same path as a person picking the place (ensureLocationFromPlace): the existing workplace,
// one of ours nearby with a matching name (place id attached), "did you mean" candidates, or a
// new workplace (created_via 'partner').

export const maxDuration = 60;

const url = async (locationId: string, locale: string) => {
  const l = await getLocationById(locationId);
  return l ? `https://ratethatjob.com${getPathname({ href: locationPath(l), locale })}` : null;
};

export async function POST(request: Request) {
  const partner = await requestPartner();
  if (!partner) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    placeId?: unknown;
    sessionToken?: unknown;
    locale?: unknown;
    confirm?: unknown;
    force?: unknown;
  } | null;
  const placeId = typeof body?.placeId === "string" ? body.placeId.trim() : "";
  if (!placeId) return Response.json({ error: "invalid_request" }, { status: 400 });
  const locale = body?.locale === "en" ? "en" : "hu";

  const result = await ensureLocationFromPlace(placeId, {
    via: "rate",
    locale,
    sessionToken: typeof body?.sessionToken === "string" ? body.sessionToken.slice(0, 100) : undefined,
    confirm: typeof body?.confirm === "string" ? body.confirm : undefined,
    force: body?.force === true,
  });

  if ("candidates" in result) return Response.json({ status: "candidates", candidates: result.candidates });
  if ("error" in result) {
    if (result.error === "limit") return Response.json({ error: "limit" }, { status: 429 });
    if (result.error === "invalid") {
      return Response.json({ error: result.reason, name: result.name ?? null }, { status: 422 });
    }
    return Response.json({ error: "generic" }, { status: 502 });
  }
  if (result.created) revalidateTag("locations", { expire: 0 });
  return Response.json(
    { status: result.created ? "created" : "existing", locationId: result.locationId, url: await url(result.locationId, locale) },
    { status: result.created ? 201 : 200 },
  );
}
