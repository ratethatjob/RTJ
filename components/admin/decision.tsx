"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  decideClaim,
  decideDispute,
  decideOrder,
  decidePlanOrder,
  decideReport,
  decideVerification,
  moderateReview,
  requestClaimInfo,
} from "@/app/[locale]/admin/actions";

type Props = {
  kind:
    | "claims"
    | "moderation"
    | "verifications"
    | "disputes"
    | "reports"
    | "orders"
    | "plans";
  id: string;
  documentUrl?: string | null;
};

export function Decision({ kind, id, documentUrl }: Props) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [entity, setEntity] = useState("");
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function decide(yes: boolean) {
    setError(false);
    startTransition(async () => {
      const result =
        kind === "claims"
          ? await decideClaim(id, yes)
          : kind === "moderation"
            ? await moderateReview(id, yes)
            : kind === "verifications"
              ? await decideVerification(id, yes, entity)
              : kind === "orders"
                ? await decideOrder(id, yes)
                : kind === "plans"
                  ? await decidePlanOrder(id, yes)
                  : kind === "disputes"
                    ? await decideDispute(id, !yes)
                    : await decideReport(id, !yes);
      if (result.error) return setError(true);
      router.refresh();
    });
  }

  function askForInfo() {
    setError(false);
    startTransition(async () => {
      const result = await requestClaimInfo(id, question);
      if (result.error) return setError(true);
      setQuestion("");
      setAsking(false);
      router.refresh();
    });
  }

  const keepOrRemove = kind === "disputes" || kind === "reports";
  const order = kind === "orders" || kind === "plans";
  const yesLabel = order
    ? t("markPaid")
    : keepOrRemove
      ? t("keep")
      : t("approve");
  const noLabel = order
    ? t("cancelOrder")
    : keepOrRemove
      ? t("remove")
      : t("reject");

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-[#E8E6E1] pt-4">
      {kind === "claims" && documentUrl && (
        <a href={documentUrl} target="_blank" rel="noreferrer" className="font-black underline underline-offset-4">
          {t("openDocument")}
        </a>
      )}
      {kind === "claims" && asking && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-black">{t("infoQuestion")}</span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              maxLength={2000}
              className="rounded-2xl border border-mist/60 px-4 py-3 outline-none focus:border-ink"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !question.trim()}
              onClick={askForInfo}
              className="rounded-2xl bg-ink px-5 py-3 font-black text-paper disabled:opacity-60"
            >
              {t("sendInfoRequest")}
            </button>
            <button type="button" onClick={() => setAsking(false)} className="rounded-2xl px-4 py-3 font-black">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      {kind === "verifications" && (
        <>
          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noreferrer"
              className="font-black underline underline-offset-4"
            >
              {t("openDocument")}
            </a>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-black">{t("legalEntity")}</span>
            <input
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="rounded-2xl border border-mist/60 px-4 py-3 outline-none focus:border-ink"
            />
          </label>
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(true)}
          className="rounded-2xl bg-ink px-5 py-3 font-black text-paper disabled:opacity-60"
        >
          {yesLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide(false)}
          className="rounded-2xl border-2 border-ink px-5 py-3 font-black disabled:opacity-60"
        >
          {noLabel}
        </button>
        {kind === "claims" && !asking && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setAsking(true)}
            className="rounded-2xl px-4 py-3 font-black underline underline-offset-4 disabled:opacity-60"
          >
            {t("requestInfo")}
          </button>
        )}
        {error && <span className="font-black text-slate">{t("error")}</span>}
      </div>
    </div>
  );
}
