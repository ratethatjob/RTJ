"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideApplication, setJobStatus } from "@/app/[locale]/business/jobs/actions";

export function JobStatusButton({ id, status }: { id: string; status: "draft" | "open" | "closed" }) {
  const t = useTranslations("BusinessJobs");
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  if (status === "draft") return null;
  const next = status === "open" ? "closed" : "open";
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setJobStatus(id, next);
            if (result.error) return setError(true);
            router.refresh();
          })
        }
        className="rounded-2xl border-2 border-ink px-5 py-2.5 font-black disabled:opacity-60"
      >
        {status === "open" ? t("close") : t("reopen")}
      </button>
      {error && <span className="font-black">{t("error")}</span>}
    </>
  );
}

const DECISIONS = ["interviewing", "hired", "rejected"] as const;

export function ApplicationDecision({ id, status }: { id: string; status: string }) {
  const t = useTranslations("BusinessJobs");
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = { interviewing: t("interview"), hired: t("hire"), rejected: t("reject") };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E8E6E1] pt-4">
      {DECISIONS.filter((d) => d !== status).map((d) => (
        <button
          key={d}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await decideApplication(id, d);
              if (result.error) return setError(true);
              router.refresh();
            })
          }
          className={`rounded-2xl px-4 py-2.5 font-black disabled:opacity-60 ${
            d === "interviewing" ? "bg-ink text-paper" : "border-2 border-ink"
          }`}
        >
          {label[d]}
        </button>
      ))}
      {error && <span className="font-black">{t("error")}</span>}
    </div>
  );
}
