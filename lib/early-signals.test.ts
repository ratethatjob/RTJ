// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  basisKey,
  categoryDirections,
  filterTopics,
  MIN_PENDING,
  newCategories,
  type RawTopic,
  safeSummary,
  signalBasis,
  type SignalReview,
} from "./early-signals.ts";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 24 * 3600 * 1000).toISOString();
let seq = 0;
const review = (r: Partial<SignalReview>): SignalReview => ({
  id: `r${++seq}`,
  userId: `u${seq}`,
  status: "scheduled",
  publishMode: "now",
  held: false,
  publishedAt: null,
  updatedAt: daysAgo(1),
  body: null,
  position: null,
  ratings: {},
  ...r,
});
const pending = (n: number, r: Partial<SignalReview> = {}) => Array.from({ length: n }, () => review(r));
const published = (n: number, r: Partial<SignalReview> = {}) =>
  Array.from({ length: n }, () => review({ status: "published", publishedAt: daysAgo(20), ...r }));

test("nothing below 5 waiting reviews, something from 5", () => {
  assert.equal(MIN_PENDING, 5);
  assert.equal(signalBasis(pending(4), NOW), null);
  assert.equal(signalBasis(pending(5), NOW)?.pending.length, 5);
  // pending_moderation counts too, published ones don't.
  assert.notEqual(signalBasis([...pending(3), ...pending(2, { status: "pending_moderation" })], NOW), null);
  assert.equal(signalBasis([...pending(4), ...published(10)], NOW), null);
});

test("after_leaving and held reviews never count", () => {
  assert.equal(signalBasis([...pending(4), ...pending(3, { publishMode: "after_leaving" })], NOW), null);
  assert.equal(signalBasis([...pending(4), review({ held: true })], NOW), null);
  const basis = signalBasis([...pending(5), ...published(3, { publishMode: "after_leaving" })], NOW)!;
  assert.equal(basis.recent.length, 0);
  assert.equal(basis.baseline.length, 0);
  assert.ok(basis.pending.every((r) => r.publishMode !== "after_leaving"));
});

test("recent = published in the last 60 days, baseline = last 12 months", () => {
  const basis = signalBasis([...pending(5), ...published(2), ...published(3, { publishedAt: daysAgo(200) }), ...published(1, { publishedAt: daysAgo(400) })], NOW)!;
  assert.equal(basis.recent.length, 2);
  assert.equal(basis.baseline.length, 5);
});

test("a theme needs 3 different reviewers", () => {
  const known = new Set(["R1", "R2", "R3", "R4"]);
  const theme = (reviewers: string[]): RawTopic => ({
    category: "pay",
    en: "Pay often arrives later than promised",
    hu: "A fizetés gyakran később érkezik",
    reviewers,
  });
  assert.equal(filterTopics([theme(["R1", "R2"])], known, [], []).length, 0);
  assert.equal(filterTopics([theme(["R1", "R1", "R2"])], known, [], []).length, 0, "the same reviewer twice is one");
  assert.equal(filterTopics([theme(["R1", "R2", "R9"])], known, [], []).length, 0, "unknown reviewers don't count");
  assert.equal(filterTopics([theme(["R1", "R2", "R3"])], known, [], []).length, 1);
});

test("themes never quote, count, date or name", () => {
  const src = ["The shift manager Kata shouts at the new cashiers every morning before opening"];
  const positions = ["Pénztáros", "shift manager"];
  assert.equal(safeSummary("Communication from management is often harsh", src, positions), true);
  assert.equal(safeSummary("Shouts at the new cashiers every morning", src, positions), false, "4 copied words");
  assert.equal(safeSummary("Late pay in 3 cases", src, positions), false, "number");
  assert.equal(safeSummary('Staff say "chaos"', src, positions), false, "quote");
  assert.equal(safeSummary("Problems since October", src, positions), false, "month");
  assert.equal(safeSummary("A pénztárosok túlterheltek", src, positions), true);
  assert.equal(safeSummary("Complaints about the shift manager tone", src, positions), false, "a reviewer's job title");
  assert.equal(safeSummary("x".repeat(161), src, positions), false, "too long");
});

test("directions without numbers, only with enough ratings", () => {
  const basis = signalBasis([
    ...pending(5, { ratings: { pay: 2, manager: 4 } }),
    ...published(3, { ratings: { pay: 4, manager: 4 } }),
  ], NOW)!;
  assert.deepEqual(categoryDirections(basis), [{ category: "pay", direction: "worse" }]);
  const thin = signalBasis([...pending(5, { ratings: { pay: 1 } }), ...published(2, { ratings: { pay: 5 } })], NOW)!;
  assert.deepEqual(categoryDirections(thin), []);
});

test("the AI only runs again when the reviews change; new themes for the weekly email", () => {
  const rs = pending(5);
  const a = basisKey(signalBasis(rs, NOW));
  assert.equal(basisKey(signalBasis([...rs].reverse(), NOW)), a);
  assert.notEqual(basisKey(signalBasis([...rs, review({})], NOW)), a);
  assert.equal(basisKey(null), "none");
  assert.deepEqual(newCategories([{ category: "pay", en: "a", hu: "b" }, { category: "manager", en: "c", hu: "d" }], ["pay"]), ["manager"]);
});
