"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { submitReview } from "@/app/[locale]/app/actions";
import { MonthYearSelect, thisMonth } from "@/components/month-year-select";
import { initials } from "@/lib/format";
import {
  FACT_KEYS,
  RATING_KEYS,
  RELATIONSHIPS,
  type ReviewInput,
} from "@/lib/review-input";
import { createClient } from "@/lib/supabase/client";
import type { PendingWorkplace } from "@/lib/workplaces";
import { ChevronLeftIcon, GlobeIcon } from "../icons";
import { BACK_LINK_CLASS } from "./back-link-class";
import { ReviewSignIn } from "./review-sign-in";

/** Without `userId` the whole review is filled in first and the last step signs in by email code.
 *  `workplace`: picked or typed but not in the database yet (created when the review is sent). */
type Props = {
  userId: string | null;
  inviteToken?: string;
  location: { id: string | null; name: string; address: string };
  workplace?: PendingWorkplace;
  displayName: string | null;
  changeNameHref: string;
  locationHref: string;
  /** This page (localized, with its query): where an email sign-in link comes back to. */
  returnPath: string;
  welcomePath: string;
  /** The "review sent" page (`?review=<id>`). */
  sentPath: string;
};

const DOC_TYPES = ["payslip", "contract", "employment_letter", "other"] as const;
const SIGN_IN_STEP = 5;

const empty = (locationId: string): ReviewInput => ({
  locationId,
  relationship: null,
  periodStart: "",
  periodEnd: "",
  position: "",
  workType: "permanent",
  ratings: {},
  wouldReturn: null,
  facts: {},
  gotReply: null,
  replyDays: "",
  interviewRounds: "",
  body: "",
  publishMode: "now",
});

