import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Faq } from "@/components/faq";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { exampleBadges } from "@/lib/marketing-examples";
import { localeAlternates } from "@/lib/seo";

type Props = PageProps<"/[locale]/ratethatjob-index">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "IndexPage" });
  return {
    title: `${t("metaTitle")} | RateThatJob`,
    description: t("metaDescription"),
    alternates: localeAlternates("/ratethatjob-index", locale),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), type: "website" },
  };
}

const HOW = ["window", "categories", "facts", "verified", "threshold"] as const;
const PLACES = ["image", "widget", "json", "email"] as const;
const IMPROVE = ["reply", "applicants", "invite", "pay", "hours", "listen"] as const;
const FAQ = ["what", "update", "remove", "few", "cost"] as const;

export default async function IndexMarketingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("IndexPage");
  const badges = await exampleBadges(locale);
  const svg = (markup: string, label: string) => (
    <div className="min-w-0 max-w-full [&_svg]:h-auto [&_svg]:max-w-full" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: markup }} />
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-8 pt-6 sm:px-6 lg:gap-16 lg:pt-12">
        <section className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-tagline text-slate">{t("eyebrow")}</p>
            <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-brand lg:text-6xl">{t("title")}</h1>
            <p className="mt-6 text-xl text-slate lg:text-2xl">{t("intro")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/business/index" className="rounded-2xl bg-ink px-7 py-4 text-lg font-black text-paper">
                {t("ctaGet")}
              </Link>
              <Link href="/employers" className="rounded-2xl border-2 border-ink px-7 py-4 text-lg font-black">
                {t("ctaEmployers")}
              </Link>
            </div>
            <p className="mt-4 inline-block rounded-lg bg-signal px-3 py-1.5 font-black">{t("trialNote")}</p>
          </div>
          <figure className="flex min-w-0 flex-col gap-4 rounded-[2rem] bg-white p-6 sm:p-8">
            <figcaption className="self-start rounded-lg border-2 border-dashed border-mist px-3 py-1 text-sm font-black text-slate">
              {t("exampleLabel")}
            </figcaption>
            {svg(badges.wide, t("exampleLabel"))}
            <div className="flex flex-wrap items-center gap-4">
              {svg(badges.compact, t("exampleLabel"))}
            </div>
            {svg(badges.strip, t("exampleLabel"))}
            <p className="text-sm text-slate">{t("exampleNote")}</p>
          </figure>
        </section>

        <section className="grid gap-6 rounded-[2rem] bg-ink p-8 text-paper lg:grid-cols-2 lg:p-12">
          <h2 className="text-3xl font-black tracking-brand lg:text-5xl">{t("messageTitle")}</h2>
          <div className="flex flex-col gap-4 text-lg text-mist">
            <p>{t("message1")}</p>
            <p>{t("message2")}</p>
          </div>
        </section>

        <section className="max-w-3xl">
          <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("whatTitle")}</h2>
          <p className="mt-4 text-lg text-slate">{t("whatBody")}</p>
        </section>

        <section>
          <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("howTitle")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOW.map((k) => (
              <div key={k} className="rounded-3xl bg-white p-7">
                <h3 className="text-xl font-black tracking-brand">{t(`how.${k}Title`)}</h3>
                <p className="mt-2 text-slate">{t(`how.${k}Body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("placesTitle")}</h2>
          <p className="mt-3 max-w-3xl text-lg text-slate">{t("placesIntro")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLACES.map((k) => (
              <div key={k} className="rounded-3xl bg-white p-7">
                <h3 className="text-xl font-black tracking-brand">{t(`places.${k}Title`)}</h3>
                <p className="mt-2 text-slate">{t(`places.${k}Body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2rem] bg-white p-8 lg:p-10">
            <h2 className="text-3xl font-black tracking-brand">{t("improveTitle")}</h2>
            <p className="mt-3 text-lg text-slate">{t("improveIntro")}</p>
            <ul className="mt-5 flex flex-col gap-3 text-lg">
              {IMPROVE.map((k) => (
                <li key={k} className="flex gap-3">
                  <span className="font-black" aria-hidden="true">
                    ✓
                  </span>
                  {t(`improve.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-[2rem] bg-signal p-8 lg:p-10">
              <h2 className="text-3xl font-black tracking-brand">{t("cannotTitle")}</h2>
              <p className="mt-3 text-lg">{t("cannotBody")}</p>
            </div>
            <div className="rounded-[2rem] bg-white p-8 lg:p-10">
              <h2 className="text-2xl font-black tracking-brand">{t("warningTitle")}</h2>
              <p className="mt-3 text-lg text-slate">{t("warningBody")}</p>
            </div>
          </div>
        </section>

        <section className="grid items-center gap-8 rounded-[2rem] bg-white p-8 sm:grid-cols-[auto_1fr] lg:p-12">
          <figure className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-3">
              {svg(badges.seal, t("exampleLabel"))}
              {svg(badges.sealLight, t("exampleLabel"))}
            </div>
            <figcaption className="rounded-lg border-2 border-dashed border-mist px-3 py-1 text-sm font-black text-slate">
              {t("exampleLabel")}
            </figcaption>
          </figure>
          <div>
            <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("sealTitle")}</h2>
            <p className="mt-3 text-lg text-slate">{t("sealBody")}</p>
          </div>
        </section>

        <section className="rounded-[2rem] bg-ink p-8 text-paper lg:p-12">
          <p className="text-6xl font-black tracking-brand text-signal lg:text-8xl">4.8+</p>
          <h2 className="mt-4 text-3xl font-black tracking-brand lg:text-4xl">{t("topTitle")}</h2>
          <p className="mt-3 max-w-3xl text-lg text-mist">{t("topBody")}</p>
        </section>

        <Faq title={t("faqTitle")} items={FAQ.map((k) => ({ q: t(`faq.${k}Q`), a: t(`faq.${k}A`) }))} />

        <section className="flex flex-col items-start gap-4 rounded-[2rem] bg-white p-8 lg:flex-row lg:items-center lg:justify-between lg:p-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-brand">{t("bottomTitle")}</h2>
            <p className="mt-2 text-lg text-slate">{t("bottomBody")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/business/index" className="rounded-2xl bg-ink px-7 py-4 text-lg font-black text-paper">
              {t("ctaGet")}
            </Link>
            <Link href="/employers" className="rounded-2xl border-2 border-ink px-7 py-4 text-lg font-black">
              {t("ctaEmployers")}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
