"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/[locale]/app/account/actions";
import { getPathname, Link, usePathname } from "@/i18n/navigation";
import { useBusinessStatus } from "@/lib/business-status";
import { initials } from "@/lib/format";
import { BriefcaseIcon } from "./business-access";
import { SignInChoices } from "./sign-in-choices";

/** Round avatar in the header: the person's initials (a plain person icon when signed out), a red
 *  count for unread notifications, and a menu with the account pages, the business dashboard and
 *  signing out. Checked in the browser so public pages stay static. */
export function AccountMenu() {
  const t = useTranslations("NavAccount");
  const locale = useLocale();
  const pathname = usePathname();
  const status = useBusinessStatus();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const ref = useRef<HTMLDivElement>(null);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const signedIn = Boolean(status?.signedIn);
  const unread = status?.unread ?? 0;
  const label = signedIn && unread ? t("accountUnread", { count: unread }) : t("account");
  const item = "flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-paper";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`relative grid size-9 place-items-center rounded-full text-sm font-black ${
          signedIn ? "bg-ink text-paper" : "border border-mist/70"
        }`}
      >
        {signedIn ? (
          <span aria-hidden="true">{initials(status?.name || "?")}</span>
        ) : (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
          </svg>
        )}
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-[#C8323C] px-1 text-[10px] leading-4 font-black text-white ring-2 ring-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 flex w-72 flex-col gap-0.5 rounded-2xl border border-mist/50 bg-white p-2 text-[15px] font-semibold shadow-lg"
        >
          {signedIn ? (
            <>
              {status?.name && (
                <p className="truncate px-3 pb-2 pt-1 text-sm font-medium text-slate">{t("shownAs", { name: status.name })}</p>
              )}
              <Link role="menuitem" href="/app/account" className={item}>
                {t("account")}
              </Link>
              <Link role="menuitem" href="/app/notifications" className={item}>
                {t("notificationsItem")}
                {unread > 0 && (
                  <span className="rounded-full bg-[#C8323C] px-2 text-xs font-black leading-5 text-white">{unread}</span>
                )}
              </Link>
              <Link role="menuitem" href="/app/applications" className={item}>
                {t("applications")}
              </Link>
              {(status?.org || status?.pendingClaim) && (
                <Link role="menuitem" href="/business" className={`${item} mt-1 bg-paper`}>
                  <span className="flex items-center gap-2">
                    <BriefcaseIcon className="size-4" />
                    {t(status?.org ? "business" : "pending")}
                  </span>
                </Link>
              )}
              {status?.admin && (
                <Link role="menuitem" href="/admin" className={`${item} mt-1 bg-paper`}>
                  {t("admin")}
                </Link>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  await signOut();
                  window.location.assign(getPathname({ href: "/", locale }));
                }}
                className={`${item} mt-1 border-t border-mist/40 text-left`}
              >
                {t("signOut")}
              </button>
            </>
          ) : (
            <SignInChoices role="menuitem" />
          )}
        </div>
      )}
    </div>
  );
}
