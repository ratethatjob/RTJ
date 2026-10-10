// Shape the review form sends, and server-side validation into a DB row.

export const RELATIONSHIPS = ["applicant", "trial_shift", "current", "former"] as const;
export const RATING_KEYS = ["overall", "manager", "pay", "schedule", "environment"] as const;
export const FACT_KEYS = ["paid_as_promised", "paid_on_time", "overtime_paid", "hours_as_promised"] as const;
export const PUBLISH_MODES = ["now", "delayed", "after_leaving"] as const;

export type ReviewInput = {
  locationId: string;
  relationship: (typeof RELATIONSHIPS)[number] | null;
  periodStart: string; // YYYY-MM
  periodEnd: string; // YYYY-MM or ""
  position: string;
  workType: "permanent" | "temporary";
  ratings: Partial<Record<(typeof RATING_KEYS)[number], number>>;
  wouldReturn: boolean | null;
  facts: Partial<Record<(typeof FACT_KEYS)[number], boolean>>;
  gotReply: boolean | null;
  replyDays: string;
  interviewRounds: string;
  body: string;
  publishMode: (typeof PUBLISH_MODES)[number];
};

const month = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseReview(input: ReviewInput) {
  const r = input.relationship;
  const applicant = r === "applicant";
  const position = input.position.trim();
  const needsEnd = r === "former";

  if (
    !r ||
    !RELATIONSHIPS.includes(r) ||
    !month.test(input.periodStart) ||
    (needsEnd && !month.test(input.periodEnd)) ||
    !position ||
    position.length > 80 ||
    !["permanent", "temporary"].includes(input.workType) ||
    !PUBLISH_MODES.includes(input.publishMode)
  ) {
    return { error: "required" as const };
  }
  if (needsEnd && input.periodEnd < input.periodStart) return { error: "dates" as const };

  const rating = (k: (typeof RATING_KEYS)[number]) => {
    const v = input.ratings[k];
    return Number.isInteger(v) && v! >= 1 && v! <= 5 ? v! : null;
  };
  const overall = rating("overall");
  if (!overall && !applicant) return { error: "required" as const };

  const count = (v: string) => {
    const n = Number.parseInt(v, 10);
    return Number.isInteger(n) && n >= 0 && n < 1000 ? n : null;
  };
  const bool = (v: unknown) => (typeof v === "boolean" ? v : null);
  const body = input.body.trim().slice(0, 5000) || null;

  return {
    row: {
      location_id: input.locationId,
      relationship: r,
      period_start: `${input.periodStart}-01`,
      period_end: needsEnd ? `${input.periodEnd}-01` : null,
      position,
      work_type: input.workType,
      overall,
      manager: applicant ? null : rating("manager"),
      pay: applicant ? null : rating("pay"),
      schedule: applicant ? null : rating("schedule"),
      environment: applicant ? null : rating("environment"),
      would_return: applicant ? null : bool(input.wouldReturn),
      paid_as_promised: applicant ? null : bool(input.facts.paid_as_promised),
      paid_on_time: applicant ? null : bool(input.facts.paid_on_time),
      overtime_paid: applicant ? null : bool(input.facts.overtime_paid),
      hours_as_promised: applicant ? null : bool(input.facts.hours_as_promised),
      got_reply: applicant ? bool(input.gotReply) : null,
      reply_days: applicant && input.gotReply ? count(input.replyDays) : null,
      interview_rounds: applicant ? count(input.interviewRounds) : null,
      body,
      // "After I leave" only makes sense while still working there.
      publish_mode: input.publishMode === "after_leaving" && r !== "current" ? "now" : input.publishMode,
    },
  };
}
