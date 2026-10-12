import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeftIcon } from "@/components/icons";
import { ReviewCard } from "@/components/review-card";
import { DemoBanner } from "@/components/demo-badge";
import { SiteHeader } from "@/components/site-header";
import { getPathname, Link } from "@/i18n/navigation";
import { getLocation, getLocationPaths, getReviews, REVIEWS_PER_PAGE } from "@/lib/data";
import type { ReviewFilter } from "@/lib/data/types";
import { locationPath } from "@/lib/format";
import { findRedirect } from "@/lib/data/redirects";
import { localeAlternates } from "@/lib/seo";

type Props = PageProps<"/[locale]/[company]/[location]/reviews">;

const FILTERS: ReviewFilter[] = ["all", "verified", "permanent", "temporary", "applicants"];

export async function generateStaticParams() {
  return getLocationPaths();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, company, location } = await params;
  const data = await getLocation(company, location);
  if (!data) return {};
  const t = await getTranslations({ locale, namespace: "Reviews" });
  return {
    title: `${t("metaTitle", { company: data.companyName, location: data.address })} | RateThatJob`,
    alternates: localeAlternates(`${locationPath(data)}/reviews`, locale),
    // Like the location page: no index without reviews (or for demo data).
    ...((data.isDemo || !data.scores) && { robots: { index: false } }),
  };
}

// Blocking (not streamed) so unknown slugs get a real 404 status.
export const instant = false;

export default async function ReviewsPage({ params, searchParams }: Props) {
  const { locale, company, location } = await params;
  setRequestLocale(locale);
  const data = await getLocation(company, location);
  if (!data) {
    const to = await findRedirect(company, location, "/reviews");
    if (to) permanentRedirect(getPathname({ href: to, locale }));
    notFound();
  }

  const query = await searchParams;
  const filter = FILTERS.includes(query.filter as ReviewFilter)
    ? (query.filter as ReviewFilter)
    : "all";
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const { reviews, total } = await getReviews(data.id, filter, page);
  const pages = Math.max(1, Math.ceil(total / REVIEWS_PER_PAGE));

  const t = await getTranslations("Reviews");
  const tl = await getTranslations("Location");
  const tn = await getTranslations("Nav");
  const path = locationPath(data);
  const href = (f: ReviewFilter, p = 1) => ({
    pathname: `${path}/reviews`,
    query: {
      ...(f !== "all" && { filter: f }),
      ...(p > 1 && { page: String(p) }),
    },
  });

  return (
    <>
    <div className="hidden lg:block">
      <SiteHeader withSearch />
    </div>
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      {data.isDemo && <DemoBanner />}
      <header className="flex items-center gap-3">
        <Link href={path} aria-label={tn("back")} className="-ml-2 p-2">
          <ChevronLeftIcon className="size-7" />
        </Link>
        <div>
          <h1 className="text-3xl font-black leading-tight tracking-brand">{data.name}</h1>
          <p className="text-slate">
            {data.scores && `${tl("reviewCount", { count: data.scores.reviewCount })} · `}
            {data.address}
          </p>
        </div>
      </header>

      <nav className="-mx-4 mt-5 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={href(f)}
            aria-current={f === filter ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              f === filter ? "bg-ink text-paper" : "border border-mist/60"
            }`}
          >
            {t(`filters.${f === "all" ? "allShort" : f === "verified" ? "verifiedShort" : f}`)}
          </Link>
        ))}
      </nav>

      <section className="mt-5 flex flex-col gap-4">
        {reviews.length === 0 ? (
          <p className="rounded-3xl bg-white p-6 text-slate">{t("empty")}</p>
        ) : (
          reviews.map((r) => (
            <ReviewCard key={r.id} review={r} companyName={data.companyName} reportable />
          ))
        )}
      </section>

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between font-black">
          {page > 1 ? <Link href={href(filter, page - 1)}>{t("previous")}</Link> : <span />}
          <span className="text-slate">{t("pageOf", { page, pages })}</span>
          {page < pages ? <Link href={href(filter, page + 1)}>{t("next")}</Link> : <span />}
        </nav>
      )}
    </main>
    </>
  );
}
