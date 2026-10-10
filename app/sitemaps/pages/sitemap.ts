import type { MetadataRoute } from "next";
import { getSitemapLocations, type SitemapLocation } from "@/lib/data";
import { getAllJobs } from "@/lib/data/jobs";
import { CATEGORY_SLUGS } from "@/lib/format";
import { entry } from "@/lib/sitemap";

// Home, employers, jobs, company pages and city hubs that have at least one rated workplace.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rated = (await getSitemapLocations()).filter((l) => l.reviewCount > 0);
  const latest = (key: (l: SitemapLocation) => string) => {
    const map = new Map<string, string>();
    for (const l of rated) {
      const k = key(l);
      if (!map.has(k) || map.get(k)! < l.updatedAt) map.set(k, l.updatedAt);
    }
    return [...map];
  };
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
