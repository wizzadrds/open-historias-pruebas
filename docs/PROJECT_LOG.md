## 2026-10-17 — Remove invented fallback consequences for free-text orders

- In `src/Game/AI/gameplay.js`, fallback turns no longer turn arbitrary free-text order titles into events claiming immediate administrative or political consequences. The fallback only creates an action event for a chat order with named participants and a non-empty opening message, an effect the engine can actually persist.
- For other queued orders, the fallback timeline now explicitly says it could not verify a world-state effect and that the orders remain attempted, not fulfilled. The action ledger is the record of attempted orders; the map and persisted records remain authoritative for consequences.
- Added `selectFallbackChatActions` in `src/Game/AI/actionResolution.js` and regression tests for concrete chat eligibility and for ensuring `attempted` orders cannot be replayed as `planned`.
- Verification at authoring time: source changes committed below; CI has not yet run to completion. Do not treat this as fully validated until the exact-head workflow passes.
- Next: implement per-order causal links and postcondition checks against the persisted world; the fallback change removes a false claim but does not itself fulfill arbitrary orders. PR #1 remains open and unmerged.

---

## 2026-10-17 — Stop treating turn completion as proof an order succeeded

- Updated `src/Game/AI/actionResolution.js`: when the turn-level `clearActions` flag closes the pending queue, individual planned orders now become `attempted`, not `resolved`. The flag proves only that the turn processed/cleared the queue; it does not prove the requested effect occurred.
- Updated `src/Game/AI/actionResolution.test.js` to assert the safer lifecycle and preserve the original ledger. Existing terminal statuses remain unchanged.
- This is a deliberate truthfulness improvement, not the complete outcome-verification feature: per-order causal attribution, expected-postcondition checks against canonical persisted world state, and next-decision adaptation are still not implemented. Existing UI displays the status value directly, so `attempted` is visible without claiming success.
- Verification at authoring time: inspected current branch head `04bb24ae7d79c261d81d0c65046d02ed566d0354`; the latest workflow run `39026900099` had lint passed while `verify` was still running (Chromium had not started). The new code/test patch has not yet been run locally or in CI.
- Next: add structured per-order outcome evidence at the turn-application seam, then read persisted state back and make the next decision consume verified outcomes. PR #1 remains open and unmerged.

---

## 2026-10-17 — Document autonomous-agent design and remaining work

- Added [`docs/AUTONOMOUS_AGENT_PLAN.md`](./AUTONOMOUS_AGENT_PLAN.md), a durable explanation of the intended observe → decide → execute → verify → adapt loop, current code/tests, evidence limits, prioritized implementation roadmap, and acceptance criteria.
- The document records the latest observed workflow run [39026240957](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39026240957): lint passed, but Chromium browser smoke failed. The branch is not fully green.
- Key distinction: shared planned-order selection and event-impact tests are real incremental work; per-order causal attribution, persisted postcondition verification, and autonomous feedback/adaptation remain unimplemented.
- This is documentation only; it does not implement autonomous gameplay. PR #1 remains open and unmerged.

---

## 2026-10-17 — Keep planned-order counting consistent

