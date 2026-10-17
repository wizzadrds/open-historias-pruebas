# Architecture Map for Coding Agents

This is a navigation aid for investigations, not a replacement for reading source. It records verified architectural landmarks and important boundaries so an agent can find the owner of behavior before changing it. Re-check paths and call sites on the current branch: this project changes quickly and some files are very large.

## Product and runtime shape

Open Historia is a React/Vite game with a shared client source tree and several runtime environments. The same feature can cross UI, simulation state, AI orchestration, persistence, and platform adapters; a change is not complete merely because one bundle compiles.

| Concern | Starting point | What to trace before changing |
|---|---|---|
| World/game state and turn effects | `src/runtime/gameState.js` | exported functions, state invariants, normalization/migrations, callers, related `src/runtime/*` helpers and regression tests |
| AI gameplay/turn orchestration | `src/Game/AI/gameplay.js` | prompt builders, provider boundary, output parsing/normalization, operation screening, state application, retries/fallbacks, turn receipts and error paths |
| AI provider integration | `src/Game/AI/main.jsx` (imported by gameplay) | provider selection, request/response handling, structured-output expectations, timeouts and secret handling |
| HTTP server and API routes | `server/server.js` | route handlers, request validation, auth/CORS, errors, lifecycle/shutdown and store functions called by each route |
| Server-side library and persistence | `server/libraryStore.js` | file layout, atomic writes, game/scenario bundle formats, migrations, imports/exports, safe path resolution and test fixtures |
| Writable server data root | `server/dataDir.js` | `OH_DATA_DIR` override; default is `server/data`; embedded desktop uses a writable user-data path |
| Browser smoke journey | `scripts/browser-smoke.mjs` on the engineering branch | actual visible milestones, loading completion, persistence after reload, uncaught errors and what the smoke test does *not* cover |
| Quality workflow | `.github/workflows/working-repo-checks.yml` on the engineering branch | trigger branches, exact step order, required checks, artifacts and which later steps are skipped after failure |

The world-state and AI gameplay files are exceptionally large (hundreds of thousands of characters in the inspected default-branch revision). Do not read or rewrite them wholesale. Search for the exact function, inspect its callers and adjacent helpers, then trace the contract end to end. New focused helpers are often safer than expanding an already broad module, but only introduce one when it fits the existing design.

## Platform and persistence boundaries

### Server-backed desktop/local runtime

- The server owns a writable data root. `server/dataDir.js` uses `OH_DATA_DIR` when set and otherwise resolves `server/data`.
- The embedded desktop app must use a writable user-data directory because packaged application assets can be read-only.
- Server-side stores cover games, scenarios and other library assets. Check migrations and import/export paths whenever a stored schema or identifier changes.
- Use temporary directories and isolated fixtures in persistence tests; never test by resetting real user data.

### Browser runtime

- The browser build has its own mode and seed step: `npm run build:web` runs `scripts/seed-web-defaults.mjs` before Vite.
- Browser persistence uses IndexedDB and browser-specific fetch behavior rather than assuming the desktop filesystem/server model.
- A reload-persistence smoke test demonstrates only that its exercised identifier/state survived that reload; it does not prove full save/load UI correctness, save compatibility, or turn correctness.

### Android

- `npm run build:android` builds the Android-targeted client bundle; that is compile-time evidence, not a device/emulator runtime test.
- The Android app has no local Node server in its runtime model; its library persistence is the web backend's IndexedDB, with Capacitor/native bridges where applicable.
- For changes touching browser APIs, filesystem access, networking, dialogs, downloads, maps, or lifecycle, inspect the Android adapter and mobile documentation and run a device test when possible.

## AI turn path: questions to answer before a change

When a feature changes AI behavior or simulation effects, trace these stages and record the real functions involved in the task:

1. **Input construction:** which world snapshot, player action, scenario rules and context are sent to the model?
2. **Provider boundary:** where is the request made, which provider modes exist, and how are timeout/network errors represented?
3. **Output boundary:** how is raw output decoded? Is the shape validated beyond asking the model for JSON?
4. **Operation screening:** are identifiers, ownership, ranges, geography and allowed action types checked against current state?
5. **Application:** are operations applied atomically or can partial changes survive an invalid response?
6. **Receipts and observability:** can the player or test see what was accepted, rejected, normalized or omitted?
7. **Persistence:** is the resulting state saved, and can it be loaded after reload or migration?
8. **Regression tests:** can valid and invalid outputs be tested deterministically with a mocked provider, without keys or network access?

A prompt is not a validator. A successful API response is not proof that its proposed operations are legal. A valid schema is not proof that referenced countries/regions exist or that the transition preserves invariants.

## Test discovery and evidence

Do not assume a test filename or that a nearby test covers the changed contract. Discover tests on the active branch:

```sh
find src server -type f \( -name '*.test.js' -o -name '*.spec.js' \)
rg -n 'functionName|exportName|route path|schema field' src server
```

Then run the narrowest matching test, followed by the relevant commands in `docs/QUALITY_GATES.md`. Use fixtures that represent old persisted data when touching migrations. For a turn/state change, assert the resulting state and invariants, not only that the function returned or the UI rendered.

Current known coverage limitation from the project log: browser smoke covers creation, initialization completion and reload persistence, but not advancing a turn, explicit save/load UI, a real AI provider, or actual desktop/Android device runtime. Do not present those paths as covered until a test actually exercises them.

## When updating this map

Only add statements supported by current source, tests or observed CI. Include file/function links when the relevant identifiers are confirmed. If a subsystem changes ownership, update this map and the project log in the same change. Keep uncertain details under a clearly labelled “unknown / needs investigation” heading instead of filling gaps with plausible guesses.
