import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReviewCard } from "@/components/review-card";
import {
  CategoryScores,
  FactBars,
  GhostingMeter,
  ScoreTile,
} from "@/components/scores";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { getLocation, getLocationPaths, getReviews } from "@/lib/data";
import type { LocationSummary } from "@/lib/data/types";
import { locationPath } from "@/lib/format";
import { locationMetadata } from "@/lib/location-meta";
import { SITE_URL } from "@/lib/seo";

type Props = PageProps<"/[locale]/[company]/[location]">;

export async function generateStaticParams() {
  return getLocationPaths();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, company, location } = await params;
  const data = await getLocation(company, location);
  if (!data) return {};
  const meta = await locationMetadata(data, locale, locationPath(data));
  // Thin pages without reviews or seeded data stay out of the index.
  return data.scores ? meta : { ...meta, robots: { index: false } };
}

// Blocking (not streamed) so unknown slugs get a real 404 status.
export const instant = false;

export default async function LocationPage({ params }: Props) {
  const { locale, company, location } = await params;
  setRequestLocale(locale);
  const data = await getLocation(company, location);
  if (!data) notFound();

  const t = await getTranslations("Location");
  const tc = await getTranslations("Categories");
  const tr = await getTranslations("Reviews");
  const { reviews } = await getReviews(data.id);
  const s = data.scores;
  const path = locationPath(data);
  const rateHref = `/app/rate/${data.id}`;

  return (
    <>
    <SiteHeader withSearch />
    <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 lg:pb-16 lg:pt-6">
      <JsonLd location={data} locale={locale} />

      <section className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-row-reverse items-start justify-between gap-4 lg:flex-row lg:items-center lg:justify-start lg:gap-7">
          {s && <ScoreTile score={s.overall} />}
          <div>
            <h1 className="text-4xl font-black leading-tight tracking-brand lg:text-6xl">
              {data.name}
            </h1>
            <p className="text-lg text-slate">
              {data.address}, {data.city} · {tc(data.category)}
              {data.legalEntityName && (
                <>
                  <span className="lg:hidden">
                    <br />
                  </span>
                  <span className="hidden lg:inline"> · </span>
                  {t("operatedBy", { entity: data.legalEntityName })}
                </>
              )}
            </p>
            {s && (
              <p className="mt-1 hidden text-slate lg:block">
                {t("last12Months")} · {t("reviewCount", { count: s.reviewCount })} ·{" "}
                <strong className="font-black text-ink">
                  {t("verifiedCount", { count: s.verifiedCount })}
                </strong>
              </p>
            )}
          </div>
        </div>
        {s && (
          <p className="text-slate lg:hidden">
            {t("last12Months")} · {t("reviewCount", { count: s.reviewCount })} ·{" "}
            <strong className="font-black text-ink">
              {t("verifiedCount", { count: s.verifiedCount })}
            </strong>
          </p>
        )}
        <div className="hidden gap-3 lg:flex">
          <Link
            href="/app/sign-in"
            className="rounded-2xl border-2 border-ink px-7 py-4 text-lg font-black"
          >
            {t("follow")}
          </Link>
          <Link
            href={rateHref}
            className="rounded-2xl bg-ink px-7 py-4 text-lg font-black text-paper"
          >
            {t("rateThisJob")}
          </Link>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <aside className="flex flex-col gap-4 lg:order-2">
          {s ? (
            <>
              <FactBars facts={s.facts} />
              {s.replyRate != null && (
                <GhostingMeter replyRate={s.replyRate} avgReplyDays={s.avgReplyDays} />
              )}
              <CategoryScores scores={s} />
            </>
          ) : (
            <section className="rounded-3xl bg-white p-6">
              <h2 className="text-2xl font-black tracking-brand">{t("noReviewsTitle")}</h2>
              <p className="mt-2 text-slate">{t("noReviewsBody")}</p>
              <Link
                href={rateHref}
                className="mt-4 inline-block rounded-2xl bg-ink px-6 py-3 font-black text-paper"
              >
                {t("beTheFirst")}
              </Link>
            </section>
          )}
          {!data.claimed && (
            <section className="rounded-3xl border-2 border-dashed border-mist/60 p-6">
              <h2 className="text-xl font-black">{t("claimTitle")}</h2>
              <p className="mt-2 text-slate">{t("claimBody")}</p>
              <Link
                href="/employers"
                className="mt-4 inline-block font-black underline underline-offset-4"
              >
                {t("claimCta")}
              </Link>
            </section>
          )}
        </aside>

        {reviews.length > 0 && (
          <section id="reviews" className="flex flex-col gap-4 lg:order-1">
            <nav className="hidden flex-wrap gap-3 lg:flex">
              {(["all", "verified", "permanent", "temporary", "applicants"] as const).map(
                (f) => (
                  <Link
                    key={f}
                    href={{
                      pathname: `${path}/reviews`,
                      query: f === "all" ? {} : { filter: f },
                    }}
                    className={`rounded-full px-5 py-3 font-black ${
                      f === "all" ? "bg-ink text-paper" : "border border-mist/60"
                    }`}
                  >
                    {tr(`filters.${f}`)}
                  </Link>
                ),
              )}
            </nav>
            {reviews.slice(0, 3).map((r) => (
              <ReviewCard key={r.id} review={r} companyName={data.companyName} />
            ))}
            <Link
              href={`${path}/reviews`}
              className="self-start font-black underline underline-offset-4"
            >
              {t("seeAllReviews")}
            </Link>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 grid grid-cols-2 gap-3 bg-paper/95 p-4 backdrop-blur lg:hidden">
        <Link
          href={`${path}/reviews`}
          className="rounded-2xl border-2 border-ink py-4 text-center text-lg font-black"
        >
          {t("readReviews")}
        </Link>
        <Link
          href={rateHref}
          className="rounded-2xl bg-ink py-4 text-center text-lg font-black text-paper"
        >
          {t("rateThisJob")}
        </Link>
      </div>
    </main>
    </>
  );
}

function JsonLd({ location, locale }: { location: LocationSummary; locale: string }) {
  const prefix = locale === "en" ? "" : `/${locale}`;
  const url = `${SITE_URL}${prefix}${locationPath(location)}`;
  const graph: object[] = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "RateThatJob", item: `${SITE_URL}${prefix || "/"}` },
        { "@type": "ListItem", position: 2, name: `${location.name} (${location.address})`, item: url },
      ],
    },
  ];
  if (location.scores) {
    graph.push({
      "@type": "EmployerAggregateRating",
      itemReviewed: {
        "@type": "Organization",
        name: location.name,
        ...(location.legalEntityName && { legalName: location.legalEntityName }),
        address: {
          "@type": "PostalAddress",
          streetAddress: location.address,
          addressLocality: location.city,
          addressCountry: location.country,
        },
        url,
      },
      ratingValue: location.scores.overall,
      ratingCount: location.scores.reviewCount,
      bestRating: 5,
      worstRating: 1,
    });
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(
          /</g,
          "\\u003c",
        ),
      }}
    />
  );
}
