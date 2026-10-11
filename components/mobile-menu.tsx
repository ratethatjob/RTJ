"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { MenuBusinessLink } from "./business-access";
import { LocaleSwitch } from "./locale-switch";

/** Menu for phones: the header only has room for the logo and sign-in. */
export function MobileMenu() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "/search", label: t("findWorkplaces") },
    { href: "/jobs", label: t("jobs") },
    { href: "/employers", label: t("forEmployers") },
    { href: "/pricing", label: t("pricing") },
    { href: "/about", label: t("about") },
  ];

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("menu")}
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-full border border-mist/70"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={t("menu")} className="fixed inset-0 z-50 flex flex-col bg-ink p-4 text-paper">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="grid size-9 place-items-center rounded-full border border-white/25 text-lg font-black"
            >
              ✕
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/app/rate" className="rounded-xl bg-signal px-4 py-3 text-center text-lg font-black text-ink">
              {t("rateAJob")}
            </Link>
            <MenuBusinessLink />
          </div>
          <nav className="mt-4 flex flex-col">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={pathname === l.href ? "page" : undefined}
                className={`border-b border-white/10 py-3.5 text-2xl font-black tracking-brand ${pathname === l.href ? "text-signal" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto pb-4">
            <LocaleSwitch dark />
          </div>
        </div>
      )}
    </div>
  );
}
