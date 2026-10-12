import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { getIndexLocation, isTopRated, localeUrl, PUBLIC_HEADERS } from "@/lib/rtj-index";

// Public JSON for the RateThatJob Index. Scores only from 5 published reviews, and only while
// the location has Pro (trial or paid); otherwise status is "inactive".
export async function GET(request: Request, { params }: RouteContext<"/api/public/locations/[id]/index">) {
  const { id } = await params;
  const requested = new URL(request.url).searchParams.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const data = await getIndexLocation(id);
  if (!data) return Response.json({ error: "not_found" }, { status: 404, headers: PUBLIC_HEADERS });
  const { location, active, showScore, profileUrl, rateUrl } = data;
  const s = location.scores;
  return Response.json(
    {
      status: active ? "active" : "inactive",
      name: location.name,
      company: location.companyName,
      address: location.address,
      city: location.city,
      score: showScore && s ? s.overall : null,
      rating_count: s?.reviewCount ?? 0,
      verified_count: s?.verifiedCount ?? 0,
      facts: {
        paid_on_time: showScore ? (s?.facts.paid_on_time ?? null) : null,
        paid_as_promised: showScore ? (s?.facts.paid_as_promised ?? null) : null,
        overtime_paid: showScore ? (s?.facts.overtime_paid ?? null) : null,
        hours_as_promised: showScore ? (s?.facts.hours_as_promised ?? null) : null,
        reply_rate: showScore ? (s?.replyRate ?? null) : null,
        avg_reply_days: showScore ? (s?.avgReplyDays ?? null) : null,
      },
      top_rated: active && isTopRated(location),
      profile_url: localeUrl(profileUrl, locale),
      rate_url: localeUrl(rateUrl, locale),
      updated_at: location.updatedAt ?? null,
    },
    { headers: PUBLIC_HEADERS },
  );
}
