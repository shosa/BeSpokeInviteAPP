import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPlanner, isInviteTier } from "../src/planner";

test("il planner è solo nel livello premium", () => {
  assert.equal(hasPlanner("premium"), true);
  assert.equal(hasPlanner("rsvp"), false);
  assert.equal(hasPlanner("save_the_date"), false);
  assert.equal(hasPlanner(null), false);
});

test("solo i livelli noti sono validi", () => {
  assert.equal(isInviteTier("premium"), true);
  assert.equal(isInviteTier("gold"), false);
  assert.equal(isInviteTier(undefined), false);
});
