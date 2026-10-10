"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { applyToJob } from "@/app/[locale]/app/apply/actions";
import { Link } from "@/i18n/navigation";

type Props = {
  jobId: string;
  company: string;
  question: string | null;
  defaultEmail: string;
  defaultPhone: string;
};

const START = ["now", "two_weeks", "later"] as const;

export function ApplyForm({ jobId, company, question, defaultEmail, defaultPhone }: Props) {
  const t = useTranslations("Apply");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [startWhen, setStartWhen] = useState("");
  const [experience, setExperience] = useState<boolean | null>(null);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <section className="rounded-3xl bg-white p-6">
        <h2 className="text-3xl font-black tracking-brand">{t("doneTitle")}</h2>
        <p className="mt-2 text-lg text-slate">{t("doneBody", { company })}</p>
        <Link href="/app/applications" className="mt-5 inline-block rounded-2xl bg-ink px-6 py-3 font-black text-paper">
          {t("myApplications")}
        </Link>
      </section>
    );
  }

  const input = "w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 text-lg outline-none focus:border-ink";
  const chip = (active: boolean) =>
    `rounded-2xl px-4 py-3 font-black ${active ? "bg-ink text-paper" : "border border-mist/60 bg-white"}`;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await applyToJob(
            { jobId, fullName, email, phone, startWhen, experience, answer, message },
            Boolean(question),
          );
          if (result.error) return setError(t(`errors.${result.error}`));
          setDone(true);
        });
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="font-black">{t("fullName")}</span>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={120} className={input} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="font-black">{t("email")}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={input} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-black">{t("phone")}</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={40} className={input} />
        </label>
        <p className="text-sm text-slate sm:col-span-2">{t("contactHint")}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-black">{t("startWhen")}</legend>
        <div className="flex flex-wrap gap-2">
          {START.map((s) => (
            <button key={s} type="button" aria-pressed={startWhen === s} onClick={() => setStartWhen(s)} className={chip(startWhen === s)}>
              {t(`start.${s}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-black">{t("experience")}</legend>
        <div className="flex gap-2">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" aria-pressed={experience === v} onClick={() => setExperience(v)} className={chip(experience === v)}>
              {v ? t("yes") : t("no")}
            </button>
          ))}
        </div>
      </fieldset>

      {question && (
        <label className="flex flex-col gap-2">
          <span className="font-black">{t("question", { company })}</span>
          <span className="text-slate">{question}</span>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} maxLength={1000} className={input} />
        </label>
      )}

      <label className="flex flex-col gap-2">
        <span className="font-black">
          {t("message")} <span className="font-medium text-slate">({t("optional")})</span>
        </span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000} className={input} />
      </label>

      {error && <p className="rounded-2xl bg-white p-4 font-black">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-2xl bg-ink px-6 py-4 text-lg font-black text-paper disabled:opacity-60">
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
