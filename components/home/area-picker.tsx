"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { locate, readArea, rememberTimeZone, saveArea, subscribeArea } from "@/lib/area-client";
import { type AreaChoice, SEARCH_AREAS } from "@/lib/search-areas";

export type AreaPickerLabels = {
  label: string;
  auto: string;
  here: string;
  any: string;
  hereError: string;
  areas: Record<string, string>;
};

/** City picker for the "near you" section (and the desktop header). Saves the choice in the
 *  shared cookie and re-renders the page; "My location" asks the browser only when picked. */
export function AreaPicker({ labels, className = "" }: { labels: AreaPickerLabels; className?: string }) {
  const router = useRouter();
  const area = useSyncExternalStore(subscribeArea, readArea, () => "auto" as AreaChoice);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  // Without an IP location the server falls back to the time zone.
  useEffect(rememberTimeZone, []);

  function choose(value: string) {
    setError(false);
    const apply = (v: AreaChoice) => {
      saveArea(v);
      start(() => router.refresh());
    };
    if (value === "here") return void locate().then(apply, () => setError(true));
    apply(value as AreaChoice);
  }

  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <select
        aria-label={labels.label}
        value={area.startsWith("geo:") ? "here" : area}
        disabled={pending}
        onChange={(e) => choose(e.target.value)}
        className="max-w-full rounded-xl border border-mist/60 bg-white px-3 py-2 text-sm font-black text-ink disabled:opacity-60"
      >
        <option value="auto">{labels.auto}</option>
        <option value="here">{labels.here}</option>
        {Object.keys(SEARCH_AREAS).map((id) => (
          <option key={id} value={id}>
            {labels.areas[id]}
          </option>
        ))}
        <option value="any">{labels.any}</option>
      </select>
      {error && <span className="text-sm font-black">{labels.hereError}</span>}
    </span>
  );
}
