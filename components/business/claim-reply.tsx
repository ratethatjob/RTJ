"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { replyToClaim } from "@/app/[locale]/business/actions";
import { CLAIM_DOC_TYPES, claimDocOk, uploadClaimDocument } from "@/lib/claim-upload";

/** The claimant's answer to "we need more information": text and/or a (new) document. */
export function ClaimReply({ claimId, userId }: { claimId: string; userId: string }) {
  const t = useTranslations("Business");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    setError(null);
    if (file && !claimDocOk(file)) return setError(t("documentError"));
    start(async () => {
      let path = "";
      if (file) {
        const uploaded = await uploadClaimDocument(userId, claimId, file);
        if (!uploaded) return setError(t("documentError"));
        path = uploaded;
      }
      const result = await replyToClaim(claimId, body, path);
      if (result.error) return setError(t("error"));
      setBody("");
      setFile(null);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        aria-label={t("claimReply")}
        placeholder={t("claimReply")}
        className="w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 outline-none focus:border-ink"
      />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-black">{t("claimAddDocument")}</span>
        <input
          type="file"
          accept={CLAIM_DOC_TYPES.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full min-w-0 rounded-2xl border border-mist/60 bg-white px-4 py-2"
        />
      </label>
      {error && <p className="font-black">{error}</p>}
      <button
        type="button"
        onClick={send}
        disabled={pending || (!body.trim() && !file)} aria-busy={pending}
        className="self-start rounded-2xl bg-ink px-5 py-3 font-black text-paper disabled:opacity-50"
      >
        {t("claimSendReply")}
      </button>
    </div>
  );
}
