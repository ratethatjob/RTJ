"use client";

import type { Provider } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { AUTH_PROVIDERS } from "@/lib/site-config";
import { createClient } from "@/lib/supabase/client";

/** `business`: employer sign-in, work email code only (no Apple, Google or Facebook). */
type Props = { next: string; welcome: string; linkError: boolean; business?: boolean };

const NAMES = { apple: "Apple", google: "Google", facebook: "Facebook" };
const PROVIDERS: { id: Provider; name: string }[] = AUTH_PROVIDERS.map((id) => ({ id, name: NAMES[id] }));

export function SignInForm({ next, welcome, linkError, business = false }: Props) {
  const t = useTranslations("Auth");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkError ? t("errorLink") : null);

  const callback = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function oauth(provider: Provider) {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback() },
    });
    if (error) setError(t("errorGeneric"));
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: target.trim(),
      options: { emailRedirectTo: callback() },
    });
    setBusy(false);
    if (error) return setError(t("errorGeneric"));
    setSent(true);
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({
      email: target.trim(),
      token: code.replace(/\s/g, ""),
      type: "email",
    });
    if (error) {
      setBusy(false);
      return setError(t("errorCode"));
    }
    window.location.assign(welcome);
  }

  const errorBox = error && (
    <p role="alert" className="rounded-2xl bg-ink px-4 py-3 font-black text-paper">
      {error}
    </p>
  );

  if (sent) {
    return (
      <form onSubmit={verify} className="mt-8 flex flex-1 flex-col gap-4">
        <h2 className="text-2xl font-black tracking-brand">{t("codeTitle")}</h2>
        <p className="text-slate">{t("codeSent", { target })}</p>
        <label className="flex flex-col gap-2">
          <span className="font-black text-slate">{t("code")}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className="rounded-2xl border border-mist/60 bg-white px-5 py-4 text-2xl tracking-[0.3em] outline-none focus:border-ink"
          />
        </label>
        {errorBox}
        <button
          disabled={busy} aria-busy={busy}
          className="rounded-2xl bg-signal py-3 text-base font-black text-ink disabled:opacity-60"
        >
          {t("verify")}
        </button>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setCode("");
          }}
          className="font-black underline underline-offset-4"
        >
          {t("resend")}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-8 flex flex-1 flex-col">
      {!business && PROVIDERS.length > 0 && (
        <>
      <div className="flex flex-col gap-3">
        {PROVIDERS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => oauth(p.id)}
            className={`rounded-2xl border-2 border-ink py-3 text-base font-black ${
              i === 0 ? "bg-ink text-paper" : "bg-white"
            }`}
          >
            {t("continueWith", { provider: p.name })}
          </button>
        ))}
      </div>

      <div className="my-6 flex items-center gap-4 text-slate">
        <span className="h-px flex-1 bg-mist/60" />
        <span className="font-black">{t("or")}</span>
        <span className="h-px flex-1 bg-mist/60" />
      </div>

        </>
      )}

      <form onSubmit={sendCode} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-black text-slate">{business ? t("businessEmail") : t("email")}</span>
          <input
            type="email"
            autoComplete="email"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={business ? t("businessPlaceholder") : t("emailPlaceholder")}
            required
            className="rounded-2xl border border-mist/60 bg-white px-4 py-3 text-base outline-none focus:border-ink"
          />
        </label>
        {errorBox}
        <button
          disabled={busy} aria-busy={busy}
          className="rounded-2xl bg-signal py-3 text-base font-black text-ink disabled:opacity-60"
        >
          {t("sendCode")}
        </button>
      </form>

      {business && (
        <p className="mt-6 text-center text-slate">
          {t("notEmployer")}{" "}
          <Link href="/app/sign-in" className="font-black text-ink underline underline-offset-4">
            {t("workerSignIn")}
          </Link>
        </p>
      )}

      <p className="mt-auto pt-10 text-center text-sm text-slate">
        {t.rich("footer", {
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
    </div>
  );
}
