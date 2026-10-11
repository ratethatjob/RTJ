import { getTranslations, setRequestLocale } from "next-intl/server";
import { BackLink } from "@/components/app/back-link";
import { PlaceSearch } from "@/components/app/place-search";
import { SearchIcon } from "@/components/icons";
import { Link, getPathname } from "@/i18n/navigation";
import { searchLocations } from "@/lib/data";
import { placesProvider } from "@/lib/places";

export const instant = false;

export default async function RatePickerPage({ params, searchParams }: PageProps<"/[locale]/app/rate">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 80) : "";
  const results = query ? await searchLocations(query) : [];
  const t = await getTranslations("RatePicker");
  const tw = await getTranslations("NewWorkplace");
  const tc = await getTranslations("Categories");
  const tp = await getTranslations("Places");
  const provider = await placesProvider();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-4">
      <BackLink href={getPathname({ href: "/", locale })} />
      <h1 className="mt-4 text-4xl font-black tracking-brand">{t("title")}</h1>
      <p className="mt-2 text-slate">{t("hint")}</p>
      <form role="search" className="mt-6 flex items-center gap-2 rounded-2xl border border-mist/60 bg-white p-2 pl-4">
        <SearchIcon className="size-5 text-slate" />
        <input
          name="q"
          defaultValue={query}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="flex-1 bg-transparent py-2 text-lg outline-none"
        />
        <button className="rounded-xl bg-ink px-5 py-3 font-black text-paper">{t("search")}</button>
      </form>

      {query && (
        <ul className="mt-6 flex flex-col gap-3">
          {results.length === 0 && <li className="text-slate">{t("noResults")}</li>}
          {results.map((l) => (
            <li key={l.id}>
              <Link href={`/app/rate/${l.id}`} className="block rounded-3xl bg-white p-5">
                <span className="block text-xl font-black tracking-brand">{l.name}</span>
                <span className="text-slate">
                  {l.address}, {l.city} · {tc(l.category)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {provider && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-black">{tp(provider === "osm" ? "titleOsm" : "title")}</h2>
          <PlaceSearch provider={provider} initialQuery={query} />
        </section>
      )}

      <p className="mt-8 text-slate">
        {provider ? tp(provider === "osm" ? "notOnMapOsm" : "notOnMap") : tw("cantFind")}{" "}
        <Link
          href={{ pathname: "/app/rate/new", query: query ? { q: query } : {} }}
          className="font-black text-ink underline underline-offset-4"
        >
          {tw("addIt")}
        </Link>
      </p>
    </main>
  );
}
