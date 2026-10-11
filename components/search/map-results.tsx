import { getTranslations } from "next-intl/server";
import { MapPick } from "@/components/search/map-pick";
import { findMapPlaces } from "@/lib/place-search";
import type { PlacesProvider } from "@/lib/places";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** "Pick the one you mean": map places under the workplaces already on RateThatJob (streamed).
 *  Places already listed above (same page, or same name and street) are left out. The session
 *  token found here is reused by the details call when one is opened (one Google session). */
export async function MapResults({
  q,
  where,
  provider,
  own,
}: {
  q: string;
  where: string;
  provider: PlacesProvider;
  own: { ids: string[]; keys: string[] };
}) {
  const t = await getTranslations("Search");
  const tp = await getTranslations("Places");
  const sessionToken = crypto.randomUUID();
  const found = await findMapPlaces(q, where, sessionToken).catch((e) => {
    console.error("findMapPlaces", e);
    return null;
  });
  const ownKeys = new Set(own.keys.map(norm));
  const list = (found ?? []).filter(
    (r) => !(r.locationId && own.ids.includes(r.locationId)) && !ownKeys.has(norm(`${r.main} ${r.secondary.split(",")[0]}`)),
  );

  if (!list.length) {
    return own.ids.length === 0 ? <p className="font-black text-slate">{t("noneAnywhere")}</p> : null;
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-black tracking-brand">{t("pickOne")}</h2>
      <p className="text-slate">{t("pickOneHint")}</p>
      <MapPick results={list} sessionToken={sessionToken} />
      <p className="text-xs text-slate">
        {provider === "osm"
          ? tp.rich("poweredByOsm", {
              osm: (chunks) => (
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline">
                  {chunks}
                </a>
              ),
            })
          : tp("poweredBy")}
      </p>
    </section>
  );
}

export async function MapResultsFallback() {
  const t = await getTranslations("Search");
  return (
    <p role="status" className="text-slate">
      {t("mapSearching")}
    </p>
  );
}
