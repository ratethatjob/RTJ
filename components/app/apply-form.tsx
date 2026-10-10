"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { answerFollowups, applyToJob, getFollowups, type ApplyInput } from "@/app/[locale]/app/apply/actions";
import { QuickBadge } from "@/components/jobs/quick-badge";
import { Link } from "@/i18n/navigation";
import type { ApplyMode, JobQuestion } from "@/lib/data/types";
import { unmetMusts, type Answers } from "@/lib/job-questions";
import { createClient } from "@/lib/supabase/client";

type Props = {
  jobId: string;
  userId: string;
  company: string;
  mode: ApplyMode;
  questions: JobQuestion[];
  defaultEmail: string;
  defaultPhone: string;
  /** "embed" when the applicant came from a jobs widget on the employer's website. */
  source: "site" | "embed";
  /** The employer's page the applicant came from (http/https only). */
  returnUrl: string | null;
};

const START = ["now", "two_weeks", "later"] as const;
const CV_TYPES = ".pdf,.doc,.docx";
const CV_MAX = 5 * 1024 * 1024;

const input = "w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 text-lg outline-none focus:border-ink";
const chip = (active: boolean) =>
  `rounded-2xl px-4 py-3 font-black ${active ? "bg-ink text-paper" : "border border-mist/60 bg-white"}`;

