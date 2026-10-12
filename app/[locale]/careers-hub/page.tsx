import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Faq } from "@/components/faq";
import { JobsWidgetExample } from "@/components/marketing/jobs-widget-example";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { ogImage, pageMeta, SITE_URL } from "@/lib/seo";

type Props = PageProps<"/[locale]/careers-hub">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "CareersHub" });
  return pageMeta({
    locale,
    path: "/careers-hub",
    title: `${t("metaTitle")} | RateThatJob`,
    description: t("metaDescription"),
    image: ogImage("careers", locale),
  });
}

const FEATURES = ["oneSnippet", "auto", "trust", "scope", "looks", "featured"] as const;
const STEPS = ["claim", "post", "embed"] as const;
const APPLY = ["quick", "ai", "contact", "back"] as const;
const FAQ = ["cost", "where", "noJobs", "index", "data"] as const;

export default async function CareersHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("CareersHub");
  const code =
    `<div data-rtj-jobs="location" data-id="LOCATION_ID" data-theme="light" data-locale="${locale}">\n` +
    `  <a href="${SITE_URL}/your-company/your-location">${t("codeFallback")}</a>\n` +
    `</div>\n<script src="${SITE_URL}/widget.js" async></script>`;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-8 pt-6 sm:px-6 lg:gap-12 lg:pt-8">
        <section className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-tagline text-slate">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-brand break-words sm:text-5xl lg:text-7xl">{t("title")}</h1>
            <p className="mt-6 text-xl text-slate lg:text-2xl">{t("intro")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/business/index?tab=jobs" className="rounded-2xl bg-ink px-6 py-3 text-base font-black text-paper">
                {t("ctaGet")}
              </Link>
              <Link href="/employers" className="rounded-2xl border-2 border-ink px-6 py-3 text-base font-black">
                {t("ctaEmployers")}
              </Link>
            </div>
          </div>
          <figure className="flex min-w-0 flex-col gap-3">
            <figcaption className="self-start rounded-lg border-2 border-dashed border-mist px-3 py-1 text-sm font-black text-slate">
              {t("exampleLabel")}
            </figcaption>
            <JobsWidgetExample />
          </figure>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((k) => (
            <div key={k} className="rounded-3xl bg-white p-7">
              <h2 className="text-xl font-black tracking-brand">{t(`features.${k}Title`)}</h2>
              <p className="mt-2 text-slate">{t(`features.${k}Body`)}</p>
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("stepsTitle")}</h2>
          <ol className="mt-6 grid gap-4 lg:grid-cols-3">
            {STEPS.map((k, i) => (
              <li key={k} className="rounded-3xl bg-white p-7">
                <span className="grid size-10 place-items-center rounded-full bg-ink font-black text-paper">{i + 1}</span>
                <h3 className="mt-4 text-xl font-black">{t(`steps.${k}Title`)}</h3>
                <p className="mt-1 text-slate">{t(`steps.${k}Body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div className="min-w-0">
            <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("codeTitle")}</h2>
            <p className="mt-3 text-lg text-slate">{t("codeBody")}</p>
            <pre className="mt-5 overflow-x-auto rounded-2xl bg-ink p-5 text-sm text-paper">
              <code>{code}</code>
            </pre>
            <p className="mt-3 text-sm text-slate">{t("codeNote")}</p>
          </div>
          <figure className="flex min-w-0 flex-col gap-3">
            <figcaption className="self-start rounded-lg border-2 border-dashed border-mist px-3 py-1 text-sm font-black text-slate">
              {t("exampleDark")}
            </figcaption>
            <JobsWidgetExample dark />
          </figure>
        </section>

        <section className="rounded-[2rem] bg-ink p-8 text-paper lg:p-12">
          <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("applyTitle")}</h2>
          <p className="mt-3 max-w-3xl text-lg text-mist">{t("applyIntro")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {APPLY.map((k) => (
              <div key={k} className="rounded-3xl bg-white/5 p-6">
                <h3 className="text-xl font-black">{t(`apply.${k}Title`)}</h3>
                <p className="mt-2 text-mist">{t(`apply.${k}Body`)}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="mt-6 inline-block font-black text-signal underline underline-offset-4">
            {t("pricingLink")}
          </Link>
        </section>

        <Faq title={t("faqTitle")} items={FAQ.map((k) => ({ q: t(`faq.${k}Q`), a: t(`faq.${k}A`) }))} />

        <section className="flex flex-col items-start gap-4 rounded-[2rem] bg-white p-8 lg:flex-row lg:items-center lg:justify-between lg:p-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-brand">{t("bottomTitle")}</h2>
            <p className="mt-2 text-lg text-slate">{t("bottomBody")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/business/index?tab=jobs" className="rounded-2xl bg-ink px-6 py-3 text-base font-black text-paper">
              {t("ctaGet")}
            </Link>
            <Link href="/employers" className="rounded-2xl border-2 border-ink px-6 py-3 text-base font-black">
              {t("ctaEmployers")}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
