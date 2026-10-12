// What a location's subscription looks like to the employer: one state with a clear label,
// days left, how long Pro lasts and when the next charge is. Pure (no imports), so it is
// unit-tested (lib/billing-status.test.ts) and shared by the billing page and the dashboard.

export type BillingState = "trial" | "active" | "past_due" | "canceling" | "expired" | "free";

export type PlanFacts = {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  /** Pro is paid up to here (card or bank transfer). */
  paidUntil: string | null;
  /** Mirrored Stripe subscription status, if there is one. */
  stripeStatus: string | null;
  /** End of the current Stripe period (trial end while Stripe is trialing). */
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingView = {
  state: BillingState;
  /** A Stripe subscription that renews or retries by itself. */
  subscribed: boolean;
  /** Whole days until the trial ends (trial only). */
  daysLeft: number | null;
  /** Share of the trial used, 0–1 (trial only). */
  trialProgress: number | null;
  /** Pro works until this date (trial end, cancel date, paid period or retry window). */
  accessUntil: string | null;
  /** The next automatic card charge (active or a subscribed trial). */
  nextChargeAt: string | null;
  /** Worth a banner on the dashboard: trial ends within 7 days, or a payment failed. */
  attention: boolean;
  /** Active from a period paid by bank transfer (no Stripe subscription behind it). */
  transfer?: boolean;
};

/** Stripe statuses that mean a subscription exists (no second Checkout). */
export const SUBSCRIBED_STATUSES = ["active", "trialing", "past_due", "unpaid", "incomplete"];

const DAY = 24 * 3600 * 1000;
const time = (iso: string | null) => (iso ? Date.parse(iso) : NaN);
const later = (iso: string | null, now: number) => Number.isFinite(time(iso)) && time(iso) > now;

export function billingView(p: PlanFacts, now: number = Date.now()): BillingView {
  const stripe = p.stripeStatus ?? "";
  const subscribed = ["active", "trialing", "past_due", "unpaid"].includes(stripe);
  const trialOn = later(p.trialEndsAt, now);
  const paidOn = later(p.paidUntil, now);
  const base = { subscribed, daysLeft: null, trialProgress: null, accessUntil: null, nextChargeAt: null, attention: false };

  if (stripe === "past_due" || stripe === "unpaid") {
    // Stripe keeps retrying; Pro lasts until the last paid period (or the trial) ends.
    const until = [p.paidUntil, p.trialEndsAt].filter((d) => later(d, now)).sort().pop() ?? null;
    return { ...base, state: "past_due", accessUntil: until, attention: true };
  }
  if ((stripe === "active" || stripe === "trialing") && p.cancelAtPeriodEnd) {
    return { ...base, state: "canceling", accessUntil: p.periodEnd ?? p.paidUntil };
  }
  if (trialOn || stripe === "trialing") {
    const end = trialOn ? p.trialEndsAt! : p.periodEnd;
    const daysLeft = end ? Math.max(0, Math.ceil((time(end) - now) / DAY)) : null;
    const start = time(p.trialStartedAt);
    const progress =
      end && Number.isFinite(start) && time(end) > start
        ? Math.min(1, Math.max(0, (now - start) / (time(end) - start)))
        : null;
    return {
      ...base,
      state: "trial",
      daysLeft,
      trialProgress: progress,
      accessUntil: end,
      // Subscribed during the trial: the first charge is at the trial end.
      nextChargeAt: subscribed ? (p.periodEnd ?? end) : null,
      attention: !subscribed && daysLeft !== null && daysLeft <= 7,
    };
  }
  if (stripe === "active") {
    return { ...base, state: "active", accessUntil: p.periodEnd ?? p.paidUntil, nextChargeAt: p.periodEnd };
  }
  // Paid by bank transfer (no automatic renewal), or a period still running after Stripe ended.
  if (paidOn) return { ...base, state: "active", accessUntil: p.paidUntil, transfer: !stripe };
  if (p.trialStartedAt || p.paidUntil || stripe) return { ...base, state: "expired" };
  return { ...base, state: "free" };
}

/** Yearly price saving against 12 monthly payments, as a whole percentage. */
export function yearlySavingPercent(monthly: number, yearly: number) {
  return monthly > 0 ? Math.round((1 - yearly / (monthly * 12)) * 100) : 0;
}
