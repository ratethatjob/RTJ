import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CategoryChips } from "@/components/category-chips";
import { Suspense } from "react";
import { NearYou, NearYouFallback } from "@/components/home/near-you";
import { LocationList } from "@/components/location-list";
import { MapResults, MapResultsFallback } from "@/components/search/map-results";
import { SiteHeader } from "@/components/site-header";
import { getPathname, Link } from "@/i18n/navigation";
import { findLocations, isCategory } from "@/lib/data";
import { placesProvider } from "@/lib/places";
import { localeAlternates } from "@/lib/seo";

type Props = PageProps<"/[locale]/search">;

export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Search" });
  // Result pages are thin duplicates of location pages: crawl links, don't index.
  return {
    title: `${t("metaTitle")} | RateThatJob`,
    alternates: localeAlternates("/search", locale),
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const where = typeof sp.where === "string" ? sp.where.slice(0, 100) : "";
  const category = isCategory(sp.category) ? sp.category : null;
  const t = await getTranslations("Search");
  const th = await getTranslations("Home");
  const searched = Boolean(q.trim() || where.trim() || category);
  const results = searched ? await findLocations(q, where, category) : [];
  // Map places too (3+ characters of a name), like the review finder.
  const provider = await placesProvider();
  const mapSearch = q.trim().length >= 3;
  const query = (c: string | null) => ({
    ...(q && { q }),
    ...(where && { where }),
    ...(c && { category: c }),
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-6 sm:px-6 lg:pt-10">
        <h1 className="text-4xl font-black tracking-brand lg:text-6xl">{t("title")}</h1>
        <form
          action={getPathname({ href: "/search", locale })}
          role="search"
          className="flex max-w-3xl flex-col rounded-3xl border border-mist/40 bg-white p-3 sm:flex-row sm:items-center sm:p-2"
        >
          <label className="flex flex-1 flex-col px-4 py-2">
            <span className="text-sm font-black text-slate">{th("workplace")}</span>
            <input
              name="q"
              defaultValue={q}
              placeholder={th("workplacePlaceholder")}
              className="bg-transparent text-lg outline-none"
            />
          </label>
          <span className="mx-1 h-px bg-[#E8E6E1] sm:h-10 sm:w-px" />
          <label className="flex flex-1 flex-col px-4 py-2">
            <span className="text-sm font-black text-slate">{th("where")}</span>
            <input
              name="where"
              defaultValue={where}
              placeholder={th("wherePlaceholder")}
              className="bg-transparent text-lg outline-none"
            />
          </label>
          {category && <input type="hidden" name="category" value={category} />}
          <button type="submit" className="mt-2 rounded-2xl bg-ink px-8 py-4 text-lg font-black text-paper sm:mt-0">
            {th("search")}
          </button>
        </form>

        <CategoryChips
          active={category}
          href={(c) => ({ pathname: "/search", query: query(c) })}
          lead={
            <li className="shrink-0">
              <Link
                href={{ pathname: "/search", query: query(null) }}
                aria-current={category === null ? "page" : undefined}
                className={`inline-block rounded-full px-5 py-2.5 font-black ${
                  category === null ? "bg-ink text-paper" : "border border-mist/60"
                }`}
              >
                {t("all")}
              </Link>
            </li>
          }
        />

        {searched && (results.length > 0 || !mapSearch) && (
          <>
            <p className="font-black text-slate">{t("results", { count: results.length })}</p>
            <LocationList locations={results} />
          </>
        )}
        {mapSearch && provider && (
          <Suspense fallback={<MapResultsFallback />}>
            <MapResults
              q={q}
              where={where}
              provider={provider}
              own={{ ids: results.map((l) => l.id), keys: results.map((l) => `${l.name} ${l.address}`) }}
            />
          </Suspense>
        )}
        {!searched && (
          // Nothing typed yet: popular places near the visitor instead of an empty page.
          <Suspense fallback={<NearYouFallback />}>
            <NearYou locale={locale} />
          </Suspense>
        )}
        <Link href="/app/rate/new" className="font-black underline underline-offset-4">
          {t("addMissing")}
        </Link>
      </main>
    </>
  );
}
