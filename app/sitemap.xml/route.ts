import { getSitemapLocations } from "@/lib/data";
import { SITE_URL } from "@/lib/seo";
import { SITEMAP_CHUNK } from "@/lib/sitemap";

// Sitemap index pointing at the per-type sitemaps.
export async function GET() {
  const rated = (await getSitemapLocations()).filter((l) => l.reviewCount > 0).length;
  const chunks = Math.max(1, Math.ceil(rated / SITEMAP_CHUNK));
  const urls = [
    `${SITE_URL}/sitemaps/pages/sitemap.xml`,
    ...Array.from({ length: chunks }, (_, i) => `${SITE_URL}/sitemaps/locations/sitemap/${i}.xml`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <sitemap><loc>${u}</loc></sitemap>`).join("\n")}
</sitemapindex>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
