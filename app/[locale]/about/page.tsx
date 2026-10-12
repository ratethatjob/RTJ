import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { OPERATOR } from "@/lib/site-config";
import { ogImage, pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return pageMeta({
    locale,
    path: "/about",
    title: `${t("metaTitle")} | RateThatJob`,
    description: t("intro"),
    image: ogImage("home", locale),
  });
}

const PRINCIPLES = ["anonymous", "verified", "facts", "fair"] as const;

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("About");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-8 pt-6 sm:px-6 lg:gap-12 lg:pt-8">
        <section className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-tagline text-slate">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-brand sm:text-5xl lg:text-7xl">{t("title")}</h1>
          <p className="mt-6 text-xl text-slate lg:text-2xl">{t("intro")}</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <div key={p} className="rounded-3xl bg-white p-7 lg:p-8">
              <h2 className="text-2xl font-black tracking-brand">{t(`principles.${p}Title`)}</h2>
              <p className="mt-2 text-lg text-slate">{t(`principles.${p}Body`)}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 rounded-[2rem] bg-ink p-8 text-paper lg:grid-cols-[1fr_1fr] lg:p-12">
          <div>
            <h2 className="text-3xl font-black tracking-brand lg:text-4xl">{t("whyTitle")}</h2>
          </div>
          <div className="flex flex-col gap-4 text-lg text-mist">
            <p>{t("why1")}</p>
            <p>{t("why2")}</p>
          </div>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-[2rem] bg-white p-8 lg:flex-row lg:items-center lg:justify-between lg:p-12">
          <div>
            <h2 className="text-3xl font-black tracking-brand">{t("contactTitle")}</h2>
            <p className="mt-2 text-lg text-slate">{t("contactBody")}</p>
          </div>
          <a href={`mailto:${OPERATOR.email}`} className="rounded-2xl bg-ink px-6 py-3 text-base font-black text-paper">
            {OPERATOR.email}
          </a>
        </section>

        <p className="text-slate">
          <Link href="/imprint" className="font-black text-ink underline underline-offset-4">
            {t("imprintLink")}
          </Link>
        </p>
      </main>
    </>
  );
}
