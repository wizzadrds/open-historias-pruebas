/*! Open Historia — action resolution tests © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
import test from "node:test";
import assert from "node:assert/strict";
import { applyVerifiedActionOutcomes, resolvePlannedActions, selectFallbackChatActions, selectPlannedActions, verifyPersistedChatOutcomes } from "./actionResolution.js";

test("a turn that clears the queue marks planned orders attempted, not fulfilled", () => {
  const actions = [
    { id: "a", text: "Build a bridge", status: "planned" },
    { id: "b", text: "Old order", status: "resolved" },
    { id: "c", text: "Another planned order", status: "planned" },
  ];
  const resolved = resolvePlannedActions(actions, true);
  assert.deepEqual(resolved.map(({ id, status }) => ({ id, status })), [
    { id: "a", status: "attempted" },
    { id: "b", status: "resolved" },
    { id: "c", status: "attempted" },
  ]);
  assert.deepEqual(actions.map((action) => action.status), ["planned", "resolved", "planned"], "input ledger is not mutated");
  assert.equal(resolved[0].status, "attempted", "a turn-level signal must not claim an individual order succeeded");
});

test("a turn that does not clear actions leaves planned orders pending", () => {
  const actions = [{ id: "a", status: "planned" }, { id: "b", status: "rejected" }];
  assert.deepEqual(resolvePlannedActions(actions, false), actions);
});

test("only planned orders are eligible for the next simulation pass", () => {
  const actions = [
    { id: "queued", status: "planned" },
    { id: "completed", status: "resolved" },
    { id: "rejected", status: "rejected" },
  ];

  assert.deepEqual(selectPlannedActions(actions).map(({ id }) => id), ["queued"]);
  assert.deepEqual(actions.map(({ id, status }) => ({ id, status })), [
    { id: "queued", status: "planned" },
    { id: "completed", status: "resolved" },
    { id: "rejected", status: "rejected" },
  ]);
});


test("fallback only turns concrete chat orders into world events", () => {
  const actions = [
    { id: "free-text", kind: "action", title: "Build a bridge", status: "planned" },
    { id: "no-invitees", kind: "chat", title: "Negotiate", invitees: [], chatStarter: "Terms?" },
    { id: "no-message", kind: "chat", title: "Negotiate", invitees: ["Rival"], chatStarter: "  " },
    { id: "concrete-chat", kind: "chat", title: "Negotiate", invitees: ["Rival"], chatStarter: "Let us discuss terms." },
  ];
  assert.deepEqual(selectFallbackChatActions(actions).map(({ id }) => id), ["concrete-chat"]);
});

test("attempted orders are not replayed as pending orders", () => {
  const actions = [
    { id: "pending", status: "planned" },
    { id: "attempted", status: "attempted" },
    { id: "fulfilled", status: "resolved" },
    { id: "rejected", status: "rejected" },
  ];
  assert.deepEqual(selectPlannedActions(actions).map(({ id }) => id), ["pending"]);
});


test("only an order-specific positive postcondition can resolve an attempted order", () => {
  const actions = [
    { id: "verified", status: "attempted", title: "Open channel" },
    { id: "negative", status: "attempted", title: "Take region" },
    { id: "no-evidence", status: "attempted", title: "Change policy" },
    { id: "still-planned", status: "planned", title: "Wait" },
  ];
  const outcomes = {
    verified: {
      verified: true,
      postcondition: "A new persisted chat contains the requested participants and opening message.",
      source: "persisted-chats",
      observedAt: "round-3-after-write",
    },
    negative: {
      verified: false,
      postcondition: "The region owner did not change.",
      source: "persisted-world",
      observedAt: "round-3-after-write",
    },
    "no-evidence": {
      verified: true,
      postcondition: "Some text was generated.",
      source: "",
      observedAt: "round-3-after-write",
    },
  };

  const next = applyVerifiedActionOutcomes(actions, outcomes);
  assert.equal(next[0].status, "resolved");
  assert.deepEqual(next[0].verification, {
    postcondition: "A new persisted chat contains the requested participants and opening message.",
    source: "persisted-chats",
    observedAt: "round-3-after-write",
  });
  assert.equal(next[1].status, "attempted", "negative evidence is not success");
  assert.equal(next[2].status, "attempted", "incomplete evidence is not success");
  assert.equal(next[3].status, "planned", "the verifier cannot settle orders not attempted");
  assert.equal(actions[0].status, "attempted", "the input history remains immutable");
});

test("verified outcomes require a stable action ID and do not resolve on narration alone", () => {
  const actions = [
    { status: "attempted", title: "Unnamed order" },
    { id: "narrated", status: "attempted", title: "Victory" },
  ];
  const next = applyVerifiedActionOutcomes(actions, {
    narrated: { verified: true, summary: "We succeeded." },
  });
  assert.deepEqual(next, actions);
});


test("persisted chat evidence resolves only a new exact participant-and-message match", () => {
  const actions = [
    { id: "success", kind: "chat", invitees: ["Rival"], chatStarter: "Let us discuss terms." },
    { id: "missing", kind: "chat", invitees: ["Neighbor"], chatStarter: "Meet with us." },
    { id: "ambiguous", kind: "chat", invitees: ["Ally"], chatStarter: "A shared message." },
  ];
  const before = [{ id: "old", countries: [{ name: "Rival" }], messages: [{ text: "An older note." }] }];
  const after = [
    { id: "new", countries: [{ name: "Rival" }], messages: [{ text: "Let us discuss terms." }] },
    { id: "ally-a", countries: [{ name: "Ally" }], messages: [{ text: "A shared message." }] },
    { id: "ally-b", countries: [{ name: "Ally" }], messages: [{ text: "A shared message." }] },
  ];
  const outcomes = verifyPersistedChatOutcomes(actions, before, after, "round-4-post-write");
  assert.deepEqual(Object.keys(outcomes), ["success"]);
  assert.equal(outcomes.success.verified, true);
  assert.equal(outcomes.success.source, "canonical-chat-state-after-write");
});

test("persisted chat verification rejects pre-existing effects and missing snapshots", () => {
  const action = { id: "same", invitees: ["Rival"], chatStarter: "Existing message." };
  const chats = [{ id: "thread", countries: [{ name: "Rival" }], messages: [{ text: "Existing message." }] }];
  assert.deepEqual(verifyPersistedChatOutcomes([action], chats, chats, "round-4"), {});
  assert.deepEqual(verifyPersistedChatOutcomes([action], null, chats, "round-4"), {});
});
