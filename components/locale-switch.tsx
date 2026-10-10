"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { GlobeIcon } from "./icons";

export function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const next =
    routing.locales[(routing.locales.indexOf(locale as never) + 1) % routing.locales.length];

  return (
    <Link
      href={pathname}
      locale={next}
      aria-label={t("switchLanguage")}
      className="inline-flex h-11 items-center gap-1.5 rounded-full border border-mist/60 px-3.5 font-black uppercase"
    >
      <GlobeIcon className="size-4" />
      {locale}
    </Link>
  );
}