export function ReviewForm({
  userId,
  inviteToken,
  location,
  workplace,
  displayName,
  changeNameHref,
  locationHref,
  returnPath,
  welcomePath,
  sentPath,
}: Props) {
  const t = useTranslations("ReviewForm");
  const router = useRouter();
  const target =
    location.id ??
    (workplace?.kind === "place"
      ? workplace.placeId
      : [workplace?.company, workplace?.address, workplace?.city, workplace?.country].join("|"));
  const storageKey = `rtj-review:${target}`;
  const locationId = location.id ?? "";
  const [step, setStep] = useState(1);
  const [input, setInput] = useState<ReviewInput>(() => empty(locationId));
  const [jobAlerts, setJobAlerts] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]>("payslip");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  // The draft stays in this browser (also through signing in by an email link in another tab).
  // Back on the sign-in step while signed in: the person just signed in, so send it now.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      const draft = JSON.parse(saved) as { input: ReviewInput; step: number; jobAlerts?: boolean };
      const savedInput = { ...draft.input, locationId };
      // localStorage only exists in the browser, so restore after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInput(savedInput);
      setJobAlerts(Boolean(draft.jobAlerts));
      if (draft.step === SIGN_IN_STEP && userId) {
        setStep(4);
        send(savedInput, Boolean(draft.jobAlerts), userId);
      } else {
        setStep(Math.min(draft.step, userId ? 4 : SIGN_IN_STEP));
      }
    } catch {}
    // Runs once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (!done) localStorage.setItem(storageKey, JSON.stringify({ input, step, jobAlerts }));
    } catch {}
  }, [input, step, jobAlerts, done, storageKey]);

  const set = <K extends keyof ReviewInput>(key: K, value: ReviewInput[K]) => {
    setError(null);
    setInput((prev) => ({ ...prev, [key]: value }));
  };
  const applicant = input.relationship === "applicant";

  function stepValid() {
    if (step === 1) {
      return (
        input.relationship &&
        input.periodStart &&
        input.periodStart <= thisMonth() &&
        input.position.trim() &&
        (input.relationship !== "former" ||
          (input.periodEnd && input.periodEnd >= input.periodStart && input.periodEnd <= thisMonth()))
      );
    }
    if (step === 2) return applicant || input.ratings.overall;
    return true;
  }

  function goNext() {
    if (!stepValid()) {
      const datesWrong =
        step === 1 &&
        ((input.periodEnd && input.periodStart && input.periodEnd < input.periodStart) ||
          input.periodStart > thisMonth() ||
          input.periodEnd > thisMonth());
      return setError(t(datesWrong ? "errors.dates" : "errors.required"));
    }
    setError(null);
    setStep(step + 1);
    window.scrollTo(0, 0);
  }

  function submit() {
    if (!userId) {
      // Not signed in yet: the email step, then it is sent automatically.
      setError(null);
      setStep(SIGN_IN_STEP);
      window.scrollTo(0, 0);
      return;
    }
    send(input, jobAlerts, userId);
  }

  function send(data: ReviewInput, alerts: boolean, uid: string) {
    setError(null);
    startTransition(async () => {
      const result = await submitReview(data, inviteToken, workplace, alerts || undefined);
      if (result.error || !result.id) {
        setStep(4);
        return setError(t(`errors.${result.error ?? "generic"}`));
      }
      let uploadOk = true;
      if (file) uploadOk = await uploadDocument(result.id, uid);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      setDone(true);
      const sent = `${sentPath}?review=${result.id}${uploadOk ? "" : "&upload=failed"}`;
      // A new reviewer still picks how they are shown (generated name by default), then sees it.
      if (!result.nameConfirmed) return router.push(`${welcomePath}?next=${encodeURIComponent(sent)}&sent=1`);
      router.push(sent);
    });
  }

  async function uploadDocument(reviewId: string, uid: string) {
    const supabase = createClient();
    const ext = file!.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${uid}/${reviewId}/${crypto.randomUUID()}.${ext}`;
    const upload = await supabase.storage.from("verifications").upload(path, file!);
    if (upload.error) return false;
    const { error } = await supabase
      .from("verifications")
      .insert({ review_id: reviewId, storage_path: path, doc_type: docType });
    return !error;
  }

  const header = (
    <div className="flex items-center gap-3">
      {step > 1 ? (
        <button type="button" onClick={() => setStep(step - 1)} className={BACK_LINK_CLASS}>
          <ChevronLeftIcon className="size-6" />
          {t("back")}
        </button>
      ) : (
        <a href={locationHref} className={BACK_LINK_CLASS}>
          <ChevronLeftIcon className="size-6" />
          {t("back")}
        </a>
      )}
      {step <= 3 && (
        <>
          <div className="flex flex-1 gap-2" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-2 flex-1 rounded-full ${n <= step ? "bg-ink" : "bg-[#D9D6CF]"}`}
              />
            ))}
          </div>
          <span className="font-black text-slate">{t("step", { step })}</span>
        </>
      )}
    </div>
  );

  const eyebrow = (
    <p className="mt-6 font-black text-slate">
      {location.name} · {location.address}
    </p>
  );

  return (
    <Shell>
      {header}

      {step === 1 && (
        <>
          {eyebrow}
          <h1 className="text-4xl font-black tracking-brand">{t("aboutTitle")}</h1>
          <Field label={t("howKnow")}>
            <div className="grid grid-cols-2 gap-3">
              {RELATIONSHIPS.map((r) => (
                <Choice
                  key={r}
                  selected={input.relationship === r}
                  onClick={() => set("relationship", r)}
                >
                  {t(`relationship.${r}`)}
                </Choice>
              ))}
            </div>
          </Field>

          {input.relationship && (
            <div className="flex flex-col gap-4">
              <Field label={t(applicant ? "appliedWhen" : "from")}>
                <MonthYearSelect
                  label={t(applicant ? "appliedWhen" : "from")}
                  value={input.periodStart}
                  onChange={(v) => set("periodStart", v)}
                />
              </Field>
              {(input.relationship === "current" || input.relationship === "former") && (
                <Field label={t("to")}>
                  {input.relationship === "former" && (
                    <MonthYearSelect
                      label={t("to")}
                      value={input.periodEnd}
                      min={input.periodStart || undefined}
                      onChange={(v) => set("periodEnd", v)}
                    />
                  )}
                  {/* "Still working here" is the same as the "I work here now" relationship. */}
                  <label className="mt-3 flex items-center gap-3 font-black">
                    <input
                      type="checkbox"
                      checked={input.relationship === "current"}
                      onChange={(e) => set("relationship", e.target.checked ? "current" : "former")}
                      className="size-5 accent-ink"
                    />
                    {t("stillHere")}
                  </label>
                </Field>
              )}
            </div>
          )}

          <Field label={t("position")}>
            <input
              value={input.position}
              onChange={(e) => set("position", e.target.value)}
              maxLength={80}
              placeholder={t("positionPlaceholder")}
              className={inputClass}
            />
          </Field>

          {!applicant && (
            <Field label={t("workType")}>
              <div className="grid grid-cols-2 rounded-2xl bg-[#EAE7E1] p-1.5">
                {(["permanent", "temporary"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={input.workType === w}
                    onClick={() => set("workType", w)}
                    className={`rounded-xl py-3.5 text-lg font-black ${
                      input.workType === w ? "bg-white" : "text-slate"
                    }`}
                  >
                    {t(w)}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </>
      )}

      {step === 2 && (
        <>
          {eyebrow}
          <h1 className="text-4xl font-black tracking-brand">
            {t(applicant ? "rateProcess" : "rateTitle")}
          </h1>
          <div className="mt-6 rounded-3xl bg-white px-6">
            {(applicant ? (["overall"] as const) : RATING_KEYS).map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-[#E8E6E1] py-5 last:border-0">
                <span className="text-lg font-black leading-tight">{t(`ratings.${k}`)}</span>
                <Stars
                  value={input.ratings[k] ?? 0}
                  onChange={(v) => set("ratings", { ...input.ratings, [k]: v })}
                  label={(n) => `${t(`ratings.${k}`)}: ${t("starLabel", { count: n })}`}
                />
              </div>
            ))}
          </div>
          {!applicant && (
            <Field label={t("workAgain")}>
              <YesNo
                value={input.wouldReturn}
                onChange={(v) => set("wouldReturn", v)}
                yes={t("yes")}
                no={t("no")}
                big
              />
            </Field>
          )}
        </>
      )}

      {step === 3 && (
        <>
          {eyebrow}
          <h1 className="text-4xl font-black tracking-brand">
            {t(applicant ? "applicantTitle" : "factsTitle")}
          </h1>
          <div className="mt-6 rounded-3xl bg-white px-6">
            {applicant ? (
              <>
                <FactRow label={t("gotReply")}>
                  <YesNo value={input.gotReply} onChange={(v) => set("gotReply", v)} yes={t("yes")} no={t("no")} />
                </FactRow>
                {input.gotReply && (
                  <FactRow label={t("replyDays")}>
                    <NumberInput value={input.replyDays} onChange={(v) => set("replyDays", v)} />
                  </FactRow>
                )}
                <FactRow label={t("interviewRounds")}>
                  <NumberInput value={input.interviewRounds} onChange={(v) => set("interviewRounds", v)} />
                </FactRow>
              </>
            ) : (
              FACT_KEYS.map((k) => (
                <FactRow key={k} label={t(`facts.${k}`)}>
                  <YesNo
                    value={input.facts[k] ?? null}
                    onChange={(v) => set("facts", { ...input.facts, [k]: v })}
                    yes={t("yes")}
                    no={t("no")}
                  />
                </FactRow>
              ))
            )}
          </div>
          <Field
            label={
              <>
                {t("bodyLabel")} <span className="font-medium text-slate">{t("optional")}</span>
              </>
            }
          >
            <textarea
              value={input.body}
              onChange={(e) => set("body", e.target.value)}
              maxLength={5000}
              rows={5}
              placeholder={t("bodyPlaceholder")}
              className={inputClass}
            />
          </Field>
          <p className="mt-3 flex items-center gap-2 text-slate">
            <GlobeIcon className="size-5 shrink-0" />
            {t("anyLanguage")}
          </p>
        </>
      )}

      {step === 4 && (
        <>
          <h1 className="mt-6 text-4xl font-black tracking-brand">{t("almostDone")}</h1>
          <section className="mt-6 rounded-3xl bg-ink p-6 text-paper">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-black">{t("verifiedTitle")}</h2>
              <span className="rounded-lg bg-signal px-2.5 py-1 text-sm font-black text-ink">
                {t("optionalBadge")}
              </span>
            </div>
            <p className="mt-3 text-mist">{t("verifiedBody")}</p>
            {file ? (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-black">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="shrink-0 underline">
                    {t("removeFile")}
                  </button>
                </div>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-mist">{t("docType")}</span>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as (typeof DOC_TYPES)[number])}
                    className="rounded-lg bg-white/10 px-3 py-2 font-black"
                  >
                    {DOC_TYPES.map((d) => (
                      <option key={d} value={d} className="text-ink">
                        {t(`docTypes.${d}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/40 py-5 text-lg font-black">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
                </svg>
                {t("upload")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            <p className="mt-4 text-sm text-mist">{t("verifiedNote")}</p>
          </section>

          <Field label={t("whenLive")}>
            <div className="flex flex-col gap-3">
              {(input.relationship === "current"
                ? (["now", "delayed", "after_leaving"] as const)
                : (["now", "delayed"] as const)
              ).map((m) => (
                <Choice key={m} selected={input.publishMode === m} onClick={() => set("publishMode", m)}>
                  {t(`publish.${m}`)}
                </Choice>
              ))}
            </div>
          </Field>
          <p className="mt-3 text-sm text-slate">{t("signalsNote")}</p>

          {displayName === null ? (
            <p className="mt-4 rounded-3xl bg-white p-4 text-slate">{t("anonName")}</p>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-3xl bg-white p-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#E8E6E1] font-black">
                {initials(displayName || "?")}
              </span>
              <span className="flex-1 text-slate">
                {t.rich("shownAs", {
                  name: () => <strong className="font-black text-ink">{displayName}</strong>,
                })}
              </span>
              <a href={changeNameHref} className="font-black underline underline-offset-4">
                {t("change")}
              </a>
            </div>
          )}
        </>
      )}

      {step === SIGN_IN_STEP && (
        <ReviewSignIn
          returnPath={returnPath}
          jobAlerts={jobAlerts}
          onJobAlerts={setJobAlerts}
          onSignedIn={(uid) => send(input, jobAlerts, uid)}
          busy={pending}
        />
      )}

      {error && <ErrorBox>{error}</ErrorBox>}

      <div className={`mt-auto pt-8 ${step === SIGN_IN_STEP ? "hidden" : ""}`}>
        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            className="w-full rounded-2xl bg-ink py-3 text-base font-black text-paper"
          >
            {t("next")}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={pending} aria-busy={pending}
            className="w-full rounded-2xl bg-signal py-3 text-base font-black text-ink disabled:opacity-60"
          >
            {pending ? t("submitting") : t(userId ? "submit" : "continueToSend")}
          </button>
        )}
      </div>
    </Shell>
  );
}

const inputClass =
  "w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 text-base outline-none focus:border-ink";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-4 lg:max-w-2xl lg:flex-none lg:pt-8">{children}</main>;
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-6 rounded-2xl bg-ink px-4 py-3 font-black text-paper">
      {children}
    </p>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-6 ${className}`}>
      <p className="mb-3 text-lg font-black">{label}</p>
      {children}
    </div>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl bg-white px-4 py-4 text-left text-lg font-black leading-tight ${
        selected ? "border-[3px] border-ink" : "border border-mist/60"
      }`}
    >
      <span
        className={`size-5 shrink-0 rounded-full border-2 ${
          selected ? "border-ink bg-[radial-gradient(circle,#14161A_35%,transparent_40%)]" : "border-mist"
        }`}
      />
      {children}
    </button>
  );
}

function NumberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
      className="w-20 rounded-xl border border-mist/60 px-3 py-3 text-center text-lg font-black outline-none focus:border-ink"
    />
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E8E6E1] py-4 last:border-0">
      <span className="text-lg font-black leading-tight">{label}</span>
      {children}
    </div>
  );
}

function YesNo({
  value,
  onChange,
  yes,
  no,
  big = false,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  yes: string;
  no: string;
  big?: boolean;
}) {
  const button = (v: boolean, label: string) => {
    const active = value === v;
    const activeClass = big ? "border-[3px] border-ink bg-signal" : "border-2 border-ink bg-ink text-paper";
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onChange(v)}
        className={`rounded-2xl font-black ${big ? "py-4 text-lg" : "w-20 py-3"} ${
          active ? activeClass : "border border-mist/60 bg-white"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className={big ? "grid grid-cols-2 gap-3" : "flex shrink-0 gap-2"}>
      {button(true, yes)}
      {button(false, no)}
    </div>
  );
}

function Stars({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: (n: number) => string;
}) {
  return (
    <div role="radiogroup" className="flex shrink-0">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={label(n)}
          onClick={() => onChange(n)}
          className="p-1"
        >
          <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true">
            <path
              d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"
              fill={n <= value ? "#14161A" : "none"}
              stroke={n <= value ? "#14161A" : "#B5BAC1"}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
