"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useBusinessStatus } from "@/lib/business-status";

/** `match`: regular expression source for the paths that belong to this section. */
export type NavItem = { href: string; label: string; match: string };

/** Main desktop links with the current section marked. "For employers" gives way to the business
 *  dashboard / request button (HeaderBusinessLink) for members and open requests. */
export function HeaderNav({ items, employers }: { items: NavItem[]; employers: NavItem }) {
  const pathname = usePathname();
  const status = useBusinessStatus();
  const shown = status?.org || status?.pendingClaim ? items : [...items, employers];
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {shown.map((i) => {
        const active = new RegExp(i.match).test(pathname);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-[15px] font-semibold ${
              active ? "bg-ink/[0.06] text-ink" : "text-slate hover:text-ink"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
