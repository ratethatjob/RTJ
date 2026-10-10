import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Faq } from "@/components/faq";
import { getPathname, Link } from "@/i18n/navigation";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/employers">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Employers" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/employers", locale),
  };
}

export default async function EmployersPage({ params }: PageProps<"/[locale]/employers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Employers");
  const features = ["reply", "invite", "warning", "index"] as const;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-8 pt-6 sm:px-6 lg:gap-16 lg:pt-12">
        <section className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-tagline text-slate">{t("eyebrow")}</p>
          <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-brand lg:text-7xl">{t("title")}</h1>
          <p className="mt-5 text-xl text-slate">{t("body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/business/claim" className="rounded-2xl bg-ink px-7 py-4 text-lg font-black text-paper">
              {t("cta")}
            </Link>
            <Link
              href={{ pathname: "/app/sign-in", query: { for: "business", next: getPathname({ href: "/business", locale }) } }}
              className="rounded-2xl border-2 border-ink px-7 py-4 text-lg font-black"
            >
              {t("dashboard")}
            </Link>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f} className="rounded-3xl bg-white p-8">
              <h2 className="text-2xl font-black tracking-brand">{t(`features.${f}Title`)}</h2>
              <p className="mt-2 text-slate">{t(`features.${f}Body`)}</p>
              {f === "index" && (
                <Link href="/ratethatjob-index" className="mt-3 inline-block font-black underline underline-offset-4">
                  {t("features.indexLink")}
                </Link>
              )}
            </div>
          ))}
        </section>
        <p className="rounded-3xl bg-signal p-8 text-2xl font-black tracking-brand">{t("free")}</p>
        <section>
          <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("howTitle")}</h2>
          <ol className="mt-6 grid gap-4 lg:grid-cols-3">
            {(["claim", "engage", "improve"] as const).map((step, i) => (
              <li key={step} className="rounded-3xl bg-white p-7">
                <span className="grid size-10 place-items-center rounded-full bg-ink font-black text-paper">{i + 1}</span>
                <h3 className="mt-4 text-xl font-black">{t(`how.${step}Title`)}</h3>
                <p className="mt-1 text-slate">{t(`how.${step}Body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-[2rem] bg-ink p-8 text-paper lg:flex-row lg:items-center lg:justify-between lg:p-11">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-brand">{t("pricingTitle")}</h2>
            <p className="mt-2 text-lg text-mist">{t("pricingBody")}</p>
          </div>
          <Link href="/pricing" className="rounded-2xl bg-signal px-7 py-4 text-lg font-black text-ink">
            {t("pricingCta")}
          </Link>
        </section>

        <Faq
          title={t("faqTitle")}
          items={(["remove", "anonymous", "dispute", "cost"] as const).map((k) => ({
            q: t(`faq.${k}Q`),
            a: t(`faq.${k}A`),
          }))}
        />
      </main>
    </>
  );
}
