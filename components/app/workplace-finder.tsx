"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  choosePlace,
  claimPlace,
  findWorkplaces,
  type OwnResult,
  type Suggestion,
} from "@/app/[locale]/app/rate/places/actions";
import { NewWorkplaceForm } from "@/components/app/new-workplace-form";
import { CategorySelect } from "@/components/category-select";
import { SearchIcon } from "@/components/icons";
import { useRouter } from "@/i18n/navigation";
import { locate, readArea, saveArea, subscribeArea } from "@/lib/area-client";
import { placeTypeLabel } from "@/lib/place-types";
import type { PlacesProvider } from "@/lib/places";
import { type AreaChoice, SEARCH_AREAS } from "@/lib/search-areas";

type Place = {
  placeId: string;
  name: string;
  address: string;
  city: string;
  category: string | null;
  placeTypeLabel: { en: string | null; hu: string | null };
  certain: boolean;
};

type Props = {
  /** "rate": write a review (works signed out); "claim": employer claims the workplace. */
  mode: "rate" | "claim";
  provider: PlacesProvider | null;
  initialQuery?: string;
  /** Where "Automatic" searches (the visitor's city), e.g. "Budapest"; null = everywhere. */
  autoArea: string | null;
  defaultCountry: string;
  /** Localized base for the manual form: /app/rate or /business/claim. */
  manualBase: string;
};

