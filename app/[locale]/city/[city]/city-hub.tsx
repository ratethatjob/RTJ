import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LocationList } from "@/components/location-list";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { getCity } from "@/lib/data";
import type { Category } from "@/lib/data/types";
import { CATEGORY_SLUGS } from "@/lib/format";

export async function CityHub({ city, category }: { city: string; category: Category | null }) {
  const data = await getCity(city, category);
  if (!data || !data.locations.length) notFound();
  const t = await getTranslations("City");
  const tc = await getTranslations("Categories");
  const ts = await getTranslations("Search");
  const all = category ? (await getCity(city, null))!.locations : data.locations;
  const present = (Object.keys(CATEGORY_SLUGS) as Category[]).filter((c) =>
    all.some((l) => l.category === c),
  );

  return (
    <>
      <SiteHeader withSearch />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-6 sm:px-6 lg:pt-10">
        <div>
          <h1 className="text-4xl font-black tracking-brand lg:text-6xl">
            {category
              ? t("titleCategory", { category: tc(`${category}Plural`), city: data.name })
              : t("title", { city: data.name })}
          </h1>
          <p className="mt-2 text-lg text-slate">{t("count", { count: data.locations.length })}</p>
        </div>
        {present.length > 1 && (
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {[null, ...present].map((c) => (
              <li key={c ?? "all"} className="shrink-0">
                <Link
                  href={c ? `/city/${city}/${CATEGORY_SLUGS[c]}` : `/city/${city}`}
                  aria-current={c === category ? "page" : undefined}
                  className={`inline-block rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                    c === category ? "bg-ink text-paper" : "border border-mist/60"
                  }`}
                >
                  {c ? tc(`${c}Plural`) : ts("all")}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <LocationList locations={data.locations} />
      </main>
    </>
  );
}

export async function cityMetadata(locale: string, city: string, category: Category | null) {
  const data = await getCity(city, category);
  if (!data || !data.locations.length) return null;
  const t = await getTranslations({ locale, namespace: "City" });
  const tc = await getTranslations({ locale, namespace: "Categories" });
  return {
    title: category
      ? t("metaTitleCategory", { category: tc(`${category}Plural`), city: data.name })
      : t("metaTitle", { city: data.name }),
    rated: data.locations.some((l) => l.scores && !l.isDemo),
  };
}
