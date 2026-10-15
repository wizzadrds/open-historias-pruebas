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
