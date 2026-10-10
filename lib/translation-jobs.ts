import { revalidateTag } from "next/cache";
import { adminClient } from "./supabase/admin";
import { translate } from "./translate";

// Stores machine translations of reviews and employer replies. Runs after the
// response (via after()) and from the daily backfill cron. Never throws.

const MODEL_NAME = "claude-opus-5-5";

export async function translateReview(reviewId: string) {
  const db = adminClient();
  if (!db) return;
  try {
    const { data: r } = await db
      .from("reviews")
      .select("id, body, location_id, status")
      .eq("id", reviewId)
      .single();
    if (!r?.body) return;
    const result = await translate(r.body);
    if (!result) return;
    await db.from("reviews").update({ original_language: result.language }).eq("id", r.id);
    const rows = Object.entries(result.translations)
      .filter(([locale]) => locale !== result.language)
      .map(([locale, body]) => ({ review_id: r.id, locale, body, model: MODEL_NAME }));
    if (rows.length) await db.from("review_translations").upsert(rows, { onConflict: "review_id,locale" });
    if (r.status === "published") revalidateTag(`reviews:${r.location_id}`, "max");
  } catch (e) {
    console.error("translateReview", reviewId, e);
  }
}

export async function translateReply(replyId: string) {
  const db = adminClient();
  if (!db) return;
  try {
    const { data: reply } = await db
      .from("employer_replies")
      .select("id, body, reviews(location_id)")
      .eq("id", replyId)
      .single();
    if (!reply?.body) return;
    const result = await translate(reply.body);
    if (!result) return;
    await db.from("employer_replies").update({ original_language: result.language }).eq("id", reply.id);
    // An edited reply replaces its old translations.
    await db.from("reply_translations").delete().eq("reply_id", reply.id);
    const rows = Object.entries(result.translations)
      .filter(([locale]) => locale !== result.language)
      .map(([locale, body]) => ({ reply_id: reply.id, locale, body, model: MODEL_NAME }));
    if (rows.length) await db.from("reply_translations").insert(rows);
    const loc = (reply.reviews as unknown as { location_id: string } | null)?.location_id;
    if (loc) revalidateTag(`reviews:${loc}`, "max");
  } catch (e) {
    console.error("translateReply", replyId, e);
  }
}

/** Backfill: recent reviews and replies with text but no translations yet. */
export async function translateMissing(limit = 25) {
  const db = adminClient();
  if (!db) return { reviews: 0, replies: 0 };
  const [{ data: reviews }, { data: replies }] = await Promise.all([
    db
      .from("reviews")
      .select("id, review_translations(locale)")
      .not("body", "is", null)
      .in("status", ["pending_moderation", "scheduled", "published"])
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("employer_replies")
      .select("id, updated_at, reply_translations(locale, created_at)")
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  const reviewIds = (reviews ?? [])
    .filter((r) => !(r.review_translations as unknown[]).length)
    .slice(0, limit)
    .map((r) => r.id);
  const replyIds = (replies ?? [])
    .filter((r) => {
      const t = r.reply_translations as { created_at: string }[];
      return !t.length || t.every((x) => x.created_at < r.updated_at);
    })
    .slice(0, limit)
    .map((r) => r.id);
  for (const id of reviewIds) await translateReview(id);
  for (const id of replyIds) await translateReply(id);
  return { reviews: reviewIds.length, replies: replyIds.length };
}
