import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ratethatjob.com";
export const SITE_NAME = "RateThatJob";

/** EmployerAggregateRating only from this many published reviews (the Index shows a score from 5 too). */
export const RATING_LD_MIN_REVIEWS = 5;

const OG_LOCALES: Record<string, string> = { en: "en_US", hu: "hu_HU" };

/** Locale-prefixed path: "/" for English, "/hu/…" for Hungarian. */
export function localePath(path: string, locale: string) {
  return locale === routing.defaultLocale ? path || "/" : `/${locale}${path === "/" ? "" : path}`;
}

/** Canonical + hreflang alternates for a locale-less path like "/joes-pizzeria/w-46th-st". */
export function localeAlternates(path: string, locale: string) {
  return {
    canonical: localePath(path, locale),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, localePath(path, l)])),
      "x-default": localePath(path, routing.defaultLocale),
    },
  };
}

export type OgKind =
  | "home"
  | "employers"
  | "index"
  | "careers"
  | "jobs"
  | "job"
  | "location"
  | "company"
  | "city"
  | "sample";

/** Branded 1200×630 share image from app/api/og/route.tsx (resolved against metadataBase). */
export function ogImage(kind: OgKind, locale: string, params: Record<string, string> = {}) {
  return `/api/og?${new URLSearchParams({ k: kind, l: locale, ...params })}`;
}

/** Title, description, canonical + hreflang, Open Graph and the large Twitter card for one page. */
export function pageMeta({
  locale,
  path,
  title,
  shareTitle,
  description,
  image,
  noindex,
}: {
  locale: string;
  path: string;
  /** <title>, usually ending in "| RateThatJob". */
  title: string;
  /** og:title without the site name (defaults to the title without " | RateThatJob"). */
  shareTitle?: string;
  description: string;
  image: string;
  noindex?: boolean;
}): Metadata {
  const alternates = localeAlternates(path, locale);
  const share = shareTitle ?? title.replace(/ \| RateThatJob$/, "");
  return {
    title,
    description,
    alternates,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: alternates.canonical,
      title: share,
      description,
      locale: OG_LOCALES[locale] ?? locale,
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALES[l] ?? l),
      images: [{ url: image, width: 1200, height: 630, alt: share }],
    },
    twitter: { card: "summary_large_image" },
    ...(noindex && { robots: { index: false, follow: true } }),
  };
}

/** schema.org BreadcrumbList from [name, locale-less path] pairs, home first. */
export function breadcrumbLd(locale: string, items: [string, string][]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [[SITE_NAME, "/"] as [string, string], ...items].map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: `${SITE_URL}${localePath(path, locale)}`,
    })),
  };
}

/** <script type="application/ld+json"> body for a list of schema.org nodes. */
export function ldJson(...graph: object[]) {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}
