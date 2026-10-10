import { after } from "next/server";
import { jobsWidgetData, validWidgetTarget, WIDGET_LOCALES, WIDGET_SCOPES, type WidgetScope } from "@/lib/jobs-widget";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { EMBED_HEADERS, recordEmbed } from "@/lib/rtj-index";

// Public JSON for the jobs widget: ?job=ID | ?location=ID | ?company=SLUG, optional &locale=en|hu.
// Open, published jobs only. Cached in the browser only, so every embedding site is counted.
export async function GET(request: Request) {
  if (rateLimited(`jobs:${clientIp(request)}`)) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { ...EMBED_HEADERS, "Retry-After": "60" } });
  }
  const params = new URL(request.url).searchParams;
  const scope = WIDGET_SCOPES.find((s) => params.has(s)) as WidgetScope | undefined;
  const id = scope ? (params.get(scope) ?? "").trim() : "";
  if (!scope || !validWidgetTarget(scope, id)) {
    return Response.json({ error: "bad_request" }, { status: 400, headers: EMBED_HEADERS });
  }
  const requested = params.get("locale")?.slice(0, 2).toLowerCase();
  const locale = WIDGET_LOCALES.find((l) => l === requested) ?? "en";
  const data = await jobsWidgetData(scope, id, locale);
  if (!data) return Response.json({ error: "not_found" }, { status: 404, headers: EMBED_HEADERS });
  after(() => Promise.all(data.locationIds.slice(0, 10).map((loc) => recordEmbed(request, loc))));
  return Response.json(data.payload, { headers: EMBED_HEADERS });
}
