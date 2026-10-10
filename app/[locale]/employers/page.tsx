import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
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
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-16 pt-6 sm:px-6 lg:pt-12">
        <section className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-tagline text-slate">{t("eyebrow")}</p>
          <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-brand lg:text-7xl">{t("title")}</h1>
          <p className="mt-5 text-xl text-slate">{t("body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/business/claim" className="rounded-2xl bg-ink px-7 py-4 text-lg font-black text-paper">
              {t("cta")}
            </Link>
            <Link href="/business" className="rounded-2xl border-2 border-ink px-7 py-4 text-lg font-black">
              {t("dashboard")}
            </Link>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f} className="rounded-3xl bg-white p-8">
              <h2 className="text-2xl font-black tracking-brand">{t(`features.${f}Title`)}</h2>
              <p className="mt-2 text-slate">{t(`features.${f}Body`)}</p>
            </div>
          ))}
        </section>
        <p className="rounded-3xl bg-signal p-8 text-2xl font-black tracking-brand">{t("free")}</p>
      </main>
    </>
  );
}
