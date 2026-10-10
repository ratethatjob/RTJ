"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { createJob, type JobInput, updateJob } from "@/app/[locale]/business/jobs/actions";
import { useRouter } from "@/i18n/navigation";
import { currencyFor } from "@/lib/currency";

type Location = { id: string; name: string; address: string; country: string };

type Props = {
  orgId: string;
  locations: Location[];
  initial: JobInput;
  jobId?: string;
  status?: "draft" | "open" | "closed";
};

const WORK = ["permanent", "temporary"] as const;
const SCHEDULE = ["full_time", "part_time", "shifts", "flexible"] as const;
const PERIOD = ["hour", "day", "week", "month", "year"] as const;
const CURRENCIES = ["HUF", "EUR", "USD", "GBP", "RON", "CZK", "PLN"];

export function JobForm({ orgId, locations, initial, jobId, status = "draft" }: Props) {
  const t = useTranslations("BusinessJobs");
  const router = useRouter();
  const [v, setV] = useState<JobInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof JobInput) => (e: { target: { value: string } }) =>
    setV((prev) => ({ ...prev, [key]: e.target.value }));

  function submit(publish: boolean) {
    setError(null);
    startTransition(async () => {
      const result = jobId ? await updateJob(jobId, v, publish) : await createJob(orgId, v, publish);
      if (result.error) return setError(result.error === "invalid" ? t("invalid") : t("error"));
      router.push(`/business/jobs/${result.id}`);
      router.refresh();
    });
  }

  const input = "w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 text-lg outline-none focus:border-ink";
  const label = "flex flex-col gap-2";
  const chip = (active: boolean) =>
    `rounded-2xl px-4 py-2.5 font-black ${active ? "bg-ink text-paper" : "border border-mist/60 bg-white"}`;

  return (
    <form
      className="flex flex-col gap-5 rounded-3xl bg-white p-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      {!jobId && locations.length > 1 && (
        <label className={label}>
          <span className="font-black">{t("location")}</span>
          <select
            value={v.locationId}
            onChange={(e) => {
              const loc = locations.find((l) => l.id === e.target.value);
              setV((prev) => ({ ...prev, locationId: e.target.value, payCurrency: loc ? currencyFor(loc.country) : prev.payCurrency }));
            }}
            className={input}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} · {l.address}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={label}>
        <span className="font-black">{t("jobTitle")}</span>
        <input value={v.title} onChange={set("title")} maxLength={120} placeholder={t("titlePlaceholder")} className={input} />
      </label>

      <fieldset>
        <legend className="mb-2 font-black">{t("workType")}</legend>
        <div className="flex flex-wrap gap-2">
          {WORK.map((w) => (
            <button key={w} type="button" aria-pressed={v.workType === w} onClick={() => setV({ ...v, workType: w })} className={chip(v.workType === w)}>
              {t(`workTypes.${w}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-black">{t("schedule")}</legend>
        <div className="flex flex-wrap gap-2">
          {SCHEDULE.map((s) => (
            <button key={s} type="button" aria-pressed={v.schedule === s} onClick={() => setV({ ...v, schedule: s })} className={chip(v.schedule === s)}>
              {t(`schedules.${s}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-black">
          {t("pay")} <span className="font-medium text-slate">({t("optional")})</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input inputMode="decimal" value={v.payMin} onChange={set("payMin")} placeholder={t("payMin")} aria-label={t("payMin")} className={input} />
          <input inputMode="decimal" value={v.payMax} onChange={set("payMax")} placeholder={t("payMax")} aria-label={t("payMax")} className={input} />
          <select value={v.payCurrency} onChange={set("payCurrency")} aria-label={t("currency")} className={input}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={v.payPeriod} onChange={set("payPeriod")} aria-label={t("period")} className={input}>
            {PERIOD.map((p) => (
              <option key={p} value={p}>
                / {t(`periods.${p}`)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-slate">{t("payHint")}</p>
      </fieldset>

      <label className={label}>
        <span className="font-black">{t("description")}</span>
        <textarea value={v.description} onChange={set("description")} rows={8} maxLength={8000} placeholder={t("descriptionPlaceholder")} className={input} />
      </label>

      <label className={label}>
        <span className="font-black">
          {t("question")} <span className="font-medium text-slate">({t("optional")})</span>
        </span>
        <input value={v.question} onChange={set("question")} maxLength={300} placeholder={t("questionPlaceholder")} className={input} />
      </label>

      <label className={label}>
        <span className="font-black">
          {t("closesAt")} <span className="font-medium text-slate">({t("optional")})</span>
        </span>
        <input type="date" value={v.closesAt} onChange={set("closesAt")} className={`${input} sm:max-w-60`} />
      </label>

      {error && <p className="rounded-2xl bg-paper p-4 font-black">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <>
            <button type="button" disabled={pending} onClick={() => submit(true)} className="rounded-2xl bg-ink px-6 py-3 font-black text-paper disabled:opacity-60">
              {t("publish")}
            </button>
            <button type="button" disabled={pending} onClick={() => submit(false)} className="rounded-2xl border-2 border-ink px-6 py-3 font-black disabled:opacity-60">
              {t("saveDraft")}
            </button>
          </>
        ) : (
          <button type="submit" disabled={pending} className="rounded-2xl bg-ink px-6 py-3 font-black text-paper disabled:opacity-60">
            {t("save")}
          </button>
        )}
      </div>
    </form>
  );
}
