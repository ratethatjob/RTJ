"use client";

import { useLocale, useTranslations } from "next-intl";
import { CATEGORIES } from "@/lib/categories";

/** Native dropdown of every category with short examples ("Hair & barber – hair salon, barber"),
 *  A–Z in the page language with "Other" last. The empty value is "Let us decide": the server picks
 *  from the map data, the name or with AI. `suggested` marks a preselected guess. */
export function CategorySelect({
  value,
  onChange,
  className,
  auto = true,
  suggested = false,
  placeholder,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  auto?: boolean;
  suggested?: boolean;
  /** No preselected value: a "Choose…" option that can't be picked, and `required`. */
  placeholder?: string;
  required?: boolean;
}) {
  const t = useTranslations("Categories");
  const locale = useLocale();
  const sorted = CATEGORIES.filter((c) => c !== "other").sort((a, b) => t(a).localeCompare(t(b), locale));
  const label = (c: (typeof CATEGORIES)[number]) =>
    t.has(`examples.${c}`) ? `${t(c)} – ${t(`examples.${c}`)}` : t(c);
  return (
    <>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t("pick")}
        required={required}
        className={className}
      >
        {placeholder && !auto && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {auto && <option value="">{t("letUsDecide")}</option>}
        {[...sorted, "other" as const].map((c) => (
          <option key={c} value={c}>
            {label(c)}
          </option>
        ))}
      </select>
      {suggested && value !== "" && <p className="text-sm text-slate">{t("suggested")}</p>}
    </>
  );
}
