"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const KEY = "rtj:pages";

/** Counts the pages seen in this tab, so a back button knows whether there is a page of ours to go back to. */
export function HistoryTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      // Only real page changes count (not reloads, nor effects running twice in development).
      if (sessionStorage.getItem(`${KEY}:last`) === pathname) return;
      sessionStorage.setItem(`${KEY}:last`, pathname);
      sessionStorage.setItem(KEY, String(Number(sessionStorage.getItem(KEY) ?? 0) + 1));
    } catch {}
  }, [pathname]);
  return null;
}

export function hasEarlierPage() {
  try {
    return Number(sessionStorage.getItem(KEY) ?? 0) > 1 && window.history.length > 1;
  } catch {
    return false;
  }
}
