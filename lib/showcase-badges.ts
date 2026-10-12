import { cacheLife } from "next/cache";
import { badgeLabels, renderBadge, renderSeal } from "./rtj-index";
import { SITE_URL } from "./seo";
import { SHOWCASE } from "./showcase";

/** RateThatJob Index badges of the sample workplace (the seal carries the current year). */
export async function showcaseBadges(locale: string) {
  "use cache";
  cacheLife("days");
  const index = { location: SHOWCASE, active: true, showScore: true, profileUrl: SITE_URL, rateUrl: SITE_URL };
  const labels = await badgeLabels(locale, index);
  return {
    wide: renderBadge("wide-light", index, labels),
    compact: renderBadge("compact-dark", index, labels),
    seal: renderSeal(index, labels),
  };
}
