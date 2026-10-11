import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

// Country and language names from Intl.DisplayNames that never throw: only our own locales
// (anything else, e.g. "wp-login.php" from a bot hitting /[locale], falls back to the default)
// and only well-formed codes. Unknown codes come back as the code itself (or the fallback).

const safeLocale = (locale: string) => (hasLocale(routing.locales, locale) ? locale : routing.defaultLocale);

const cache = new Map<string, Intl.DisplayNames>();
function names(locale: string, type: "region" | "language") {
  const key = `${safeLocale(locale)}:${type}`;
  let n = cache.get(key);
  if (!n) {
    n = new Intl.DisplayNames([safeLocale(locale)], { type });
    cache.set(key, n);
  }
  return n;
}

/** "HU" → "Hungary" / "Magyarország". */
export function regionName(code: string | null | undefined, locale: string, fallback?: string): string {
  const upper = (code ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return fallback ?? upper;
  try {
    return names(locale, "region").of(upper) ?? fallback ?? upper;
  } catch {
    return fallback ?? upper;
  }
}

/** "de" → "German" / "német". */
export function languageName(code: string | null | undefined, locale: string): string {
  const value = code ?? "";
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(value)) return value;
  try {
    return names(locale, "language").of(value) ?? value;
  } catch {
    return value;
  }
}
