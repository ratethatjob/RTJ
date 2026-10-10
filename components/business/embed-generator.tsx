"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

const VARIANTS = ["compact-light", "compact-dark", "wide-light", "wide-dark", "strip", "seal"] as const;
type Variant = (typeof VARIANTS)[number];

type Props = {
  origin: string;
  locationId: string;
  locationName: string;
  profileUrl: string;
  locale: string;
  sealEarned: boolean;
};

export function EmbedGenerator({ origin, locationId, locationName, profileUrl, locale, sealEarned }: Props) {
  const t = useTranslations("Index");
  const [variant, setVariant] = useState<Variant>("compact-light");
  const svgPath = variant === "seal" ? `/embed/${locationId}/seal.svg` : `/embed/${locationId}.svg`;
  const src = `${origin}${svgPath}?style=${variant}&locale=${locale}`;
  const alt = `${locationName} – RateThatJob`;

  const imageCode = `<a href="${profileUrl}">\n  <img src="${src}" alt="${alt}">\n</a>`;
  const scriptCode = `<div class="rtj-index" data-location="${locationId}" data-style="${variant}" data-locale="${locale}">\n  <a href="${profileUrl}">${alt}</a>\n</div>\n<script src="${origin}/widget.js" async></script>`;
  const jsonCode = `GET ${origin}/api/public/locations/${locationId}/index`;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl bg-white p-6">
        <h2 className="mb-3 text-sm font-black uppercase tracking-tagline text-slate">{t("variant")}</h2>
        <div className="flex flex-wrap gap-2">
          {VARIANTS.map((v) => (
            <button
              key={v}
              type="button"
              disabled={v === "seal" && !sealEarned}
              onClick={() => setVariant(v)}
              aria-pressed={v === variant}
              className={`rounded-full px-4 py-2.5 font-black disabled:opacity-40 ${
                v === variant ? "bg-ink text-paper" : "border border-mist/60"
              }`}
            >
              {t(`variants.${v}`)}
            </button>
          ))}
        </div>
        {!sealEarned && <p className="mt-3 text-sm text-slate">{t("sealNotEarned")}</p>}
      </section>

      <section className="rounded-3xl bg-white p-6">
        <h2 className="mb-3 text-sm font-black uppercase tracking-tagline text-slate">{t("preview")}</h2>
        <div
          className={`grid min-h-40 place-items-center overflow-x-auto rounded-2xl p-6 ${
            variant.endsWith("dark") ? "bg-[#E8E6E1]" : "bg-paper"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- live SVG badge */}
          <img key={src} src={src} alt={alt} className="max-w-full" />
        </div>
      </section>

      <Code title={t("imageCode")} code={imageCode} />
      <Code title={t("scriptCode")} code={scriptCode} />
      <Code title={t("jsonCode")} code={jsonCode} />
    </div>
  );
}

function Code({ title, code }: { title: string; code: string }) {
  const t = useTranslations("Index");
  const [copied, setCopied] = useState(false);
  return (
    <section className="rounded-3xl bg-white p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-black">{title}</h2>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 rounded-xl border-2 border-ink px-4 py-2 font-black"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-sm text-paper">
        <code>{code}</code>
      </pre>
    </section>
  );
}
