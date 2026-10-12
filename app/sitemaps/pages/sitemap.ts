import type { MetadataRoute } from "next";
import { getProfiledLocationIds, getSitemapLocations, type SitemapLocation } from "@/lib/data";
import { getAllJobs } from "@/lib/data/jobs";
import { CATEGORY_SLUGS } from "@/lib/format";
import { entry } from "@/lib/sitemap";

// Home, marketing pages, open jobs, and company pages and city hubs with at least one indexable
// workplace (a published review or an employer-filled profile).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const profiled = await getProfiledLocationIds();
  const rated = (await getSitemapLocations()).filter((l) => l.reviewCount > 0 || profiled.has(l.id));
  const latest = (key: (l: SitemapLocation) => string) => {
    const map = new Map<string, string>();
    for (const l of rated) {
      const k = key(l);
      if (!map.has(k) || map.get(k)! < l.updatedAt) map.set(k, l.updatedAt);
    }
    return [...map];
  };
  // public_jobs holds open jobs only: closed ones and ads past their closing day are left out.
  const jobs = (await getAllJobs()).filter((j) => !j.isDemo);
  return [
    entry("/"),
    entry("/employers"),
    entry("/jobs"),
    entry("/pricing"),
    entry("/about"),
    entry("/ratethatjob-index"),
    entry("/careers-hub"),
    ...jobs.map((j) =>
      entry(`/${j.location.companySlug}/${j.location.slug}/jobs/${j.id}`, j.updatedAt),
    ),
    ...latest((l) => `/${l.companySlug}`).map(([path, at]) => entry(path, at)),
    ...latest((l) => `/city/${l.citySlug}`).map(([path, at]) => entry(path, at)),
    ...latest((l) => `/city/${l.citySlug}/${CATEGORY_SLUGS[l.category]}`).map(([path, at]) => entry(path, at)),
  ];
}
