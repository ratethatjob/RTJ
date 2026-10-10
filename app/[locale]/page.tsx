import { DemoChip } from "@/components/demo-badge";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Bar, formatScore, ScoreTile } from "@/components/scores";
import { Faq } from "@/components/faq";
import { JobCard } from "@/components/jobs/job-card";
import { getFeaturedLocations, getSitemapLocations } from "@/lib/data";
import { getAllJobs } from "@/lib/data/jobs";
import { getPathname, Link } from "@/i18n/navigation";
import { locationPath } from "@/lib/format";
import { localeAlternates } from "@/lib/seo";

const CATEGORIES = [
  "restaurant",
  "retail",
  "warehouse",
  "factory",
  "office",
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates("/", locale) };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tc = await getTranslations("Categories");
  const tl = await getTranslations("Location");
  const [featured, allJobs, allLocations] = await Promise.all([
    getFeaturedLocations(),
    getAllJobs(),
    getSitemapLocations(),
  ]);
  const jobs = allJobs.slice(0, 3);
  const cityCounts = new Map<string, number>();
  const cityNames = new Map<string, string>();
  for (const l of allLocations) {
    cityCounts.set(l.citySlug, (cityCounts.get(l.citySlug) ?? 0) + 1);
    cityNames.set(l.citySlug, l.city);
  }
  const cities = [...cityCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const example = featured[0];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-8 pt-6 sm:px-6 lg:gap-16 lg:pb-8 lg:pt-12">
        <section className="grid items-center gap-10 lg:grid-cols-[1fr_340px] lg:gap-16 xl:grid-cols-[1fr_400px]">
          <div>
            <h1 className="text-[3.25rem] font-black leading-[0.95] tracking-brand sm:text-7xl lg:text-8xl">
              {t("headline")}
            </h1>
            <p className="mt-5 max-w-xl text-xl text-slate lg:text-2xl">
              {t("intro")}
              <span className="hidden lg:inline"> {t("introMore")}</span>
            </p>

            <form
              action={getPathname({ href: "/search", locale })}
              role="search"
              className="mt-8 flex flex-col rounded-3xl border border-mist/40 bg-white p-3 lg:flex-row lg:items-center lg:p-2"
            >
              <label className="flex flex-1 flex-col px-4 py-2">
                <span className="text-sm font-black text-slate">
                  {t("workplace")}
                </span>
                <input
                  name="q"
                  placeholder={t("workplacePlaceholder")}
                  className="bg-transparent text-lg outline-none placeholder:text-ink"
                />
              </label>
              <span className="mx-1 h-px bg-[#E8E6E1] lg:h-10 lg:w-px" />
              <label className="flex flex-1 flex-col px-4 py-2">
                <span className="text-sm font-black text-slate">
                  {t("where")}
                </span>
                <input
                  name="where"
                  placeholder={t("wherePlaceholder")}
                  className="bg-transparent text-lg outline-none placeholder:text-ink"
                />
              </label>
              <button
                type="submit"
                className="mt-2 rounded-2xl bg-ink px-8 py-4 text-lg font-black text-paper lg:mt-0"
              >
                {t("search")}
              </button>
            </form>

            <ul className="mt-5 flex flex-wrap gap-3">
              {CATEGORIES.map((c) => (
                <li key={c}>
                  <Link
                    href={{ pathname: "/search", query: { category: c } }}
                    className="inline-block rounded-full border border-mist/60 px-5 py-3 font-black"
                  >
                    {tc(`${c}Plural`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {example?.scores && (
            <Link
              href={locationPath(example)}
              className="hidden rounded-[2rem] bg-ink p-8 text-paper lg:block"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-3xl font-black tracking-brand">
                    {example.name}
                  </p>
                  <p className="text-mist">
                    {example.address} · {tc(example.category)} ·{" "}
                    {tl("verifiedCount", {
                      count: example.scores.verifiedCount,
                    })}
                  </p>
                </div>
                <ScoreTile score={example.scores.overall} size="sm" />
              </div>
              <dl className="mt-6 flex flex-col gap-4">
                {(
                  [
                    [
                      tl("facts.paid_on_time"),
                      example.scores.facts.paid_on_time,
                    ],
                    [
                      tl("facts.overtime_paid"),
                      example.scores.facts.overtime_paid,
                    ],
                    [tl("repliesToApplicants"), example.scores.replyRate],
                  ] as const
                ).map(([label, value]) =>
                  value == null ? null : (
                    <div key={label}>
                      <div className="mb-2 flex justify-between font-black">
                        <dt>{label}</dt>
                        <dd>{value}%</dd>
                      </div>
                      <Bar value={value} dark />
                    </div>
                  ),
                )}
              </dl>
              <p className="mt-6 text-sm text-mist">{t("exampleProfile")}</p>
            </Link>
          )}
        </section>

        {featured.length > 0 && (
          <section className="lg:hidden">
            <h2 className="mb-4 text-sm font-black uppercase tracking-tagline text-slate">
              {t("recentlyRated")}
            </h2>
            <ul className="flex flex-col gap-3">
              {await Promise.all(
                featured.map(async (l) => (
                  <li key={l.id}>
                    <Link
                      href={locationPath(l)}
                      className="flex items-center justify-between gap-4 rounded-3xl bg-white p-6"
                    >
                      <div>
                        {l.isDemo && <DemoChip />}
                        <p className="text-2xl font-black tracking-brand">
                          {l.name}
                        </p>
                        <p className="text-slate">
                          {l.address} · {tc(l.category)}
                        </p>
                        {l.scores && (
                          <p className="font-black">
                            {t("paysOnTimeShort")} {l.scores.facts.paid_on_time}
                            % · {t("repliesShort")} {l.scores.replyRate}%
                          </p>
                        )}
                      </div>
                      {l.scores && (
                        <span
                          className={`grid size-20 shrink-0 place-items-center rounded-2xl text-3xl font-black ${
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

        <section className="grid gap-4 lg:grid-cols-3">
          {(["verified", "facts", "ghosting"] as const).map((key) => (
            <div key={key} className="rounded-3xl bg-white p-8">
              <h2 className="text-2xl font-black tracking-brand">
                {t(`features.${key}Title`)}
              </h2>
              <p className="mt-2 text-slate">{t(`features.${key}Body`)}</p>
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("howTitle")}</h2>
          <ol className="mt-6 grid gap-4 lg:grid-cols-3">
            {(["find", "facts", "rate"] as const).map((step, i) => (
              <li key={step} className="rounded-3xl bg-white p-7">
                <span className="grid size-10 place-items-center rounded-full bg-ink font-black text-paper">{i + 1}</span>
                <h3 className="mt-4 text-xl font-black">{t(`how.${step}Title`)}</h3>
                <p className="mt-1 text-slate">{t(`how.${step}Body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {jobs.length > 0 && (
          <section>
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("jobsTitle")}</h2>
              <Link href="/jobs" className="shrink-0 font-black underline underline-offset-4">
                {t("allJobs")}
              </Link>
            </div>
            <p className="mt-2 text-lg text-slate">{t("jobsBody")}</p>
            <ul className="mt-6 grid gap-3 lg:grid-cols-3">
              {jobs.map((j) => (
                <li key={j.id}>
                  <JobCard job={j} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {cities.length > 0 && (
          <section>
            <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("citiesTitle")}</h2>
            <ul className="mt-6 flex flex-wrap gap-3">
              {cities.map(([slug, count]) => (
                <li key={slug}>
                  <Link
                    href={`/city/${slug}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-black"
                  >
                    {cityNames.get(slug)}
                    <span className="rounded-full bg-paper px-2 text-sm text-slate">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-6 rounded-[2rem] bg-signal p-8 lg:flex-row lg:items-center lg:justify-between lg:p-11">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-brand lg:text-4xl">
              {t("claimTitle")}
            </h2>
            <p className="mt-2 text-lg">{t("claimBody")}</p>
          </div>
          <Link
            href="/employers"
            className="self-start rounded-2xl bg-ink px-8 py-4 text-lg font-black text-paper lg:self-auto"
          >
            {t("claimCta")}
          </Link>
        </section>
        <Faq
          title={t("faqTitle")}
          items={(["anonymous", "verified", "employer", "free"] as const).map((k) => ({
            q: t(`faq.${k}Q`),
            a: t(`faq.${k}A`),
          }))}
        />
      </main>

      <div className="fixed inset-x-4 bottom-4 flex items-center justify-between gap-4 rounded-3xl bg-ink p-5 text-paper lg:hidden">
        <p className="leading-tight">
          <span className="block font-black">{t("rateBarTitle")}</span>
          <span className="text-mist">{t("rateBarBody")}</span>
        </p>
        <Link
          href="/app/rate"
          className="shrink-0 rounded-2xl bg-signal px-6 py-3.5 font-black text-ink"
        >
          {(await getTranslations("Nav"))("rateAJob")}
        </Link>
      </div>
    </>
  );
}
