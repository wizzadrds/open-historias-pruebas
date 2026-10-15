# AI Engineering Guide

This file is the entry point for coding agents and automated contributors. Its goal is to make safe, independent work possible by teaching agents how to discover the real system, prove behavior, and leave durable evidence. It is not permission to guess, skip checks, or claim unverified success.

## Read this first

Before acting, read these in order:

1. `docs/WORKING_AGREEMENT.md` — non-negotiable engineering rules and definition of done.
2. `docs/QUALITY_GATES.md` — commands and evidence required before delivery.
3. `docs/AI_TASK_PROTOCOL.md` — task lifecycle, acceptance-criteria template, evidence ledger, failure triage, risk tiers and stop conditions.
4. `docs/AI_ARCHITECTURE_MAP.md` — subsystem boundaries and platform-specific persistence notes.
5. The newest entry in `docs/PROJECT_LOG.md` — current verified state, blockers, and next action.
6. The relevant subsystem documentation and implementation, including callers and tests.

If instructions conflict, preserve user data and safety first, then follow the working agreement and the narrowest applicable subsystem contract. Do not treat old log entries as current facts without rechecking the repository and latest CI.

## The autonomous change loop

For every task, follow this loop and record the evidence:

### 1. Establish reality

- Read the request and convert it into observable acceptance criteria.
- Inspect the current branch, working tree, recent commits, relevant files, callers, tests, and active CI results before editing.
- Search for an existing implementation or contract before creating a parallel abstraction.
- Separate **verified facts**, **hypotheses**, and **unknowns**. Never turn a guess into a requirement.
- If two plausible interpretations would lead to materially different implementations, ask one concise question. Otherwise choose the smallest reversible interpretation and state it.

### 2. Map impact before editing

Trace the full path from user action to visible outcome and persistence. Check applicable areas:

- React/UI component and its state ownership
- domain/runtime logic and state transitions
- AI prompt, provider adapter, structured output schema, validation and error path
- server/API, filesystem or data directory behavior
- scenario/world/map data and GIS assumptions
- save/load, migrations, import/export and backward compatibility
- desktop/local server, web/IndexedDB and Android/Capacitor differences
- tests, docs, build configuration and generated assets

Do not assume that code shared under `src/` behaves identically on every target. Confirm target-specific branches and storage/network adapters.

### 3. Plan the smallest safe change

- Write down the acceptance criteria and the test that will prove each one.
- Identify invariants that must not change, especially save compatibility, world-state integrity, user data and AI output contracts.
- Prefer a focused patch over broad refactoring. Keep unrelated cleanup out of the task.
- For behavior changes, add or update a regression test that fails on the old behavior.
- For AI behavior, test valid output, malformed output, missing fields, boundary values, provider failure, timeout/cancellation where relevant, and ensure untrusted model text is validated before mutating game state.

### 4. Implement and verify incrementally

Run the narrowest relevant test first, then expand to the repository quality gates. Use the scripts in `package.json` and `docs/QUALITY_GATES.md`; do not invent commands or silently replace the official command.

Baseline commands when applicable:

```sh
npm test
npm run lint
npm run build
npm run build:web
npm run build:android
npm run wiki:check
```

Run only the checks relevant to the change, but explain why any applicable check was omitted. When a command fails:

1. Preserve the complete diagnostic and exit status.
2. Identify whether it is caused by this change, a pre-existing issue, or an environment limitation.
3. Fix the root cause if it is in scope; do not weaken rules, delete tests, or suppress diagnostics merely to get a green run.
4. Re-run the failed command and the relevant regression suite.
5. Report unresolved failures explicitly.

A successful build is not proof of correct runtime behavior. For UI changes, use the browser/device workflow where available and assert a user-visible outcome, not just the presence of a component or absence of console errors.

### 5. Review the result as a separate pass

Inspect the final diff and changed-file list. Check for accidental generated files, secrets, unsafe destructive operations, stale comments, incomplete error handling, race conditions, missing tests, compatibility breaks, and docs that overstate evidence. Confirm the final branch/commit and CI status before describing delivery.

### 6. Leave durable memory

Update `docs/PROJECT_LOG.md` at the top with:

- date and objective
- files/subsystems changed
- decisions and the reason behind them
- exact checks run and their observed results
- what was not tested and why
- remaining risks and the next concrete action

Record only useful, verified learning. Never store credentials, tokens, private user data, or unverified speculation. Documentation is part of the change, not a substitute for tests.

## Repository orientation

Use this as a starting map, not a substitute for searching current code:

- `src/runtime/gameState.js` — central game/world-state logic.
- `src/Game/AI/gameplay.js` — AI gameplay/turn interaction path.
- `server/server.js` — server entry point and HTTP behavior.
- `server/libraryStore.js`, `server/dataDir.js` — library persistence and data-directory concerns.
- `scripts/browser-smoke.mjs` — browser smoke workflow.
- `docs/QUALITY_GATES.md` — authoritative local check list.
- `docs/AI_TASK_PROTOCOL.md` — repeatable task/evidence contract.
- `docs/PROJECT_LOG.md` — chronological evidence and handoff.

These paths are known landmarks from prior reconnaissance; verify that they still exist and inspect their current contents before relying on them. Search imports and callers to find the actual ownership of behavior.

## AI-specific safety and correctness

- Treat provider output as untrusted input, even if the prompt requests JSON or a schema.
- Validate shape, types, identifiers, ranges and references before applying output to world state.
- Prefer deterministic local validation and deterministic tests; mock external AI providers in normal CI.
- Do not require API keys or external paid services for the ordinary test suite.
- Make failure modes explicit: invalid output must not partially corrupt a turn or save; retry/fallback behavior must be bounded and tested.
- Do not silently change prompts, schemas, model parameters and state application in one untestable patch. Separate concerns or test their combined contract.
- Avoid brittle tests tied to exact prose from a model. Assert schema, invariants, allowed actions and state transitions.
- Keep secrets out of logs, screenshots, fixtures, test output and the project log.

## Data, persistence and destructive operations

- Preserve existing saves, scenarios, maps and user-created content.
- Treat import/export formats and saved game state as compatibility contracts. If a schema change is needed, document versioning and migration/fallback behavior and test old-format fixtures.
- Do not delete, overwrite, reset or migrate user data just to make a test pass.
- Use temporary test directories and deterministic fixtures for filesystem/server tests.
- Do not commit generated bundles, screenshots, credentials or machine-specific files unless explicitly required.

## CI and delivery policy

- A failed required check means the change is not fully verified. Do not label a PR ready or recommend merging while required checks fail.
- Do not make CI green by removing coverage, broadening skips, disabling lint rules, or making assertions weaker.
- A smoke test proves only the path it exercises. List untested behavior explicitly; expand end-to-end coverage around critical user journeys when selectors and expected state transitions are understood.
- Report evidence precisely: **passed**, **failed**, **not run**, or **blocked by environment**. Never infer a check result from a workflow file or an earlier commit.
- Do not merge, close a PR, alter branch protection, or perform other consequential repository administration unless explicitly authorized.

## Completion report template

Every handoff should include:

1. **Outcome** — what changed and what the user can observe.
2. **Files** — important files changed and why.
3. **Evidence** — exact commands/workflows and pass/fail results.
4. **Limitations** — checks not run, environment blockers and remaining risks.
5. **Next step** — one concrete, prioritized action.

The objective is independent engineering with traceable evidence—not autonomous activity for its own sake. When confidence is insufficient, gather more evidence or ask for clarification rather than guessing.
