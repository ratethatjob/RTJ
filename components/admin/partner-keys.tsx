"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPartnerKey, revokePartnerKey } from "@/app/[locale]/admin/actions";

/** New partner key: name and hourly ceiling; the key is shown here once, never again. */
export function NewPartnerKey() {
  const t = useTranslations("Admin.partners");
  const router = useRouter();
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("1000");
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (key) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-paper p-4">
        <p className="font-black">{t("onceTitle")}</p>
        <p className="text-sm text-slate">{t("onceBody")}</p>
        <code className="break-all rounded-xl bg-white p-3 text-sm">{key}</code>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(key).then(() => setCopied(true))}
            className="rounded-xl bg-ink px-3 py-2 text-sm font-black text-paper"
          >
            {copied ? t("copied") : t("copy")}
          </button>
          <button
            type="button"
            onClick={() => {
              setKey(null);
              setCopied(false);
            }}
            className="rounded-xl border border-mist/60 px-3 py-2 text-sm font-black"
          >
            {t("done")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await createPartnerKey(name, Number(limit));
          setError(!r.key);
          if (r.key) {
            setKey(r.key);
            setName("");
            router.refresh();
          }
        });
      }}
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-black">{t("name")}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="rounded-xl border border-mist/60 bg-white px-3 py-2" />
      </label>
      <label className="flex w-32 flex-col gap-1">
        <span className="text-sm font-black">{t("hourly")}</span>
        <input type="number" min={1} max={100000} value={limit} onChange={(e) => setLimit(e.target.value)} className="rounded-xl border border-mist/60 bg-white px-3 py-2" />
      </label>
      <button type="submit" disabled={pending || name.trim().length < 2} aria-busy={pending} className="rounded-xl bg-ink px-4 py-2 font-black text-paper disabled:opacity-50">
        {t("create")}
      </button>
      {error && <p className="w-full text-sm font-black">{t("error")}</p>}
    </form>
  );
}

export function RevokePartnerKey({ id }: { id: string }) {
  const t = useTranslations("Admin.partners");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("revokeConfirm"))) return;
        startTransition(async () => {
          await revokePartnerKey(id);
          router.refresh();
        });
      }}
      className="rounded-xl border border-mist/60 px-3 py-1.5 text-sm font-black disabled:opacity-50"
    >
      {t("revoke")}
    </button>
  );
}
