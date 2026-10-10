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

/** Same rules as public.slugify(): ASCII, lowercase, hyphens ("Budapest" → "budapest"). */
export function slugify(value: string) {
  return value
    .replace(/['’]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** URL segment for a category on city hubs: /city/budapest/restaurants. */
export const CATEGORY_SLUGS = {
  restaurant: "restaurants",
  retail: "retail",
  warehouse: "warehouses",
  factory: "factories",
  office: "offices",
} as const;

export function categoryFromSlug(slug: string) {
  const entry = Object.entries(CATEGORY_SLUGS).find(([, s]) => s === slug);
  return entry ? (entry[0] as keyof typeof CATEGORY_SLUGS) : null;
}
