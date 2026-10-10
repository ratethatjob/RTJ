import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "./seo";

export const SITEMAP_CHUNK = 20000;

/** One sitemap entry per locale-less path, with hreflang alternates. */
export function entry(path: string, lastModified?: string): MetadataRoute.Sitemap[number] {
  const href = (l: string) =>
    `${SITE_URL}${l === routing.defaultLocale ? "" : `/${l}`}${path === "/" && l !== routing.defaultLocale ? "" : path}`;
  return {
    url: href(routing.defaultLocale),
    ...(lastModified && { lastModified }),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, href(l)])) },
  };
}
