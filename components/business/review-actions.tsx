"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { disputeReview, postReply } from "@/app/[locale]/business/actions";

type Props = {
  reviewId: string;
  locationId: string;
  orgId: string;
  existingReply: string | null;
  canDispute: boolean;
  startOpen: boolean;
};

export function ReviewActions({ reviewId, locationId, orgId, existingReply, canDispute, startOpen }: Props) {
  const t = useTranslations("Business");
  const [mode, setMode] = useState<"closed" | "reply" | "dispute">(startOpen ? "reply" : "closed");
  const [text, setText] = useState(existingReply ?? "");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(kind: "reply" | "dispute") {
    setMessage(null);
    startTransition(async () => {
      const result =
        kind === "reply"
          ? await postReply(reviewId, locationId, text)
          : await disputeReview(reviewId, orgId, reason);
      if (result.error) return setMessage(t("error"));
      setMessage(kind === "reply" ? t("saved") : t("disputeSent"));
      if (kind === "dispute") setMode("closed");
    });
  }

  if (mode === "closed") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E8E6E1] pt-4">
        <button type="button" onClick={() => setMode("reply")} className="rounded-2xl border-2 border-ink px-5 py-3 font-black">
          {existingReply ? t("updateReply") : t("reply")}
        </button>
        {canDispute && (
          <button type="button" onClick={() => setMode("dispute")} className="rounded-2xl border border-mist px-5 py-3 font-black">
            {t("dispute")}
          </button>
        )}
        {message && <span className="font-black text-slate">{message}</span>}
      </div>
    );
  }

  const isReply = mode === "reply";
  return (
    <div className="mt-4 border-t border-[#E8E6E1] pt-4">
      <label className="flex flex-col gap-2">
        <span className="font-black">{isReply ? t("yourReply") : t("disputeReason")}</span>
        <textarea
          value={isReply ? text : reason}
          onChange={(e) => (isReply ? setText(e.target.value) : setReason(e.target.value))}
          rows={4}
          maxLength={isReply ? 3000 : 2000}
          placeholder={isReply ? t("replyPlaceholder") : undefined}
          className="w-full rounded-2xl border border-mist/60 px-4 py-3 text-lg outline-none focus:border-ink"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-slate">{message ?? (isReply ? t("replyHint") : "")}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("closed")} className="rounded-2xl px-4 py-3 font-black">
            ✕
          </button>
          <button
            type="button"
            disabled={pending} aria-busy={pending}
            onClick={() => send(mode)}
            className="rounded-2xl bg-ink px-6 py-3 font-black text-paper disabled:opacity-60"
          >
            {isReply ? (existingReply ? t("updateReply") : t("postReply")) : t("sendDispute")}
          </button>
        </div>
      </div>
    </div>
  );
}
