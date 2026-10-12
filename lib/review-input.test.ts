// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReview, type ReviewInput } from "./review-input.ts";

const base: ReviewInput = {
  locationId: "00000000-0000-0000-0000-000000000001",
  relationship: "current",
  periodStart: "2024-03",
  periodEnd: "",
  position: "Barista",
  workType: "permanent",
  ratings: { overall: 4, manager: 3, pay: 4, schedule: 3, environment: 5 },
  wouldReturn: true,
  facts: {},
  gotReply: null,
  replyDays: "",
  interviewRounds: "",
  body: "",
};

test("nobody picks a publishing time: every row is 'now'", () => {
  const r = parseReview(base);
  assert.ok("row" in r && r.row);
  assert.equal(r.row.publish_mode, "now");
});

test("after_leaving is refused: an old saved draft still asking for it is sent as 'now'", () => {
  for (const publishMode of ["after_leaving", "delayed"]) {
    const old = { ...base, publishMode } as ReviewInput;
    const r = parseReview(old);
    assert.ok("row" in r && r.row);
    assert.equal(r.row.publish_mode, "now");
    assert.ok(!Object.values(r.row).includes("after_leaving"));
  }
});
