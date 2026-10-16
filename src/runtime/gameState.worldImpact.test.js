/*! Open Historia — world impact regression tests © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
import test from "node:test";
import assert from "node:assert/strict";

import { applyEventImpactsToWorld } from "./gameState.js";

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
