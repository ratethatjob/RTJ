"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { choosePlace, confirmPlace, searchPlaces, type Suggestion } from "@/app/[locale]/app/rate/places/actions";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { PlacesProvider } from "@/lib/places";
import { locate, readArea, saveArea, subscribeArea } from "@/lib/area-client";
import { type AreaChoice, SEARCH_AREAS } from "@/lib/search-areas";

const CATEGORIES = ["restaurant", "retail", "warehouse", "factory", "office"] as const;

type Place = { placeId: string; name: string; address: string; city: string; category: string | null };

/** Find a workplace on Google Maps or OpenStreetMap; one RateThatJob page per place. */
export function PlaceSearch({ initialQuery = "", provider }: { initialQuery?: string; provider: PlacesProvider }) {
  const t = useTranslations("Places");
  const tc = useTranslations("Categories");
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [category, setCategory] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // One billing session per search: autocomplete calls plus the chosen place's details.
  const session = useRef<string>("");
  // Where to look first; the last choice is remembered on this device.
  const area = useSyncExternalStore(subscribeArea, readArea, () => "auto" as AreaChoice);
  const [areaError, setAreaError] = useState(false);

  function chooseArea(value: string) {
    setAreaError(false);
    const remember = (v: AreaChoice) => saveArea(v);
    if (value !== "here") return remember(value as AreaChoice);
    // Browser location only when the person asks for it; rounded to about 1 km.
    locate().then(remember, () => setAreaError(true));
  }

  useEffect(() => {
    if (!session.current) session.current = crypto.randomUUID();
    const text = query.trim();
    if (text.length < 3 || place) return;
    const timer = setTimeout(async () => {
      const result = await searchPlaces(text, session.current, area);
      if (result.error === "signin") {
        return router.push({ pathname: "/app/sign-in", query: { next: pathname } });
      }
      if (result.error) return setError(t("error"));
      setError(null);
      setSuggestions(result.suggestions ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, place, area, router, pathname, t]);

  function pick(s: Suggestion) {
    if (s.locationId) return router.push(`/app/rate/${s.locationId}`);
    startTransition(async () => {
      const result = await choosePlace(s.placeId, session.current);
      session.current = crypto.randomUUID();
      if (result.locationId) return router.push(`/app/rate/${result.locationId}`);
      if (!result.place) return setError(t("error"));
      setPlace(result.place);
      setCategory(result.place.category ?? "");
    });
  }

  function confirm() {
    if (!place || !category) return;
    startTransition(async () => {
      const result = await confirmPlace(place.placeId, category);
      if (result.error || !result.locationId) {
        return setError(result.error === "limit" ? t("limit") : t("error"));
      }
      router.push(`/app/rate/${result.locationId}`);
    });
  }

  if (place) {
    return (
      <div className="flex flex-col gap-4 rounded-3xl bg-white p-5">
        <div>
          <p className="text-xl font-black tracking-brand">{place.name}</p>
          <p className="text-slate">
            {place.address}, {place.city}
          </p>
        </div>
        <fieldset>
          <legend className="mb-2 font-black">{t("category")}</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`rounded-2xl px-4 py-2.5 font-black ${category === c ? "bg-ink text-paper" : "border border-mist/60"}`}
              >
                {tc(c)}
              </button>
            ))}
          </div>
        </fieldset>
        {error && <p className="font-black">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !category}
            onClick={confirm}
            className="rounded-2xl bg-ink px-6 py-3 font-black text-paper disabled:opacity-50"
          >
            {t("addAndRate")}
          </button>
          <button type="button" onClick={() => setPlace(null)} className="rounded-2xl px-4 py-3 font-black">
            {t("back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="w-full min-w-0 flex-1 rounded-2xl border border-mist/60 bg-white px-4 py-3 text-lg outline-none focus:border-ink"
        />
        <label className="flex items-center gap-2 text-sm font-black text-slate">
          {t("near")}
          <select
            value={area.startsWith("geo:") ? "here" : area}
            onChange={(e) => chooseArea(e.target.value)}
            className="min-w-0 flex-1 rounded-2xl border border-mist/60 bg-white px-3 py-3 text-base font-medium text-ink sm:flex-none"
          >
            <option value="auto">{t("areaAuto")}</option>
            <option value="here">{t("areaHere")}</option>
            {Object.keys(SEARCH_AREAS).map((id) => (
              <option key={id} value={id}>
                {t(`areas.${id}`)}
              </option>
            ))}
            <option value="any">{t("areaAny")}</option>
          </select>
        </label>
      </div>
      {areaError && <p className="text-sm font-black">{t("areaHereError")}</p>}
      {error && <p className="font-black">{error}</p>}
      {suggestions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                disabled={pending}
                onClick={() => pick(s)}
                className="flex w-full items-start justify-between gap-3 rounded-2xl bg-white p-4 text-left disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block font-black">{s.main}</span>
                  <span className="text-sm text-slate">{s.secondary}</span>
                </span>
                {s.locationId && (
                  <span className="shrink-0 rounded-lg bg-signal px-2 py-1 text-xs font-black">{t("onRtj")}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate">
        {provider === "osm"
          ? t.rich("poweredByOsm", {
              osm: (chunks) => (
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline">
                  {chunks}
                </a>
              ),
            })
          : t("poweredBy")}
      </p>
    </div>
  );
}
