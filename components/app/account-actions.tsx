"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteAccount, signOut } from "@/app/[locale]/app/account/actions";
import { setJobAlerts } from "@/app/[locale]/app/actions";

/** Emails about jobs near me: opt-in, off by default, switched off here any time. */
export function JobAlertsToggle({ initial }: { initial: boolean }) {
  const t = useTranslations("Account");
  const [on, setOn] = useState(initial);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <section className="rounded-3xl bg-white p-5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          disabled={pending} aria-busy={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            setError(false);
            startTransition(async () => {
              const result = await setJobAlerts(next);
              if (result.error) {
                setOn(!next);
                setError(true);
              }
            });
          }}
          className="mt-1 size-5 shrink-0 accent-ink"
        />
        <span>
          <span className="block font-black">{t("jobAlerts")}</span>
          <span className="text-sm text-slate">{t("jobAlertsNote")}</span>
        </span>
      </label>
      {error && <p className="mt-2 text-sm font-black">{t("jobAlertsError")}</p>}
    </section>
  );
}

export function AccountActions({ exportHref, home }: { exportHref: string; home: string }) {
  const t = useTranslations("Account");
  const [keep, setKeep] = useState(true);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const word = t("deleteConfirm").split(" ").pop() ?? "DELETE";

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5">
        <div>
          <a href={exportHref} className="font-black underline underline-offset-4">
            {t("export")}
          </a>
          <p className="text-sm text-slate">{t("exportHint")}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await signOut();
              window.location.assign(home);
            })
          }
          className="rounded-xl border-2 border-ink px-4 py-2 font-black"
        >
          {t("signOut")}
        </button>
      </section>

      <section className="rounded-3xl border-2 border-dashed border-mist p-5">
        <h2 className="text-xl font-black">{t("deleteTitle")}</h2>
        <p className="mt-1 text-slate">{t("deleteBody")}</p>
        <div className="mt-4 flex flex-col gap-2">
          {[true, false].map((v) => (
            <label key={String(v)} className="flex items-center gap-3 font-black">
              <input type="radio" name="keep" checked={keep === v} onChange={() => setKeep(v)} className="size-5 accent-ink" />
              {t(v ? "keepReviews" : "removeReviews")}
            </label>
          ))}
        </div>
        <label className="mt-4 flex flex-col gap-2">
          <span className="text-sm font-black text-slate">{t("deleteConfirm")}</span>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="rounded-xl border border-mist/60 bg-white px-3 py-2"
          />
        </label>
        {error && <p className="mt-3 font-black">{t("error")}</p>}
        <button
          type="button"
          disabled={confirm.trim().toUpperCase() !== word.replace(/[^\p{L}]/gu, "").toUpperCase() || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteAccount(keep);
              if (result.error) return setError(true);
              window.location.assign(home);
            })
          }
          className="mt-4 rounded-xl bg-ink px-5 py-3 font-black text-paper disabled:opacity-40"
        >
          {t("deleteButton")}
        </button>
      </section>
    </>
  );
}
