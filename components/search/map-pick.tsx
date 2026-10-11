"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { openMapPlace } from "@/app/[locale]/search/actions";
import type { MapResult } from "@/lib/place-search";

/** Map places to pick from; a new one becomes a workplace page on the click. */
export function MapPick({ results, sessionToken }: { results: MapResult[]; sessionToken: string }) {
  const t = useTranslations("Search");
  const tp = useTranslations("Places");
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function open(r: MapResult) {
    setError(null);
    setOpening(r.placeId);
    if (r.href) return router.push(r.href);
    startTransition(async () => {
      const result = await openMapPlace(r.placeId, sessionToken);
      if (result.href) return router.push(result.href);
      setOpening(null);
      setError(result.error === "limit" ? tp("limit") : tp("error"));
    });
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
                <span className="block text-sm text-slate">{r.secondary}</span>
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
