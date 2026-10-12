"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { openMapPlace } from "@/app/[locale]/search/actions";
import { DidYouMean } from "@/components/did-you-mean";
import type { PlaceCandidate } from "@/lib/place-ensure";
import type { MapResult } from "@/lib/place-search";
import { placeTypeLabel } from "@/lib/place-types";

/** Map places to pick from; a new one becomes a workplace page on the click. */
export function MapPick({ results, sessionToken }: { results: MapResult[]; sessionToken: string }) {
  const t = useTranslations("Search");
  const tp = useTranslations("Places");
  const locale = useLocale();
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ask, setAsk] = useState<{ result: MapResult; candidates: PlaceCandidate[] } | null>(null);

  function open(r: MapResult, choice?: { confirm?: string; force?: boolean }) {
    setError(null);
    setOpening(r.placeId);
    if (r.href) return router.push(r.href);
    startTransition(async () => {
      const result = await openMapPlace(r.placeId, sessionToken, choice);
      if (result.href) return router.push(result.href);
      setOpening(null);
      if (result.candidates) return setAsk({ result: r, candidates: result.candidates });
      setError(result.error === "limit" ? tp("limit") : tp("error"));
    });
  }

  if (ask) {
    return (
      <DidYouMean
        candidates={ask.candidates}
        pending={pending || opening !== null}
        error={error}
        onYes={(id) => open(ask.result, { confirm: id })}
        onNo={() => open(ask.result, { force: true })}
        onBack={() => setAsk(null)}
      />
    );
  }

  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2">
        {results.map((r) => (
          <li key={r.placeId}>
            <button
              type="button"
              disabled={opening !== null}
              onClick={() => open(r)}
              className="flex h-full w-full items-center justify-between gap-3 rounded-2xl border border-mist/60 bg-white p-4 text-left disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block font-black">{r.main}</span>
                <span className="block text-sm text-slate" data-place-type={r.placeType ?? undefined}>
                  {[placeTypeLabel(r.placeType, locale), r.secondary].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-sm font-black">
                {opening === r.placeId ? t("opening") : r.locationId ? tp("onRtj") : "›"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="font-black">
          {error}
        </p>
      )}
    </>
  );
}
