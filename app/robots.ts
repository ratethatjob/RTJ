import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Trailing slashes so company slugs like "applebees" stay crawlable.
  const pages = ["/app/", "/business/", "/admin/", "/r/"];
  return {
    rules: {
      userAgent: "*",
      // Share images live under /api/og: crawlers of social sites must be able to fetch them.
      allow: ["/", "/api/og"],
      disallow: [...pages, ...pages.map((p) => `/hu${p}`), "/embed/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
