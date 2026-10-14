# Working Agreement for This Repository

This repository is the active working copy for the requested Open Historia changes. Keep it; do not delete or replace the repository. Record meaningful changes, failures, decisions, and next steps here so work can continue without making the user repeat context.

## Non-negotiable working rules

1. **Inspect before changing.** Read the relevant implementation, its callers, data contracts, related tests, and subsystem documentation before editing.
2. **Define the expected result first.** For behavior changes, write down the observable acceptance criteria before implementation. If the user's intent is ambiguous in a way that changes the design, ask one focused question rather than guessing.
3. **Trace impact across targets.** Consider desktop, browser/web, and Android builds, as well as server, saved data, AI provider, map, and scenario behavior when relevant.
4. **Make the smallest coherent change.** Avoid unrelated refactors and generated/binary assets unless necessary.
5. **Prove, don't assume.** Run relevant automated tests, lint, and build checks where available. For UI or integration behavior, perform a real runtime check when tools/environment permit. State clearly which checks ran, which passed, and which could not be run.
6. **Verify the final state independently.** Inspect the diff and changed files after editing; check for unintended changes, missing imports, broken contracts, unhandled edge cases, and misleading documentation.
7. **Document as part of the change.** Update the project log and relevant subsystem docs when behavior, architecture, setup, or known limitations change.
8. **Preserve user data and repository safety.** Never delete the repository or user content as a cleanup shortcut. Do not create a backup branch or copy unless explicitly requested. Prefer a topic branch and pull request over writing directly to the default branch.
9. **Do not claim success without evidence.** If a tool fails, a check is unavailable, or runtime behavior is not verified, report that explicitly and keep it on the task list.

## Definition of done

A change is done only when all applicable items are true:

- [ ] The user-visible behavior and acceptance criteria are clear.
- [ ] The implementation follows existing architecture and conventions.
- [ ] Relevant regression tests exist or the reason they cannot be added is documented.
- [ ] Relevant tests and lint pass, or failures are recorded with exact scope.
- [ ] Applicable build targets pass.
- [ ] Runtime/UI behavior has been checked where possible; otherwise the remaining manual check is explicit.
- [ ] The final diff has been reviewed for unrelated or unsafe changes.
- [ ] Documentation and `docs/PROJECT_LOG.md` are updated.
- [ ] The user receives a concise summary of changed files, evidence, remaining risks, and next step.

## Change record format

Append entries to `docs/PROJECT_LOG.md` with date, goal, files/subsystems, checks run and results, unresolved risks, and next step. Do not record secrets, API keys, private tokens, or personal data.
