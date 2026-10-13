// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewScore } from "./review-score.ts";

test("every answer counts: overall 5 with pay 4 is 4.8", () => {
  assert.equal(reviewScore({ overall: 5, manager: 5, pay: 4, schedule: 5, environment: 5 }), 4.8);
});

test("only the answers given; an applicant's overall alone stays that number", () => {
  assert.equal(reviewScore({ overall: 4, pay: 3 }), 3.5);
  assert.equal(reviewScore({ overall: 2 }), 2);
  assert.equal(reviewScore({}), null);
});
