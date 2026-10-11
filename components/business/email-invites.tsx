"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { type InviteResult, sendInvites } from "@/app/[locale]/business/invite/actions";
import { MAX_INVITES, parseInviteText } from "@/lib/invites";

export function EmailInvites({ locationId, defaultLocale }: { locationId: string; defaultLocale: "en" | "hu" }) {
  const t = useTranslations("Business");
  const router = useRouter();
  const [text, setText] = useState("");
  const [locale, setLocale] = useState(defaultLocale);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [pending, start] = useTransition();
  const people = useMemo(() => parseInviteText(text), [text]);
  const tooMany = people.length > MAX_INVITES;

  async function addFile(file: File | undefined) {
    if (!file) return;
    const content = await file.text();
    setText((v) => (v.trim() ? `${v.trim()}\n${content}` : content));
  }

  function send() {
    setResult(null);
    start(async () => {
      const r = await sendInvites(locationId, people, locale);
      setResult(r);
      if (r.ok) {
        setText("");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl bg-paper p-5">
      <p className="mb-1 font-black">{t("emailTitle")}</p>
      <p className="mb-3 text-slate">{t("emailHint")}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={t("emailPlaceholder")}
        aria-label={t("emailTitle")}
        className="w-full rounded-xl border border-mist/60 bg-white px-4 py-3"
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl border-2 border-ink bg-white px-4 py-2 font-black">
          {t("csvUpload")}
          <input
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => {
              addFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <label className="flex items-center gap-2 text-slate">
          {t("emailLanguage")}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as "en" | "hu")}
            className="rounded-xl border border-mist/60 bg-white px-3 py-2 text-ink"
          >
            <option value="en">English</option>
            <option value="hu">Magyar</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-sm text-slate">{t("emailLanguageHint")}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={send}
          disabled={pending || people.length === 0 || tooMany}
          className="rounded-xl bg-ink px-5 py-3 font-black text-paper disabled:opacity-50"
        >
          {pending ? t("emailSending") : t("emailSend", { count: people.length })}
        </button>
        {tooMany && <p className="text-sm font-black">{t("emailTooMany", { max: MAX_INVITES })}</p>}
      </div>
      {result && (
        <p role="status" className="mt-3 font-black">
          {result.ok
            ? t("emailResult", { sent: result.sent, skipped: result.skipped })
            : t(`emailError.${result.error}`, { max: MAX_INVITES })}
        </p>
      )}
      <p className="mt-4 text-sm text-slate">{t("emailPrivacy")}</p>
    </div>
  );
}
