"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { reportReview } from "@/app/[locale]/reports/actions";
import { usePathname, useRouter } from "@/i18n/navigation";

const REASONS = ["personal", "hate", "fake", "spam", "other"] as const;

export function ReportButton({ reviewId }: { reviewId: string }) {
  const t = useTranslations("Report");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (message && !open) return <p className="text-sm text-slate">{message}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="py-1.5 text-sm text-slate underline underline-offset-4">
        {t("report")}
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-3 border-t border-[#E8E6E1] pt-4">
      <p className="font-black">{t("title")}</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={reason === r}
            onClick={() => setReason(r)}
            className={`rounded-xl px-3 py-2 text-sm font-black ${reason === r ? "bg-ink text-paper" : "border border-mist/60"}`}
          >
            {t(`reasons.${r}`)}
          </button>
        ))}
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={2}
        maxLength={1500}
        placeholder={t("details")}
        className="w-full rounded-2xl border border-mist/60 px-4 py-3 outline-none focus:border-ink"
      />
      {message && <p className="font-black">{message}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !reason}
          onClick={() =>
            startTransition(async () => {
              const result = await reportReview(reviewId, reason, details);
              if (result.error === "signin") {
                return router.push({ pathname: "/app/sign-in", query: { next: pathname } });
              }
              if (result.error) return setMessage(t("error"));
              setMessage(t("sent"));
              setOpen(false);
            })
          }
          className="rounded-xl bg-ink px-4 py-2.5 font-black text-paper disabled:opacity-50"
        >
          {t("send")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 font-black">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
