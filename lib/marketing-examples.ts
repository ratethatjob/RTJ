import { cacheLife } from "next/cache";
import { badgeLabels, renderBadge, renderSeal, type getIndexLocation } from "./rtj-index";
import type { LocationSummary } from "./data/types";
import { SITE_URL } from "./seo";

// Made-up sample data for the examples on the marketing pages. Always shown with an "Example" label.

type IndexData = NonNullable<Awaited<ReturnType<typeof getIndexLocation>>>;

const EXAMPLE: LocationSummary = {
  id: "00000000-0000-4000-8000-00000000e001",
  companySlug: "example",
  companyName: "Example Bistro",
  slug: "example",
  name: "Example Bistro",
  address: "Example Street 1",
  city: "Budapest",
  citySlug: "budapest",
  country: "HU",
  category: "restaurant",
  legalEntityName: null,
  claimed: true,
  scores: {
    overall: 4.4,
    manager: 4.3,
    pay: 4.1,
    schedule: 4.2,
    environment: 4.6,
    reviewCount: 32,
    verifiedCount: 14,
    facts: { paid_on_time: 91, paid_as_promised: 88, overtime_paid: 79, hours_as_promised: 84 },
    replyRate: 76,
    avgReplyDays: 3,
  },
};

const data: IndexData = { location: EXAMPLE, showScore: true, profileUrl: SITE_URL, rateUrl: SITE_URL };

/** SVG markup of example badges (text is escaped by the renderers). */
export async function exampleBadges(locale: string) {
  "use cache";
  cacheLife("days");
  const labels = await badgeLabels(locale, data);
  return {
    wide: renderBadge("wide-light", data, labels),
    compact: renderBadge("compact-dark", data, labels),
    strip: renderBadge("strip", data, labels),
    seal: renderSeal(data, labels),
  };
}
