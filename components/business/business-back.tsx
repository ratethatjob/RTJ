"use client";

import { useTranslations } from "next-intl";
import { BACK_LINK_CLASS } from "@/components/app/back-link-class";
import { ChevronLeftIcon } from "@/components/icons";
import { Link, usePathname } from "@/i18n/navigation";

/** "← Back" on every employer page except the overview: to the parent page in the URL
 *  (`/business/jobs/1/edit` → `/business/jobs/1`). Without an employer account the top is the
 *  employers landing page. */
export function BusinessBack({ hasOrg }: { hasOrg: boolean }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  // Not on the overview, and not on the "request sent" page (it has its own buttons).
  if (!/^\/business\/./.test(pathname) || pathname === "/business/claim/sent") return null;
  const parts = pathname.split("/").filter(Boolean);
  // Join links (/business/join/<token>) have no page in between.
  const parent = parts[1] === "join" ? "/business" : `/${parts.slice(0, -1).join("/")}`;
  const href = parent === "/business" && !hasOrg ? "/employers" : parent;
  return (
    <Link href={href} className={BACK_LINK_CLASS}>
      <ChevronLeftIcon className="size-6" />
      {t("back")}
    </Link>
  );
}
