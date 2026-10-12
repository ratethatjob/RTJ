"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setOwnCategory } from "@/app/[locale]/business/profile/actions";
import { CategorySelect } from "@/components/category-select";

/** The employer sets its own location's main category (an admin's choice stays). */
export function OwnCategory({ locationId, category, lockedByAdmin }: { locationId: string; category: string; lockedByAdmin: boolean }) {
  const t = useTranslations("Profile");
  const [value, setValue] = useState(category);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col gap-2 rounded-3xl bg-white p-6">
      <h2 className="font-black">{t("categoryTitle")}</h2>
      <p className="text-sm text-slate">{t(lockedByAdmin ? "categoryLocked" : "categoryHint")}</p>
      {!lockedByAdmin && (
      <CategorySelect
        auto={false}
        value={value}
        onChange={(next) => {
          setValue(next);
          setState("idle");
          startTransition(async () => {
            const result = await setOwnCategory(locationId, next);
            setState(result.error ? "error" : "saved");
          });
        }}
        className="rounded-2xl border border-mist/60 bg-white px-4 py-3"
      />
      )}
      <p role="status" aria-busy={pending} className="text-sm font-black">
        {state === "saved" ? t("categorySaved") : state === "error" ? t("categoryError") : ""}
      </p>
    </section>
  );
}
