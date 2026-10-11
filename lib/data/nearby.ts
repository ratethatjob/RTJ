import { cacheLife, cacheTag } from "next/cache";
import { getFeaturedLocations } from "./index";
import { findJobsIn } from "./jobs";
import { publicClient, toLocation } from "./supabase";
import { sampleLocations } from "./sample";
import type { Job, LocationSummary } from "./types";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

const useSupabase = Boolean(supabaseUrl && supabaseKey);

export type NearbyScope = "city" | "country" | "all";
export type Nearby = { scope: NearbyScope; locations: LocationSummary[]; jobs: Job[] };

/** Workplaces and open jobs for the home page's "near you" section: the city first, then the
 *  country, then everything – never an empty section. Cached per city/country. */
export async function getNearby(citySlugs: string[], country: string | null): Promise<Nearby> {
  "use cache";
  cacheLife("hours");
  cacheTag("locations", "jobs");
  if (citySlugs.length) {
    const [locations, jobs] = await Promise.all([locationsWhere("city_slug", citySlugs), findJobsIn("city_slug", citySlugs)]);
    if (locations.length || jobs.length) return { scope: "city", locations, jobs };
  }
  if (country) {
    const [locations, jobs] = await Promise.all([locationsWhere("country", [country]), findJobsIn("country", [country])]);
    if (locations.length || jobs.length) return { scope: "country", locations, jobs };
  }
  const [locations, jobs] = await Promise.all([getFeaturedLocations(), findJobsIn(null, [])]);
  return { scope: "all", locations: locations.slice(0, 6), jobs };
}

async function locationsWhere(column: "city_slug" | "country", values: string[]): Promise<LocationSummary[]> {
  if (!useSupabase) {
    return sampleLocations
      .filter((l) => values.includes(column === "city_slug" ? l.citySlug : l.country))
      .slice(0, 6);
  }
  const { data, error } = await publicClient()
    .from("public_locations")
    .select("*")
    .in(column, values)
    .order("review_count", { ascending: false })
    .limit(6);
  if (error) throw error;
  return data.map(toLocation);
}
