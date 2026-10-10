"use client";

import type { Provider } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = { next: string; welcome: string; linkError: boolean };

const PROVIDERS: { id: Provider; name: string }[] = [
  { id: "apple", name: "Apple" },
  { id: "google", name: "Google" },
  { id: "facebook", name: "Facebook" },
];

export function SignInForm({ next, welcome, linkError }: Props) {
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
          disabled={busy}
          className="rounded-2xl bg-signal py-4 text-lg font-black text-ink disabled:opacity-60"
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
      <div className="flex flex-col gap-3">
        {PROVIDERS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => oauth(p.id)}
            className={`rounded-2xl border-2 border-ink py-4 text-lg font-black ${
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

      <form onSubmit={sendCode} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-black text-slate">{t("email")}</span>
          <input
            type="email"
            autoComplete="email"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
            className="rounded-2xl border border-mist/60 bg-white px-5 py-4 text-lg outline-none focus:border-ink"
          />
        </label>
        {errorBox}
        <button
          disabled={busy}
          className="rounded-2xl bg-signal py-4 text-lg font-black text-ink disabled:opacity-60"
        >
          {t("sendCode")}
        </button>
      </form>

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
