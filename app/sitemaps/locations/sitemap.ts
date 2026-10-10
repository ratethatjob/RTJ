import type { MetadataRoute } from "next";
import { getSitemapLocations } from "@/lib/data";
import { entry, SITEMAP_CHUNK } from "@/lib/sitemap";

// Only rated locations are indexable; the rest are noindex until their first review.
async function rated() {
  return (await getSitemapLocations()).filter((l) => l.reviewCount > 0);
}

export async function generateSitemaps() {
  const count = Math.max(1, Math.ceil((await rated()).length / SITEMAP_CHUNK));
  return Array.from({ length: count }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const start = Number(await props.id) * SITEMAP_CHUNK;
  return (await rated()).slice(start, start + SITEMAP_CHUNK).flatMap((l) => [
    entry(`/${l.companySlug}/${l.slug}`, l.updatedAt),
    entry(`/${l.companySlug}/${l.slug}/reviews`, l.updatedAt),
  ]);
}
