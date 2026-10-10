import { after } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import {
  badgeLabels,
  EMBED_HEADERS,
  getIndexLocation,
  isTopRated,
  PUBLIC_HEADERS,
  recordEmbed,
  renderSeal,
} from "@/lib/rtj-index";

// Top Rated Employer seal: 404 unless the location earned it (4.0+, 10+ verified in 12 months).
// Without Pro (trial or paid) the seal stays but says the Index is unavailable.
export async function GET(request: Request, { params }: RouteContext<"/embed/[id]/seal.svg">) {
  const { id } = await params;
  const url = new URL(request.url);
  const requested = url.searchParams.get("locale");
  const theme = url.searchParams.get("style")?.includes("light") ? "light" : "dark";
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const data = await getIndexLocation(id);
  if (!data || (data.active && !isTopRated(data.location))) {
    return new Response("Not found", { status: 404, headers: PUBLIC_HEADERS });
  }
  after(() => recordEmbed(request, data.location.id));
  return new Response(renderSeal(data, await badgeLabels(locale, data), theme), {
    headers: { ...EMBED_HEADERS, "Content-Type": "image/svg+xml; charset=utf-8" },
  });
}
