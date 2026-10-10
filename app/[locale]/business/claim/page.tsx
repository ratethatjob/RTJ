import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { searchLocations } from "@/lib/data";

export const instant = false;

export default async function ClaimSearchPage({ params, searchParams }: PageProps<"/[locale]/business/claim">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 80) : "";
  const results = query ? await searchLocations(query) : [];
  const t = await getTranslations("Business");
  const tp = await getTranslations("RatePicker");
  const tc = await getTranslations("Categories");

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-4xl font-black tracking-brand">{t("claimTitle")}</h1>
      <p className="mt-2 text-slate">{t("claimSearchHint")}</p>
      <form role="search" className="mt-6 flex items-center gap-2 rounded-2xl border border-mist/60 bg-white p-2 pl-4">
        <SearchIcon className="size-5 text-slate" />
        <input name="q" defaultValue={query} placeholder={tp("placeholder")} aria-label={tp("placeholder")} className="flex-1 bg-transparent py-2 text-lg outline-none" />
        <button className="rounded-xl bg-ink px-5 py-3 font-black text-paper">{tp("search")}</button>
      </form>
      {query && (
        <ul className="mt-6 flex flex-col gap-3">
          {results.length === 0 && <li className="text-slate">{tp("noResults")}</li>}
          {results.map((l) => (
            <li key={l.id}>
              <Link href={`/business/claim/${l.id}`} className="block rounded-3xl bg-white p-5">
                <span className="block text-xl font-black tracking-brand">{l.name}</span>
                <span className="text-slate">
                  {l.address}, {l.city} · {tc(l.category)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8">
        <Link href={{ pathname: "/business/claim/new", query: query ? { q: query } : {} }} className="font-black underline underline-offset-4">
          {t("claimNotListed")}
        </Link>
      </p>
    </main>
  );
}
