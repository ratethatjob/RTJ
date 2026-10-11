"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

const FIRST_YEAR = 1970;

/** "YYYY-MM" for the current month, in the visitor's time zone. */
export function thisMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const noop = () => () => {};

const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2314161A' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

/** Month + year as two native selects (same on every browser and phone), no day.
 *  `value` and `onChange` use "YYYY-MM", or "" until both are picked. Months after `max`
 *  (default: this month) and before `min` can't be chosen. */
export function MonthYearSelect({
  value,
  onChange,
  min,
  max: maxProp,
  label,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  label?: string;
  compact?: boolean;
}) {
  const t = useTranslations("MonthYear");
  const locale = useLocale();
  // "Now" only in the browser (null while prerendering), so no clock reads end up in a prerender.
  const today = useSyncExternalStore(noop, thisMonth, () => null);
  const max = maxProp ?? today;
  // Half-picked state (only a month or only a year) stays here until both are set.
  const [draft, setDraft] = useState(() => ({ year: value.slice(0, 4), month: value.slice(5, 7) }));
  const year = value ? value.slice(0, 4) : draft.year;
  const month = value ? value.slice(5, 7) : draft.month;

  const [maxY, maxM] = (max ?? "0-0").split("-").map(Number);
  const [minY, minM] = (min || `${FIRST_YEAR}-01`).split("-").map(Number);
  const years = max
    ? Array.from({ length: Math.max(0, maxY - Math.max(minY, FIRST_YEAR) + 1) }, (_, i) => String(maxY - i))
    : year
      ? [year]
      : [];
  const names = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, "0"),
    label: names.format(new Date(Date.UTC(2000, i, 1))),
    disabled: (Boolean(max) && Number(year) === maxY && i + 1 > maxM) || (Number(year) === minY && i + 1 < minM),
  })).filter((m) => max || m.value === month);

  function update(next: { year: string; month: string }) {
    // Moving to a year where the chosen month is out of range clears the month.
    const m = Number(next.month);
    const out = (Boolean(max) && Number(next.year) === maxY && m > maxM) || (Number(next.year) === minY && m < minM);
    const fixed = { year: next.year, month: out ? "" : next.month };
    setDraft(fixed);
    onChange(fixed.year && fixed.month ? `${fixed.year}-${fixed.month}` : "");
  }

  const select = `w-full min-w-0 appearance-none rounded-2xl border border-mist/60 bg-white bg-no-repeat outline-none focus:border-ink ${
    compact ? "py-2 pl-3 pr-9 text-base" : "py-4 pl-4 pr-10 text-lg"
  }`;
  const style = { backgroundImage: chevron, backgroundPosition: "right 0.75rem center", backgroundSize: "1.1rem" };

  return (
    <div role="group" aria-label={label} className="grid grid-cols-[3fr_2fr] gap-2">
      <select
        aria-label={label ? `${label} – ${t("month")}` : t("month")}
        value={month}
        onChange={(e) => update({ year, month: e.target.value })}
        className={select}
        style={style}
      >
        <option value="">{t("month")}</option>
        {months.map((m) => (
          <option key={m.value} value={m.value} disabled={m.disabled}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        aria-label={label ? `${label} – ${t("year")}` : t("year")}
        value={year}
        onChange={(e) => update({ year: e.target.value, month })}
        className={select}
        style={style}
      >
        <option value="">{t("year")}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
