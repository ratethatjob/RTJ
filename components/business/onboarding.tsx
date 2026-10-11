"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

const STEPS = [
  { key: "profile", href: "/business/profile" },
  { key: "invite", href: "/business/invite" },
  { key: "billing", href: "/business/billing" },
] as const;

/** Welcome band with three first steps, until it is closed (remembered in this browser). */
export function BusinessOnboarding({ orgId }: { orgId: string }) {
  const t = useTranslations("Business.onboarding");
  const key = `rtj:onboarding-closed:${orgId}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let closed = false;
    try {
      closed = localStorage.getItem(key) === "1";
    } catch {}
    // localStorage only exists in the browser, so decide after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!closed);
  }, [key]);
  if (!open) return null;
  return (
    <section className="relative mt-6 rounded-3xl bg-ink p-5 text-paper sm:p-6">
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(key, "1");
          } catch {}
          setOpen(false);
        }}
        className="absolute right-3 top-3 rounded-xl px-3 py-2 text-sm font-black text-mist hover:text-paper"
      >
        {t("close")}
      </button>
      <h2 className="pr-24 text-2xl font-black tracking-brand">{t("title")}</h2>
      <p className="mt-1 text-mist">{t("body")}</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <Link href={s.href} className="flex h-full gap-3 rounded-2xl bg-white/10 p-4 hover:bg-white/15">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-signal text-sm font-black text-ink">
                {i + 1}
              </span>
              <span>
                <span className="block font-black">{t(`steps.${s.key}Title`)}</span>
                <span className="text-sm text-mist">{t(`steps.${s.key}Body`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
