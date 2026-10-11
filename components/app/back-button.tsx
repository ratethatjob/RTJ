"use client";

import { useRouter } from "next/navigation";
import { hasEarlierPage } from "@/components/history-tracker";
import { BACK_LINK_CLASS } from "@/components/app/back-link-class";
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
      onClick={(e) => {
        if (!hasEarlierPage()) return;
        e.preventDefault();
        router.back();
      }}
      className={BACK_LINK_CLASS}
    >
      <ChevronLeftIcon className="size-6" />
      {label}
    </a>
  );
}
