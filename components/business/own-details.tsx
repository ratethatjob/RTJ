"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateOwnLocation } from "@/app/[locale]/business/profile/actions";

type Field = "name" | "address" | "city";

/** The employer corrects its location's name, address and city; fields our team edited are locked. */
export function OwnDetails({
  locationId,
  initial,
  locked,
}: {
  locationId: string;
  initial: Record<Field, string>;
  locked: string[];
}) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<"idle" | "saved" | "invalid" | "locked" | "error">("idle");
  const [pending, startTransition] = useTransition();
  const changed = (Object.keys(initial) as Field[]).some((k) => values[k].trim() !== initial[k]);
  const input = "w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 text-lg outline-none focus:border-ink disabled:bg-paper disabled:text-slate";

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateOwnLocation(locationId, values);
      if (result.error) return setState(result.error === "generic" ? "error" : result.error);
      setState("saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-3xl bg-white p-6">
      <h2 className="font-black">{t("detailsTitle")}</h2>
      <p className="text-sm text-slate">{t("detailsHint")}</p>
      {(["name", "address", "city"] as const).map((key) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="text-sm font-black">{t(`details.${key}`)}</span>
          <input
            value={values[key]}
            disabled={locked.includes(key)}
            onChange={(e) => {
              setValues((v) => ({ ...v, [key]: e.target.value }));
              setState("idle");
            }}
            maxLength={key === "address" ? 150 : key === "city" ? 80 : 100}
            className={input}
          />
          {locked.includes(key) && <span className="text-sm text-slate">{t("detailsLocked")}</span>}
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !changed}
          aria-busy={pending}
          className="rounded-2xl bg-ink px-5 py-3 text-base font-black text-paper disabled:opacity-50"
        >
          {t("detailsSave")}
        </button>
        <p role="status" className="text-sm font-black">
          {state === "saved"
            ? t("categorySaved")
            : state === "invalid"
              ? t("detailsInvalid")
              : state === "locked"
                ? t("detailsLocked")
                : state === "error"
                  ? t("categoryError")
                  : ""}
        </p>
      </div>
    </form>
  );
}
