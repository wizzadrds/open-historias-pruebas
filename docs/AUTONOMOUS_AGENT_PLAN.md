# Autonomous player agent: current implementation and roadmap

## Purpose and product idea

Open Historia should be able to play as a situation-aware agent, not merely generate plausible historical prose. The agent should repeatedly observe the persisted campaign, choose a goal and concrete orders, submit those orders through the existing turn engine, inspect what actually changed, and use that evidence to choose its next move.

The intended control loop is:

```text
OBSERVE persisted game + world + prior outcomes
   ↓
DECIDE goals, priorities, and explicit orders
   ↓
EXECUTE through the existing turn/simulation pipeline
   ↓
VERIFY the applied and persisted world changes
   ↓
EVALUATE success, failure, cost, and side effects
   ↓
ADAPT the next decision using the new state
   ↺
```

The loop must be grounded in authoritative game state. A generated event or a successful turn is not, by itself, proof that an order succeeded. The agent should distinguish *planned*, *attempted*, *partially fulfilled*, *fulfilled*, *blocked*, and *failed* outcomes when the engine can establish those facts. It should not invent certainty where the available state cannot support it.

## What is implemented in this branch

### Repository checks and browser smoke coverage

- Added a repository-specific GitHub Actions workflow and quality-gate documentation so this working copy receives tests, builds, lint, and a Chromium browser smoke run.
- Added/expanded `scripts/browser-smoke.mjs`. The journey enters the app, navigates the demo/consent screens, creates a Medium scenario game, checks that the active game ID is stored in IndexedDB, reloads the app, queues a manual order, advances the simulation date, checks date persistence, and records browser errors/screenshots.
- The browser journey is useful UI/persistence coverage, but it is not an end-to-end proof that the order caused a particular world change or that an autonomous agent is operating.
- The latest fully inspected code-validation run before the documentation-only progress updates is [39038420188](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39038420188), on code head `47c5ea6e6e739ea1dc4fe32e73af3e964859c879`. Both `lint` and `verify` passed, including regression tests, desktop/browser builds, Chromium smoke, and Android bundle build. The subsequent commits update project documentation only; a fresh workflow run for the latest documentation commit has not yet been confirmed.

### Order selection and resolution helpers

File: `src/Game/AI/actionResolution.js`

- `selectPlannedActions(actions)` selects entries whose status is `planned`, so resolved/rejected history is not replayed through code paths using this helper.
- The helper is shared with the fallback turn simulator and planned-order counting for event-slot budgeting, keeping those selection rules consistent.
- `resolvePlannedActions(actions, clearActions)` marks planned entries as `attempted` when the turn result says `clearActions`; it does not treat a turn-level signal as proof of individual success.
- The fallback simulator only emits a player-action event for a concrete chat order with named participants and opening text. Other free-text orders remain unverified instead of receiving fabricated consequences.
- `verifyPersistedChatOutcomes` compares the exact pre-write canonical chat snapshot with a post-write canonical read. It requires a newly observed stable thread ID, matching participants and opening text, and a unique match. One persisted thread cannot verify duplicate orders twice.
- The turn persistence path applies the verifier only to the bounded set of fallback chat orders actually eligible for execution. The latest simulation-history entry records per-order `verified`/`unverified` outcomes and reasons; `renderLastTurnReceipt` carries those outcomes into the next decision prompt.
- Focused tests cover positive, missing, pre-existing, ambiguous, duplicate, appended-to-existing-thread, and missing-stable-ID cases, plus evidence normalization and bounded selection.

**Important limitation:** positive postcondition verification is still restricted to newly persisted fallback diplomatic-chat threads. It does not prove territory, military, policy, project, or general free-text order effects, and it is not yet a complete autonomous observe → decide → execute → verify → adapt loop.

### World-impact regression test

File: `src/runtime/gameState.worldImpact.test.js`

- Exercises the real `applyEventImpactsToWorld` function with a supported marker-build operation.
- Asserts that the resulting world includes the marker and that the original input snapshot is not mutated.
- Includes a malformed-operation case to ensure an empty-name marker is not fabricated.
- The code commit `d91f84f` passed [CI run 38962179941](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38962179941) for both `verify` and `lint`. A later commit on the branch has a newer failed Chromium run, so that earlier green run is not the current branch's overall status.

This test proves that a supported event impact can change the returned world snapshot. It does not prove that a player order caused that event, or that the new world state was persisted and reloaded.

### Persistence and turn pipeline inspected

- The UI queues manual free-text orders as `planned`.
- The turn planner includes planned orders in its prompt/template inputs; the fallback path uses the shared planned-order selector.
- The gameplay application stage takes generated/accepted events, applies their world impacts, updates game date/round and ledgers, and writes the resulting game/world/action data through the runtime persistence helpers.
- For the fallback diplomatic-chat path, the implementation captures a canonical pre-write chat snapshot, writes chats, reads canonical chat state again, and uses the comparison to generate order-specific evidence. If the baseline or post-write read is unavailable, the outcome remains unverified.
- The outcome ledger is stored in simulation history and appended to the next-turn receipt, so the next decision can distinguish verified effects from attempted but unverified orders.

These changes improve evidence for one action type; they do not establish causal attribution or reliable postcondition checks for other event/operation types.

