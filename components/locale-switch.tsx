"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Flag } from "./flags";

/** Language menu: every locale with its flag and own name. */
export function LocaleSwitch({ dark = false }: { dark?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("switchLanguage")}
        className={`inline-flex h-11 items-center gap-2 rounded-full border px-3.5 font-black uppercase ${
          dark ? "border-white/25" : "border-mist/60"
        }`}
      >
        <Flag locale={locale} className="h-3.5 w-5 rounded-[2px]" />
        {locale}
        <svg viewBox="0 0 24 24" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          role="menu"
          className={`absolute z-50 mt-2 min-w-44 overflow-hidden rounded-2xl border border-mist/40 bg-white py-1 text-ink shadow-lg ${
            dark ? "bottom-full mb-2 left-0" : "right-0"
          }`}
        >
          {routing.locales.map((l) => (
            <li key={l} role="none">
              <Link
                role="menuitem"
                href={pathname}
                locale={l}
                onClick={() => setOpen(false)}
                aria-current={l === locale ? "true" : undefined}
                className={`flex items-center gap-3 px-4 py-3 font-black normal-case hover:bg-paper ${l === locale ? "bg-paper" : ""}`}
              >
                <Flag locale={l} className="h-4 w-6 rounded-[2px]" />
                {t(`languages.${l}`)}
                {l === locale && <span className="ml-auto" aria-hidden="true">✓</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
