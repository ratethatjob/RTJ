import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobCard } from "@/components/jobs/job-card";
import { ReviewCard } from "@/components/review-card";
import { CategoryScores, FactBars, GhostingMeter, ScoreTile } from "@/components/scores";
import { ShowcaseCoffee, ShowcaseCounter, ShowcaseLogo, ShowcaseStorefront } from "@/components/showcase/illustrations";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { kindLabel } from "@/lib/place-types";
import { localeAlternates } from "@/lib/seo";
import { showcaseBadges } from "@/lib/showcase-badges";
import { getShowcase, SHOWCASE_PATH } from "@/lib/showcase";

// The sample workplace page: a made-up bakery showing what a workplace page with Pro shows. Built
// from the same parts as the real location page, with data from lib/showcase.ts; never indexed.

type Props = PageProps<"/[locale]/sample-workplace">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Showcase" });
  return {
    title: `${t("metaTitle")} | RateThatJob`,
    description: t("banner"),
    alternates: localeAlternates(SHOWCASE_PATH, locale),
    robots: { index: false, follow: true },
  };
}

export default async function SampleWorkplacePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Location");
  const ts = await getTranslations("Showcase");
  const tc = await getTranslations("Categories");
  const { brand, location: SHOWCASE, reviews, jobs, profile } = getShowcase(locale);
  const s = SHOWCASE.scores!;
  const svgs = await showcaseBadges(locale);
  const badges = [
    { label: ts("badgeWide"), svg: svgs.wide },
    { label: ts("badgeCompact"), svg: svgs.compact },
    { label: ts("badgeSeal"), svg: svgs.seal },
  ];

  return (
    <>
      <SiteHeader withSearch />
      <div className="border-b-2 border-dashed border-ink bg-signal">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <p className="font-black">{ts("banner")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/business/claim" className="rounded-xl bg-ink px-4 py-2 text-[15px] font-black text-paper">
              {ts("ctaEmployer")}
            </Link>
            <Link href="/app/rate" className="rounded-xl border-2 border-ink px-4 py-2 text-[15px] font-black">
              {ts("ctaWorker")}
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-row-reverse items-start justify-between gap-4 lg:flex-row lg:items-center lg:justify-start lg:gap-7">
            <ScoreTile score={s.overall} />
            <div className="min-w-0">
              <h1 className="text-4xl font-black leading-tight tracking-brand lg:text-6xl">
                {SHOWCASE.name} <span className="text-slate">– {ts("sample")}</span>
              </h1>
              <p className="text-lg text-slate">
                {SHOWCASE.address}, {SHOWCASE.city} · {kindLabel(SHOWCASE.placeType, locale, tc(SHOWCASE.category))}
                <br className="lg:hidden" />
                <span className="hidden lg:inline"> · </span>
                {t("operatedBy", { entity: SHOWCASE.legalEntityName! })}
              </p>
              <p className="mt-1 text-slate">
                {t("last12Months")} · {t("reviewCount", { count: s.reviewCount })} ·{" "}
                <strong className="font-black text-ink">{t("verifiedCount", { count: s.verifiedCount })}</strong>
              </p>
            </div>
          </div>
          <div className="hidden gap-3 lg:flex">
            <Link href="/app/rate" className="rounded-xl bg-ink px-5 py-2.5 text-base font-black text-paper">
              {ts("ctaWorker")}
            </Link>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
          <aside className="flex flex-col gap-4 lg:order-2">
            <FactBars facts={s.facts} />
            <GhostingMeter
              replyRate={SHOWCASE.ghosting!.replyRate}
              avgReplyDays={SHOWCASE.ghosting!.avgReplyDays}
              applications={SHOWCASE.ghosting!.applications}
            />
            <CategoryScores scores={s} />
            <section className="flex flex-col gap-4 rounded-3xl bg-ink p-6 text-paper">
              <p className="self-start rounded-lg bg-signal px-2.5 py-1 text-xs font-black uppercase tracking-tagline text-ink">
                {ts("pro")}
              </p>
              <h2 className="text-xl font-black">{ts("proTitle")}</h2>
              <p className="text-mist">{ts("proBody")}</p>
              {badges.map((b) => (
                <figure key={b.label} className="flex flex-col gap-2">
                  <div
                    className="min-w-0 max-w-full [&_svg]:h-auto [&_svg]:max-w-full"
                    role="img"
                    aria-label={b.label}
                    dangerouslySetInnerHTML={{ __html: b.svg }}
                  />
                  <figcaption className="text-sm text-mist">{b.label}</figcaption>
                </figure>
              ))}
              <Link href="/ratethatjob-index" className="font-black text-signal underline underline-offset-4">
                {ts("proMore")}
              </Link>
            </section>
          </aside>

          <div className="flex min-w-0 flex-col gap-6 lg:order-1">
            <section className="flex flex-col gap-4 rounded-3xl bg-white p-6">
              <div className="flex items-center gap-4">
                <ShowcaseLogo monogram={brand.monogram} className="size-16 shrink-0" />
                <h2 className="text-sm font-black uppercase tracking-tagline text-slate">{t("fromEmployer")}</h2>
              </div>
              <div className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6">
                <ShowcaseStorefront sign={brand.sign} className="aspect-[4/3] h-44 w-auto shrink-0 snap-start rounded-2xl" />
                <ShowcaseCounter className="aspect-[4/3] h-44 w-auto shrink-0 snap-start rounded-2xl" />
                <ShowcaseCoffee className="aspect-[4/3] h-44 w-auto shrink-0 snap-start rounded-2xl" />
              </div>
              <p className="whitespace-pre-line text-lg leading-relaxed">{profile.about}</p>
              <ul className="flex flex-wrap gap-2">
                {profile.benefits.map((b) => (
                  <li key={b} className="rounded-lg bg-[#EDEBE6] px-3 py-1.5 font-black">
                    {b}
                  </li>
                ))}
              </ul>
            </section>

            <section id="jobs" className="flex flex-col gap-3">
              <h2 className="text-sm font-black uppercase tracking-tagline text-slate">{t("openJobs")}</h2>
              {jobs.map((j) => (
                <JobCard key={j.id} job={j} showPlace={false} linked={false} />
              ))}
            </section>

            <section id="reviews" className="flex flex-col gap-4">
              <h2 className="text-sm font-black uppercase tracking-tagline text-slate">
                {t("reviewCount", { count: reviews.length })}
              </h2>
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} companyName={SHOWCASE.companyName} />
              ))}
            </section>
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 grid grid-cols-2 gap-3 bg-paper/95 p-4 backdrop-blur lg:hidden">
        <Link href="/business/claim" className="rounded-2xl border-2 border-ink py-3 text-center text-base font-black">
          {ts("ctaEmployerShort")}
        </Link>
        <Link href="/app/rate" className="rounded-2xl bg-ink py-3 text-center text-base font-black text-paper">
          {ts("ctaWorkerShort")}
        </Link>
      </div>
    </>
  );
}