## Progress estimate (2026-10-17)

For the autonomous-player objective in this document (not the whole Open Historia game), estimate **35–45% implemented**. This is a planning judgment, not a code-coverage metric.

- Done in the current slice: conservative attempted/resolved lifecycle; evidence-gated promotion helper; post-write verification for newly created diplomatic chat threads; verified/unverified outcome ledger with reasons passed into the next-turn receipt; regression and browser smoke coverage. The last inspected code CI run was green on its exact code SHA, but it predates the latest documentation-only commits.
- Not done: general order-to-event causal identity beyond the narrow fallback-chat path, post-write verification for territory/military/policy/project operations, broad deterministic integration coverage, autonomous goal/order generation, demonstrated adaptation to verified outcomes, and an end-to-end autonomous acceptance scenario.
- Next implementation target: select one supported non-chat operation with a deterministic canonical postcondition; preserve the originating order ID through execution; re-read canonical persisted world state; test positive, negative, ambiguous and reload cases before extending the pattern to other operations.

## What remains to implement

### P0 — Make the existing workflow reliable

1. Diagnose and fix the current Chromium smoke failure without weakening assertions or turning the test into a false positive.
2. Re-run CI on the latest branch head and record the exact SHA and result.
3. Keep the PR open and unmerged until required checks pass.

### P1 — Trace one order from input to observable outcome

1. Give every queued order a stable identity (reuse an existing stable action ID if one is already present).
2. Ensure that identity survives prompt construction and is associated with any resulting event/operation where attribution is possible.
3. Record a structured per-order outcome, with evidence and a reason when an order is blocked or not fulfilled. Do not infer success solely from a generated narrative.
4. Define deterministic behavior for ambiguous cases: no event, invalid operation, conflicting orders, partial progress, and a valid event that does not produce the requested effect.
5. Add integration tests for the actual turn-application seam, rather than testing only isolated helpers.

### P2 — Verify persisted state

1. After applying a turn, read the canonical persisted world and action ledgers back through the runtime persistence API.
2. Compare the observed state to the pre-turn snapshot and the expected postconditions for each supported order type.
3. Store the verified outcome and evidence with the order/history.
4. Test reload/restart behavior so the verified result survives a new read, not merely an in-memory object update.

### P3 — Implement the autonomous decision loop

1. Build an observation object from canonical game date/round, player nation, world state, relevant events, available resources, queued orders, objectives, and recent verified outcomes.
2. Have the agent produce a structured decision: objective, rationale, proposed orders, expected effects, and success conditions. Validate output with the existing structured-output/provider infrastructure.
3. Route orders through the existing queue and turn engine rather than creating a parallel simulation path.
4. After the turn, compare verified state with expected effects; classify success, partial success, failure, or uncertainty.
5. Feed those results into the next observation and revise priorities. Add guardrails against repeated failed orders, impossible actions, unbounded loops, and excessive provider calls.
6. Make autonomy opt-in/configurable initially, with a clear audit trail and a way to inspect or cancel proposed orders.

### P4 — Acceptance tests for actual autonomous play

A minimum deterministic scenario should prove all of the following:

- Given a known initial world and objective, the agent observes the correct state and proposes a valid order.
- The order is queued with a stable ID and appears in the turn input.
- A controlled simulation result applies the intended world operation.
- The canonical persisted world changes as expected and the change survives reload.
- The action record references the evidence for its outcome.
- On the next cycle, the agent observes the changed state and chooses a meaningfully different or appropriately continued action.
- Failure/blocked cases do not get labelled successful, and retries are bounded.

Then add a browser-level journey for the user-visible autonomous mode. Mocked/deterministic tests should establish causal correctness; browser smoke tests should establish UI and persistence integration.

## Current status at a glance

| Capability | Status |
| --- | --- |
| Create a game and persist its active ID | Covered by browser smoke journey |
| Queue a manual order as planned | Existing UI behavior; smoke journey exercises queueing |
| Advance date and verify it survives reload | Covered by browser smoke journey, subject to current Chromium workflow failure |
| Select only planned orders in shared helper paths | Implemented and unit-tested |
| Avoid treating queue-clearing as proof of success | Implemented and unit-tested (`attempted`, not `resolved`) |
| Apply a supported event operation to returned world state | Implemented and regression-tested |
| Prove a specific order caused the world effect | Implemented narrowly for eligible fallback diplomatic-chat orders; not general |
| Verify each order against canonical persisted postconditions | Implemented only for newly persisted diplomatic-chat threads |
| Record evidence-backed per-order outcomes | Implemented as a verified/unverified ledger with reasons in simulation history and the next-turn receipt |
| Autonomous observe → decide → execute → verify → adapt loop | Not implemented end-to-end |
| Full end-to-end autonomous gameplay acceptance test | Not implemented |

## Engineering principles

- Reuse the existing game state, event application, provider, and persistence pipelines.
- Separate narration from state mutation: text that says an action succeeded is not evidence that it did.
- Prefer deterministic unit/integration tests for causal behavior and browser tests for UI/persistence.
- Record uncertainty honestly; do not convert missing evidence into success.
- Do not weaken quality gates to make a run green.
- Keep PR #1 open and unmerged unless explicitly authorized otherwise.
