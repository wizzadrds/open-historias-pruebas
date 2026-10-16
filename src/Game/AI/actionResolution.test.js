/*! Open Historia — action resolution tests © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
import test from "node:test";
import assert from "node:assert/strict";
import { resolvePlannedActions, selectPlannedActions } from "./actionResolution.js";

test("a turn that clears actions resolves planned orders but preserves history", () => {
  const actions = [
    { id: "a", text: "Build a bridge", status: "planned" },
    { id: "b", text: "Old order", status: "resolved" },
    { id: "c", text: "Another planned order", status: "planned" },
  ];
  const resolved = resolvePlannedActions(actions, true);
  assert.deepEqual(resolved.map(({ id, status }) => ({ id, status })), [
    { id: "a", status: "resolved" },
    { id: "b", status: "resolved" },
    { id: "c", status: "resolved" },
  ]);
  assert.deepEqual(actions.map((action) => action.status), ["planned", "resolved", "planned"], "input ledger is not mutated");
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
