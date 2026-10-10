import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { formatPay } from "@/components/jobs/pay";
import { FactBars, GhostingMeter, ScoreTile } from "@/components/scores";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { getLocationById } from "@/lib/data";
import { getAllJobs, getJob } from "@/lib/data/jobs";
import type { Job } from "@/lib/data/types";
import { locationPath } from "@/lib/format";
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
  };
}

export default async function JobPage({ params }: Props) {
  const { locale, company, location, job: id } = await params;
  setRequestLocale(locale);
  const job = await load(company, location, id);
  if (!job) notFound();
  const workplace = await getLocationById(job.location.id);
  const t = await getTranslations("Jobs");
  const tr = await getTranslations("Review");
  const tc = await getTranslations("Categories");
  const tl = await getTranslations("Location");
  const format = await getFormatter();
  const pay = formatPay(job, locale, t);
  const s = workplace?.scores;
  const ghosting =
    workplace?.ghosting ??
    (s?.replyRate != null ? { replyRate: s.replyRate, avgReplyDays: s.avgReplyDays, applications: 0 } : null);
  const applyHref = `/app/apply/${job.id}`;
  const date = (d: string) => format.dateTime(new Date(d), { dateStyle: "medium" });

  return (
    <>
      <SiteHeader withSearch />
      <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 lg:pb-16 lg:pt-6">
        <JsonLd job={job} locale={locale} />
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
          <article className="flex flex-col gap-6">
            <header>
              <Link
                href={workplace ? locationPath(workplace) : "/jobs"}
                className="font-black text-slate underline-offset-4 hover:underline"
              >
                {job.location.name} · {job.location.address}, {job.location.city}
              </Link>
              <h1 className="mt-2 text-4xl font-black leading-tight tracking-brand lg:text-6xl">{job.title}</h1>
              <p className="mt-4 flex flex-wrap gap-2 font-black">
                {pay && <span className="rounded-xl bg-signal px-3 py-1.5">{pay}</span>}
                <span className="rounded-xl border border-mist px-3 py-1.5">{t(`schedule.${job.schedule}`)}</span>
                <span className="rounded-xl border border-mist px-3 py-1.5">{tr(`workType.${job.workType}`)}</span>
                <span className="rounded-xl border border-mist px-3 py-1.5">{tc(job.location.category)}</span>
              </p>
              <p className="mt-3 text-slate">
                {t("posted", { date: date(job.publishedAt) })}
                {job.closesAt && ` · ${t("closes", { date: date(job.closesAt) })}`}
              </p>
              <Link
                href={applyHref}
                className="mt-6 hidden rounded-2xl bg-ink px-8 py-4 text-lg font-black text-paper lg:inline-block"
              >
                {t("apply")}
              </Link>
            </header>
            <section className="rounded-3xl bg-white p-6">
              <h2 className="text-sm font-black uppercase tracking-tagline text-slate">{t("aboutJob")}</h2>
              <p className="mt-3 whitespace-pre-line text-lg leading-relaxed">{job.description}</p>
            </section>
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
          <Link href={applyHref} className="block rounded-2xl bg-ink py-4 text-center text-lg font-black text-paper">
            {t("apply")}
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
