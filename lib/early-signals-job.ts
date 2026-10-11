import { createHash } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { sendEmail } from "./email";
import {
  basisKey,
  categoryDirections,
  filterTopics,
  newCategories,
  type SignalReview,
  signalBasis,
  type Topic,
} from "./early-signals";
import { summarizeThemes } from "./early-signals-ai";
import { SITE_URL } from "./seo";
import { adminClient } from "./supabase/admin";

type Db = NonNullable<ReturnType<typeof adminClient>>;
type Row = {
  location_id: string;
  input_hash: string | null;
  topics: Topic[];
  notified_at: string | null;
  notified_categories: string[];
};

const WEEK = 7 * 24 * 3600 * 1000;

/** Daily (/api/cron/signals): refreshes the early signals of every location with Pro (trial or
 *  paid). The AI runs only when the reviews behind a location changed; a new theme category
 *  emails the owners and HR, at most once a week per location. */
export async function refreshEarlySignals() {
  const db = adminClient();
  if (!db) return { skipped: "not configured" };
  const now = Date.now();
  const { data: plans } = await db.from("location_plans").select("location_id, trial_ends_at, paid_until, stripe_status");
  const future = (iso: string | null) => Boolean(iso && Date.parse(iso) > now);
  const ids = (plans ?? [])
    .filter((p) => future(p.trial_ends_at) || future(p.paid_until) || ["active", "trialing"].includes(p.stripe_status ?? ""))
    .map((p) => p.location_id as string);
  const { data: existing } = ids.length
    ? await db.from("early_signals").select("location_id, input_hash, topics, notified_at, notified_categories").in("location_id", ids)
    : { data: [] };
  const prev = new Map(((existing ?? []) as Row[]).map((r) => [r.location_id, r]));

  let summarized = 0;
  let emailed = 0;
  for (const id of ids) {
    try {
      const reviews = await loadReviews(db, id, now);
      const basis = signalBasis(reviews, now);
      const hash = createHash("sha256").update(basisKey(basis)).digest("hex");
      const before = prev.get(id);
      if (before?.input_hash === hash) continue;

      if (!basis) {
        await db.from("early_signals").upsert({ location_id: id, input_hash: hash, ready: false, topics: [], directions: [], generated_at: new Date().toISOString() });
        continue;
      }
      // Anonymous labels per reviewer, in a fixed order that says nothing about who wrote first.
      const texts = [...basis.pending, ...basis.recent].filter((r) => r.body?.trim());
      const labels = new Map<string, string>();
      for (const r of texts) {
        const who = r.userId ?? r.id;
        if (!labels.has(who)) labels.set(who, `R${labels.size + 1}`);
      }
      const input = texts
        .map((r) => ({ label: labels.get(r.userId ?? r.id)!, text: r.body! }))
        .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
      const raw = input.length ? await summarizeThemes(input) : [];
      if (raw) summarized += input.length ? 1 : 0;
      const topics = raw
        ? filterTopics(
            raw,
            new Set(labels.values()),
            texts.map((r) => r.body!),
            reviews.map((r) => r.position ?? "").filter(Boolean),
          )
        : [];
      // Without an answer from the AI the hash stays unset, so tomorrow tries again.
      await db.from("early_signals").upsert({
        location_id: id,
        input_hash: raw ? hash : null,
        ready: true,
        topics,
        directions: categoryDirections(basis),
        generated_at: new Date().toISOString(),
      });

      const fresh = newCategories(topics, before?.notified_categories ?? []);
      const quiet = before?.notified_at && now - Date.parse(before.notified_at) < WEEK;
      if (fresh.length && !quiet) {
        emailed += await notify(db, id);
        await db
          .from("early_signals")
          .update({ notified_at: new Date().toISOString(), notified_categories: topics.map((t) => t.category) })
          .eq("location_id", id);
      }
    } catch (e) {
      console.error("refreshEarlySignals", id, e);
    }
  }
  return { locations: ids.length, summarized, emailed };
}

async function loadReviews(db: Db, locationId: string, now: number): Promise<SignalReview[]> {
  const since = new Date(now - 366 * 24 * 3600 * 1000).toISOString();
  const { data } = await db
    .from("reviews")
    .select("id, user_id, status, publish_mode, hold_reason, published_at, updated_at, body, position, overall, manager, pay, schedule, environment")
    .eq("location_id", locationId)
    .or(`status.in.(scheduled,pending_moderation),and(status.eq.published,published_at.gt.${since})`)
    .limit(500);
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    status: r.status,
    publishMode: r.publish_mode,
    held: Boolean(r.hold_reason),
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    body: r.body,
    position: r.position,
    ratings: { overall: r.overall, manager: r.manager, pay: r.pay, schedule: r.schedule, environment: r.environment },
  }));
}

/** "New early signal" email to the owners and HR of the location's org, in their language. */
async function notify(db: Db, locationId: string): Promise<number> {
  const { data: loc } = await db.from("locations").select("name, address, companies(owner_org_id)").eq("id", locationId).single();
  const orgId = (loc?.companies as unknown as { owner_org_id: string | null } | null)?.owner_org_id;
  if (!loc || !orgId) return 0;
  const { data: members } = await db.from("org_members").select("user_id").eq("org_id", orgId).in("role", ["owner", "hr"]);
  let sent = 0;
  for (const m of members ?? []) {
    const { data: user } = await db.auth.admin.getUserById(m.user_id);
    const email = user.user?.email;
    if (!email) continue;
    const { data: profile } = await db.from("profiles").select("preferred_locale").eq("user_id", m.user_id).maybeSingle();
    const locale = profile?.preferred_locale === "hu" ? "hu" : "en";
    const t = await getTranslations({ locale, namespace: "EarlySignalsEmail" });
    const values = {
      location: `${loc.name}, ${loc.address}`,
      link: `${SITE_URL}${locale === "en" ? "" : `/${locale}`}/business?location=${locationId}`,
    };
    if (await sendEmail(email, t("subject", values), t("body", values))) sent += 1;
  }
  return sent;
}
