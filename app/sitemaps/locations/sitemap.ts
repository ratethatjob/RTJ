import type { MetadataRoute } from "next";
import { getProfiledLocationIds, getSitemapLocations } from "@/lib/data";
import { entry, SITEMAP_CHUNK } from "@/lib/sitemap";

// Indexable locations only: a published review or an employer-filled profile (the same rule as the
// page's robots tag). The /reviews list only with reviews.
async function indexable() {
  const profiled = await getProfiledLocationIds();
  return (await getSitemapLocations()).filter((l) => l.reviewCount > 0 || profiled.has(l.id));
}

export async function generateSitemaps() {
  const count = Math.max(1, Math.ceil((await indexable()).length / SITEMAP_CHUNK));
  return Array.from({ length: count }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const start = Number(await props.id) * SITEMAP_CHUNK;
  return (await indexable()).slice(start, start + SITEMAP_CHUNK).flatMap((l) => [
    entry(`/${l.companySlug}/${l.slug}`, l.updatedAt),
    ...(l.reviewCount > 0 ? [entry(`/${l.companySlug}/${l.slug}/reviews`, l.updatedAt)] : []),
  ]);
}
