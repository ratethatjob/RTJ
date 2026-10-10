"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { BrandIcon } from "../logo";

type Props = { orgName: string; role: string; awaiting: number };

const ITEMS = [
  { key: "overview", href: "/business" },
  { key: "locations", href: "/business/locations" },
  { key: "reviews", href: "/business/reviews" },
  { key: "invite", href: "/business/invite" },
  { key: "index", href: "/business/index" },
  { key: "jobs", href: "/business/jobs" },
  { key: "team", href: "/business/team" },
  { key: "plan", href: "/business/locations#plan" },
] as const;

export function BusinessSidebar({ orgName, role, awaiting }: Props) {
  const t = useTranslations("Business");
  const pathname = usePathname();

  return (
    <aside className="flex shrink-0 flex-col bg-ink p-4 text-paper lg:min-h-dvh lg:w-72 lg:p-5">
      <div className="flex items-center justify-between gap-4 lg:block">
        <Link href="/business" className="flex items-center gap-2.5">
          <BrandIcon className="h-6 w-auto" />
          <span className="text-lg leading-tight tracking-brand">
            <span className="font-black">RateThatJob</span>{" "}
            <span className="text-mist">{t("brand")}</span>
          </span>
        </Link>
        <div className="rounded-2xl border border-white/15 px-3 py-2 lg:mt-6 lg:px-4 lg:py-3">
          <p className="hidden text-sm text-mist lg:block">{t("company")}</p>
          <p className="max-w-40 truncate font-black lg:max-w-none">{orgName}</p>
        </div>
      </div>

      <nav className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:mt-6 lg:flex-col lg:px-0">
        {ITEMS.map(({ key, href }) => {
          const active = href && !href.includes("#") && (pathname === href || (href !== "/business" && pathname.startsWith(`${href}/`)));
          const content = (
            <>
              <span>{t(`nav.${key}`)}</span>
              {key === "reviews" && awaiting > 0 && (
                <span className="grid size-6 place-items-center rounded-full bg-paper text-sm text-ink">
                  {awaiting}
                </span>
              )}
              {!href && (
                <span className="text-xs uppercase tracking-tagline text-mist">{t("nav.soon")}</span>
              )}
            </>
          );
          const cls = `flex shrink-0 items-center justify-between gap-3 rounded-xl px-4 py-3 font-black ${
            active ? "bg-signal text-ink" : !href ? "text-mist" : ""
          }`;
          return href ? (
            <Link key={key} href={href} className={cls} aria-current={active ? "page" : undefined}>
              {content}
            </Link>
          ) : (
            <span key={key} className={cls}>
              {content}
            </span>
          );
        })}
      </nav>

      <p className="mt-auto hidden pt-8 text-sm text-mist lg:block">
        {t("signedInAs", { role: t(`roles.${role}`) })}
      </p>
    </aside>
  );
}
