import { cacheLife, cacheTag } from "next/cache";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { sampleLocations, sampleReviews } from "./sample";
import { applyReviewFilter, publicClient, toLocation, toReview } from "./supabase";
import type { LocationSummary, Review, ReviewFilter } from "./types";

// Data access for public pages. Reads the Supabase public_* views when the
// project is configured, otherwise falls back to the sample data.
const useSupabase = Boolean(supabaseUrl && supabaseKey);

export const REVIEWS_PER_PAGE = 10;

export async function getLocation(
  companySlug: string,
  locationSlug: string,
): Promise<LocationSummary | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`location:${companySlug}/${locationSlug}`);
  if (!useSupabase) {
    return (
      sampleLocations.find(
        (l) => l.companySlug === companySlug && l.slug === locationSlug,
      ) ?? null
    );
  }
  const { data, error } = await publicClient()
    .from("public_locations")
    .select("*")
    .eq("company_slug", companySlug)
    .eq("slug", locationSlug)
    .maybeSingle();
  if (error) throw error;
  return data && toLocation(data);
}

export async function getLocationById(id: string): Promise<LocationSummary | null> {
  "use cache";
  cacheLife("hours");
  if (!useSupabase) return sampleLocations.find((l) => l.id === id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await publicClient()
    .from("public_locations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data && toLocation(data);
}

export async function searchLocations(q: string): Promise<LocationSummary[]> {
  "use cache";
  cacheLife("minutes");
  const term = q.trim().toLowerCase();
  if (!term) return [];
  if (!useSupabase) {
    return sampleLocations.filter((l) =>
      `${l.name} ${l.address} ${l.city}`.toLowerCase().includes(term),
    );
  }
  // Escape LIKE wildcards and PostgREST filter syntax characters.
  const safe = term.replace(/[%_\\,()]/g, " ");
  const { data, error } = await publicClient()
    .from("public_locations")
    .select("*")
    .or(`name.ilike.%${safe}%,company_name.ilike.%${safe}%,address.ilike.%${safe}%`)
    .order("review_count", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data.map(toLocation);
}

export async function getLocationPaths() {
  "use cache";
  cacheLife("hours");
  if (!useSupabase) {
    return sampleLocations.map((l) => ({ company: l.companySlug, location: l.slug }));
  }
  // Prerender the most reviewed locations; the rest render on first visit.
  const { data, error } = await publicClient()
    .from("public_locations")
    .select("company_slug, slug")
    .order("review_count", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const paths = data.map((l) => ({ company: l.company_slug, location: l.slug }));
  // Cache Components needs at least one param at build time; this one 404s.
  return paths.length ? paths : [{ company: "_", location: "_" }];
}

export async function getFeaturedLocations(): Promise<LocationSummary[]> {
  "use cache";
  cacheLife("hours");
  if (!useSupabase) return sampleLocations.filter((l) => l.scores).slice(0, 4);
  const { data, error } = await publicClient()
    .from("public_locations")
    .select("*")
    .gt("review_count", 0)
    .order("scores_updated_at", { ascending: false })
    .limit(4);
  if (error) throw error;
  return data.map(toLocation);
}

export async function getReviews(
  locationId: string,
  filter: ReviewFilter = "all",
  page = 1,
): Promise<{ reviews: Review[]; total: number }> {
  "use cache";
  cacheLife("hours");
  cacheTag(`reviews:${locationId}`);
  const start = (page - 1) * REVIEWS_PER_PAGE;

  if (!useSupabase) {
    const all = (sampleReviews[locationId] ?? [])
      .filter((r) => {
        switch (filter) {
          case "verified":
            return r.verification !== "none";
          case "permanent":
          case "temporary":
            return r.workType === filter && r.relationship !== "applicant";
          case "applicants":
            return r.relationship === "applicant";
          default:
            return true;
        }
      })
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return { reviews: all.slice(start, start + REVIEWS_PER_PAGE), total: all.length };
  }

  const query = publicClient()
    .from("public_reviews")
    .select("*", { count: "exact" })
    .eq("location_id", locationId);
  const { data, error, count } = await applyReviewFilter(query, filter)
    .order("published_at", { ascending: false })
    .range(start, start + REVIEWS_PER_PAGE - 1);
  if (error) throw error;
  return { reviews: data.map(toReview), total: count ?? 0 };
}
