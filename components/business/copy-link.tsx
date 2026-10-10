"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const t = useTranslations("Business");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        aria-label={t("shareable")}
        className="min-w-0 flex-1 rounded-xl border border-mist/60 bg-white px-4 py-3"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="rounded-xl border-2 border-ink bg-white px-5 py-3 font-black"
      >
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}
