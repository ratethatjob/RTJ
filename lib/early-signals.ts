// Early signals (Pro): the rules that keep them anonymous. Pure, unit-tested in
// early-signals.test.ts; the AI call is in early-signals-ai.ts and the daily job in
// lib/early-signals-job.ts.
//
// - Reviews published "after I leave" never count, nor held ones (manual moderation queue).
// - Nothing is shown below MIN_PENDING reviews waiting to go live.
// - A theme needs MIN_REVIEWERS different reviewers; it never quotes, names, dates or counts.
// - Directions per category come from the ratings, without numbers.

export const MIN_PENDING = 5;
export const MIN_REVIEWERS = 3;
/** Ratings per category needed on both sides before a direction is shown. */
export const MIN_RATED = 3;
/** Average change (stars) that counts as a direction. */
export const DIRECTION_STEP = 0.5;
export const RECENT_DAYS = 60;
export const BASELINE_DAYS = 365;

export const SIGNAL_CATEGORIES = ["pay", "manager", "schedule", "environment", "overall"] as const;
export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];
/** Theme categories the AI may use (ratings categories plus a few common ones). */
export const TOPIC_CATEGORIES = ["pay", "manager", "schedule", "environment", "workload", "training", "safety", "other"] as const;
export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];

export type SignalReview = {
  id: string;
  /** The reviewer (several reviews by one person count once). */
  userId: string | null;
  status: string;
  publishMode: string;
  held: boolean;
  publishedAt: string | null;
  updatedAt: string;
  body: string | null;
  position: string | null;
  ratings: Partial<Record<SignalCategory, number | null>>;
};

export type SignalBasis = { pending: SignalReview[]; recent: SignalReview[]; baseline: SignalReview[] };
export type Direction = { category: SignalCategory; direction: "worse" | "better" };
export type Topic = { category: TopicCategory; en: string; hu: string };
export type RawTopic = Topic & { reviewers: string[] };

const DAY = 24 * 3600 * 1000;
const isPending = (r: SignalReview) => r.status === "scheduled" || r.status === "pending_moderation";

/** The reviews a location's signals may use, or null when fewer than MIN_PENDING wait to go live. */
export function signalBasis(reviews: SignalReview[], now = Date.now()): SignalBasis | null {
  const usable = reviews.filter((r) => r.publishMode !== "after_leaving" && !r.held);
  const pending = usable.filter(isPending);
  if (pending.length < MIN_PENDING) return null;
  const published = usable.filter((r) => r.status === "published" && r.publishedAt);
  const since = (days: number) => published.filter((r) => Date.parse(r.publishedAt!) > now - days * DAY);
  return { pending, recent: since(RECENT_DAYS), baseline: since(BASELINE_DAYS) };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** "worse" / "better" per rating category: waiting reviews against the last 12 months published. */
export function categoryDirections(basis: SignalBasis): Direction[] {
  const out: Direction[] = [];
  for (const category of SIGNAL_CATEGORIES) {
    const values = (rs: SignalReview[]) =>
      rs.map((r) => r.ratings[category]).filter((v): v is number => typeof v === "number");
    const now = values(basis.pending);
    const before = values(basis.baseline);
    if (now.length < MIN_RATED || before.length < MIN_RATED) continue;
    const delta = mean(now) - mean(before);
    if (delta <= -DIRECTION_STEP) out.push({ category, direction: "worse" });
    else if (delta >= DIRECTION_STEP) out.push({ category, direction: "better" });
  }
  return out;
}

const MONTHS_AND_DAYS =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|janu[aá]r|febru[aá]r|m[aá]rcius|[aá]prilis|m[aá]jus|j[uú]nius|j[uú]lius|augusztus|szeptember|okt[oó]ber|november|december|h[eé]tf[oő]|kedd|szerda|cs[uü]t[oö]rt[oö]k|p[eé]ntek|szombat|vas[aá]rnap|yesterday|tomorrow|tegnap|holnap)\b/iu;

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}]+/u)
    .filter(Boolean);

function sharesRun(summary: string, source: string, run = 4) {
  const a = words(summary);
  const b = words(source).join(" ");
  for (let i = 0; i + run <= a.length; i++) {
    if (` ${b} `.includes(` ${a.slice(i, i + run).join(" ")} `)) return true;
  }
  return false;
}

/** One theme sentence is safe to show: short, no numbers, quotes, emails, links, dates, job
 *  titles of the reviewers, and no run of 4+ words copied from any review. */
export function safeSummary(text: string, sources: string[], positions: string[]): boolean {
  const t = text.trim();
  if (!t || t.length > 160) return false;
  if (/[0-9"„”“'‘’«»@]|https?:|www\./i.test(t)) return false;
  if (MONTHS_AND_DAYS.test(t)) return false;
  const lower = ` ${words(t).join(" ")} `;
  if (positions.some((p) => words(p).length && lower.includes(` ${words(p).join(" ")} `))) return false;
  return !sources.some((s) => sharesRun(t, s));
}

/** Keeps the AI's themes that MIN_REVIEWERS different known reviewers mention and that pass
 *  safeSummary in both languages; one theme per category, at most five. */
export function filterTopics(
  raw: RawTopic[],
  reviewers: Set<string>,
  sources: string[],
  positions: string[],
): Topic[] {
  const out: Topic[] = [];
  for (const t of raw) {
    const distinct = new Set(t.reviewers.filter((r) => reviewers.has(r)));
    if (distinct.size < MIN_REVIEWERS) continue;
    if (!(TOPIC_CATEGORIES as readonly string[]).includes(t.category)) continue;
    if (out.some((o) => o.category === t.category)) continue;
    if (!safeSummary(t.en, sources, positions) || !safeSummary(t.hu, sources, positions)) continue;
    out.push({ category: t.category, en: t.en.trim(), hu: t.hu.trim() });
    if (out.length === 5) break;
  }
  return out;
}

/** Stable key of the reviews behind a summary: the AI runs again only when this changes. */
export function basisKey(basis: SignalBasis | null): string {
  if (!basis) return "none";
  const ids = [...basis.pending, ...basis.baseline].map((r) => `${r.id}:${r.status}:${r.updatedAt}`).sort();
  return ids.join("|");
}

/** Theme categories that are new against the ones the last email covered. */
export function newCategories(topics: Topic[], notified: string[]): string[] {
  return topics.map((t) => t.category).filter((c) => !notified.includes(c));
}