export function ApplyForm(props: Props) {
  const t = useTranslations("Apply");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(props.defaultEmail);
  const [phone, setPhone] = useState(props.defaultPhone);
  const [startWhen, setStartWhen] = useState("");
  const [experience, setExperience] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; followups: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const quick = props.mode === "quick";

  if (done?.followups) {
    return <Followups applicationId={done.id} company={props.company} onDone={() => setDone({ ...done, followups: false })} />;
  }
  if (done) {
    return (
      <section className="rounded-3xl bg-white p-6">
        <h2 className="text-3xl font-black tracking-brand">{t("doneTitle")}</h2>
        <p className="mt-2 text-lg text-slate">{t("doneBody", { company: props.company })}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {props.returnUrl && (
            <a href={props.returnUrl} rel="noopener" className="rounded-2xl bg-ink px-6 py-3 font-black text-paper">
              {t("backToCompany", { company: props.company })}
            </a>
          )}
          <Link
            href="/app/applications"
            className={
              props.returnUrl
                ? "rounded-2xl border-2 border-ink px-6 py-3 font-black"
                : "rounded-2xl bg-ink px-6 py-3 font-black text-paper"
            }
          >
            {t("myApplications")}
          </Link>
        </div>
      </section>
    );
  }

  const answer = (id: string, value: boolean | string) => setAnswers((a) => ({ ...a, [id]: value }));

  function submit() {
    setError(null);
    startTransition(async () => {
      let cvPath: string | null = null;
      if (!quick) {
        if (!file) return setError(t("errors.cv"));
        if (file.size > CV_MAX) return setError(t("cvTooBig"));
        const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
        cvPath = `${props.jobId}/${props.userId}/${crypto.randomUUID()}.${ext}`;
        const upload = await createClient().storage.from("cvs").upload(cvPath, file);
        if (upload.error) return setError(t("errors.cv"));
      }
      const payload: ApplyInput = {
        jobId: props.jobId,
        fullName,
        email,
        phone,
        startWhen,
        experience,
        answers,
        cvPath,
        message,
        source: props.source,
      };
      const result = await applyToJob(payload);
      if (result.error || !result.id) return setError(t(`errors.${result.error ?? "generic"}`));
      setDone({ id: result.id, followups: Boolean(result.followups) });
      window.scrollTo(0, 0);
    });
  }

  const contact = (
    <>
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
    </>
  );

  const messageField = (
    <label className="flex flex-col gap-2">
      <span className="font-black">
        {t("message")} <span className="font-medium text-slate">({t("optional")})</span>
      </span>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000} className={input} />
    </label>
  );

  const submitButton = (
    <>
      {error && <p className="rounded-2xl bg-white p-4 font-black">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-2xl bg-ink px-6 py-4 text-lg font-black text-paper disabled:opacity-60">
        {pending ? t("sending") : t("submit")}
      </button>
    </>
  );

  if (quick) {
    return (
      <QuickSteps
        questions={props.questions}
        answers={answers}
        answer={answer}
        company={props.company}
        startWhen={startWhen}
        setStartWhen={setStartWhen}
        experience={experience}
        setExperience={setExperience}
        onSubmit={submit}
      >
        {contact}
        {messageField}
        {submitButton}
      </QuickSteps>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {contact}
      <label className="flex flex-col gap-2">
        <span className="font-black">{t("cv")}</span>
        <span className="flex items-center gap-3 rounded-2xl border border-dashed border-mist bg-white p-4">
          <span className="rounded-xl bg-ink px-4 py-2 font-black text-paper">{t("cvPick")}</span>
          <span className="min-w-0 truncate text-slate">{file ? file.name : t("cvHint")}</span>
          <input
            type="file"
            accept={CV_TYPES}
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </span>
      </label>
      {props.questions.map((q) => (
        <QuestionField key={q.id} question={q} value={answers[q.id]} onChange={(v) => answer(q.id, v)} />
      ))}
      {messageField}
      {submitButton}
    </form>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: JobQuestion;
  value: boolean | string | undefined;
  onChange: (v: boolean | string) => void;
}) {
  const t = useTranslations("Apply");
  const label = (
    <span className="font-black">
      {question.text} {!question.required && <span className="font-medium text-slate">({t("optional")})</span>}
    </span>
  );
  if (question.type === "text") {
    return (
      <label className="flex flex-col gap-2">
        {label}
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          maxLength={1000}
          className={input}
        />
      </label>
    );
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2">{label}</legend>
      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={chip(value === v)}>
            {v ? t("yes") : t("no")}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type QuickProps = {
  questions: JobQuestion[];
  answers: Answers;
  answer: (id: string, v: boolean | string) => void;
  company: string;
  startWhen: string;
  setStartWhen: (v: string) => void;
  experience: boolean | null;
  setExperience: (v: boolean) => void;
  onSubmit: () => void;
  children: React.ReactNode;
};

/** One question per screen with big Yes/No buttons, then the basics, then contact. */
function QuickSteps(p: QuickProps) {
  const t = useTranslations("Apply");
  const [step, setStep] = useState(0);
  const n = p.questions.length;
  const total = n + 2;
  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const q = step < n ? p.questions[step] : null;
  const unmet = unmetMusts(p.questions, p.answers);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <QuickBadge label={t("quickBadge")} />
        <span className="text-sm font-black text-slate">{t("stepOf", { step: step + 1, total })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-mist/40" aria-hidden="true">
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>

      {q && (
        <div className="flex flex-col gap-5 rounded-3xl bg-white p-6">
          <p className="text-sm font-black uppercase tracking-tagline text-slate">{t("question", { company: p.company })}</p>
          <h2 className="text-3xl font-black leading-tight tracking-brand">{q.text}</h2>
          {q.type === "yes_no" ? (
            <div className="grid grid-cols-2 gap-3">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={p.answers[q.id] === v}
                  onClick={() => {
                    p.answer(q.id, v);
                    next();
                  }}
                  className={`rounded-2xl py-6 text-2xl font-black ${
                    p.answers[q.id] === v ? "bg-ink text-paper" : "border-2 border-ink bg-white"
                  }`}
                >
                  {v ? t("yes") : t("no")}
                </button>
              ))}
            </div>
          ) : (
            <>
              <textarea
                value={typeof p.answers[q.id] === "string" ? (p.answers[q.id] as string) : ""}
                onChange={(e) => p.answer(q.id, e.target.value)}
                rows={3}
                maxLength={1000}
                className={input}
              />
              <button
                type="button"
                onClick={next}
                disabled={q.required && !String(p.answers[q.id] ?? "").trim()}
                className="rounded-2xl bg-ink py-4 text-lg font-black text-paper disabled:opacity-40"
              >
                {q.required ? t("next") : t("nextOrSkip")}
              </button>
            </>
          )}
        </div>
      )}

      {step === n && (
        <div className="flex flex-col gap-6 rounded-3xl bg-white p-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xl font-black">{t("startWhen")}</legend>
            <div className="flex flex-wrap gap-2">
              {START.map((s) => (
                <button key={s} type="button" aria-pressed={p.startWhen === s} onClick={() => p.setStartWhen(s)} className={chip(p.startWhen === s)}>
                  {t(`start.${s}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xl font-black">{t("experience")}</legend>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" aria-pressed={p.experience === v} onClick={() => p.setExperience(v)} className={chip(p.experience === v)}>
                  {v ? t("yes") : t("no")}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={next}
            disabled={!p.startWhen || p.experience == null}
            className="rounded-2xl bg-ink py-4 text-lg font-black text-paper disabled:opacity-40"
          >
            {t("next")}
          </button>
        </div>
      )}

      {step === n + 1 && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            p.onSubmit();
          }}
        >
          {unmet.length > 0 && <p className="rounded-2xl border-2 border-ink bg-white p-4">{t("mismatch", { company: p.company })}</p>}
          {p.children}
        </form>
      )}

      {step > 0 && (
        <button type="button" onClick={() => setStep(step - 1)} className="self-start font-black underline underline-offset-4">
          {t("back")}
        </button>
      )}
    </section>
  );
}

/** Pro jobs: a few AI follow-up questions right after applying. Skippable. */
export function Followups({
  applicationId,
  company,
  onDone,
  initial,
}: {
  applicationId: string;
  company: string;
  onDone: () => void;
  initial?: { id: string; question: string }[];
}) {
  const t = useTranslations("Apply");
  const locale = useLocale();
  const [questions, setQuestions] = useState(initial ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const started = useRef(Boolean(initial));
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    getFollowups(applicationId, locale).then((q) => (q.length ? setQuestions(q) : onDone()));
  }, [applicationId, locale, onDone]);

  if (!questions) {
    return (
      <section className="rounded-3xl bg-white p-6" aria-busy="true">
        <h2 className="text-3xl font-black tracking-brand">{t("doneTitle")}</h2>
        <p className="mt-2 animate-pulse text-lg text-slate">{t("followups.loading", { company })}</p>
      </section>
    );
  }

  function send(skip: boolean) {
    setError(false);
    startTransition(async () => {
      const result = await answerFollowups(applicationId, skip ? {} : answers);
      if (result.error) return setError(true);
      onDone();
    });
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-3xl bg-white p-6"
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
    >
      <div>
        {!initial && <p className="font-black text-slate">{t("doneTitle")} ✓</p>}
        <h2 className="mt-1 text-3xl font-black tracking-brand">{t("followups.title", { company })}</h2>
        <p className="mt-2 text-slate">{t("followups.body")}</p>
      </div>
      {questions.map((q) => (
        <label key={q.id} className="flex flex-col gap-2">
          <span className="font-black">{q.question}</span>
          <textarea
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            rows={2}
            maxLength={1000}
            className={input}
          />
        </label>
      ))}
      {error && <p className="rounded-2xl bg-paper p-4 font-black">{t("errors.generic")}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-2xl bg-ink px-6 py-4 text-lg font-black text-paper disabled:opacity-60">
          {t("followups.send")}
        </button>
        <button type="button" disabled={pending} onClick={() => send(true)} className="font-black underline underline-offset-4">
          {t("followups.skip")}
        </button>
      </div>
    </form>
  );
}
