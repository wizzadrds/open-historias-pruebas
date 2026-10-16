/*! Open Historia — world impact regression tests © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
import test from "node:test";
import assert from "node:assert/strict";

import { applyEventImpactsToWorld } from "./gameState.js";

test("an applied event persists a city population impact in the returned world state", () => {
  const before = {
    cityPopulations: {},
    markers: [],
  };
  const event = {
    id: "event-city-population-test",
    title: "A city grows",
    date: "1936-04-01",
    description: "The city population increases.",
    impacts: {
      markerOps: [{ op: "population", name: "Test City", population: 1234 }],
    },
  };

  const result = applyEventImpactsToWorld({ events: [event], world: before });

  assert.equal(result.world.cityPopulations["test city"], 1234);
  assert.deepEqual(before.cityPopulations, {}, "applying an event must not mutate the input snapshot");
});

test("a malformed population impact does not fabricate a world-state change", () => {
  const result = applyEventImpactsToWorld({
    events: [{
      id: "event-city-population-invalid",
      title: "Invalid population",
      date: "1936-04-01",
      description: "A malformed population impact.",
      impacts: { markerOps: [{ op: "population", name: "Test City", population: -10 }] },
    }],
    world: { cityPopulations: {}, markers: [] },
  });

  assert.equal(result.world.cityPopulations["test city"], undefined);
});
