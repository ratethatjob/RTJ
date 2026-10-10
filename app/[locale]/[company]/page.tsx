import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatScore } from "@/components/scores";
import { SiteHeader } from "@/components/site-header";
import { getPathname, Link } from "@/i18n/navigation";
import { getCompany, getLocationPaths } from "@/lib/data";
import { locationPath } from "@/lib/format";
import { findRedirect } from "@/lib/data/redirects";
import { localeAlternates } from "@/lib/seo";

type Props = PageProps<"/[locale]/[company]">;

// Blocking so unknown slugs get a real 404 status.
export const instant = false;

export async function generateStaticParams() {
  const paths = await getLocationPaths();
  return [...new Set(paths.map((p) => p.company))].map((company) => ({ company }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, company } = await params;
  const data = await getCompany(company);
  if (!data) return {};
  const t = await getTranslations({ locale, namespace: "Company" });
  const rated = data.locations.some((l) => l.scores);
  return {
    title: `${t("metaTitle", { company: data.name })} | RateThatJob`,
    alternates: localeAlternates(`/${data.slug}`, locale),
    ...(!rated && { robots: { index: false } }),
  };
}

export default async function CompanyPage({ params }: Props) {
  const { locale, company } = await params;
  setRequestLocale(locale);
  const data = await getCompany(company);
  if (!data) {
    const to = await findRedirect(company);
    if (to) permanentRedirect(getPathname({ href: to, locale }));
    notFound();
  }
  const t = await getTranslations("Company");
  const tc = await getTranslations("Categories");

  return (
    <>
      <SiteHeader withSearch />
      <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:pt-10">
        <h1 className="text-4xl font-black tracking-brand lg:text-6xl">{data.name}</h1>
        <p className="mt-2 text-lg text-slate">{t("locations", { count: data.locations.length })}</p>
        <ul className="mt-8 grid gap-3 lg:grid-cols-2">
          {await Promise.all(
            data.locations.map(async (l) => (
              <li key={l.id}>
                <Link
                  href={locationPath(l)}
                  className="flex items-center justify-between gap-4 rounded-3xl bg-white p-6"
                >
                  <span>
                    <span className="block text-2xl font-black tracking-brand">{l.address}</span>
                    <span className="text-slate">
                      {l.city} · {tc(l.category)}
                    </span>
                  </span>
                  {l.scores ? (
                    <span
                      className={`grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-black ${
                        l.scores.overall >= 4 ? "bg-signal" : "bg-[#E8E6E1]"
                      }`}
                    >
                      {await formatScore(l.scores.overall)}
                    </span>
                  ) : (
                    <span className="shrink-0 text-sm text-slate">{t("noScore")}</span>
                  )}
                </Link>
              </li>
            )),
          )}
        </ul>
      </main>
    </>
  );
}
