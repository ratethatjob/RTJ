"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type Scope = "job" | "location" | "company";

type Props = {
  origin: string;
  locale: string;
  location: { id: string; name: string; profileUrl: string };
  company: { slug: string; name: string; url: string };
  jobs: { id: string; title: string; url: string }[];
};

const LOCALES = ["en", "hu"] as const;

export function JobsEmbedGenerator({ origin, locale, location, company, jobs }: Props) {
  const t = useTranslations("Index.jobs");
  const ti = useTranslations("Index");
  const [scope, setScope] = useState<Scope>("location");
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<string>(LOCALES.includes(locale as "en") ? locale : "en");

  const job = jobs.find((j) => j.id === jobId);
  const target =
    scope === "job" && job
      ? { id: job.id, href: job.url, label: job.title }
      : scope === "company"
        ? { id: company.slug, href: company.url, label: t("fallback", { name: company.name }) }
        : { id: location.id, href: location.profileUrl, label: t("fallback", { name: location.name }) };
  const code =
    `<div data-rtj-jobs="${scope}" data-id="${target.id}" data-theme="${theme}" data-locale="${lang}">\n` +
    `  <a href="${target.href}">${target.label.replace(/[<>&"]/g, "")}</a>\n` +
    `</div>\n<script src="${origin}/widget.js" async></script>`;
  const preview = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;background:${
    theme === "dark" ? "#E8E6E1" : "#F4F2EE"
  }}</style></head><body>${code}</body></html>`;

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2.5 font-black ${active ? "bg-ink text-paper" : "border border-mist/60"}`;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-5 rounded-3xl bg-white p-6">
        <div>
          <h2 className="mb-3 text-sm font-black uppercase tracking-tagline text-slate">{t("scope")}</h2>
          <div className="flex flex-wrap gap-2">
            {(["job", "location", "company"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={s === "job" && !jobs.length}
                aria-pressed={scope === s}
                onClick={() => setScope(s)}
                className={`${chip(scope === s)} disabled:opacity-40`}
              >
                {t(`scopes.${s}`, { location: location.name, company: company.name })}
              </button>
            ))}
          </div>
          {!jobs.length && <p className="mt-3 text-sm text-slate">{t("noOpenJobs")}</p>}
          {scope === "job" && jobs.length > 0 && (
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              aria-label={t("scopes.job")}
              className="mt-3 w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 text-lg outline-none focus:border-ink sm:max-w-md"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-8">
          <div>
            <h2 className="mb-3 text-sm font-black uppercase tracking-tagline text-slate">{t("theme")}</h2>
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={theme === v} onClick={() => setTheme(v)} className={chip(theme === v)}>
                  {t(`themes.${v}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-black uppercase tracking-tagline text-slate">{t("language")}</h2>
            <div className="flex gap-2">
              {LOCALES.map((v) => (
                <button key={v} type="button" aria-pressed={lang === v} onClick={() => setLang(v)} className={chip(lang === v)}>
                  {t(`languages.${v}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-sm text-slate">{t("indexNote")}</p>
      </section>

      <section className="rounded-3xl bg-white p-6">
        <h2 className="mb-3 text-sm font-black uppercase tracking-tagline text-slate">{ti("preview")}</h2>
        <iframe key={preview} srcDoc={preview} title={ti("preview")} className="h-[520px] w-full rounded-2xl border-0" />
      </section>

      <section className="rounded-3xl bg-white p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-black">{t("code")}</h2>
          <CopyButton code={code} />
        </div>
        <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-sm text-paper">
          <code>{code}</code>
        </pre>
        <p className="mt-3 text-sm text-slate">{t("codeHint")}</p>
      </section>
    </div>
  );
}

function CopyButton({ code }: { code: string }) {
  const t = useTranslations("Index");
  const [copied, setCopied] = useState(false);
  return (
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
  );
}
