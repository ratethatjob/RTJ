// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { billingView, type PlanFacts, yearlySavingPercent } from "./billing-status.ts";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const day = (n: number) => new Date(NOW + n * 24 * 3600 * 1000).toISOString();
const plan = (p: Partial<PlanFacts>): PlanFacts => ({
  trialStartedAt: null,
  trialEndsAt: null,
  paidUntil: null,
  stripeStatus: null,
  periodEnd: null,
  cancelAtPeriodEnd: false,
  ...p,
});

test("no plan at all is free", () => {
  assert.equal(billingView(plan({}), NOW).state, "free");
});

test("trial without a card: days left, progress, attention in the last 7 days", () => {
  const v = billingView(plan({ trialStartedAt: day(-20), trialEndsAt: day(10) }), NOW);
  assert.equal(v.state, "trial");
  assert.equal(v.daysLeft, 10);
  assert.ok(Math.abs(v.trialProgress! - 20 / 30) < 1e-9);
  assert.equal(v.accessUntil, day(10));
  assert.equal(v.nextChargeAt, null);
  assert.equal(v.attention, false);
  const soon = billingView(plan({ trialStartedAt: day(-25), trialEndsAt: day(5) }), NOW);
  assert.equal(soon.daysLeft, 5);
  assert.equal(soon.attention, true);
});

test("a part of a day left still counts as one day", () => {
  const v = billingView(plan({ trialStartedAt: day(-29.5), trialEndsAt: day(0.5) }), NOW);
  assert.equal(v.daysLeft, 1);
});

test("subscribed during the trial: first charge at the trial end, no warning", () => {
  const v = billingView(
    plan({ trialStartedAt: day(-25), trialEndsAt: day(5), stripeStatus: "trialing", periodEnd: day(5) }),
    NOW,
  );
  assert.equal(v.state, "trial");
  assert.equal(v.subscribed, true);
  assert.equal(v.nextChargeAt, day(5));
  assert.equal(v.attention, false);
});

test("trial over without paying is expired", () => {
  const v = billingView(plan({ trialStartedAt: day(-40), trialEndsAt: day(-10) }), NOW);
  assert.equal(v.state, "expired");
  assert.equal(v.accessUntil, null);
});

test("active card subscription: next charge at the period end", () => {
  const v = billingView(plan({ stripeStatus: "active", periodEnd: day(20), paidUntil: day(20) }), NOW);
  assert.equal(v.state, "active");
  assert.equal(v.nextChargeAt, day(20));
  assert.equal(v.accessUntil, day(20));
});

test("paid by bank transfer: active, no automatic charge", () => {
  const v = billingView(plan({ trialStartedAt: day(-60), trialEndsAt: day(-30), paidUntil: day(100) }), NOW);
  assert.equal(v.state, "active");
  assert.equal(v.subscribed, false);
  assert.equal(v.nextChargeAt, null);
});

test("cancelled for the period end: works until then", () => {
  const v = billingView(
    plan({ stripeStatus: "active", periodEnd: day(12), paidUntil: day(12), cancelAtPeriodEnd: true }),
    NOW,
  );
  assert.equal(v.state, "canceling");
  assert.equal(v.accessUntil, day(12));
  assert.equal(v.nextChargeAt, null);
});

test("failed payment: needs attention, access until the paid period ends", () => {
  const v = billingView(plan({ stripeStatus: "past_due", periodEnd: day(30), paidUntil: day(2) }), NOW);
  assert.equal(v.state, "past_due");
  assert.equal(v.attention, true);
  assert.equal(v.accessUntil, day(2));
  const gone = billingView(plan({ stripeStatus: "unpaid", paidUntil: day(-3) }), NOW);
  assert.equal(gone.state, "past_due");
  assert.equal(gone.accessUntil, null);
});

test("subscription ended in Stripe is expired", () => {
  assert.equal(billingView(plan({ stripeStatus: "canceled", paidUntil: day(-1) }), NOW).state, "expired");
});

test("yearly saving", () => {
  assert.equal(yearlySavingPercent(39, 390), 17);
  assert.equal(yearlySavingPercent(12900, 129000), 17);
  assert.equal(yearlySavingPercent(0, 10), 0);
});
