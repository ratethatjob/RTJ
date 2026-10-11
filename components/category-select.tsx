"use client";

import { useLocale, useTranslations } from "next-intl";
import { CATEGORIES } from "@/lib/categories";

/** Native dropdown of every category, A–Z in the page language with "Other" last.
 *  The empty value is "Let us decide": the server picks from the map data or with AI. */
export function CategorySelect({
  value,
  onChange,
  className,
  auto = true,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  auto?: boolean;
}) {
  const t = useTranslations("Categories");
  const locale = useLocale();
  const sorted = CATEGORIES.filter((c) => c !== "other").sort((a, b) => t(a).localeCompare(t(b), locale));
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={t("pick")} className={className}>
      {auto && <option value="">{t("letUsDecide")}</option>}
      {[...sorted, "other" as const].map((c) => (
        <option key={c} value={c}>
          {t(c)}
        </option>
      ))}
    </select>
  );
}
