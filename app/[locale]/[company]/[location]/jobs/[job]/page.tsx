import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { jobQuestions, languageList } from "@/components/jobs/languages";
import { formatPay } from "@/components/jobs/pay";
import { QuickBadge } from "@/components/jobs/quick-badge";
import { FactBars, GhostingMeter, ScoreTile } from "@/components/scores";
import { DemoBanner } from "@/components/demo-badge";
import { SiteHeader } from "@/components/site-header";
import { getPathname, Link } from "@/i18n/navigation";
import { getLocationById } from "@/lib/data";
import { getAllJobs, getJob } from "@/lib/data/jobs";
import type { Job } from "@/lib/data/types";
import { locationPath } from "@/lib/format";
import { findRedirect } from "@/lib/data/redirects";
import { languageName } from "@/lib/languages";
import { localeAlternates, SITE_URL } from "@/lib/seo";

type Props = PageProps<"/[locale]/[company]/[location]/jobs/[job]">;

// Blocking so closed or unknown jobs get a real 404 status.
export const instant = false;

export async function generateStaticParams() {
  const jobs = await getAllJobs();
  const params = jobs.map((j) => ({ company: j.location.companySlug, location: j.location.slug, job: j.id }));
  return params.length ? params : [{ company: "_", location: "_", job: "_" }];
}

async function load(company: string, location: string, id: string) {
  const job = await getJob(id);
  return job && job.location.companySlug === company && job.location.slug === location ? job : null;
}

