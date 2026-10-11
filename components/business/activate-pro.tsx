"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestPro } from "@/app/[locale]/business/actions";

/** Monthly / yearly activation request for one location. */
export function ActivatePro({ locationId, pending }: { locationId: string; pending: "month" | "year" | null }) {
  const t = useTranslations("Plan");
  const router = useRouter();
  const [error, setError] = useState(false);
  const [busy, startTransition] = useTransition();

  if (pending) {
    return <span className="text-sm font-black">{t("requested", { interval: t(`intervals.${pending}`) })}</span>;
  }
  const ask = (interval: "month" | "year") =>
    startTransition(async () => {
      setError(false);
      const result = await requestPro(locationId, interval);
      if (result.error) return setError(true);
      router.refresh();
    });
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      {(["month", "year"] as const).map((i) => (
        <button
          key={i}
          type="button"
          disabled={busy} aria-busy={busy}
          onClick={() => ask(i)}
          className={`rounded-xl px-3 py-2 text-sm font-black disabled:opacity-50 ${
            i === "year" ? "bg-ink text-paper" : "border-2 border-ink"
          }`}
        >
          {t(`activate_${i}`)}
        </button>
      ))}
      {error && <span className="w-full text-right text-sm font-black">{t("error")}</span>}
    </span>
  );
}
