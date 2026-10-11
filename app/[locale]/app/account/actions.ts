"use server";

import { getUser } from "@/lib/auth";
import { latestMonth } from "@/lib/review-input";

export async function markJobEnded(reviewId: string, month: string): Promise<{ ok?: true; error?: true }> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > latestMonth()) return { error: true };
  const { supabase, user } = await getUser();
  if (!user) return { error: true };
  const { error } = await supabase.rpc("mark_job_ended", { p_review_id: reviewId, p_end: `${month}-01` });
  return error ? { error: true } : { ok: true };
}

export async function deleteAccount(keepReviews: boolean): Promise<{ ok?: true; error?: true }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: true };
  const { error } = await supabase.rpc("delete_my_account", { p_keep_reviews: keepReviews });
  if (error) return { error: true };
  await supabase.auth.signOut();
  return { ok: true };
}

export async function signOut() {
  const { supabase } = await getUser();
  await supabase.auth.signOut();
}
