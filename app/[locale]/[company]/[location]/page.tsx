import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReviewCard } from "@/components/review-card";
import {
  CategoryScores,
  FactBars,
  formatScore,
  GhostingMeter,
  ScoreTile,
} from "@/components/scores";
import { DemoBanner } from "@/components/demo-badge";
import { SiteHeader } from "@/components/site-header";
import { getPathname, Link } from "@/i18n/navigation";
import { FollowButton } from "@/components/follow-button";
import { JobCard } from "@/components/jobs/job-card";
import {
  getLocation,
  getLocationPaths,
  getLocationProfile,
  getNearbyLocations,
  getReviews,
} from "@/lib/data";
import { getLocationJobs } from "@/lib/data/jobs";
import { findRedirect } from "@/lib/data/redirects";
import type { LocationSummary } from "@/lib/data/types";
import { locationPath } from "@/lib/format";
import { locationMetadata } from "@/lib/location-meta";
import { SITE_URL } from "@/lib/seo";
import { kindLabel } from "@/lib/place-types";

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
  return data.scores && !data.isDemo ? meta : { ...meta, robots: { index: false } };
}

// Blocking (not streamed) so unknown slugs get a real 404 status.
export const instant = false;

export default async function LocationPage({ params }: Props) {
  const { locale, company, location } = await params;
  setRequestLocale(locale);
  const data = await getLocation(company, location);
  if (!data) {
    const to = await findRedirect(company, location);
    if (to) permanentRedirect(getPathname({ href: to, locale }));
    notFound();
  }

  const t = await getTranslations("Location");
  const tc = await getTranslations("Categories");
  const tr = await getTranslations("Reviews");
  const [{ reviews }, jobs, profile, nearby] = await Promise.all([
    getReviews(data.id),
    getLocationJobs(data.id),
    getLocationProfile(data.id),
    getNearbyLocations(data),
  ]);
  const s = data.scores;
  const ghosting =
    data.ghosting ??
    (s?.replyRate != null ? { replyRate: s.replyRate, avgReplyDays: s.avgReplyDays, applications: 0 } : null);
  const path = locationPath(data);
  const rateHref = `/app/rate/${data.id}`;

  return (
    <>
    <SiteHeader withSearch />
    <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:pt-6">
      {data.isDemo ? <DemoBanner /> : <JsonLd location={data} locale={locale} />}

      <section className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-row-reverse items-start justify-between gap-4 lg:flex-row lg:items-center lg:justify-start lg:gap-7">
          {s && <ScoreTile score={s.overall} />}
          <div>
            <h1 className="text-4xl font-black leading-tight tracking-brand lg:text-6xl">
              {data.name}
            </h1>
            <p className="text-lg text-slate">
              {data.address},{" "}
              <Link href={`/city/${data.citySlug}`} className="underline-offset-4 hover:underline">
                {data.city}
              </Link>{" "}
              · {kindLabel(data.placeType, locale, tc(data.category))}
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
        <div className="lg:hidden">
          <FollowButton
            locationId={data.id}
            followLabel={t("follow")}
            followingLabel={t("following")}
            className="rounded-xl border-2 border-ink px-4 py-2 text-sm font-black"
          />
        </div>
        <div className="hidden gap-3 lg:flex">
          <FollowButton
            locationId={data.id}
            followLabel={t("follow")}
            followingLabel={t("following")}
            className="rounded-xl border-2 border-ink px-5 py-2.5 text-base font-black"
          />
          <Link
            href={rateHref}
            className="rounded-xl bg-ink px-5 py-2.5 text-base font-black text-paper"
          >
            {t("rateThisJob")}
          </Link>
        </div>
      </section>

      {!s && (
        <section className="mt-6 flex flex-col items-start gap-5 rounded-[2rem] bg-ink p-6 text-paper sm:p-10">
          <h2 className="max-w-3xl text-3xl font-black leading-tight tracking-brand sm:text-5xl">{t("emptyTitle")}</h2>
          <p className="max-w-2xl text-lg text-mist">{t("emptyBody")}</p>
          <Link
            href={rateHref}
            className="w-full rounded-2xl bg-signal px-6 py-3.5 text-center text-lg font-black text-ink sm:w-auto"
          >
            {t("emptyCta")}
          </Link>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <aside className="flex flex-col gap-4 lg:order-2">
          {s && (
            <>
              <FactBars facts={s.facts} />
              {ghosting && (
                <GhostingMeter
                  replyRate={ghosting.replyRate}
                  avgReplyDays={ghosting.avgReplyDays}
                  applications={ghosting.applications}
                />
              )}
              <CategoryScores scores={s} />
            </>
          )}
          {!data.claimed && (
            <section className="rounded-3xl border-2 border-dashed border-mist/60 p-6">
              <h2 className="text-xl font-black">{t("claimTitle")}</h2>
              <p className="mt-2 text-slate">{t("claimBody")}</p>
              <Link
                href={`/business/claim/${data.id}`}
                className="mt-4 inline-block font-black underline underline-offset-4"
              >
                {t("claimCta")}
              </Link>
            </section>
          )}
        </aside>

        <div className="flex flex-col gap-6 lg:order-1">
        {profile && (profile.about || profile.benefits.length > 0 || profile.photos.length > 0) && (
          <section className="flex flex-col gap-4 rounded-3xl bg-white p-6">
            <h2 className="text-sm font-black uppercase tracking-tagline text-slate">
              {t("fromEmployer")}
            </h2>
            {profile.photos.length > 0 && (
              <div className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6">
                {profile.photos.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element -- employer photos from storage
                  <img
                    key={src}
                    src={src}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] h-44 shrink-0 snap-start rounded-2xl object-cover"
                  />
                ))}
              </div>
            )}
            {profile.about && <p className="whitespace-pre-line text-lg leading-relaxed">{profile.about}</p>}
            {profile.benefits.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {profile.benefits.map((b) => (
                  <li key={b} className="rounded-lg bg-[#EDEBE6] px-3 py-1.5 font-black">
                    {b}
                  </li>
                ))}
              </ul>
            )}
            {profile.website && (
              <a
                href={profile.website}
                rel="nofollow ugc noopener"
                target="_blank"
                className="self-start font-black underline underline-offset-4"
              >
                {t("website")}
              </a>
            )}
          </section>
        )}
        {jobs.length > 0 && (
          <section id="jobs" className="flex flex-col gap-3">
            <h2 className="text-sm font-black uppercase tracking-tagline text-slate">
              {t("openJobs")}
            </h2>
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} showPlace={false} />
            ))}
          </section>
        )}
        {reviews.length > 0 && (
          <section id="reviews" className="flex flex-col gap-4">
            <nav className="hidden flex-wrap gap-3 lg:flex">
              {(["all", "verified", "permanent", "temporary", "applicants"] as const).map(
                (f) => (
                  <Link
                    key={f}
                    href={{
                      pathname: `${path}/reviews`,
                      query: f === "all" ? {} : { filter: f },
                    }}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                      f === "all" ? "bg-ink text-paper" : "border border-mist/60"
                    }`}
                  >
                    {tr(`filters.${f}`)}
                  </Link>
                ),
              )}
            </nav>
            {reviews.slice(0, 3).map((r) => (
              <ReviewCard key={r.id} review={r} companyName={data.companyName} reportable />
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
      </div>

      {nearby.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-black tracking-brand">{t("nearby", { city: data.city })}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {await Promise.all(
              nearby.map(async (l) => (
                <li key={l.id}>
                  <Link
                    href={locationPath(l)}
                    className="flex h-full items-start justify-between gap-3 rounded-3xl bg-white p-5"
                  >
                    <span className="min-w-0">
                      <span className="block text-lg font-black leading-tight">{l.name}</span>
                      <span className="text-sm text-slate">
                        {l.address} · {kindLabel(l.placeType, locale, tc(l.category))}
                      </span>
                    </span>
                    {l.scores && (
                      <span
                        className={`grid size-12 shrink-0 place-items-center rounded-xl font-black ${
                          l.scores.overall >= 4 ? "bg-signal" : "bg-[#E8E6E1]"
                        }`}
                      >
                        {await formatScore(l.scores.overall)}
                      </span>
                    )}
                  </Link>
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      <div className={`fixed inset-x-0 bottom-0 grid gap-3 bg-paper/95 p-4 backdrop-blur lg:hidden ${s ? "grid-cols-2" : ""}`}>
        {s && (
          <Link
            href={`${path}/reviews`}
            className="rounded-2xl border-2 border-ink py-3 text-center text-base font-black"
          >
            {t("readReviews")}
          </Link>
        )}
        <Link
          href={rateHref}
          className="rounded-2xl bg-ink py-3 text-center text-base font-black text-paper"
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
        { "@type": "ListItem", position: 2, name: location.companyName, item: `${SITE_URL}${prefix}/${location.companySlug}` },
        { "@type": "ListItem", position: 3, name: `${location.name} (${location.address})`, item: url },
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