- The turn planner now uses the shared `selectPlannedActions()` helper when counting queued orders for event-slot budgeting, matching the fallback simulator's selection rule. This avoids two separate definitions of which ledger entries count as pending.
- Code change: [commit 47110de](https://github.com/wizzadrds/open-historias-pruebas/commit/47110de67a940bfc44a657aad0a7cd136f324aa1).
- This is a consistency refactor, not proof that an order succeeds. Individual action-to-event attribution, persisted effect verification, and an observe → decide → act → verify → adapt loop remain open work.

---

## 2026-10-16 — Share and test queued-order selection

- Extracted `selectPlannedActions` into `src/Game/AI/actionResolution.js` and used it in the fallback turn simulator, so only actions still marked `planned` are eligible to produce fallback events. Added a focused test that resolved and rejected history is excluded and the original ledger is unchanged.
- Commits: [cee8237](https://github.com/wizzadrds/open-historias-pruebas/commit/cee82373c3bd329e9ee7781e65bdfcaa16a97372), [9b1f101](https://github.com/wizzadrds/open-historias-pruebas/commit/9b1f101a2df16f8921f72c64195ae0ef4c4739e4), [176fc2b](https://github.com/wizzadrds/open-historias-pruebas/commit/176fc2b7691274b5d98d8be582c59ec60be785d0).
- This tightens one actual execution path, but the fallback still narrates a generic consequence from an order title and does not prove the order's intended world effect. Action resolution is still governed by `clearActions`, not per-order outcome verification. Await exact-head CI before calling this change validated.
- Next: inspect the new CI run, then trace whether the generated event is tied to the originating action and whether the resulting world state is persisted and read back.

---

## 2026-10-16 — Verify a real world-state impact

- Replaced the unsupported population-operation test with tests for the marker build operation that the runtime actually accepts. The regression test exercises `applyEventImpactsToWorld`, asserts the marker appears in the returned world, and checks the original snapshot is not mutated; a malformed build must not create an empty-name marker.
- Change: [commit d91f84f](https://github.com/wizzadrds/open-historias-pruebas/commit/d91f84f21948c9a2211348ec28ec01f9b1f9e95c). Exact-head [CI run 38962179941](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38962179941) passed both `verify` and `lint`.
- This verifies an event's supported marker operation can change the returned world-state snapshot. It still does **not** prove a particular queued player order causes that event, that the resulting world is persisted and reloaded correctly, or that an autonomous agent observes the outcome and adapts its next decision.
- Next: connect the queued-order identity to turn input and applied outcomes, and add a regression test at that integration seam. Keep PR #1 open and unmerged.

---

## 2026-10-16 — Isolate and test planned-action resolution

- The diagnostic browser-smoke change was validated by [CI run #66 / 38951926171](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38951926171): both `verify` and `lint` passed on commit `b64dafda0d046ccab512f39a03a15d3a9b2601e8`. This confirms the longer date-change wait did not break the smoke journey, but it does not yet validate the newest action-resolution changes.
- Added `src/Game/AI/actionResolution.js` and `actionResolution.test.js` to isolate the exact rule that a planned order becomes resolved only when `clearActions` is true; wired the helper into `src/Game/AI/gameplay.js`.
- Focused tests cover both branches (clear actions and retain planned actions), and ensure the input ledger is not mutated.
- The latest branch head when this entry was revisited is `8c566e52f1bbefe7baf3e16672d6a344b4dc7308`; [CI run 38958330569](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38958330569) completed successfully. This validates the committed helper/tests under the repository's configured checks, not autonomous in-world outcomes.
- Persistence inspection confirms `readActionsState()` reads and normalizes the actions JSON endpoint, while `writeActionsState()` normalizes and writes it (`src/runtime/gameState.js`). The Actions UI queues manual orders as `planned`; gameplay calls `resolvePlannedActions(...)` based on the simulation result's `clearActions` flag. This still does not prove that a specific order was included in the model input, enacted through world-state operations, and verified against persisted world state. Next: trace the turn payload from prompt construction through operation application, then add a focused regression test for an observable world-state effect. The autonomous observe → choose → execute → verify loop is not complete.

---

## 2026-10-16 — Diagnose browser smoke turn timeout

- The CI run [#64 / 38950734661](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38950734661) failed in the browser smoke test at the assertion waiting for the in-game date to change; regression tests, both builds, and lint passed.
- Changed `scripts/browser-smoke.mjs` to wait up to 120 seconds for the date transition and include the observed date/timeline text in the error if it times out. This makes the next failure actionable rather than only reporting a generic 30-second timeout; it does not by itself prove the simulation issue is fixed.
- New commit: `e1ad66ffe36b883d20211e57bc7aa8e6bd88bfe7`. Await CI before treating this test change as verified.
- Next: use the new diagnostic if the turn still stalls, then add a deterministic test of planned → resolved action state. The smoke test still does not prove the queued free-text order caused a world effect or that an autonomous observe/decide/verify agent exists.

---

## 2026-10-16 — Browser smoke advances and persists a simulation day

- **Branch/head at entry:** `agent/engineering-quality-gates`, commit `8945fb7e5eda5dc09af8236a34be1bbe81cbcffc`.
- **Changed file:** `scripts/browser-smoke.mjs`; removed one duplicate final uncaught-page-error assertion. No gameplay implementation was changed by that cleanup.
- **Latest exact-head CI:** [run #63 / 38949391717](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38949391717) completed successfully for both `verify` and `lint`.
- **Current browser-smoke journey:** enters the web app, creates a Medium scenario game, verifies active-game ID persistence after reload, queues a manual free-text order, advances one simulation day, asserts the displayed date changes and survives another reload, and checks for uncaught page errors.
- **Important limitation:** the free-text order is only verified as queued. The test does not yet read the persisted actions ledger to prove the order transitioned from `planned` to `resolved`, nor does it establish a deterministic world effect from that order. Do not describe this as proof of autonomous play.
- **Architecture finding:** in `src/Game/AI/gameplay.js`, planned actions are marked `resolved` only when the simulation result sets `clearActions`. This is a candidate seam for a focused deterministic regression test, but the browser test should not assume every arbitrary text order causes a particular world change.
- **Next actions:** (1) trace runtime actions read/write functions and the web IndexedDB persistence contract; (2) add a deterministic test for action status resolution around the turn-application seam using a controlled result; (3) separately design an observe → choose → execute → verify loop for actual player decisions, reusing existing provider/output-validation infrastructure rather than inventing an unconfigured external agent. Keep PR #1 open and unmerged.

---

## Verificación completa de CI — 2026-10-15

- La ejecución [38792700892](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38792700892), sobre el commit `30107cb98b6bcb6059493e4e832bc56d458a7d58`, terminó con conclusión **success**.
- Los dos jobs terminaron correctamente: `lint` y `verify`. El job `verify` confirma tests de regresión, build desktop/local, build web, smoke test con Chromium, carga de captura de navegador y bundle Android.
- El smoke test de Chromium ya no se queda en ejecución: terminó en éxito, incluyendo la espera a que acabe la inicialización del mundo y la comprobación tras recargar.
- Artefacto de captura del navegador: [browser-smoke-38792700892](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38792700892). La existencia del artefacto está confirmada; no afirmo haber inspeccionado visualmente esta captura.
- Esto valida ese SHA concreto. Si se añade otro commit, la nueva cabeza debe pasar su propia CI. La PR #1 sigue abierta, en borrador y sin fusionar.
- Próximo paso: actualizar el seguimiento de la incidencia #2 con la evidencia final y continuar revisando el alcance funcional pendiente; el smoke test no cubre todavía una transición de turno real ni una llamada a un proveedor de IA.

## Lint remediation pass 1 — 2026-10-15

- Applied a narrow, behavior-preserving documentation fix to the 18 `no-empty` sites previously identified in the four map-rendering files. The empty catch bodies now contain comments explaining why the operations are intentionally best-effort during MapLibre teardown or WebGL context/resource loss.
- Changed files: `src/Game/Map/Nations.jsx` (10 sites), `src/Game/Map/labels/PolityTextLayer.jsx` (1), `src/Game/Map/labels/polityTextCustomLayer.js` (3), and `src/Game/Map/vnext/ownershipFloodCustomLayer.js` (4). Commits returned by GitHub writes: `1b092fa7ca618f80aef7c72708b2630303a40720`, `903842e4e0e3a025b00cf6d9b9922b57eb68a76c`, `4ed3bd54ae05ee8a6ea39aa40a07acaacd2fe926`, `603b2cf9b112e3aac1bda96ea50f4f6f8cbf61d5`.
- This does not suppress the rule or alter exception behavior. It documents why those catches are intentionally empty. The source changes have not yet been verified by lint/test on the resulting candidate commit; do not mark the issue fixed until CI confirms.
- Current-head workflow [38792663905](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38792663905) was pending at the time of this entry. Prior workflow [38792463042](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38792463042) was still in progress for an older commit. Earlier successful regression tests apply only to their recorded SHA, not to these edits.
- Next: inspect current-head lint first. If ESLint still reports `no-empty`, use explicit catch parameters/handling that preserve best-effort cleanup rather than disabling the rule. Then inspect remaining diagnostics and run the regression suite against the same candidate SHA.

## Lint diagnosis isolated and tracked — 2026-10-15

- Inspected the completed lint job `116619236911` from workflow run [38791976900](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38791976900), commit `e5f8b875e50b7a964308559e6ce968f2103f028f`. The command reports **18 errors and 71 warnings**; all 18 errors are `no-empty` diagnostics in four map-rendering files: `src/Game/Map/Nations.jsx` (10), `src/Game/Map/labels/PolityTextLayer.jsx` (1), `src/Game/Map/labels/polityTextCustomLayer.js` (3), and `src/Game/Map/vnext/ownershipFloodCustomLayer.js` (4).
- Inspected the affected code ranges. The empty blocks are mostly best-effort catches around MapLibre source/feature-state calls and WebGL resource cleanup. Do not mechanically suppress the rule: inspect each operation's intended failure semantics and preserve cleanup behavior before adding explicit comments or handling.
- Created [issue #2](https://github.com/wizzadrds/open-historias-pruebas/issues/2) with the exact diagnostic locations, acceptance criteria, and a narrow scope for resolving the 18 errors without weakening ESLint. The remaining 71 warnings are tracked separately from this first pass.
- In the same run, the regression-test step completed successfully on the prior head; browser smoke and Android bundle steps were still pending when inspected. This does not validate the latest documentation commits. The latest branch head is `12a6376428c7ffd277fbc68ae9532d343bf75649`, and workflow run [38792351220](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38792351220) was pending at the last check.
- Next: wait for current-head CI to finish, then fix the lint errors in a focused code patch with targeted regression coverage where behavior changes. Do not merge PR #1 while required checks are failing.

## AI test discovery index — 2026-10-15

- Added `docs/AI_TEST_MAP.md`, a source-tree-backed index of candidate tests for AI schemas/provider failures/turn orchestration, world-state and GIS invariants, persistence, server payloads and performance-sensitive turn paths.
- The index explicitly distinguishes a candidate test filename from verified coverage: agents must inspect the test body and assertions before relying on it. It includes a repeatable `find` / `rg` / narrow-test workflow and reminds agents that Tier 3 work needs end-to-end evidence where feasible.
- Linked the index from the mandatory first-read sequence in root `AGENTS.md`; this keeps test discovery part of the default workflow rather than optional reference material.
- Repository-write evidence: the new index commit is `eb46ce14b6694e8b346913251cfb126943ef4f79`; the subsequent entry-point link commit is recorded by the update response. These are GitHub write confirmations only, not validation evidence.
- CI run `38791976900` for the prior head `e5f8b875e50b7a964308559e6ce968f2103f028f` was still in progress when inspected: both `lint` and `verify` jobs were running, with regression tests not yet complete. No result is claimed for the new commits; they will trigger/require their own current-head validation.
- Next: inspect the isolated lint job output after completion, fix only evidence-backed root causes without weakening rules, and then extend the browser journey to a real turn transition once the UI control and expected state contract are confirmed.

## Aislar el diagnóstico de lint en CI — 2026-10-15

- El flujo anterior ejecutaba pruebas, compilaciones, Chromium y Android en un único job antes de ejecutar lint. La recuperación del log completo de ese job devolvió aproximadamente 175 MB y superó el límite del conector, impidiendo inspeccionar el error concreto de lint.
- Cambio: separé `npm run lint` en un job independiente llamado `lint`, con instalación reproducible mediante `npm ci` y Node.js 22. El job de verificación conserva sus pruebas, compilaciones y smoke test; no se han relajado reglas ni se han ocultado errores.
- Commit del flujo: `f181ff43c666850ae1575f21ebf0521a96c58b7b`.
- Estado de verificación de este cambio: **pendiente**. La modificación del archivo está confirmada por GitHub, pero aún no hay un resultado de CI para este commit; no se afirma que el workflow sea válido ni que lint pase.
- Próximo paso: inspeccionar la nueva ejecución, recuperar solo el log del job `lint`, corregir los errores demostrados sin desactivar reglas y volver a ejecutar la puerta de calidad. Mantener la PR sin fusionar mientras fallen comprobaciones requeridas.

## Repeatable AI task protocol — 2026-10-15

- Added `docs/AI_TASK_PROTOCOL.md` to turn the general engineering principles into a reusable task contract: lifecycle states, a copyable task brief, per-commit evidence ledger, failure triage, change-risk tiers, autonomy stop conditions, and a required handoff.
- Linked the protocol from the first-read sequence and repository orientation in root `AGENTS.md`. This reduces the chance that agents interpret autonomy as permission to skip evidence or silently treat historical CI as current.
- Confirmed the GitHub file-write operations returned commits `a7dbd69f10f1549d2176727038129da48b77139e` (new protocol) and `19f71dc50b1f0bc305c326edd8343206152ab5f4` (agent entry point). These are write confirmations only.
- Verification: documentation content was written through GitHub; no local checkout was available, and no tests, lint, builds, Markdown/link checker, or CI run were executed for these latest commits. Therefore the branch is **not yet verified**.
- Known blocker remains: workflow run `38740095544` passed tests and desktop/web/Android builds plus browser smoke, but failed `npm run lint`. A direct job-log retrieval exceeded the connector response limit (175 MB), so exact diagnostics have not been re-established from that run. Do not infer or bulk-fix the lint errors without targeted evidence.
- Next: inspect the latest PR/check status for the current head; obtain lint diagnostics through smaller step/log slices or a fresh run, fix only confirmed root causes, and rerun the failing gate. Keep PR #1 unmerged until required checks pass.

## Architecture map for autonomous agents — 2026-10-15

- Added `docs/AI_ARCHITECTURE_MAP.md` and linked it from root `AGENTS.md`. It maps verified entry points for game state, AI turn orchestration/provider boundary, server routes, server persistence, writable data root, browser smoke and CI; it also distinguishes desktop, browser and Android persistence/runtime constraints.
- The map explicitly warns that the central game-state and AI gameplay modules are very large and tells agents to trace focused functions/callers/contracts instead of attempting wholesale rewrites. It documents the difference between schema-valid model output and semantically legal game operations, and lists the eight stages an AI-turn investigation should trace.
- Rechecked workflow run [38740095544](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38740095544), job `116439722456`: regression tests, desktop build, web build, Chromium setup/smoke, screenshot upload and Android bundle build passed; the final lint step failed. The connector returned a log payload too large to inspect safely, so exact current lint diagnostics remain unverified here. This run predates the latest documentation commits and is not evidence that the current head has passed CI.
- The source landmarks were fetched from the default-branch revision for orientation, while the documentation changes were committed to `agent/engineering-quality-gates`. The map therefore requires agents to verify paths and behavior on their active branch before relying on them.
- No application code was changed and no tests/builds were run locally in this session. The new docs need CI validation. Next: inspect lint output in smaller, targeted slices or via the Actions UI, then create a source-backed subsystem/test index for turn resolution and persistence; do not claim the system is fully autonomous or fully verified yet.

## Discoverability of autonomous-agent instructions — 2026-10-15

- Linked root `AGENTS.md` from `docs/WORKING_AGREEMENT.md` and `docs/QUALITY_GATES.md`, so agents following existing quality documentation are directed to the complete task loop rather than relying on the new file being found by chance.
- The documentation chain is now: root agent entry point → working agreement and quality gates → latest project log and subsystem-specific code/tests.
- Verified the three GitHub file-write operations returned commit SHAs. These are repository-write confirmations only, not test or CI evidence. No application tests/builds were executed in this session.
- Next: inspect the new docs and current CI state, then expand the architecture map using real source and test contracts. Prioritize observed high-risk paths (turn resolution, save/load and AI validation) over speculative refactoring.

## AI contributor entry point — 2026-10-15

- Added root `AGENTS.md` as an explicit entry point for autonomous coding agents. It turns the existing working agreement into an operational loop: establish current reality, trace cross-target impact, define acceptance criteria, implement the smallest safe change, run evidence-producing checks, independently inspect the diff, and record a durable handoff.
- The guide includes repository landmarks, AI-output validation requirements, save/data safety, CI failure policy, and a completion-report template. It explicitly labels known paths as starting points that must be reverified, and prohibits treating a successful build or smoke test as proof of untested behavior.
- This is a documentation-only change. No application code, tests, lint, or builds were run in this connector session; CI must validate the branch. No claim is made that existing lint failures are fixed.
- Next: make the new guide discoverable from the working agreement and quality-gates docs, then continue the repository-wide subsystem map and turn the current CI/lint findings into verified, narrowly scoped tasks. Keep PR #1 unmerged until required checks pass.

## Browser E2E finding — 2026-10-15

- Downloaded and visually inspected screenshots from run [38586116733](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38586116733). That earlier browser smoke test created a game and confirmed its active ID persisted across reload, but the screenshots still showed the full-screen `DRAWING BORDERS AND LABELS...` artwork. This proved the original smoke test was too weak.
- Tightened `scripts/browser-smoke.mjs` to wait for world initialization to finish both after creating the game and after reloading, before it can pass.
- Latest completed run for this change: [38740095544](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/38740095544), commit `f31f810a853f6eb4cee3d677d7897843aa6d6138`. Confirmed from the Actions job steps: `npm ci`, regression tests, desktop build, browser build, Playwright/Chromium installation, browser E2E, screenshot upload, and Android bundle build all passed. The stricter browser smoke test therefore reached its success path, including the loading-finished assertion and reload check.
- The same run failed at `npm run lint`; lint remains a failing gate. Earlier output identified existing `no-empty` errors and warnings in source/test files. Do not describe the whole workflow as green, and do not merge while the required gate fails.
- Browser E2E coverage currently includes entering through the website connection/demo gate, opening the library, creating a game from the built-in default scenario at Medium difficulty, waiting for world loading to finish, checking the active game ID in IndexedDB, reloading and checking persistence/loading, collecting uncaught page errors, and capturing screenshots. It still does not advance a turn, explicitly exercise save/load UI, call a real AI provider, or test desktop/Android device runtime.
- Next: inspect the exact lint diagnostics and address the existing failures without disabling the rule or weakening the gate. Then identify the real in-game turn control and expected state transition before extending the browser scenario to advance a turn. Keep the PR unmerged while required checks fail.

# Project Log

This file is the durable record of work performed in this working repository. New entries go at the top. Record facts and observed results; distinguish verified outcomes from assumptions and unrun checks.

## Current baseline — 2026-10-14

### Repository and architecture reconnaissance

- Working repository: [wizzadrds/open-historias-pruebas](https://github.com/wizzadrds/open-historias-pruebas), default branch `master`.
- The repository is a full source tree, not an empty scaffold: the recursive Git tree contains 1,389 paths at the time of inspection.
- The source is an Open Historia working copy. The canonical upstream referenced in its README is [Open-Historia/open-historia](https://github.com/Open-Historia/open-historia), whose default branch is `main`. This working repository is the target for requested work; do not write changes to upstream.
- Stack: React 19, Vite 7, Node.js/Express 5, MapLibre GL + PMTiles, OpenLayers, Turf/GIS helpers, and an AI-provider/task layer with structured-output validation.
- Three client targets share the `src/` application: desktop/local server, browser web build backed by IndexedDB/fetch interception, and Android/Capacitor with native bridges and embedded data/server behavior.
- World state and turn resolution are centered on `src/runtime/gameState.js`, `src/Game/AI/gameplay.js`, and `world.json`-shaped runtime data. The Express API and file-backed stores are centered on `server/server.js`, `server/libraryStore.js`, and `server/dataDir.js`.
- The repository already has many Node tests (`server/**/*.test.js`, `src/**/*.test.js`) and `npm test`; package scripts also provide lint and distinct desktop/web/Android builds.
- The existing inherited `.github/workflows/tests.yml` is scoped to `main`/ `beta`, not this working copy's `master`. This is why a repository-specific quality workflow is being added.

### Work started

- Added `docs/WORKING_AGREEMENT.md`: inspect-first, acceptance criteria, verify independently, document outcomes, and do not claim checks that did not run.
- Added `docs/QUALITY_GATES.md`: a repeatable validation matrix for tests, lint, all client build variants, UI behavior, AI response handling, and change summaries.
- Added a pull request template requiring expected behavior, evidence, runtime checks, and risks.
- Added a workflow for the `master` branch and pull requests targeting `master`, running tests, lint, desktop/web/Android client builds, and a headless Chromium smoke test of the built web client.
- Added `scripts/browser-smoke.mjs`: launches the production web preview in Chromium, waits for the actual library menu (not just the loading artwork), creates a game from the built-in scenario, chooses the default country and Medium difficulty, verifies the active game ID is stored in IndexedDB and survives reload, watches uncaught page errors, and saves screenshots. The workflow installs its pinned Playwright runner and Chromium, then uploads screenshots (including on failure). The initial boot-only version passed. The first expanded run reached the library behind the website's connection overlay, then correctly failed because the test tried to click through that overlay. The test now follows the real “Enter Open Historia” and “Play the demo anyway” controls before using the library. The next run passed that gate and opened the scenario picker, but Playwright could not complete its scroll/hit-test step for “Scenario default” above the animated map canvas. The test now dispatches that one picker action with forced hit-testing and verifies the difficulty step opens; all other controls retain normal user-style clicks. This latest adjustment is awaiting CI verification.
- Removed three orphaned web account/sync modules (`account.js`, `accountWidget.js`, `sync.js`) after the existing `retiredAccount.test.js` failed because these retired modules were still present. The subsequent test run passed the account-retirement assertion; full latest-run confirmation is still pending.
- The first lint attempt reports 18 `no-empty` errors and 71 warnings in existing source/test files untouched by this work. The workflow now runs the browser smoke test and Android build before lint so the known lint backlog does not prevent runtime smoke coverage from executing; lint remains a required failing gate until its findings are resolved.
- These changes are on topic branch `agent/engineering-quality-gates`; they have not been merged into `master`.

### Verification status

- Repository metadata, default branch, permissions, file tree, package scripts, architecture overview, server overview, world-state overview, AI overview, contribution conventions, and existing test workflow were inspected through GitHub.
- **Not yet run in a local checkout:** `npm ci`, `npm test`, `npm run lint`, `npm run build`, `npm run build:web`, `npm run build:android`. The workflow is intended to run these checks in GitHub Actions after the branch is pushed/PR opened; do not report them as passing until a run confirms it.
- **Not yet verified locally:** `npm ci`, tests, lint, builds, and browser smoke test. A local checkout could not be obtained in this execution environment because direct GitHub network access is unavailable; GitHub Actions is the available execution environment for the repository source.
- **Not yet verified:** actual gameplay actions (start a game, advance a turn, save/load), real AI provider interactions, and desktop/Android device flows. The new Chromium smoke test verifies app boot/visible UI and uncaught page errors; it is not a substitute for gameplay E2E coverage.

### Next steps

1. Inspect the full architecture and critical data flows before modifying game behavior.
2. Confirm the latest GitHub Actions run, fix failures without weakening assertions, and inspect the saved browser screenshot.
3. Expand browser automation from boot smoke coverage into stable user journeys: open library, start/select a game, advance a turn where testable, and verify save/load.
4. Create a concise product acceptance checklist for the first requested gameplay changes before implementing them.


## Gameplay-agent evidence loop — 2026-10-17

### Changes made

- `src/Game/AI/actionResolution.js` now marks queued orders as `attempted` when a turn clears the queue; a turn-level flag is not proof that each order's intended effect happened.
- The fallback simulation only turns concrete chat orders (participants plus non-empty opening message) into chat effects. Arbitrary free-text orders are not represented as if they changed diplomacy, administration, or the world.
- Fallback descriptions now state only the persisted chat effect and explicitly avoid inferring other consequences.
- Added regression coverage for attempted-vs-resolved statuses, excluding completed/rejected/attempted orders from replay, and selecting only concrete fallback chat orders.

### Verification and current limitation

- GitHub Actions run [39028139014](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39028139014) failed: the new fallback selector test referenced `selectFallbackChatActions` without importing it, causing one regression-test failure and one lint error. The missing test import was fixed in commit [88263c1](https://github.com/wizzadrds/open-historias-pruebas/commit/88263c1a131e5482e16614febf31e3f484ebcaa0).
- Verification for commit `88263c1` is running in [GitHub Actions](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39028720518); do not treat it as passing until it completes.
- Important remaining gap: orders are now not falsely called successful, but the engine still needs an explicit per-order expected postcondition and evidence from canonical state after persistence. Until that exists, the status `attempted` is intentionally conservative, and the agent must not infer success from narration alone.

### Next implementation target

Implement an evidence contract for supported order types: stable order ID, declared expected effect, the canonical state fields that can prove/disprove it, and a post-write re-read. Only a passing check may promote an order to `resolved`; unsupported orders should remain `attempted` with an explicit unverified outcome. Add an integration test that demonstrates the next agent decision receives the verified result rather than only the previous generated prose.


### Evidence-gated order status helper — 2026-10-17

- Added `applyVerifiedActionOutcomes` in `src/Game/AI/actionResolution.js`: an attempted order can become `resolved` only with a positive outcome keyed by stable action ID and containing a non-empty postcondition, evidence source, and observation marker. Missing/negative/incomplete evidence leaves it `attempted`.
- Added tests for positive evidence, negative evidence, missing evidence, stable IDs, narration-only summaries, planned-order preservation, and immutable input.
- This is a deliberately small enforcement primitive, **not yet wired to the turn persistence path**. The next code change must create evidence from a fresh post-write read of canonical data, pass those outcomes through this helper, and make the verified ledger available to the next decision prompt. Until that integration and its test exist, no end-to-end per-order verification is claimed.
- The full workflow passed on commit `4daca2950c6886d9e3f393d912855345d39e2f8a`: [CI run 39028748321](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39028748321) — regression tests, desktop build, browser build/smoke, Android bundle build, and lint all succeeded. The new helper and tests above are newer than that passing commit and await their own CI run.


### Post-write verification for fallback diplomatic orders — 2026-10-17

- Added `verifyPersistedChatOutcomes` to compare requested participants and exact opening text against a fresh canonical chat read after `writeChatsState`; evidence is rejected if the same effect already existed in the pre-turn snapshot, the canonical snapshots are unavailable, or multiple threads make the match ambiguous.
- Wired the check into the turn persistence path for concrete fallback chat orders. Only attempted orders with a unique positive match are promoted through `applyVerifiedActionOutcomes`; other orders remain attempted.
- Added regression tests for exact matches, missing effects, pre-existing effects, and ambiguous matches.
- CI for the new integration is running on commit `ea759c468f69934a7b98c28dcd2318def3e8b048`: [workflow run 39030772103](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39030772103). Do not treat it as passing until it completes.
- Remaining limitation: this verification currently covers the fallback engine's concrete diplomatic-chat postcondition only. It does not yet prove territorial, military, policy, or other free-text order effects, and the verified ledger still needs explicit presentation in the next decision prompt.


### Verified order ledger reaches the next decision — 2026-10-17

- The post-write verifier now stores a compact `actionOutcomes` ledger on the latest simulation-history entry. Each order processed this turn is explicitly marked `verified` or `unverified`; only a verified record carries a positive postcondition and source.
- `renderLastTurnReceipt` now appends this ledger to the next turn's application receipt. The next model request is instructed not to treat unverified intended effects as facts.
- Added a regression test proving the next-turn receipt distinguishes a verified diplomatic effect from an unverified order.
- Corrected accent normalization in the participant/message comparison.
- CI for the receipt-rendering changes is pending at [workflow run 39031770529](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39031770529). The full end-to-end change is not considered validated until this run completes.
- Scope remains deliberately narrow: only concrete fallback diplomatic-chat effects have a positive postcondition verifier. Other order types are honestly reported as unverified, not inferred successful.

### Action evidence survives normalization; fallback verifier respects execution limit — 2026-10-17

- Preserved complete `verification` metadata when normalizing an individual queued action, while dropping incomplete evidence objects. Added a regression test for both paths.
- Found a causal attribution edge case: fallback simulation applies at most three concrete diplomatic chat orders, but the post-write verifier previously examined every eligible chat order. An unrelated matching persisted thread could therefore incorrectly verify an order that the fallback had not actually applied.
- Made the fallback chat selector accept an explicit limit and use the same limit both when generating fallback effects and when verifying persisted outcomes. Added tests for bounded and zero-result selection.
- CI for the latest changes: [workflow run 39035817036](https://github.com/wizzadrds/open-historias-pruebas/actions/runs/39035817036). Treat as pending until it completes.
- Remaining scope: positive verification still applies only to concrete fallback diplomatic chats. Other order types stay unverified until each has a reliable, order-specific canonical postcondition.


## Prevent duplicate orders from claiming the same persisted effect — 2026-10-17

- Tightened `verifyPersistedChatOutcomes` so one canonical persisted chat thread can verify at most one queued order. Two identical orders can no longer both be marked resolved by the same single thread.
- Added a regression test for duplicate participant/message orders against one persisted thread.
- This remains intentionally conservative: distinct effects need distinct canonical evidence; unverified orders remain attempted.
- CI pending for this change.

## Explain why an order remains unverified — 2026-10-17

- The next-turn outcome ledger now preserves a short reason for each unverified order: no verifier ran, canonical chat state could not be read, or no unique new persisted thread matched the order.
- The receipt shows that reason to the next decision-maker rather than using one generic message for every failure mode. Verified outcomes still require complete positive post-write evidence.
- Added normalizer and receipt regression coverage. CI pending.

## Verify chat outcomes against the actual pre-write snapshot — 2026-10-17

- Corrected the causal baseline for diplomatic-order verification: it now uses the exact canonical chat list re-read immediately before the turn writes chats, not the older state captured when the turn began.
- This closes a concurrency gap where a thread created by the player or another writer during generation could be absent from the old snapshot and then be incorrectly counted as a new effect of the queued order.
- If the pre-write read fails, the order stays unverified with an explicit reason; the fallback write path is not treated as proof. CI pending.
