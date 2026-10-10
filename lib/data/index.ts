import { cacheLife, cacheTag } from "next/cache";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { sampleLocations, sampleReviews } from "./sample";
import { applyReviewFilter, publicClient, toLocation, toReview } from "./supabase";
import type { Category, LocationSummary, Review, ReviewFilter } from "./types";

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
  cacheTag(`location:${companySlug}/${locationSlug}`, "locations");
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
  cacheTag("locations");
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

export async function getCompany(
  slug: string,
): Promise<{ name: string; slug: string; locations: LocationSummary[] } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`company:${slug}`, "locations");
  let locations: LocationSummary[];
  if (!useSupabase) {
    locations = sampleLocations.filter((l) => l.companySlug === slug);
  } else {
    const { data, error } = await publicClient()
      .from("public_locations")
      .select("*")
      .eq("company_slug", slug)
      .order("review_count", { ascending: false })
      .limit(500);
    if (error) throw error;
    locations = data.map(toLocation);
  }
  return locations.length
    ? { name: locations[0].companyName, slug, locations }
    : null;
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
  cacheTag("locations");
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

const CATEGORY_KEYS = ["restaurant", "retail", "warehouse", "factory", "office"] as const;

export function isCategory(value: unknown): value is Category {
  return CATEGORY_KEYS.includes(value as Category);
}

/** Search page: workplace name, where (city/street/area) and category. */
export async function findLocations(
  q: string,
  where: string,
  category: Category | null,
): Promise<LocationSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("locations");
  const term = q.trim().toLowerCase();
  const place = where.trim().toLowerCase();
  if (!useSupabase) {
    return sampleLocations.filter(
      (l) =>
        (!term || `${l.name} ${l.companyName}`.toLowerCase().includes(term)) &&
        (!place || `${l.address} ${l.city}`.toLowerCase().includes(place)) &&
        (!category || l.category === category),
    );
  }
  // Escape LIKE wildcards and PostgREST filter syntax characters.
  const safe = (s: string) => s.replace(/[%_\\,()]/g, " ");
  let query = publicClient().from("public_locations").select("*");
  if (term) query = query.or(`name.ilike.%${safe(term)}%,company_name.ilike.%${safe(term)}%`);
  if (place) query = query.or(`city.ilike.%${safe(place)}%,address.ilike.%${safe(place)}%`);
  if (category) query = query.eq("category", category);
  const { data, error } = await query.order("review_count", { ascending: false }).limit(50);
  if (error) throw error;
  return data.map(toLocation);
}

/** City hub: all workplaces in a city, optionally one category. */
export async function getCity(
  citySlug: string,
  category: Category | null,
): Promise<{ name: string; locations: LocationSummary[] } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("locations");
  let locations: LocationSummary[];
  if (!useSupabase) {
    locations = sampleLocations.filter((l) => l.citySlug === citySlug);
  } else {
    const { data, error } = await publicClient()
      .from("public_locations")
      .select("*")
      .eq("city_slug", citySlug)
      .order("review_count", { ascending: false })
      .limit(500);
    if (error) throw error;
    locations = data.map(toLocation);
  }
  if (!locations.length) return null;
  return {
    name: locations[0].city,
    locations: category ? locations.filter((l) => l.category === category) : locations,
  };
}

export type SitemapLocation = {
  companySlug: string;
  slug: string;
  city: string;
  citySlug: string;
  category: Category;
  reviewCount: number;
  isSeeded: boolean;
  updatedAt: string;
};

/** Every workplace for the XML sitemaps. */
export async function getSitemapLocations(): Promise<SitemapLocation[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("locations");
  if (!useSupabase) {
    return sampleLocations.map((l) => ({
      companySlug: l.companySlug,
      slug: l.slug,
      city: l.city,
      citySlug: l.citySlug,
      category: l.category,
      reviewCount: l.scores?.reviewCount ?? 0,
      isSeeded: false,
      updatedAt: "",
    }));
  }
  const rows: SitemapLocation[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await publicClient()
      .from("public_locations")
      .select("*")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data) {
      // Demo data stays out of sitemaps.
      if (r.is_demo) continue;
      rows.push({
        companySlug: r.company_slug,
        slug: r.slug,
        city: r.city,
        citySlug: r.city_slug,
        category: r.category,
        reviewCount: r.review_count,
        isSeeded: r.is_seeded,
        updatedAt: [r.updated_at, r.scores_updated_at].filter(Boolean).sort().at(-1) ?? r.updated_at,
      });
    }
    if (data.length < 1000) return rows;
  }
}

export type LocationProfile = {
  about: string | null;
  website: string | null;
  benefits: string[];
  photos: string[];
};

/** Employer-written profile (about, benefits, website, photo URLs). */
export async function getLocationProfile(locationId: string): Promise<LocationProfile | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`profile:${locationId}`);
  if (!useSupabase) return null;
  const { data, error } = await publicClient()
    .from("location_profiles")
    .select("about, website, benefits, photos")
    .eq("location_id", locationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    photos: (data.photos as string[]).map(
      (p) => `${supabaseUrl}/storage/v1/object/public/profile-photos/${p}`,
    ),
  };
}

/** Similar workplaces in the same city: same category first, best rated first. */
export async function getNearbyLocations(location: LocationSummary): Promise<LocationSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("locations");
  if (!useSupabase) {
    return sampleLocations.filter((l) => l.citySlug === location.citySlug && l.id !== location.id).slice(0, 4);
  }
  const { data, error } = await publicClient()
    .from("public_locations")
    .select("*")
    .eq("city_slug", location.citySlug)
    .neq("id", location.id)
    .order("review_count", { ascending: false })
    .limit(30);
  if (error) throw error;
  const rows = data.map(toLocation);
  return [
    ...rows.filter((l) => l.category === location.category),
    ...rows.filter((l) => l.category !== location.category),
  ].slice(0, 4);
}
