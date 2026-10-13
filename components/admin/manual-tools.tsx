"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { editLocation, reviewManual } from "@/app/[locale]/admin/actions";

/** A new hand-entered workplace: OK, Edit (name, address, city), Hide (or Show again). */
export function ManualActions({
  id,
  name,
  address,
  city,
  hidden,
}: {
  id: string;
  name: string;
  address: string;
  city: string;
  hidden: boolean;
}) {
  const t = useTranslations("Admin.manual");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ name, address, city });
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<{ ok?: true; error?: true }>) =>
    startTransition(async () => {
      const r = await fn();
      setError(!!r.error);
      if (!r.error) {
        setEditing(false);
        router.refresh();
      }
    });

  const button = "rounded-xl px-3 py-2 text-sm font-black disabled:opacity-50";
  return (
    <div className="mt-2 flex flex-col gap-2">
      {editing && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => editLocation(id, values.name, values.address, values.city));
          }}
        >
          {(["name", "address", "city"] as const).map((key) => (
            <input
              key={key}
              aria-label={t(`fields.${key}`)}
              placeholder={t(`fields.${key}`)}
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="rounded-xl border border-mist/60 bg-white px-3 py-2"
            />
          ))}
          <p className="text-sm text-slate">{t("editHint")}</p>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} aria-busy={pending} className={`${button} bg-ink text-paper`}>
              {t("save")}
            </button>
            <button type="button" onClick={() => setEditing(false)} className={`${button} border border-mist/60`}>
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
      {!editing && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => act(() => reviewManual(id, "ok"))} className={`${button} bg-ink text-paper`}>
            {hidden ? t("show") : t("ok")}
          </button>
          <button type="button" disabled={pending} onClick={() => setEditing(true)} className={`${button} border border-mist/60`}>
            {t("edit")}
          </button>
          {!hidden && (
            <button type="button" disabled={pending} onClick={() => act(() => reviewManual(id, "hide"))} className={`${button} border border-mist/60`}>
              {t("hide")}
            </button>
          )}
        </div>
      )}
      {error && <p className="text-sm font-black">{t("error")}</p>}
    </div>
  );
}
