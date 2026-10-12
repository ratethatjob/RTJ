import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatScore } from "@/components/scores";
import { DemoBanner } from "@/components/demo-badge";
import { SiteHeader } from "@/components/site-header";
import { getPathname, Link } from "@/i18n/navigation";
import { getCompany, getLocationPaths, getProfiledLocationIds } from "@/lib/data";
import type { LocationSummary } from "@/lib/data/types";
import { locationPath } from "@/lib/format";
import { findRedirect } from "@/lib/data/redirects";
import { breadcrumbLd, ldJson, ogImage, pageMeta, RATING_LD_MIN_REVIEWS, SITE_URL, localePath } from "@/lib/seo";
import { kindLabel } from "@/lib/place-types";

type Props = PageProps<"/[locale]/[company]">;

// Blocking so unknown slugs get a real 404 status.
export const instant = false;

export async function generateStaticParams() {
  const paths = await getLocationPaths();
  return [...new Set(paths.map((p) => p.company))].map((company) => ({ company }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, company } = await params;
  const data = await getCompany(company);
  if (!data) return {};
  const t = await getTranslations({ locale, namespace: "Company" });
  const profiled = await getProfiledLocationIds();
  // Indexed when a workplace has a published review or a filled employer profile.
  const indexable = data.locations.some((l) => !l.isDemo && (l.scores || profiled.has(l.id)));
  return pageMeta({
    locale,
    path: `/${data.slug}`,
    title: `${t("metaTitle", { company: data.name })} | RateThatJob`,
    description: t("metaDescription", {
      company: data.name,
      count: data.locations.length,
      reviews: data.locations.reduce((n, l) => n + (l.scores?.reviewCount ?? 0), 0),
    }),
    image: ogImage("company", locale, { slug: data.slug }),
    noindex: !indexable,
  });
}

export default async function CompanyPage({ params }: Props) {
  const { locale, company } = await params;
  setRequestLocale(locale);
  const data = await getCompany(company);
  if (!data) {
    const to = await findRedirect(company);
    if (to) permanentRedirect(getPathname({ href: to, locale }));
    notFound();
  }
  const t = await getTranslations("Company");
  const tc = await getTranslations("Categories");
  const avg = companyAverage(data.locations);
  const demo = data.locations.every((l) => l.isDemo);

  return (
    <>
      {!demo && <CompanyJsonLd name={data.name} slug={data.slug} locale={locale} avg={avg} />}
      <SiteHeader withSearch />
      <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:pt-10">
        {demo && <DemoBanner />}
        <h1 className="text-4xl font-black tracking-brand lg:text-6xl">{data.name}</h1>
        <p className="mt-2 text-lg text-slate">{t("locations", { count: data.locations.length })}</p>
        {avg && data.locations.length > 1 && (
          <p className="mt-1 font-black">{t("average", { score: await formatScore(avg.value), count: avg.count })}</p>
        )}
        <ul className="mt-8 grid gap-3 lg:grid-cols-2">
          {await Promise.all(
            data.locations.map(async (l) => (
              <li key={l.id}>
                <Link
                  href={locationPath(l)}
                  className="flex items-center justify-between gap-4 rounded-3xl bg-white p-6"
                >
                  <span>
                    <span className="block text-2xl font-black tracking-brand">{l.address}</span>
                    <span className="text-slate">
                      {l.city} · {kindLabel(l.placeType, locale, tc(l.category))}
                    </span>
                  </span>
                  {l.scores ? (
                    <span
                      className={`grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-black ${
                        l.scores.overall >= 4 ? "bg-signal" : "bg-[#E8E6E1]"
                      }`}
                    >
                      {await formatScore(l.scores.overall)}
                    </span>
                  ) : (
                    <span className="shrink-0 text-sm text-slate">{t("noScore")}</span>
                  )}
                </Link>
              </li>
            )),
          )}
        </ul>
      </main>
    </>
  );
}

/** Review-weighted average of the company's rated, non-demo workplaces. */
function companyAverage(locations: LocationSummary[]) {
  const rated = locations.filter((l) => l.scores && !l.isDemo);
  const count = rated.reduce((n, l) => n + l.scores!.reviewCount, 0);
  if (!count) return null;
  return { value: rated.reduce((n, l) => n + l.scores!.overall * l.scores!.reviewCount, 0) / count, count };
}

function CompanyJsonLd({
  name,
  slug,
  locale,
  avg,
}: {
  name: string;
  slug: string;
  locale: string;
  avg: { value: number; count: number } | null;
}) {
  const graph: object[] = [breadcrumbLd(locale, [[name, `/${slug}`]])];
  // The same average is shown on the page (or, with one workplace, its own score).
  if (avg && avg.count >= RATING_LD_MIN_REVIEWS) {
    graph.push({
      "@type": "EmployerAggregateRating",
      itemReviewed: { "@type": "Organization", name, url: `${SITE_URL}${localePath(`/${slug}`, locale)}` },
      ratingValue: Math.round(avg.value * 10) / 10,
      ratingCount: avg.count,
      bestRating: 5,
      worstRating: 1,
    });
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(...graph) }} />;
}
