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
- Added `scripts/browser-smoke.mjs`: launches the production web preview in Chromium, waits for visible UI, watches uncaught page errors, and saves a screenshot artifact. The workflow installs its pinned Playwright runner and Chromium, then uploads the screenshot (including on failure).
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
