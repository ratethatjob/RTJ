import { routing } from "@/i18n/routing";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ratethatjob.com";

/** Canonical + hreflang alternates for a locale-less path like "/joes-pizzeria/w-46th-st". */
export function localeAlternates(path: string, locale: string) {
  const href = (l: string) =>
    l === routing.defaultLocale ? path || "/" : `/${l}${path === "/" ? "" : path}`;
  return {
    canonical: href(locale),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, href(l)])),
      "x-default": href(routing.defaultLocale),
    },
  };
}
