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
- The latest exact-head validation is [39062310696](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39062310696), on commit `c09b6b8fbe3d63dcb59af967e599a295efd49f34`. Both `lint` and `verify` passed, including regression tests, desktop/browser builds, Chromium smoke, and Android bundle build. This commit only updates project documentation; it does not advance autonomous-agent functionality.

### Order selection and resolution helpers

File: `src/Game/AI/actionResolution.js`

- `selectPlannedActions(actions)` selects entries whose status is `planned`, so resolved/rejected history is not replayed through code paths using this helper.
- The helper is shared with the fallback turn simulator and planned-order counting for event-slot budgeting, keeping those selection rules consistent.
- `resolvePlannedActions(actions, clearActions)` marks planned entries as `attempted` when the turn result says `clearActions`; it does not treat a turn-level signal as proof of individual success.
- The fallback simulator only emits a player-action event for a concrete chat order with named participants and opening text. Other free-text orders remain unverified instead of receiving fabricated consequences.
- `verifyPersistedChatOutcomes` compares the exact pre-write canonical chat snapshot with a post-write canonical read. It requires a newly observed stable thread ID, matching participants and opening text, and a unique match. One persisted thread cannot verify duplicate orders twice.
- The turn persistence path verifies the bounded set of fallback chat orders eligible for execution by comparing canonical chat state before and after the write. It also verifies a narrow territorial order when an originating action is linked through `event.actionIds` and the canonical region-owner override changes to the expected owner. An explicit `expectedEffect: { type: "region-owner", regionId, owner }` takes precedence; otherwise one unambiguous linked `regionTransfers` operation may supply the expectation.
- The latest simulation-history entry records per-order `verified`/`unverified` outcomes and reasons; `renderLastTurnReceipt` carries those outcomes into the next decision prompt. Regression tests cover causal-link requirements, no-op/wrong owner changes, ambiguous transfers, canonical snapshot absence, chat verification edge cases, normalization/reload, and feedback rendering.

**Important limitation:** positive postcondition verification remains narrow: newly persisted fallback diplomatic-chat threads and region-owner changes only. It does not yet verify military movement, policy, project, or general free-text order effects, and it is not yet a complete autonomous observe → decide → execute → verify → adapt loop.

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

For the autonomous-player objective in this document (not the whole Open Historia game), estimate **55% implemented**. This is a planning judgment, not a code-coverage metric.

- Done in the current slice: conservative attempted/resolved lifecycle; evidence-gated promotion helper; post-write verification for newly created diplomatic chat threads and a narrow region-owner change; verified/unverified outcome ledger with reasons; outcome receipt fed into the next jump's prompt; deterministic regression coverage; browser E2E for game creation, order queueing, turn advancement, and date persistence across reload. Workflow run [39045607176](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39045607176) passed all configured checks on exact code head `7181b3168bfa776998fe89a43ad84d491ed761ea`. A later documentation-only commit is awaiting its own CI result.
- Not done: causal identity for general orders, verification for military/policy/project operations, evaluation of partial success/cost/side effects, autonomous goal/order generation, opt-in orchestration and guardrails, and an end-to-end autonomous acceptance scenario where the next order changes based on a controlled previous outcome.
- Next implementation target: build a deterministic observation/decision adapter that consumes the persisted outcome receipt and chooses/validates a next action in a testable way, without bypassing the existing queue or turn engine.

## What remains to implement

### P0 — Make the existing workflow reliable

1. **Complete:** diagnose and fix the animated-control Chromium smoke failure using direct dispatch only after visibility checks and follow-up state assertions.
2. **Complete for code head `7181b316`:** regression tests, desktop/browser builds, Chromium smoke, Android bundle, and lint all passed in workflow run [39045607176](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39045607176). Re-check CI for later commits before claiming the branch head is green.
3. Keep the PR open and unmerged until code review and acceptance criteria are complete.

### P1 — Trace one order from input to observable outcome

**Status: partial.** Stable action IDs, attempted lifecycle, narrow chat/territorial verification, and ambiguous/no-effect cases are covered; broad action-to-event attribution remains incomplete.

1. Give every queued order a stable identity (reuse an existing stable action ID if one is already present).
2. Ensure that identity survives prompt construction and is associated with any resulting event/operation where attribution is possible.
3. Record a structured per-order outcome, with evidence and a reason when an order is blocked or not fulfilled. Do not infer success solely from a generated narrative.
4. Define deterministic behavior for ambiguous cases: no event, invalid operation, conflicting orders, partial progress, and a valid event that does not produce the requested effect.
5. Add integration tests for the actual turn-application seam, rather than testing only isolated helpers.

### P2 — Verify persisted state

**Status: partial.** Canonical read-back and reload-safe ledger persistence exist for the supported chat and region-owner cases; the rest of the operation types remain unverified.

1. After applying a turn, read the canonical persisted world and action ledgers back through the runtime persistence API.
2. Compare the observed state to the pre-turn snapshot and the expected postconditions for each supported order type.
3. Store the verified outcome and evidence with the order/history.
4. Test reload/restart behavior so the verified result survives a new read, not merely an in-memory object update.

### Integration seam confirmed — 2026-10-18

The existing time-skip pipeline persists per-order outcomes in `simulationHistory[0].actionOutcomes`, and `renderLastTurnReceipt(normalizeWorldState(bundle.world).simulationHistory)` adds the latest receipt to each generated segment's user message. This is feedback to the text generator, not a deterministic decision adapter: there is no separately testable function that turns canonical observation + prior outcomes into a structured next action, and the current tests do not prove that the chosen action changes when the evidence changes.

The next implementation must add that seam in the existing AI/turn pipeline, not a parallel simulator. Its first deterministic contract should accept a bounded observation and outcome ledger, reject malformed/missing evidence as uncertainty, and return a validated structured proposal that can still be routed through the existing action queue. Add tests showing verified, unverified, and missing outcomes lead to distinct policy outputs, without asserting that a prompt contains a phrase is equivalent to adaptation. Only mark the milestone complete once this seam is wired to the actual decision path and the full regression workflow passes.

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
| Advance date and verify it survives reload | Covered by the latest passing browser smoke run; a previous intermittent Chromium timeout remains a reliability risk |
| Select only planned orders in shared helper paths | Implemented and unit-tested |
| Avoid treating queue-clearing as proof of success | Implemented and unit-tested (`attempted`, not `resolved`) |
| Apply a supported event operation to returned world state | Implemented and regression-tested |
| Prove a specific order caused the world effect | Implemented narrowly for eligible fallback diplomatic-chat orders and linked region-owner transfers; not general |
| Verify each order against canonical persisted postconditions | Implemented for newly persisted diplomatic-chat threads and one region-owner postcondition; military/policy/project/general orders remain unsupported |
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
