"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logCall, refreshInsight } from "@/app/[locale]/business/jobs/actions";

/** Opens the phone app and notes the call on the application. */
export function CallButton({ applicationId, phone }: { applicationId: string; phone: string }) {
  const t = useTranslations("BusinessJobs");
  return (
    <a
      href={`tel:${phone}`}
      onClick={() => void logCall(applicationId)}
      className="rounded-2xl bg-ink px-4 py-2 font-black text-paper"
    >
      {t("tools.call")}
    </a>
  );
}

export function InsightButton({ jobId, applicationId, refresh }: { jobId: string; applicationId: string; refresh: boolean }) {
  const t = useTranslations("BusinessJobs");
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(false);
            const result = await refreshInsight(jobId, applicationId);
            if (result.error) return setError(true);
            router.refresh();
          })
        }
        className={
          refresh
            ? "text-sm font-black underline underline-offset-4 disabled:opacity-50"
            : "rounded-2xl border-2 border-ink px-4 py-2 font-black disabled:opacity-50"
        }
      >
        {pending ? t("ai.working") : refresh ? t("ai.refresh") : t("ai.generate")}
      </button>
      {error && <span className="text-sm font-black">{t("ai.error")}</span>}
    </span>
  );
}
