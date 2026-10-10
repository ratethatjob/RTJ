"use client";

import type { Provider } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = { next: string; welcome: string; linkError: boolean };
type Channel = "email" | "phone";

const PROVIDERS: { id: Provider | "tiktok"; name: string }[] = [
  { id: "apple", name: "Apple" },
  { id: "google", name: "Google" },
  { id: "facebook", name: "Facebook" },
  { id: "tiktok", name: "TikTok" },
];

export function SignInForm({ next, welcome, linkError }: Props) {
  const t = useTranslations("Auth");
  const [channel, setChannel] = useState<Channel>("email");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkError ? t("errorLink") : null);

  const callback = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function oauth(provider: Provider | "tiktok") {
    if (provider === "tiktok") return setError(t("tiktokSoon"));
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
    const auth = createClient().auth;
    const { error } =
      channel === "email"
        ? await auth.signInWithOtp({ email: target.trim(), options: { emailRedirectTo: callback() } })
        : await auth.signInWithOtp({ phone: target.replace(/[\s()-]/g, "") });
    setBusy(false);
    if (error) return setError(t("errorGeneric"));
    setSent(true);
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const auth = createClient().auth;
    const token = code.replace(/\s/g, "");
    const { error } =
      channel === "email"
        ? await auth.verifyOtp({ email: target.trim(), token, type: "email" })
        : await auth.verifyOtp({ phone: target.replace(/[\s()-]/g, ""), token, type: "sms" });
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
          <span className="font-black text-slate">{t(channel)}</span>
          <input
            key={channel}
            type={channel === "email" ? "email" : "tel"}
            autoComplete={channel === "email" ? "email" : "tel"}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t(channel === "email" ? "emailPlaceholder" : "phonePlaceholder")}
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
        <button
          type="button"
          onClick={() => {
            setChannel(channel === "email" ? "phone" : "email");
            setTarget("");
          }}
          className="mt-2 font-black underline underline-offset-4"
        >
          {t(channel === "email" ? "usePhone" : "useEmail")}
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
