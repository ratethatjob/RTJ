"use client";

import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Thin bar at the top from the click on an internal link (or a GET form submit) until the new
 *  page renders, so a slow navigation never looks like nothing happened. */
export function NavigationProgress() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const start = (url: URL) => {
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setActive(true);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      start(new URL(a.href, location.href));
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (e.defaultPrevented || form.method.toLowerCase() !== "get" || !form.action) return;
      start(new URL(form.action, location.href));
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // New page (or query) rendered: done. Also a safety stop after 15 s.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(false);
  }, [pathname, search]);
  useEffect(() => {
    const onPop = () => setActive(false);
    window.addEventListener("popstate", onPop);
    const stop = active ? setTimeout(() => setActive(false), 15_000) : undefined;
    return () => {
      window.removeEventListener("popstate", onPop);
      clearTimeout(stop);
    };
  }, [active]);

  if (!active) return null;
  return (
    <div role="progressbar" aria-label={t("loading")} className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1">
      <div
        className="h-full origin-left bg-signal"
        style={{ animation: "rtj-progress 8s cubic-bezier(0.1, 0.7, 0.2, 1) forwards" }}
      />
    </div>
  );
}
