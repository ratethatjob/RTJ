"use client";

import { useTranslations } from "next-intl";
import type { PlaceCandidate } from "@/lib/place-ensure";

/** "Did you mean …?": a picked map place is close to one of ours with a similar name. Yes opens
 *  ours (and links the map place to it); No creates the picked place as a new workplace. */
export function DidYouMean({
  candidates,
  pending,
  error,
  onYes,
  onNo,
  onBack,
}: {
  candidates: PlaceCandidate[];
  pending: boolean;
  error: string | null;
  onYes: (id: string) => void;
  onNo: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("Places");
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-white p-5">
      <p className="text-xl font-black tracking-brand">{t("didYouMean")}</p>
      <ul className="flex flex-col gap-2">
        {candidates.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={pending}
              aria-busy={pending}
              onClick={() => onYes(c.id)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-ink p-4 text-left disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block font-black">{c.name}</span>
                <span className="block text-sm text-slate">{[c.address, c.city].filter(Boolean).join(", ")}</span>
              </span>
              <span className="shrink-0 text-sm font-black">{t("yesThis")}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="font-black">{error}</p>}
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={onNo}
        className="rounded-2xl bg-ink px-5 py-3 text-base font-black text-paper disabled:opacity-50"
      >
        {t("noNewPlace")}
      </button>
      <button type="button" onClick={onBack} className="py-2 font-black underline underline-offset-4">
        {t("back")}
      </button>
    </div>
  );
}
