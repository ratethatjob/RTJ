import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobCard } from "@/components/jobs/job-card";
import { SiteHeader } from "@/components/site-header";
import { getPathname, Link } from "@/i18n/navigation";
import { isCategory } from "@/lib/data";
import { findJobs } from "@/lib/data/jobs";
import { localeAlternates } from "@/lib/seo";

type Props = PageProps<"/[locale]/jobs">;

export const instant = false;

const CATEGORIES = ["restaurant", "retail", "warehouse", "factory", "office"] as const;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "Jobs" });
  const filtered = Boolean(sp.q || sp.where || sp.category);
  return {
    title: `${t("metaTitle")} | RateThatJob`,
    description: t("metaDescription"),
    alternates: localeAlternates("/jobs", locale),
    // The unfiltered list is the landing page; filtered results are not indexed.
    ...(filtered && { robots: { index: false, follow: true } }),
  };
}

export default async function JobsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const where = typeof sp.where === "string" ? sp.where.slice(0, 100) : "";
  const category = isCategory(sp.category) ? sp.category : null;
  const t = await getTranslations("Jobs");
  const th = await getTranslations("Home");
  const tc = await getTranslations("Categories");
  const jobs = await findJobs(q, where, category);
  const query = (c: string | null) => ({ ...(q && { q }), ...(where && { where }), ...(c && { category: c }) });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-6 sm:px-6 lg:pt-10">
        <h1 className="text-4xl font-black tracking-brand lg:text-6xl">{t("title")}</h1>
        <form
          action={getPathname({ href: "/jobs", locale })}
          role="search"
          className="flex max-w-3xl flex-col rounded-3xl border border-mist/40 bg-white p-3 sm:flex-row sm:items-center sm:p-2"
        >
          <label className="flex flex-1 flex-col px-4 py-2">
            <span className="text-sm font-black text-slate">{t("searchLabel")}</span>
            <input name="q" defaultValue={q} className="bg-transparent text-lg outline-none" />
          </label>
          <span className="mx-1 h-px bg-[#E8E6E1] sm:h-10 sm:w-px" />
          <label className="flex flex-1 flex-col px-4 py-2">
            <span className="text-sm font-black text-slate">{th("where")}</span>
            <input
              name="where"
              defaultValue={where}
              placeholder={th("wherePlaceholder")}
              className="bg-transparent text-lg outline-none"
            />
          </label>
          {category && <input type="hidden" name="category" value={category} />}
          <button type="submit" className="mt-2 rounded-2xl bg-ink px-8 py-4 text-lg font-black text-paper sm:mt-0">
            {th("search")}
          </button>
        </form>

        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {[null, ...CATEGORIES].map((c) => (
            <li key={c ?? "all"} className="shrink-0">
              <Link
                href={{ pathname: "/jobs", query: query(c) }}
                aria-current={c === category ? "page" : undefined}
                className={`inline-block rounded-full px-5 py-2.5 font-black ${
                  c === category ? "bg-ink text-paper" : "border border-mist/60"
                }`}
              >
                {c ? tc(`${c}Plural`) : t("allJobs")}
              </Link>
            </li>
          ))}
        </ul>

        <p className="font-black text-slate">{t("count", { count: jobs.length })}</p>
        {jobs.length === 0 ? (
          <p className="rounded-3xl bg-white p-5 text-slate">{t("noJobs")}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {jobs.map((j) => (
              <li key={j.id}>
                <JobCard job={j} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
