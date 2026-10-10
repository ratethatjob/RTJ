"use server";

import { getUser } from "@/lib/auth";

const REASONS = ["personal", "hate", "fake", "spam", "other"] as const;

export async function reportReview(
  reviewId: string,
  reason: string,
  details: string,
): Promise<{ ok?: true; error?: "signin" | "invalid" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "signin" };
  const text = details.trim();
  if (!REASONS.includes(reason as (typeof REASONS)[number]) || text.length > 1500) return { error: "invalid" };
  const { error } = await supabase.from("reports").insert({
    review_id: reviewId,
    reporter_id: user.id,
    reason: text ? `${reason}: ${text}` : reason,
  });
  // A second report from the same person is already in the queue.
  if (error && error.code !== "23505") return { error: "generic" };
  return { ok: true };
}
