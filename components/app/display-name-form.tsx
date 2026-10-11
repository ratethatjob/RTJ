"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { saveDisplayName, shuffleName } from "@/app/[locale]/app/actions";
import { initials } from "@/lib/format";

type Props = {
  next: string;
  initialMode: "generated" | "username";
  initialGenerated: string;
  initialUsername: string;
};

export function DisplayNameForm({ next, initialMode, initialGenerated, initialUsername }: Props) {
  const t = useTranslations("Welcome");
  const [mode, setMode] = useState(initialMode);
  const [generated, setGenerated] = useState(initialGenerated);
  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function shuffle() {
    startTransition(async () => {
      const name = await shuffleName();
      if (name) setGenerated(name);
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveDisplayName(mode, username);
      if (result.error === "invalid") return setError(t("usernameInvalid"));
      if (result.error === "taken") return setError(t("usernameTaken"));
      if (result.error) return setError(t("genericError"));
      window.location.assign(next);
    });
  }

  const card = (active: boolean) =>
    `rounded-3xl bg-white p-5 ${active ? "border-[3px] border-ink" : "border border-mist/60"}`;

  return (
    <form onSubmit={submit} className="mt-8 flex flex-1 flex-col gap-4">
      <div className={card(mode === "generated")}>
        <label className="flex items-center gap-3">
          <input
            type="radio"
            name="mode"
            checked={mode === "generated"}
            onChange={() => setMode("generated")}
            className="size-5 accent-ink"
          />
          <span className="flex-1 text-lg font-black">{t("anonymous")}</span>
          <span className="rounded-lg bg-signal px-2.5 py-1 text-sm font-black">
            {t("recommended")}
          </span>
        </label>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-paper p-3">
          <span className="grid size-12 place-items-center rounded-full bg-[#E8E6E1] font-black">
            {initials(generated || "?")}
          </span>
          <span className="flex-1 text-2xl font-black tracking-brand">{generated}</span>
          <button
            type="button"
            onClick={shuffle}
            disabled={pending} aria-busy={pending}
            aria-label={t("shuffle")}
            title={t("shuffle")}
            className="grid size-12 place-items-center rounded-xl border border-mist bg-white disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />
            </svg>
          </button>
        </div>
      </div>

      <div className={card(mode === "username")}>
        <label className="flex items-center gap-3">
          <input
            type="radio"
            name="mode"
            checked={mode === "username"}
            onChange={() => setMode("username")}
            className="size-5 accent-ink"
          />
          <span className="text-lg font-black">{t("username")}</span>
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          onFocus={() => setMode("username")}
          placeholder={t("usernamePlaceholder")}
          aria-describedby="username-hint"
          className="mt-4 w-full rounded-2xl border border-mist/60 bg-paper px-5 py-4 text-lg outline-none focus:border-ink"
        />
        <p id="username-hint" className="mt-2 text-sm text-slate">
          {t("usernameHint")}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-ink px-4 py-3 font-black text-paper">
          {error}
        </p>
      )}

      <p className="flex gap-3 text-slate">
        <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        {t("ownership")}
      </p>

      <button
        disabled={pending} aria-busy={pending}
        className="mt-auto rounded-2xl bg-ink py-4 text-lg font-black text-paper disabled:opacity-60"
      >
        {t("continue")}
      </button>
    </form>
  );
}
