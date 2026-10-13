"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dismissDuplicate, fillOsmAddresses, mergeLocations, osmImportGroup } from "@/app/[locale]/admin/actions";

type Line = { group: string; text: string };

/** "Import / refresh" one city: every tag group in turn, a line per group. */
export function OsmImportRunner({ cities, groups }: { cities: { slug: string; name: string }[]; groups: string[] }) {
  const t = useTranslations("Admin.osm");
  const router = useRouter();
  const [city, setCity] = useState(cities[0]?.slug ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, startTransition] = useTransition();

  function run() {
    setLines([]);
    startTransition(async () => {
      for (const group of groups) {
        const r = await osmImportGroup(city, group).catch(() => ({ error: "failed" as const }));
        const text =
          "error" in r && r.error
            ? t(r.error === "busy" ? "busy" : "failed")
            : t("line", {
                fetched: "fetched" in r ? r.fetched : 0,
                created: "created" in r ? r.created : 0,
                matched: "matched" in r ? r.matched : 0,
                known: "known" in r ? r.known : 0,
                skipped: "skipped" in r ? r.skipped : 0,
                gone: "gone" in r ? r.gone : 0,
              });
        setLines((l) => [...l, { group, text }]);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label={t("city")}
          className="min-w-0 flex-1 rounded-2xl border border-mist/60 bg-white px-4 py-3"
        >
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          aria-busy={pending}
          className="rounded-2xl bg-ink px-5 py-3 font-black text-paper disabled:opacity-50"
        >
          {pending ? t("running") : t("run")}
        </button>
      </div>
      {lines.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {lines.map((l) => (
            <li key={l.group}>
              <span className="font-black">{l.group}</span> · {l.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One possible duplicate pair: keep A, keep B, or "not the same". */
export function DuplicatePair({ a, b }: { a: string; b: string }) {
  const t = useTranslations("Admin.duplicates");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (fn: () => Promise<{ ok?: true; error?: unknown }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.error) return setError(r.error === "managed" ? t("managed") : t("error"));
      router.refresh();
    });

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => act(() => mergeLocations(a, b))} className="rounded-xl bg-ink px-3 py-2 text-sm font-black text-paper disabled:opacity-50">
        {t("keepA")}
      </button>
      <button type="button" disabled={pending} onClick={() => act(() => mergeLocations(b, a))} className="rounded-xl bg-ink px-3 py-2 text-sm font-black text-paper disabled:opacity-50">
        {t("keepB")}
      </button>
      <button type="button" disabled={pending} onClick={() => act(() => dismissDuplicate(a, b))} className="rounded-xl border border-mist/60 px-3 py-2 text-sm font-black disabled:opacity-50">
        {t("notSame")}
      </button>
      {error && <p className="w-full text-sm font-black">{error}</p>}
    </div>
  );
}

/** "Look up missing addresses": the next batch of the reverse geocoding queue (about 3 minutes). */
export function FillOsmAddresses() {
  const t = useTranslations("Admin.osm");
  const router = useRouter();
  const [line, setLine] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await fillOsmAddresses().catch(() => ({ error: true as const }));
            setLine("error" in r ? t("failed") : t("addressResult", r));
            router.refresh();
          })
        }
        className="self-start rounded-2xl bg-ink px-5 py-3 font-black text-paper disabled:opacity-50"
      >
        {pending ? t("addressRunning") : t("addressRun")}
      </button>
      {line && <p className="text-sm">{line}</p>}
    </div>
  );
}
