"use client";

import { useRouter } from "next/navigation";
import { hasEarlierPage } from "@/components/history-tracker";
import { ChevronLeftIcon } from "@/components/icons";

/**
 * Back to wherever the visitor came from. Without an earlier page of ours in this tab it goes to
 * `fallback`, which must not be a page that needs sign-in (that would bounce straight back here).
 */
export function BackButton({ fallback, label }: { fallback: string; label: string }) {
  const router = useRouter();
  return (
    <a
      href={fallback}
      aria-label={label}
      onClick={(e) => {
        if (!hasEarlierPage()) return;
        e.preventDefault();
        router.back();
      }}
      className="-ml-2 inline-block p-2"
    >
      <ChevronLeftIcon className="size-7" />
    </a>
  );
}