const path = (job: Job) => `/${job.location.companySlug}/${job.location.slug}/jobs/${job.id}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, company, location, job: id } = await params;
  const job = await load(company, location, id);
  if (!job) return {};
  const t = await getTranslations({ locale, namespace: "Jobs" });
  const title = t("metaJobTitle", { title: job.title, company: job.location.companyName, location: job.location.city });
  const description = t("metaJobDescription", {
    title: job.title,
    company: job.location.companyName,
    address: `${job.location.address}, ${job.location.city}`,
    pay: formatPay(job, locale, t) ?? t("payNotListed"),
  });
  return {
    title: `${title} | RateThatJob`,
    description,
    alternates: localeAlternates(path(job), locale),
    openGraph: { title, description, type: "website" },
    ...(job.isDemo && { robots: { index: false } }),
  };
}

export default async function JobPage({ params }: Props) {
  const { locale, company, location, job: id } = await params;
  setRequestLocale(locale);
  const job = await load(company, location, id);
  if (!job) {
    const to = await findRedirect(company, location, `/jobs/${id}`);
    if (to) permanentRedirect(getPathname({ href: to, locale }));
    notFound();
  }
  const workplace = await getLocationById(job.location.id);
  const t = await getTranslations("Jobs");
  const tr = await getTranslations("Review");
  const tl = await getTranslations("Location");
  const format = await getFormatter();
  const pay = formatPay(job, locale, t);
  const s = workplace?.scores;
  const ghosting =
    workplace?.ghosting ??
    (s?.replyRate != null ? { replyRate: s.replyRate, avgReplyDays: s.avgReplyDays, applications: 0 } : null);
  const applyHref = `/app/apply/${job.id}`;
  const quick = job.applyMode === "quick";
  const date = (d: string) => format.dateTime(new Date(d), { dateStyle: "medium" });
  const questions = jobQuestions(job, locale, t);

  return (
    <>
      <SiteHeader withSearch />
      <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:pt-6">
        {job.isDemo ? <DemoBanner /> : <JsonLd job={job} locale={locale} />}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
          <article className="flex flex-col gap-4">
            <header className="rounded-[2rem] bg-white p-6 sm:p-8">
              <Link
                href={workplace ? locationPath(workplace) : "/jobs"}
                className="flex items-center gap-3 underline-offset-4 hover:underline"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink text-xl font-black text-signal">
                  {job.location.companyName.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <span className="block font-black">{job.location.companyName}</span>
                  <span className="text-sm text-slate">
                    {job.location.address}, {job.location.city}
                  </span>
                </span>
              </Link>
              <h1 className="mt-5 text-4xl font-black leading-tight tracking-brand lg:text-6xl">{job.title}</h1>
              <div className="mt-4 flex flex-wrap gap-2 font-black">
                {quick && <QuickBadge label={t("quickApply")} large />}
                {pay && <span className="rounded-lg bg-signal px-3 py-1.5">{pay}</span>}
                <span className="rounded-lg border border-mist px-3 py-1.5">{t(`schedule.${job.schedule}`)}</span>
                <span className="rounded-lg border border-mist px-3 py-1.5">{tr(`workType.${job.workType}`)}</span>
              </div>
              <p className="mt-3 text-sm text-slate">
                {t("posted", { date: date(job.publishedAt) })}
                {job.closesAt && ` · ${t("closes", { date: date(job.closesAt) })}`}
              </p>

              <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    [t("facts.pay"), pay ?? t("payNotListed")],
                    [t("facts.hours"), t(`schedule.${job.schedule}`)],
                    [t("facts.contract"), tr(`workType.${job.workType}`)],
                    [t("facts.where"), job.location.city],
                    ...(job.adLanguage ? [[t("facts.adLanguage"), languageName(job.adLanguage, locale)] as const] : []),
                    ...(job.languages.length ? [[t("facts.languages"), languageList(job.languages, locale, t)] as const] : []),
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-paper p-4">
                    <dt className="text-xs font-black uppercase tracking-tagline text-slate">{label}</dt>
                    <dd className="mt-1 font-black">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 hidden flex-wrap items-center gap-4 lg:flex">
                <Link href={applyHref} className="rounded-2xl bg-ink px-6 py-3 text-base font-black text-paper">
                  {quick ? t("applyQuick") : t("applyCv")}
                </Link>
                <span className="text-slate">
                  {quick ? t("quickHint", { count: questions.length }) : t("cvHint")}
                </span>
              </div>
            </header>

            <section className="rounded-[2rem] bg-white p-6 sm:p-8">
              <h2 className="text-sm font-black uppercase tracking-tagline text-slate">{t("aboutJob")}</h2>
              <p className="mt-3 whitespace-pre-line text-lg leading-relaxed">{job.description}</p>
            </section>

            {(
              [
                ["responsibilities", job.responsibilities, "•"],
                ["requirements", job.requirements, "•"],
                ["offers", job.offers, "✓"],
              ] as const
            ).map(([key, items, mark]) =>
              items.length ? (
                <section key={key} className="rounded-[2rem] bg-white p-6 sm:p-8">
                  <h2 className="text-2xl font-black tracking-brand">{t(`sections.${key}`)}</h2>
                  <ul className="mt-4 flex flex-col gap-2.5 text-lg">
                    {items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="font-black" aria-hidden="true">
                          {mark}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null,
            )}

            {questions.length > 0 && (
              <section className="rounded-[2rem] bg-ink p-6 text-paper sm:p-8">
                <h2 className="text-2xl font-black tracking-brand">{t("questionsTitle")}</h2>
                <p className="mt-1 text-mist">{quick ? t("questionsQuick") : t("questionsCv")}</p>
                <ol className="mt-5 flex flex-col gap-2">
                  {questions.map((q, i) => (
                    <li key={q.id} className="flex items-start justify-between gap-3 rounded-2xl bg-white/5 p-4">
                      <span className="flex gap-3">
                        <span className="font-black text-mist">{i + 1}.</span>
                        <span className="font-black">{q.text}</span>
                      </span>
                      <span className="shrink-0 text-sm text-mist">
                        {q.must ? t("mustBe", { answer: t(q.must) }) : q.type === "yes_no" ? t("yesNo") : t("shortAnswer")}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </article>

          <aside className="flex flex-col gap-4">
            <section className="rounded-3xl bg-white p-6">
              <h2 className="text-sm font-black uppercase tracking-tagline text-slate">{t("theWorkplace")}</h2>
              <div className="mt-3 flex items-center justify-between gap-4">
                <p>
                  <span className="block text-2xl font-black tracking-brand">{job.location.name}</span>
                  {s && <span className="text-slate">{tl("reviewCount", { count: s.reviewCount })}</span>}
                </p>
                {s && <ScoreTile score={s.overall} size="sm" />}
              </div>
              {!s && <p className="mt-2 text-slate">{t("noReviewsYet")}</p>}
              {workplace && (
                <Link href={locationPath(workplace)} className="mt-4 inline-block font-black underline underline-offset-4">
                  {t("seeWorkplace")}
                </Link>
              )}
            </section>
            {s && <FactBars facts={s.facts} />}
            {ghosting && (
              <GhostingMeter
                replyRate={ghosting.replyRate}
                avgReplyDays={ghosting.avgReplyDays}
                applications={ghosting.applications}
              />
            )}
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 bg-paper/95 p-4 backdrop-blur lg:hidden">
          <Link href={applyHref} className="block rounded-2xl bg-ink py-3 text-center text-base font-black text-paper">
            {quick ? t("applyQuick") : t("applyCv")}
          </Link>
        </div>
      </main>
    </>
  );
}

const EMPLOYMENT: Record<Job["schedule"], string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  shifts: "FULL_TIME",
  flexible: "PART_TIME",
};
const UNIT: Record<NonNullable<Job["payPeriod"]>, string> = {
  hour: "HOUR",
  day: "DAY",
  week: "WEEK",
  month: "MONTH",
  year: "YEAR",
};

// Google for Jobs (schema.org JobPosting).
function JsonLd({ job, locale }: { job: Job; locale: string }) {
  const prefix = locale === "en" ? "" : `/${locale}`;
  const hasPay = job.payCurrency && job.payPeriod && (job.payMin != null || job.payMax != null);
  const data = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!).replace(/\n/g, "<br>")}</p>`)
      .join(""),
    datePosted: job.publishedAt,
    ...(job.closesAt && { validThrough: `${job.closesAt}T23:59:59` }),
    employmentType: [EMPLOYMENT[job.schedule], ...(job.workType === "temporary" ? ["TEMPORARY"] : [])],
    hiringOrganization: {
      "@type": "Organization",
      name: job.location.companyName,
      sameAs: `${SITE_URL}${prefix}/${job.location.companySlug}`,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: job.location.address,
        addressLocality: job.location.city,
        addressCountry: job.location.country,
      },
    },
    ...(hasPay && {
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: job.payCurrency,
        value: {
          "@type": "QuantitativeValue",
          ...(job.payMin != null && { minValue: job.payMin }),
          ...(job.payMax != null && { maxValue: job.payMax }),
          ...(job.payMin != null && job.payMax == null && { value: job.payMin }),
          unitText: UNIT[job.payPeriod!],
        },
      },
    }),
    ...(job.responsibilities.length && { responsibilities: job.responsibilities.join("\n") }),
    ...(job.requirements.length && { qualifications: job.requirements.join("\n") }),
    ...(job.offers.length && { jobBenefits: job.offers.join("\n") }),
    // Expected languages as skills (JobPosting has no language property of its own).
    ...(job.languages.length && {
      skills: job.languages.map((l) => `${languageName(l.code, "en")} (${l.level})`).join(", "),
    }),
    directApply: true,
    url: `${SITE_URL}${prefix}${path(job)}`,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
