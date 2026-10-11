import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CategoryChips } from "@/components/category-chips";
import { JobCard } from "@/components/jobs/job-card";
import { SiteHeader } from "@/components/site-header";
import { getPathname, Link } from "@/i18n/navigation";
import { isCategory } from "@/lib/data";
import { findJobs } from "@/lib/data/jobs";
import { isLanguageCode, JOB_LANGUAGES, languageName } from "@/lib/languages";
import { localeAlternates } from "@/lib/seo";

type Props = PageProps<"/[locale]/jobs">;

export const instant = false;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "Jobs" });
  const filtered = Boolean(sp.q || sp.where || sp.category || sp.quick || sp.lang);
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
  const quick = sp.quick === "1";
  const lang = isLanguageCode(sp.lang) ? sp.lang : null;
  const t = await getTranslations("Jobs");
  const th = await getTranslations("Home");
  const jobs = await findJobs(q, where, category, quick, lang);
  const query = (c: string | null, quickOnly = quick) => ({
    ...(q && { q }),
    ...(where && { where }),
    ...(c && { category: c }),
    ...(quickOnly && { quick: "1" }),
    ...(lang && { lang }),
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-6 sm:px-6 lg:pt-10">
        <h1 className="text-4xl font-black tracking-brand lg:text-6xl">{t("title")}</h1>
        <form
          action={getPathname({ href: "/jobs", locale })}
          role="search"
          className="flex max-w-4xl flex-col rounded-3xl border border-mist/40 bg-white p-3 sm:flex-row sm:items-center sm:p-2"
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
          <span className="mx-1 h-px bg-[#E8E6E1] sm:h-10 sm:w-px" />
          <label className="flex flex-col px-4 py-2">
            <span className="text-sm font-black text-slate">{t("languageFilter")}</span>
            <select name="lang" defaultValue={lang ?? ""} className="bg-transparent text-lg outline-none">
              <option value="">{t("anyLanguage")}</option>
              {JOB_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {languageName(code, locale)}
                </option>
              ))}
            </select>
          </label>
          {category && <input type="hidden" name="category" value={category} />}
          {quick && <input type="hidden" name="quick" value="1" />}
          <button type="submit" className="mt-2 rounded-2xl bg-ink px-8 py-4 text-lg font-black text-paper sm:mt-0">
            {th("search")}
          </button>
        </form>

        <CategoryChips
          active={category}
          href={(c) => ({ pathname: "/jobs", query: query(c) })}
          lead={
            <>
              <li className="shrink-0">
                <Link
                  href={{ pathname: "/jobs", query: query(category, !quick) }}
                  aria-pressed={quick}
                  className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 font-black ${
                    quick ? "bg-ink text-signal" : "border border-ink"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
                  </svg>
                  {t("quickOnly")}
                </Link>
              </li>
              <li className="shrink-0">
                <Link
                  href={{ pathname: "/jobs", query: query(null) }}
                  aria-current={category === null ? "page" : undefined}
                  className={`inline-block rounded-full px-5 py-2.5 font-black ${
                    category === null ? "bg-ink text-paper" : "border border-mist/60"
                  }`}
                >
                  {t("allJobs")}
                </Link>
              </li>
            </>
          }
        />

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
