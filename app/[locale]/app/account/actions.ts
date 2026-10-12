"use server";

import { getUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

export async function deleteAccount(keepReviews: boolean): Promise<{ ok?: true; error?: true }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: true };
  // Files that the database cascade would leave behind: CVs (applications are deleted) and,
  // with the reviews, their unchecked verification documents.
  const db = adminClient();
  const { data: cvs } = db
    ? await db.from("job_applications").select("cv_path").eq("user_id", user.id).not("cv_path", "is", null)
    : { data: [] };
  const { data: docs } =
    db && !keepReviews
      ? await db
          .from("verifications")
          .select("storage_path, reviews!inner(user_id)")
          .eq("reviews.user_id", user.id)
          .not("storage_path", "is", null)
      : { data: [] };
  const { error } = await supabase.rpc("delete_my_account", { p_keep_reviews: keepReviews });
  if (error) return { error: true };
  if (db) {
    const cvPaths = (cvs ?? []).map((c) => c.cv_path as string);
    if (cvPaths.length) await db.storage.from("cvs").remove(cvPaths);
    const docPaths = (docs ?? []).map((d) => d.storage_path as string);
    if (docPaths.length) await db.storage.from("verifications").remove(docPaths);
  }
  await supabase.auth.signOut();
  return { ok: true };
}

export async function signOut() {
  const { supabase } = await getUser();
  await supabase.auth.signOut();
}
