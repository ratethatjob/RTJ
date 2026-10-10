import type { LocationSummary, Review } from "./data/types";

export function initials(displayName: string) {
  const words = displayName.split(/[\s_]+/).filter((w) => /^\p{L}/u.test(w));
  return (words.length > 1 ? words[0][0] + words[1][0] : displayName.slice(0, 2))
    .toUpperCase();
}

export function periodLabel(review: Review) {
  const start = review.periodStart.slice(0, 4);
  const end = review.periodEnd?.slice(0, 4);
  if (review.relationship === "applicant" || !end || end === start) {
    return review.relationship === "current" ? `${start}–` : start;
  }
  return `${start}–${end}`;
}

/** Whole weeks an applicant waited without a reply before posting. */
export function weeksWaited(review: Review) {
  const ms = Date.parse(review.publishedAt) - Date.parse(review.periodStart);
  return Math.max(0, Math.floor(ms / (7 * 24 * 3600 * 1000)));
}

export function locationPath(l: Pick<LocationSummary, "companySlug" | "slug">) {
  return `/${l.companySlug}/${l.slug}`;
}
