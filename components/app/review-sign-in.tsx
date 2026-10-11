"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

/** Last step of a review written before signing in: email code, with what the email is for.
 *  `returnPath`: where an email sign-in link brings the person back (the draft is kept there). */
export function ReviewSignIn({
  returnPath,
  jobAlerts,
  onJobAlerts,
  onSignedIn,
  busy: submitting,
}: {
  returnPath: string;
  jobAlerts: boolean;
  onJobAlerts: (on: boolean) => void;
  onSignedIn: (userId: string) => void;
  busy: boolean;
}) {
  const t = useTranslations("ReviewForm.signIn");
  const ta = useTranslations("Auth");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`,
      },
    });
    setBusy(false);
    if (error) return setError(ta("errorGeneric"));
    setSent(true);
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\s/g, ""),
      type: "email",
    });
    setBusy(false);
    if (error || !data.user) return setError(ta("errorCode"));
    onSignedIn(data.user.id);
  }

  const errorBox = error && (
    <p role="alert" className="rounded-2xl bg-ink px-4 py-3 font-black text-paper">
      {error}
    </p>
  );
  const input =
    "rounded-2xl border border-mist/60 bg-white px-4 py-3 text-base outline-none focus:border-ink";

  return (
    <>
      <h1 className="mt-6 text-4xl font-black tracking-brand">{t("title")}</h1>
      <ul className="mt-5 flex flex-col gap-3 rounded-3xl bg-ink p-5 text-paper">
        {(["anonymous", "employer", "why"] as const).map((k) => (
          <li key={k} className="flex gap-3">
            <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-signal" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12 5 5 9-10" />
            </svg>
            <span>{t(`points.${k}`)}</span>
          </li>
        ))}
      </ul>

      {sent ? (
        <form onSubmit={verify} className="mt-6 flex flex-col gap-4">
          <p className="text-slate">{ta("codeSent", { target: email })}</p>
          <label className="flex flex-col gap-2">
            <span className="font-black text-slate">{ta("code")}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              className={`${input} text-2xl tracking-[0.3em]`}
            />
          </label>
          {errorBox}
          <button
            disabled={busy || submitting} aria-busy={busy}
            className="rounded-2xl bg-signal py-3 text-base font-black text-ink disabled:opacity-60"
          >
            {busy || submitting ? t("sending") : t("verifyAndSend")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode("");
            }}
            className="font-black underline underline-offset-4"
          >
            {ta("resend")}
          </button>
        </form>
      ) : (
        <form onSubmit={sendCode} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-black text-slate">{ta("email")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={ta("emailPlaceholder")}
              required
              className={input}
            />
          </label>
          <label className="flex items-start gap-3 rounded-2xl bg-white p-4">
            <input
              type="checkbox"
              checked={jobAlerts}
              onChange={(e) => onJobAlerts(e.target.checked)}
              className="mt-1 size-5 shrink-0 accent-ink"
            />
            <span>
              <span className="block font-black">{t("jobAlerts")}</span>
              <span className="text-sm text-slate">{t("jobAlertsNote")}</span>
            </span>
          </label>
          {errorBox}
          <button
            disabled={busy} aria-busy={busy}
            className="rounded-2xl bg-signal py-3 text-base font-black text-ink disabled:opacity-60"
          >
            {ta("sendCode")}
          </button>
          <p className="text-center text-sm text-slate">
            {ta.rich("footer", {
              terms: (chunks) => (
                <Link href="/terms" className="text-ink underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" className="text-ink underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </form>
      )}
    </>
  );
}
