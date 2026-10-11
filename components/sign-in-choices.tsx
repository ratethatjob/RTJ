"use client";

import { useLocale, useTranslations } from "next-intl";
import { getPathname, Link } from "@/i18n/navigation";

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M3 21h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8h3M8 12h3M8 16h3" strokeLinecap="round" />
    </svg>
  );
}

/** The two ways in, side by side: as an employee (reviews) and as an employer (business
 *  dashboard, or the access request without a membership). Same email code sign-in. */
export function SignInChoices({ dark = false, role }: { dark?: boolean; role?: "menuitem" }) {
  const t = useTranslations("NavAccount");
  const locale = useLocale();
  const item = `flex items-start gap-3 rounded-xl px-3 py-2.5 ${dark ? "hover:bg-white/10" : "hover:bg-paper"}`;
  const hint = `block text-sm font-medium ${dark ? "text-mist" : "text-slate"}`;
  return (
    <>
      <Link role={role} href="/app/sign-in" className={item}>
        <span className="mt-0.5 shrink-0">
          <PersonIcon />
        </span>
        <span>
          <span className="block font-semibold">{t("signInEmployee")}</span>
          <span className={hint}>{t("signInEmployeeHint")}</span>
        </span>
      </Link>
      <Link
        role={role}
        href={{ pathname: "/app/sign-in", query: { for: "business", next: getPathname({ href: "/business", locale }) } }}
        className={item}
      >
        <span className="mt-0.5 shrink-0">
          <BuildingIcon />
        </span>
        <span>
          <span className="block font-semibold">{t("signInEmployer")}</span>
          <span className={hint}>{t("signInEmployerHint")}</span>
        </span>
      </Link>
    </>
  );
}
