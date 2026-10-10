"use client";

import { useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function HelpfulButton({ reviewId, count, label }: { reviewId: string; count: number; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [n, setN] = useState(count);
  const [voted, setVoted] = useState(false);

  async function vote() {
    if (voted) return;
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return router.push({ pathname: "/app/sign-in", query: { next: pathname } });
    const { data: total, error } = await supabase.rpc("vote_helpful", { p_review_id: reviewId });
    if (!error) {
      setN(Number(total));
      setVoted(true);
    }
  }

  return (
    <button
      type="button"
      onClick={vote}
      aria-pressed={voted}
      className={`rounded-xl px-3 py-1.5 text-sm font-black ${voted ? "bg-ink text-paper" : "border border-mist/60"}`}
    >
      👍 {label}
      {n > 0 && ` · ${n}`}
    </button>
  );
}
