/*! Open Historia — action resolution tests © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
import test from "node:test";
import assert from "node:assert/strict";
import { applyVerifiedActionOutcomes, resolvePlannedActions, selectFallbackChatActions, selectPlannedActions, verifyPersistedChatOutcomes, verifyPersistedWorldOutcomes } from "./actionResolution.js";
import { normalizeActionEntry, normalizeWorldState } from "../../runtime/gameState.js";

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
  const many = Array.from({ length: 5 }, (_, index) => ({
    id: `chat-${index}`, kind: "chat", invitees: ["Rival"], chatStarter: `Message ${index}`,
  }));
  assert.deepEqual(selectFallbackChatActions(many, 3).map(({ id }) => id), ["chat-0", "chat-1", "chat-2"]);
  assert.deepEqual(selectFallbackChatActions(many, 0), []);
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

test("one persisted chat cannot verify duplicate orders twice", () => {
  const actions = [
    { id: "first", invitees: ["Rival"], chatStarter: "Let us discuss terms." },
    { id: "duplicate", invitees: ["Rival"], chatStarter: "Let us discuss terms." },
  ];
  const before = [];
  const after = [{ id: "new", countries: [{ name: "Rival" }], messages: [{ text: "Let us discuss terms." }] }];
  const outcomes = verifyPersistedChatOutcomes(actions, before, after, "round-5-post-write");
  assert.deepEqual(Object.keys(outcomes), ["first"]);
});


test("a message added to an existing thread cannot prove creation of a new chat order", () => {
  const action = { id: "append-only", invitees: ["Rival"], chatStarter: "A new opening message." };
  const before = [{
    id: "existing-thread",
    countries: [{ name: "Rival" }],
    messages: [{ text: "An earlier message." }],
  }];
  const after = [{
    id: "existing-thread",
    countries: [{ name: "Rival" }],
    messages: [{ text: "An earlier message." }, { text: "A new opening message." }],
  }];

  assert.deepEqual(
    verifyPersistedChatOutcomes([action], before, after, "round-6-post-write"),
    {},
    "the verifier must not confuse a changed existing thread with a newly created thread",
  );
});

test("persisted chat verification requires a stable ID on the newly observed thread", () => {
  const action = { id: "missing-thread-id", invitees: ["Rival"], chatStarter: "A concrete message." };
  const before = [];
  const after = [{ countries: ["Rival"], messages: [{ text: "A concrete message." }] }];

  assert.deepEqual(verifyPersistedChatOutcomes([action], before, after, "round-6-post-write"), {});
});

test("persisted world verification requires a real region-owner change in canonical snapshots", () => {
  const actions = [
    { id: "take-region", status: "attempted", expectedEffect: { type: "region-owner", regionId: "r-1", owner: "New Republic" } },
    { id: "already-owned", status: "attempted", expectedEffect: { type: "region-owner", regionId: "r-2", owner: "New Republic" } },
    { id: "wrong-owner", status: "attempted", expectedEffect: { type: "region-owner", regionId: "r-3", owner: "New Republic" } },
    { id: "not-attempted", status: "planned", expectedEffect: { type: "region-owner", regionId: "r-4", owner: "New Republic" } },
    { id: "narration-only", status: "attempted", summary: "We took the region." },
  ];
  const before = { regionOwnershipOverrides: { "r-1": "Old Union", "r-2": "New Republic", "r-3": "Old Union", "r-4": "Old Union" } };
  const after = { regionOwnershipOverrides: { "r-1": "New Republic", "r-2": "New Republic", "r-3": "Other State", "r-4": "New Republic" } };

  assert.deepEqual(
    verifyPersistedWorldOutcomes(actions, before, after, "round-8-post-write"),
    {},
    "a matching world diff without explicit event-to-order linkage is insufficient",
  );
  assert.deepEqual(verifyPersistedWorldOutcomes(actions, before, after, "round-8-post-write", [
    { actionIds: ["take-region"] },
  ]), {
    "take-region": {
      verified: true,
      postcondition: "Persisted region r-1 changed owner to New Republic.",
      source: "canonical-world-state-after-write",
      observedAt: "round-8-post-write",
    },
  });
});

test("persisted world verification rejects missing snapshots, malformed effects, and unchanged owners", () => {
  const actions = [
    { id: "unchanged", status: "attempted", expectedEffect: { type: "region-owner", regionId: "r-1", owner: "New Republic" } },
    { id: "missing-region", status: "attempted", expectedEffect: { type: "region-owner", regionId: "r-2", owner: "New Republic" } },
    { id: "malformed", status: "attempted", expectedEffect: { type: "region-owner", regionId: "", owner: "New Republic" } },
  ];
  const before = { regionOwnershipOverrides: { "r-1": "New Republic" } };
  const after = { regionOwnershipOverrides: { "r-1": "New Republic" } };
  assert.deepEqual(verifyPersistedWorldOutcomes(actions, before, after, "round-8-post-write"), {});
  assert.deepEqual(verifyPersistedWorldOutcomes(actions, null, after, "round-8-post-write"), {});
  assert.deepEqual(verifyPersistedWorldOutcomes(actions, before, { regionOwnershipOverrides: [] }, "round-8-post-write"), {});
});

test("persisted world verification derives a single region transfer from its linked event", () => {
  const actions = [
    { id: "linked-transfer", status: "attempted", title: "Resolve border dispute" },
    { id: "unlinked-transfer", status: "attempted", title: "Narrated transfer" },
    { id: "ambiguous-transfer", status: "attempted", title: "Several transfers" },
  ];
  const before = { regionOwnershipOverrides: { "r-10": "Old Union", "r-11": "Old Union", "r-12": "Old Union" } };
  const after = { regionOwnershipOverrides: { "r-10": "New Republic", "r-11": "New Republic", "r-12": "New Republic" } };
  const events = [
    { actionIds: ["linked-transfer"], regionTransfers: [{ regionId: "r-10", toCode: "New Republic" }] },
    { actionIds: ["someone-else"], regionTransfers: [{ regionId: "r-11", toCode: "New Republic" }] },
    { actionIds: ["ambiguous-transfer"], regionTransfers: [
      { regionId: "r-12", toCode: "New Republic" },
      { regionId: "r-13", toCode: "New Republic" },
    ] },
  ];

  const outcomes = verifyPersistedWorldOutcomes(actions, before, after, "round-9-post-write", events);
  assert.deepEqual(Object.keys(outcomes), ["linked-transfer"]);
  assert.equal(outcomes["linked-transfer"].verified, true);
});


test("an order resolves only after a linked event and canonical world write survive normalization", () => {
  const queued = normalizeActionEntry({
    id: "integration-transfer-1",
    title: "Transfer the border region",
    status: "planned",
    expectedEffect: { type: "region-owner", regionId: "integration-region", owner: "New Republic" },
  });
  const attempted = resolvePlannedActions([queued], true);
  const event = {
    id: "integration-event-1",
    actionIds: ["integration-transfer-1"],
    regionTransfers: [{ regionId: "integration-region", toCode: "New Republic" }],
  };

  const before = normalizeWorldState({
    regionOwnershipOverrides: { "integration-region": "Old Union" },
    simulationHistory: [],
  });
  const after = normalizeWorldState({
    ...before,
    regionOwnershipOverrides: { "integration-region": "New Republic" },
  });
  const outcomes = verifyPersistedWorldOutcomes(
    attempted,
    before,
    after,
    "integration-round-post-write",
    [event],
  );
  const resolved = applyVerifiedActionOutcomes(attempted, outcomes).map(normalizeActionEntry);

  assert.equal(resolved[0].status, "resolved");
  assert.deepEqual(resolved[0].verification, {
    postcondition: "Persisted region integration-region changed owner to New Republic.",
    source: "canonical-world-state-after-write",
    observedAt: "integration-round-post-write",
  });

  const persisted = normalizeWorldState({
    ...after,
    simulationHistory: [{
      mode: "jump",
      actionOutcomes: resolved.map((action) => ({
        id: action.id,
        title: action.title,
        status: action.status === "resolved" ? "verified" : "unverified",
        ...(action.verification ? { verification: action.verification } : {}),
      })),
    }],
  });
  const reloaded = normalizeWorldState(persisted);
  assert.deepEqual(reloaded.simulationHistory[0].actionOutcomes, [{
    id: "integration-transfer-1",
    title: "Transfer the border region",
    status: "verified",
    verification: {
      postcondition: "Persisted region integration-region changed owner to New Republic.",
      source: "canonical-world-state-after-write",
      observedAt: "integration-round-post-write",
    },
  }]);
});
