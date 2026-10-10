import type { MetadataRoute } from "next";
import { getSitemapLocations, type SitemapLocation } from "@/lib/data";
import { CATEGORY_SLUGS } from "@/lib/format";
import { entry } from "@/lib/sitemap";

// Home, employers, company pages and city hubs that have at least one rated workplace.
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
  return [
    entry("/"),
    entry("/employers"),
    ...latest((l) => `/${l.companySlug}`).map(([path, at]) => entry(path, at)),
    ...latest((l) => `/city/${l.citySlug}`).map(([path, at]) => entry(path, at)),
    ...latest((l) => `/city/${l.citySlug}/${CATEGORY_SLUGS[l.category]}`).map(([path, at]) => entry(path, at)),
  ];
}
