"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

/** "Sign in" for visitors; "My account" and the notification bell once signed in.
 * Checked in the browser so public pages stay static and cacheable. */
export function AccountLink({ signInLabel }: { signInLabel: string }) {
  const t = useTranslations("NavAccount");
  const [signedIn, setSignedIn] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        setSignedIn(Boolean(data.session));
        if (!data.session) return;
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null)
          .then(({ count }) => setUnread(count ?? 0));
      });
    } catch {}
  }, []);
  return (
    <span className="flex items-center gap-1">
      {signedIn && (
        <Link
          href="/app/notifications"
          aria-label={t("notifications", { count: unread })}
          className="relative grid size-10 place-items-center"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinejoin="round" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
          </svg>
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-signal px-1 text-xs font-black text-ink">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      )}
      {signedIn ? (
        <Link href="/app/account" aria-label={t("account")} className="grid size-10 place-items-center sm:w-auto sm:px-1">
          {/* A person icon on phones, so the header fits from 360 px. */}
          <svg viewBox="0 0 24 24" className="size-6 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
          </svg>
          <span className="hidden whitespace-nowrap sm:inline">{t("account")}</span>
        </Link>
      ) : (
        <Link href="/app/sign-in" className="whitespace-nowrap px-1">
          {signInLabel}
        </Link>
      )}
    </span>
  );
}
