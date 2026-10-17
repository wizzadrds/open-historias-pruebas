/*! Open Historia — world impact regression tests © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
import test from "node:test";
import assert from "node:assert/strict";

import { applyEventImpactsToWorld, normalizeActionEntry, normalizeWorldState } from "./gameState.js";

test("action normalization preserves complete verification evidence and drops incomplete claims", () => {
  const verified = normalizeActionEntry({
    id: "verified-action",
    title: "Open a diplomatic channel",
    status: "resolved",
    verification: {
      postcondition: "A new persisted thread contains the requested opening message.",
      source: "canonical-chat-state-after-write",
      observedAt: "round-4-post-write",
      ignoredExtra: "not part of the evidence contract",
    },
  });
  assert.equal(verified.status, "resolved");
  assert.deepEqual(verified.verification, {
    postcondition: "A new persisted thread contains the requested opening message.",
    source: "canonical-chat-state-after-write",
    observedAt: "round-4-post-write",
  });

  const incomplete = normalizeActionEntry({
    id: "incomplete-action",
    title: "Change policy",
    status: "attempted",
    verification: { postcondition: "Narration says it happened." },
  });
  assert.equal(incomplete.status, "attempted");
  assert.equal("verification" in incomplete, false);
});

test("an applied event adds a marker to the returned world state without mutating the input snapshot", () => {
  const before = { markers: [] };
  const event = {
    id: "event-marker-build-test",
    title: "A bridge is built",
    date: "1936-04-01",
    description: "A new bridge is built.",
    impacts: {
      markerOps: [{
        op: "build",
        marker: { name: "Test Bridge", type: "infrastructure", lat: 40.4, lng: -3.7 },
      }],
    },
  };

  const result = applyEventImpactsToWorld({ events: [event], world: before });

  assert.ok(result.world.markers.some((marker) => marker.name === "Test Bridge"));
  assert.deepEqual(before.markers, [], "applying an event must not mutate the input snapshot");
});

test("a malformed marker operation does not fabricate a world-state change", () => {
  const result = applyEventImpactsToWorld({
    events: [{
      id: "event-marker-invalid-test",
      title: "Invalid marker",
      date: "1936-04-01",
      description: "A malformed marker operation.",
      impacts: { markerOps: [{ op: "build", marker: { name: "" } }] },
    }],
    world: { markers: [] },
  });

  assert.equal(result.world.markers.some((marker) => marker.name === ""), false);
});


test("simulation history keeps only bounded, complete action outcome evidence", () => {
  const world = normalizeWorldState({
    simulationHistory: [{
      mode: "jump",
      actionOutcomes: [
        {
          id: "verified-order",
          title: "Open a diplomatic channel",
          status: "verified",
          verification: {
            postcondition: "A new persisted thread contains the requested opening message.",
            source: "canonical-chat-state-after-write",
            observedAt: "round-4-post-write",
          },
        },
        { id: "unverified-order", title: "Change policy", status: "unverified", reason: "No fallback postcondition verifier ran for this order." },
        {
          id: "false-verified-order", status: "verified",
          verification: { postcondition: "It happened." },
        },
        { title: "Missing stable ID", status: "verified", verification: {
          postcondition: "A state changed.", source: "world", observedAt: "round-4",
        } },
        { id: "unknown-status", status: "resolved" },
        null,
      ],
    }],
  });

  assert.deepEqual(world.simulationHistory[0].actionOutcomes, [
    {
      id: "verified-order",
      title: "Open a diplomatic channel",
      status: "verified",
      verification: {
        postcondition: "A new persisted thread contains the requested opening message.",
        source: "canonical-chat-state-after-write",
        observedAt: "round-4-post-write",
      },
    },
    { id: "unverified-order", title: "Change policy", status: "unverified", reason: "No fallback postcondition verifier ran for this order." },
    { id: "false-verified-order", status: "unverified" },
  ]);
});

test("simulation history bounds the number of persisted action outcomes", () => {
  const outcomes = Array.from({ length: 100 }, (_, index) => ({
    id: `order-${index}`, status: "unverified",
  }));
  const world = normalizeWorldState({ simulationHistory: [{ actionOutcomes: outcomes }] });
  assert.equal(world.simulationHistory[0].actionOutcomes.length, 80);
  assert.equal(world.simulationHistory[0].actionOutcomes.at(-1).id, "order-79");
});

test("normalizeActionEntry preserves only a well-formed region-owner expected effect", () => {
  const valid = normalizeActionEntry({
    id: "order-region-transfer",
    title: "Transfer region",
    status: "planned",
    expectedEffect: {
      type: "region-owner",
      regionId: "region-7",
      owner: "New Republic",
      ignoredField: "not persisted",
    },
  });
  assert.deepEqual(valid.expectedEffect, {
    type: "region-owner",
    regionId: "region-7",
    owner: "New Republic",
  });

  const malformed = normalizeActionEntry({
    id: "order-malformed",
    title: "Malformed transfer",
    expectedEffect: { type: "region-owner", regionId: "", owner: "New Republic" },
  });
  assert.equal("expectedEffect" in malformed, false);
});
