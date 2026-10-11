"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  createJob,
  type JobInput,
  updateJob,
} from "@/app/[locale]/business/jobs/actions";
import { useRouter } from "@/i18n/navigation";
import { currencyFor } from "@/lib/currency";
import type { JobQuestion } from "@/lib/data/types";
import { MAX_QUESTIONS, PRESET_QUESTIONS } from "@/lib/job-questions";
import { JOB_LANGUAGES, type JobLanguage, LANGUAGE_LEVELS, languageName, MAX_LANGUAGES } from "@/lib/languages";
import { JOB_TIERS, type JobTier, jobPricing } from "@/lib/site-config";

type Location = { id: string; name: string; address: string; country: string };

type Props = {
  orgId: string;
  locations: Location[];
  initial: JobInput;
  jobId?: string;
  status?: "draft" | "open" | "closed";
  /** Package already ordered for a published job: only upgrades are possible. */
  publishedTier?: JobTier | null;
};

const WORK = ["permanent", "temporary"] as const;
const SCHEDULE = ["full_time", "part_time", "shifts", "flexible"] as const;
const PERIOD = ["hour", "day", "week", "month", "year"] as const;
const CURRENCIES = ["HUF", "EUR", "AED", "USD", "GBP", "RON", "CZK", "PLN"];

export function JobForm({
  orgId,
  locations,
  initial,
  jobId,
  status = "draft",
  publishedTier = null,
}: Props) {
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
      const result = jobId
        ? await updateJob(jobId, v, publish)
        : await createJob(orgId, v, publish);
      if (result.error)
        return setError(result.error === "invalid" ? t("invalid") : t("error"));
      // Publishing (or upgrading) continues on Stripe's payment page; the ad goes live once paid.
      if (result.payment?.url) return window.location.assign(result.payment.url);
      router.push(`/business/jobs/${result.id}`);
      router.refresh();
    });
  }

  const input =
    "w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 text-lg outline-none focus:border-ink";
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
              setV((prev) => ({
                ...prev,
                locationId: e.target.value,
                payCurrency: loc ? currencyFor(loc.country) : prev.payCurrency,
              }));
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
        <input
          value={v.title}
          onChange={set("title")}
          maxLength={120}
          placeholder={t("titlePlaceholder")}
          className={input}
        />
      </label>

      <fieldset>
        <legend className="mb-2 font-black">{t("workType")}</legend>
        <div className="flex flex-wrap gap-2">
          {WORK.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={v.workType === w}
              onClick={() => setV({ ...v, workType: w })}
              className={chip(v.workType === w)}
            >
              {t(`workTypes.${w}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-black">{t("schedule")}</legend>
        <div className="flex flex-wrap gap-2">
          {SCHEDULE.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={v.schedule === s}
              onClick={() => setV({ ...v, schedule: s })}
              className={chip(v.schedule === s)}
            >
              {t(`schedules.${s}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-black">
          {t("pay")}{" "}
          <span className="font-medium text-slate">({t("optional")})</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            inputMode="decimal"
            value={v.payMin}
            onChange={set("payMin")}
            placeholder={t("payMin")}
            aria-label={t("payMin")}
            className={input}
          />
          <input
            inputMode="decimal"
            value={v.payMax}
            onChange={set("payMax")}
            placeholder={t("payMax")}
            aria-label={t("payMax")}
            className={input}
          />
          <select
            value={v.payCurrency}
            onChange={set("payCurrency")}
            aria-label={t("currency")}
            className={input}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={v.payPeriod}
            onChange={set("payPeriod")}
            aria-label={t("period")}
            className={input}
          >
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
        <textarea
          value={v.description}
          onChange={set("description")}
          rows={8}
          maxLength={8000}
          placeholder={t("descriptionPlaceholder")}
          className={input}
        />
      </label>

      {(["responsibilities", "requirements", "offers"] as const).map((key) => (
        <label key={key} className={label}>
          <span className="font-black">
            {t(`lists.${key}`)}{" "}
            <span className="font-medium text-slate">({t("optional")})</span>
          </span>
          <textarea
            value={v[key]}
            onChange={set(key)}
            rows={4}
            placeholder={t(`lists.${key}Placeholder`)}
            className={input}
          />
          <span className="text-sm text-slate">{t("lists.hint")}</span>
        </label>
      ))}

      <LanguagesField
        adLanguage={v.adLanguage}
        languages={v.languages}
        onChange={(patch) => setV((prev) => ({ ...prev, ...patch }))}
        input={input}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-black">{t("applyMode.title")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["quick", "cv"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={v.applyMode === m}
              onClick={() => setV({ ...v, applyMode: m })}
              className={`flex flex-col gap-1 rounded-2xl p-4 text-left ${
                v.applyMode === m
                  ? "bg-ink text-paper"
                  : "border border-mist/60 bg-white"
              }`}
            >
              <span className="font-black">
                {t(`applyMode.${m}`)}
                {m === "quick" && (
                  <span
                    className={`ml-2 text-sm ${v.applyMode === m ? "text-signal" : "text-slate"}`}
                  >
                    {t("applyMode.recommended")}
                  </span>
                )}
              </span>
              <span
                className={`text-sm ${v.applyMode === m ? "text-mist" : "text-slate"}`}
              >
                {t(`applyMode.${m}Body`)}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <QuestionBuilder
        questions={v.questions}
        quick={v.applyMode === "quick"}
        onChange={(questions) => setV((prev) => ({ ...prev, questions }))}
        input={input}
      />

      <PackagePicker
        value={v.tier}
        onChange={(tier) => setV((prev) => ({ ...prev, tier }))}
        country={locations.find((l) => l.id === v.locationId)?.country ?? "HU"}
        minimum={publishedTier}
      />

      <label className={label}>
        <span className="font-black">
          {t("closesAt")}{" "}
          <span className="font-medium text-slate">({t("optional")})</span>
        </span>
        <input
          type="date"
          value={v.closesAt}
          onChange={set("closesAt")}
          className={`${input} sm:max-w-60`}
        />
      </label>

      {error && <p className="rounded-2xl bg-paper p-4 font-black">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit(true)}
              className="rounded-2xl bg-ink px-6 py-3 font-black text-paper disabled:opacity-60"
            >
              {t("publishAndPay")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit(false)}
              className="rounded-2xl border-2 border-ink px-6 py-3 font-black disabled:opacity-60"
            >
              {t("saveDraft")}
            </button>
          </>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl bg-ink px-6 py-3 font-black text-paper disabled:opacity-60"
          >
            {publishedTier && JOB_TIERS.indexOf(v.tier) > JOB_TIERS.indexOf(publishedTier) ? t("saveAndUpgrade") : t("save")}
          </button>
        )}
      </div>
    </form>
  );
}

