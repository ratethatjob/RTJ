import { cacheLife, cacheTag } from "next/cache";
import { sampleLocations, sampleReviews } from "./sample";
import type { LocationSummary, Review, ReviewFilter } from "./types";

// Data access for public pages. Backed by sample data for now; swap the
// bodies for Supabase queries against the public views when connected.

export async function getLocation(
  companySlug: string,
  locationSlug: string,
): Promise<LocationSummary | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`location:${companySlug}/${locationSlug}`);
  return (
    sampleLocations.find(
      (l) => l.companySlug === companySlug && l.slug === locationSlug,
    ) ?? null
  );
}

export async function getLocationPaths() {
  "use cache";
  cacheLife("hours");
  return sampleLocations.map((l) => ({
    company: l.companySlug,
    location: l.slug,
  }));
}

export async function getFeaturedLocations(): Promise<LocationSummary[]> {
  "use cache";
  cacheLife("hours");
  return sampleLocations.filter((l) => l.scores).slice(0, 4);
}

export const REVIEWS_PER_PAGE = 10;

export async function getReviews(
  locationId: string,
  filter: ReviewFilter = "all",
  page = 1,
): Promise<{ reviews: Review[]; total: number }> {
  "use cache";
  cacheLife("hours");
  cacheTag(`reviews:${locationId}`);
  const all = (sampleReviews[locationId] ?? [])
    .filter((r) => {
      switch (filter) {
        case "verified":
          return r.verification !== "none";
        case "permanent":
          return r.workType === "permanent" && r.relationship !== "applicant";
        case "temporary":
          return r.workType === "temporary" && r.relationship !== "applicant";
        case "applicants":
          return r.relationship === "applicant";
        default:
          return true;
      }
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const start = (page - 1) * REVIEWS_PER_PAGE;
  return {
    reviews: all.slice(start, start + REVIEWS_PER_PAGE),
    total: all.length,
  };
}
