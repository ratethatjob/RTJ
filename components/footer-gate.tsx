"use client";

import { usePathname } from "@/i18n/navigation";

/** The footer belongs to public pages; dashboards and forms have their own chrome. */
export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (/^\/(business|admin)(\/|$)/.test(pathname) || /^\/app\/(rate|apply)\//.test(pathname)) return null;
  return children;
}
