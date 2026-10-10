import { after } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import {
  BADGE_STYLES,
  type BadgeStyle,
  badgeLabels,
  EMBED_HEADERS,
  getIndexLocation,
  recordEmbed,
  renderBadge,
} from "@/lib/rtj-index";

// /embed/{id}.svg → SVG badge; /embed/{id} → small HTML card for iframes.
export async function GET(request: Request, { params }: RouteContext<"/embed/[id]">) {
  const { id: raw } = await params;
  const isSvg = raw.endsWith(".svg");
  const id = isSvg ? raw.slice(0, -4) : raw;
  const url = new URL(request.url);
  const style: BadgeStyle = BADGE_STYLES.includes(url.searchParams.get("style") as BadgeStyle)
    ? (url.searchParams.get("style") as BadgeStyle)
    : isSvg
      ? "compact-light"
      : "wide-light";
  const requested = url.searchParams.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const data = await getIndexLocation(id);
  if (!data) return new Response("Not found", { status: 404 });
  const badge = renderBadge(style, data, await badgeLabels(locale, data));
  after(() => recordEmbed(request, data.location.id));

  if (isSvg) {
    return new Response(badge, {
      headers: { ...EMBED_HEADERS, "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  }
  const href = data.showScore ? data.profileUrl : data.rateUrl;
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>RateThatJob Index</title><style>html,body{margin:0;background:transparent}a{display:inline-block;line-height:0}</style></head><body><a href="${href}" target="_blank" rel="noopener">${badge}</a></body></html>`;
  return new Response(html, {
    headers: { ...EMBED_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}
