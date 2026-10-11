"use client";

import { useEffect, useState } from "react";

/** Native share sheet (Web Share API). Renders nothing where the browser has none. */
export function ShareButton({ url, title, text, label }: { url: string; title: string; text: string; label: string }) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    // navigator only exists in the browser, so check after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  if (!canShare) return null;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.share({ url: new URL(url, window.location.origin).href, title, text }).catch(() => {});
      }}
      className="rounded-2xl border-2 border-ink py-3 text-center text-base font-black"
    >
      {label}
    </button>
  );
}