/** One search field for picking a workplace: RateThatJob first, then the map, no duplicates. */
export function WorkplaceFinder({ mode, provider, initialQuery = "", autoArea, defaultCountry, manualBase }: Props) {
  const t = useTranslations("Places");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const base = mode === "claim" ? "/business/claim" : "/app/rate";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<{ for: string; own: OwnResult[]; map: Suggestion[] } | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [category, setCategory] = useState("");
  const [picked, setPicked] = useState(false);
  const [manual, setManual] = useState(false);
  const manualRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (manual) manualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [manual]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // One billing session per search: autocomplete calls plus the chosen place's details.
  const session = useRef("");
  // Where to look first; shared with the home page "near you" (cookie).
  const area = useSyncExternalStore(subscribeArea, readArea, () => "auto" as AreaChoice);
  const [areaOpen, setAreaOpen] = useState(false);
  const [areaError, setAreaError] = useState(false);

  const text = query.trim();
  useEffect(() => {
    if (!session.current) session.current = crypto.randomUUID();
    if (text.length < 2) return;
    let live = true;
    const timer = setTimeout(async () => {
      const found = await findWorkplaces(text, session.current, area).catch(() => null);
      if (!live) return;
      setError(found && !found.error ? null : t("error"));
      setResults({ for: `${text}|${area}`, own: found?.own ?? [], map: found?.map ?? [] });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text, area, t]);

  const current = text.length >= 2 && results?.for === `${text}|${area}` ? results : null;
  const searching = text.length >= 2 && !current;

  function chooseArea(value: string) {
    setAreaError(false);
    if (value !== "here") {
      saveArea(value as AreaChoice);
      return setAreaOpen(false);
    }
    // Browser location only when the person asks for it; rounded to about 1 km.
    locate().then(
      (v) => {
        saveArea(v);
        setAreaOpen(false);
      },
      () => setAreaError(true),
    );
  }

  function pickMap(s: Suggestion) {
    if (s.locationId) return router.push(`${base}/${s.locationId}`);
    startTransition(async () => {
      const result = await choosePlace(s.placeId, session.current);
      session.current = crypto.randomUUID();
      if (result.locationId) return router.push(`${base}/${result.locationId}`);
      if (!result.place) return setError(t("error"));
      setError(null);
      setPlace(result.place);
      setCategory(result.place.category ?? "");
      setPicked(false);
    });
  }

  function confirm() {
    if (!place) return;
    if (mode === "rate") {
      // Reviews: the workplace is created only when the review is sent (after signing in).
      return router.push({
        pathname: "/app/rate/pending",
        query: {
          place: place.placeId,
          name: place.name,
          address: [place.address, place.city].filter(Boolean).join(", "),
          ...(category && { category }),
        },
      });
    }
    startTransition(async () => {
      const result = await claimPlace(place.placeId, category);
      if (!result.locationId) return setError(result.error === "limit" ? t("limit") : t("error"));
      router.push(`/business/claim/${result.locationId}`);
    });
  }

  if (place) {
    return (
      <div className="flex flex-col gap-4 rounded-3xl bg-white p-5">
        <div>
          <p className="text-xl font-black tracking-brand">{place.name}</p>
          <p className="text-slate">
            {[locale === "hu" ? place.placeTypeLabel.hu : place.placeTypeLabel.en, [place.address, place.city].filter(Boolean).join(", ")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="font-black">{t("category")}</span>
          <CategorySelect
            value={category}
            onChange={(next) => {
              setPicked(true);
              setCategory(next);
            }}
            suggested={!picked && !place.certain}
            className="w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 text-lg outline-none focus:border-ink"
          />
        </label>
        {error && <p className="font-black">{error}</p>}
        <button
          type="button"
          disabled={pending} aria-busy={pending}
          onClick={confirm}
          className="rounded-2xl bg-ink px-5 py-3 text-base font-black text-paper disabled:opacity-50"
        >
          {t(mode === "claim" ? "addAndClaim" : "addAndRate")}
        </button>
        <button type="button" onClick={() => setPlace(null)} className="py-2 font-black underline underline-offset-4">
          {t("back")}
        </button>
      </div>
    );
  }

  const areaText =
    area === "any"
      ? t("everywhere")
      : area.startsWith("geo:")
        ? t("nearMe")
        : area in SEARCH_AREAS
          ? t("nearPlace", { place: t(`areas.${area}`) })
          : autoArea
            ? t("nearPlace", { place: autoArea })
            : t("everywhere");
  const count = (current?.own.length ?? 0) + (current?.map.length ?? 0);

  return (
    <div className="flex flex-col">
      <label className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white pl-3 pr-1 focus-within:ring-4 focus-within:ring-ink/10">
        <SearchIcon className="size-5 shrink-0 text-slate" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setManual(false);
          }}
          placeholder={t("finderPlaceholder")}
          aria-label={t("finderPlaceholder")}
          enterKeyHint="search"
          autoComplete="off"
          className="w-full min-w-0 bg-transparent py-4 text-lg outline-none placeholder:text-base placeholder:text-slate/80 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setManual(false);
            }}
            aria-label={t("clear")}
            className="grid size-10 shrink-0 place-items-center rounded-xl text-slate"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </label>

      <p className="mt-2 text-sm text-slate">
        {areaText} ·{" "}
        <button
          type="button"
          onClick={() => setAreaOpen((o) => !o)}
          aria-expanded={areaOpen}
          className="font-black text-ink underline underline-offset-4"
        >
          {t("change")}
        </button>
      </p>
      {areaOpen && (
        <label className="mt-2 flex flex-col gap-1">
          <span className="sr-only">{t("areaLabel")}</span>
          <select
            value={area.startsWith("geo:") ? "here" : area}
            onChange={(e) => chooseArea(e.target.value)}
            className="w-full rounded-xl border border-mist/60 bg-white px-3 py-3 text-base font-black"
          >
            <option value="auto">{autoArea ? t("areaAutoPlace", { place: autoArea }) : t("areaAuto")}</option>
            <option value="here">{t("areaHere")}</option>
            {Object.keys(SEARCH_AREAS).map((id) => (
              <option key={id} value={id}>
                {t(`areas.${id}`)}
              </option>
            ))}
            <option value="any">{t("areaAny")}</option>
          </select>
          {areaError && <span className="text-sm font-black">{t("areaHereError")}</span>}
        </label>
      )}

      {searching && (
        <p role="status" className="mt-5 text-slate">
          {t("searching")}
        </p>
      )}
      {error && <p className="mt-4 font-black">{error}</p>}

      {current && (
        <div className="mt-5 flex flex-col gap-2">
          {count === 0 && <p className="text-slate">{t("noResults")}</p>}
          {count > 0 && (
            <ul className="flex flex-col gap-2">
              {current.own.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`${base}/${o.id}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block font-black">{o.name}</span>
                      <span className="block text-sm text-slate">{[o.address, o.city].filter(Boolean).join(", ")}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      {o.score !== null && o.reviewCount > 0 ? (
                        <>
                          <span className="rounded-lg bg-ink px-2 py-0.5 text-lg font-black text-signal">
                            {format.number(o.score, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </span>
                          <span className="mt-0.5 text-xs text-slate">{t("reviews", { count: o.reviewCount })}</span>
                        </>
                      ) : (
                        <span className="rounded-lg bg-[#E8E6E1] px-2 py-1 text-xs font-black">{t("onRtj")}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
              {current.map.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    disabled={pending} aria-busy={pending}
                    onClick={() => pickMap(s)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-mist/60 bg-paper p-4 text-left disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block font-black">{s.main}</span>
                      <span className="block text-sm text-slate">
                        {[placeTypeLabel(s.placeType, locale), s.secondary].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {s.locationId ? (
                      <span className="shrink-0 rounded-lg bg-[#E8E6E1] px-2 py-1 text-xs font-black">{t("onRtj")}</span>
                    ) : (
                      <span className="shrink-0 text-xs font-black text-slate">{t("fromMap")}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!manual && (
            <p className="mt-3 text-center">
              {t("notListed")}{" "}
              <button
                type="button"
                onClick={() => setManual(true)}
                className="font-black underline underline-offset-4"
              >
                {t("addManually")}
              </button>
            </p>
          )}
          {provider && current.map.length > 0 && (
            <p className="mt-3 text-center text-xs text-slate">
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
          )}
        </div>
      )}

      {manual && (
        <section ref={manualRef} className="mt-6 border-t border-mist/60 pt-6">
          <h2 className="text-2xl font-black tracking-brand">{t("manualTitle")}</h2>
          <NewWorkplaceForm
            key={text}
            initialName={text}
            defaultCountry={defaultCountry}
            rateBase={manualBase}
            claim={mode === "claim"}
          />
        </section>
      )}
    </div>
  );
}