function QuestionBuilder({
  questions,
  quick,
  onChange,
  input,
}: {
  questions: JobQuestion[];
  quick: boolean;
  onChange: (q: JobQuestion[]) => void;
  input: string;
}) {
  const t = useTranslations("BusinessJobs");
  const full = questions.length >= MAX_QUESTIONS;
  const update = (i: number, patch: Partial<JobQuestion>) =>
    onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const add = (q: JobQuestion) => !full && onChange([...questions, q]);
  const presets = PRESET_QUESTIONS.filter(
    (p) => !questions.some((q) => q.id === p.toLowerCase()),
  );
  const small = (active: boolean) =>
    `rounded-xl px-3 py-1.5 text-sm font-black ${active ? "bg-ink text-paper" : "border border-mist/60 bg-white"}`;

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl bg-paper p-4">
      <legend className="sr-only">{t("questions.title")}</legend>
      <p className="font-black">{t("questions.title")}</p>
      <p className="-mt-2 text-sm text-slate">
        {quick ? t("questions.hintQuick") : t("questions.hintCv")}
      </p>

      {questions.map((q, i) => (
        <div
          key={q.id}
          className="flex flex-col gap-2 rounded-2xl bg-white p-3"
        >
          <div className="flex items-start gap-2">
            <span className="pt-3 font-black text-slate">{i + 1}.</span>
            <input
              value={q.text}
              onChange={(e) => update(i, { text: e.target.value })}
              maxLength={200}
              aria-label={t("questions.text")}
              placeholder={t("questions.textPlaceholder")}
              className={input}
            />
            <button
              type="button"
              onClick={() => onChange(questions.filter((_, j) => j !== i))}
              aria-label={t("questions.remove")}
              className="px-2 pt-3 text-xl font-black text-slate"
            >
              ×
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-6">
            <span className="flex gap-2">
              {(["yes_no", "text"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={q.type === type}
                  onClick={() =>
                    update(i, { type, must: type === "text" ? null : q.must })
                  }
                  className={small(q.type === type)}
                >
                  {t(`questions.types.${type}`)}
                </button>
              ))}
            </span>
            {q.type === "yes_no" ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate">
                  {t("questions.must")}
                </span>
                {([null, "yes", "no"] as const).map((must) => (
                  <button
                    key={String(must)}
                    type="button"
                    aria-pressed={q.must === must}
                    onClick={() =>
                      update(i, { must, required: must ? true : q.required })
                    }
                    className={small(q.must === must)}
                  >
                    {t(`questions.mustOptions.${must ?? "any"}`)}
                  </button>
                ))}
              </span>
            ) : (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                />
                {t("questions.required")}
              </label>
            )}
          </div>
        </div>
      ))}

      {!full && presets.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-black text-slate">
            {t("questions.presets")}
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() =>
                  add({
                    id: p.toLowerCase(),
                    text: t(`questions.preset.${p}`),
                    type: "yes_no",
                    required: true,
                    must: null,
                  })
                }
                className="rounded-xl border border-mist/60 bg-white px-3 py-1.5 text-sm"
              >
                + {t(`questions.preset.${p}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {!full && (
        <button
          type="button"
          onClick={() =>
            add({
              id: `c${Math.random().toString(36).slice(2, 9)}`,
              text: "",
              type: "yes_no",
              required: true,
              must: null,
            })
          }
          className="self-start rounded-2xl border-2 border-ink px-4 py-2 font-black"
        >
          {t("questions.addCustom")}
        </button>
      )}
      {full && (
        <p className="text-sm text-slate">
          {t("questions.max", { count: MAX_QUESTIONS })}
        </p>
      )}
    </fieldset>
  );
}

const TIER_FEATURES: Record<JobTier, string[]> = {
  standard: ["ad", "apply", "contact"],
  basic: ["summary", "cv"],
  pro: ["followups", "featured"],
};

function PackagePicker({
  value,
  onChange,
  country,
  minimum,
}: {
  value: JobTier;
  onChange: (tier: JobTier) => void;
  country: string;
  minimum: JobTier | null;
}) {
  const t = useTranslations("BusinessJobs");
  const format = useFormatter();
  const pricing = jobPricing(country);
  const rank = (tier: JobTier) => JOB_TIERS.indexOf(tier);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 font-black">{t("packages.title")}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {JOB_TIERS.map((tier, i) => {
          const active = value === tier;
          const locked = minimum != null && rank(tier) < rank(minimum);
          return (
            <button
              key={tier}
              type="button"
              disabled={locked}
              aria-pressed={active}
              onClick={() => onChange(tier)}
              className={`flex flex-col gap-2 rounded-2xl p-4 text-left disabled:opacity-40 ${
                active ? "bg-ink text-paper" : "border border-mist/60 bg-white"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-black">{t(`packages.${tier}.name`)}</span>
                {tier === "basic" && (
                  <span className={`text-xs font-black ${active ? "text-signal" : "text-slate"}`}>
                    {t("applyMode.recommended")}
                  </span>
                )}
              </span>
              <span className="text-2xl font-black tracking-brand">
                {format.number(pricing.prices[tier], { style: "currency", currency: pricing.currency, maximumFractionDigits: 0 })}
              </span>
              <span className={`text-xs ${active ? "text-mist" : "text-slate"}`}>{t("packages.perAd")}</span>
              <ul className="flex flex-col gap-1 text-sm">
                {i > 0 && <li className={active ? "text-mist" : "text-slate"}>{t("packages.everythingIn", { name: t(`packages.${JOB_TIERS[i - 1]}.name`) })}</li>}
                {TIER_FEATURES[tier].map((f) => (
                  <li key={f}>✓ {t(`packages.features.${f}`)}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-slate">{minimum ? t("packages.upgradeOnly") : t("packages.billing")}</p>
    </fieldset>
  );
}

/** The ad's own language and the languages expected from applicants, with level. */
function LanguagesField({
  adLanguage,
  languages,
  onChange,
  input,
}: {
  adLanguage: string;
  languages: JobLanguage[];
  onChange: (patch: { adLanguage?: string; languages?: JobLanguage[] }) => void;
  input: string;
}) {
  const t = useTranslations("BusinessJobs");
  const locale = useLocale();
  const name = (code: string) => languageName(code, locale);
  const unused = JOB_LANGUAGES.filter((c) => !languages.some((l) => l.code === c));
  const update = (i: number, patch: Partial<JobLanguage>) =>
    onChange({ languages: languages.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl bg-paper p-4">
      <legend className="sr-only">{t("languages.title")}</legend>
      <p className="font-black">{t("languages.title")}</p>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-black text-slate">{t("languages.adLanguage")}</span>
        <select value={adLanguage} onChange={(e) => onChange({ adLanguage: e.target.value })} className={`${input} sm:max-w-xs`}>
          <option value="">{t("languages.notSet")}</option>
          {JOB_LANGUAGES.map((c) => (
            <option key={c} value={c}>
              {name(c)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-black text-slate">
          {t("languages.expected")} <span className="font-medium">({t("optional")})</span>
        </span>
        {languages.map((l, i) => (
          <div key={l.code} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-2">
            <select
              value={l.code}
              onChange={(e) => update(i, { code: e.target.value })}
              aria-label={t("languages.language")}
              className="rounded-xl border border-mist/60 bg-white px-3 py-2 font-black"
            >
              {[l.code, ...unused].map((c) => (
                <option key={c} value={c}>
                  {name(c)}
                </option>
              ))}
            </select>
            <select
              value={l.level}
              onChange={(e) => update(i, { level: e.target.value as JobLanguage["level"] })}
              aria-label={t("languages.level")}
              className="rounded-xl border border-mist/60 bg-white px-3 py-2"
            >
              {LANGUAGE_LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {t(`languages.levels.${lv}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange({ languages: languages.filter((_, j) => j !== i) })}
              aria-label={t("languages.remove")}
              className="ml-auto px-2 text-xl font-black text-slate"
            >
              ×
            </button>
          </div>
        ))}
        {languages.length < MAX_LANGUAGES && unused.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ languages: [...languages, { code: unused[0], level: "conversational" }] })}
            className="self-start rounded-2xl border-2 border-ink px-4 py-2 font-black"
          >
            {t("languages.add")}
          </button>
        )}
        <p className="text-sm text-slate">{t("languages.hint")}</p>
      </div>
    </fieldset>
  );
}
