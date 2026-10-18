/*! Open Historia — autonomous decision adapter tests © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
import test from "node:test";
import assert from "node:assert/strict";
import { buildAutonomousObservation, chooseDeterministicAction } from "./autonomousDecision.js";

test("observation reflects canonical game state and only planned orders", () => {
  const observation = buildAutonomousObservation({
    gameState: { gameDate: "1200-01-01", country: "Crown", round: 4 },
    worldState: {
      resources: { gold: 12 },
      events: [{ id: "e1", title: "Treaty signed" }],
      playerGoals: [{ id: "g1", text: "Secure peace", status: "active" }],
      actions: [{ id: "a1", title: "Open talks", status: "planned" }, { id: "a2", title: "Old order", status: "attempted" }],
    },
  });
  assert.equal(observation.game.date, "1200-01-01");
  assert.equal(observation.game.player, "Crown");
  assert.deepEqual(observation.world.resources, { gold: 12 });
  assert.deepEqual(observation.pendingActions.map(({ id }) => id), ["a1"]);
});

test("unverified outcomes remain uncertain and never count as success", () => {
  const observation = buildAutonomousObservation({
    actionOutcomes: [{ actionId: "a1", title: "Build road", status: "unverified", reason: "No persisted effect found" }],
  });
  assert.equal(observation.priorOutcomes[0].status, "uncertain");
  assert.equal(observation.priorOutcomes[0].postcondition, "");
});

test("blocked candidate is skipped in favor of a different valid action", () => {
  const observation = buildAutonomousObservation({
    actionOutcomes: [{ actionId: "old", title: "Negotiate", status: "blocked", reason: "No access" }],
  });
  assert.deepEqual(chooseDeterministicAction(observation, [
    { id: "retry", title: "Negotiate", valid: true },
    { id: "alternate", title: "Secure trade route", valid: true, expectedEffect: "trade route secured" },
  ]), { id: "alternate", title: "Secure trade route", expectedEffect: "trade route secured" });
});

test("already verified or already pending actions are not repeated", () => {
  const observation = buildAutonomousObservation({
    worldState: { actions: [{ id: "pending", title: "Pending", status: "planned" }] },
    actionOutcomes: [{ actionId: "done", title: "Done", status: "verified", verification: { postcondition: "State changed" } }],
  });
  assert.equal(chooseDeterministicAction(observation, [
    { id: "done", title: "Done", valid: true },
    { id: "pending", title: "Pending", valid: true },
  ]), null);
});

test("missing evidence does not unlock evidence-gated candidates", () => {
  const observation = buildAutonomousObservation({ actionOutcomes: [{ actionId: "x", status: "unverified" }] });
  assert.equal(chooseDeterministicAction(observation, [
    { id: "next", title: "Follow up", valid: true, requiresVerifiedEvidence: true },
  ]), null);
  assert.equal(chooseDeterministicAction(observation, [{ id: "invalid", title: "Bad", valid: false }]), null);
});
