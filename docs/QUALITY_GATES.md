# Quality Gates and Self-Verification

The purpose of this process is to catch regressions before asking the user to retest them. CI is a safety net, not a substitute for checking the actual behavior.

Coding agents should read the root [`AGENTS.md`](../AGENTS.md) for the full autonomous engineering loop and [`WORKING_AGREEMENT.md`](WORKING_AGREEMENT.md) for the definition of done. This document is the authoritative checklist for quality commands.

## Before implementation

1. Restate the requested outcome in observable terms.
2. Identify the relevant architecture path and source of truth.
3. Inspect neighboring code, existing tests, saved-data formats, and platform-specific branches.
4. Write acceptance criteria, including at least one negative or edge case where relevant.
5. Decide how each criterion will be checked: unit test, integration test, build check, browser/device check, or a clearly marked manual check.

For work whose desired behavior cannot be inferred safely, ask before committing to a design.

## During implementation

- Add or update regression tests at the lowest useful level.
- Keep pure business rules testable without network, provider keys, or a running UI.
- Mock external AI providers, content nodes, and network boundaries in automated tests; do not consume paid API calls in routine CI.
- Treat AI output as untrusted input: validate schemas, handle malformed/incomplete output, and test fallback/error paths.
- For state and save-data changes, cover migration, old saves, missing fields, and round-trip persistence where applicable.
- For map/GIS changes, check geometry edge cases, projection/coordinate assumptions, and large-data performance where applicable.
- For security or trust changes, test rejection paths as well as valid requests.

## Before calling a change complete

Run applicable checks from this baseline:

| Check | Command | Purpose |
|---|---|---|
| Automated regression suite | `npm test` | Node built-in test runner for server and source tests |
| Lint | `npm run lint` | Static checks across the repository |
| Desktop/local build | `npm run build` | Default Vite bundle used by the local/desktop app |
| Browser/web build | `npm run build:web` | Web-only code paths and generated browser seed |
| Android client build | `npm run build:android` | Native Android compile-time code paths |
| Wiki consistency (when relevant) | `npm run wiki:check` | Detect stale generated wiki content |

Do not report a command as passed unless it was actually executed and its exit status observed. If environment, dependency installation, missing assets, or time prevents a check, mark it **not run** and explain why. If a command fails, capture the relevant error and decide whether it is introduced by the change or pre-existing.

## UI and product behavior verification

For a user-visible change, a successful build alone is insufficient.

- Check the actual screen/flow in a browser or device if a suitable runtime is available.
- Verify the main success path, one invalid/empty/error path, and relevant responsive or platform-specific behavior.
- Check that labels, loading states, disabled states, errors, and persistence match the acceptance criteria.
- For visual changes, attach before/after screenshots to the pull request when possible.
- If a browser/device check cannot be performed by the available tools, explicitly say so and give the exact remaining check; do not imply that it was tested.

## AI-driven behavior

A language model's answer is nondeterministic. Verify the deterministic parts around it: prompt assembly, schema validation, tool permissions, error classification, retry/fallback behavior, state mutation limits, and the receipt/logging of accepted or rejected changes. Use recorded fixtures or mocked provider responses for repeatable tests.

## Pull request / change summary

Every change should include:
- **Expected behavior:** what should be different for a player or maintainer.
- **Implementation:** key modules and why they are the right place.
- **Evidence:** exact commands run and results.
- **Runtime verification:** what was manually observed, or what remains unverified.
- **Risks and rollback:** save compatibility, platform impact, and how to revert if needed.
- **Documentation/log:** links to updated docs and project-log entry.

## Current limitation

The repository has a large existing automated test suite and a test workflow, but this working copy's default branch is `master`, while the inherited test workflow only targets `main` and `beta`. The working-repo workflow added alongside this document makes checks run for this repository's `master` branch and pull requests targeting it. Browser/device end-to-end automation is not yet established by this change; it remains a follow-up, not something to assume exists.
