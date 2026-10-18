# AI Task Protocol

This document defines the smallest repeatable contract for handing a task to any coding agent. It supplements `AGENTS.md`; it does not override the working agreement, quality gates, security policy, or repository permissions.

## Task lifecycle

Use these states in notes, issues, or handoffs:

- **proposed** — outcome and scope are not yet accepted.
- **ready** — observable acceptance criteria and verification plan exist.
- **in_progress** — current branch and baseline have been inspected; implementation is underway.
- **blocked** — progress requires a missing permission, external dependency, unavailable environment, or a user decision that cannot safely be inferred.
- **verified** — applicable checks were run on the exact candidate commit and their results are recorded.
- **completed** — verified work is committed and handed off; this does not imply a pull request was merged.

Never mark a task verified based on a previous commit's CI, a successful build alone, or an assumed test result. Record the full commit SHA used for verification.

## Task brief template

Before editing, create a brief in the issue/PR description or task notes. Keep it short and specific.

```markdown
## Outcome
What should a player, maintainer, or other system be able to observe?

## Scope
- In scope:
- Out of scope:

## Acceptance criteria
- [ ] AC1: observable condition
  - Evidence: exact test, assertion, or runtime observation
- [ ] AC2: failure/edge condition
  - Evidence: exact test, assertion, or runtime observation

## Contracts to preserve
- State/save format:
- API or AI output schema:
- Platform/runtime differences:
- Security/data-safety constraints:

## Verification plan
- Narrow test:
- Regression suite:
- Lint/build/runtime checks:
- Checks intentionally not run and why:

## Risks and rollback
What data, compatibility, or user workflow could be affected? How can this patch be reverted safely?
```

For a documentation-only or mechanical task, simplify the template, but still state what success means and how it was checked.

## Evidence ledger

For each verification attempt, record one row. Do not collapse different commits or reruns into one claim.

| Field | Required value |
|---|---|
| Commit | Full SHA tested |
| Check | Exact command or workflow/job |
| Result | passed / failed / not run / blocked |
| Diagnostic | Short error summary or link to full output |
| Interpretation | introduced / pre-existing / environment / unknown |
| Follow-up | Fix, rerun, or reason to defer |

A test result without a commit identity is historical context, not proof about the current candidate. When logs are too large to inspect, say so and retrieve a narrower job/step log; do not guess the cause.

## Failure triage protocol

When a check fails:

1. Capture the command, exit status, commit SHA and relevant diagnostic.
2. Reproduce with the narrowest available command or isolate the failing file/test.
3. Compare against the base branch or known baseline before calling it pre-existing.
4. Fix root causes within scope. Do not delete coverage, loosen assertions, disable rules, hide failures, or add blanket ignores to make CI green.
5. Rerun the failed check and related regression tests.
6. If the failure is out of scope, create a tracked follow-up with the exact evidence and leave the gate visibly failing.

Do not make unrelated lint cleanup part of a feature patch unless the lint issue blocks its verification and the cleanup is demonstrably minimal.

## Change risk tiers

Choose a tier before editing and increase it when evidence warrants it.

- **Tier 1 — docs/mechanical:** no runtime behavior or stored data changes. Verify links, formatting where available, and relevant CI.
- **Tier 2 — isolated logic/UI:** localized runtime change with no data migration or cross-platform contract change. Add a regression test and run relevant builds.
- **Tier 3 — critical contracts:** turn resolution, AI output application, save/load or migrations, API trust boundaries, GIS geometry, import/export, authentication/network exposure, or shared platform adapters. Trace end-to-end callers, test valid and invalid paths, include compatibility fixtures where relevant, and obtain runtime evidence where possible.

Tier 3 work must not be treated as complete merely because unit tests pass. If end-to-end coverage is unavailable, report the gap and a precise follow-up.

## Safe autonomy and stop conditions

Agents may choose implementation details when the acceptance criteria and contracts make the choice reversible and low risk. Stop and ask one focused question when:

- two plausible interpretations would produce materially different user-visible behavior;
- a change could delete, overwrite, expose, or irreversibly migrate user data;
- credentials, production access, paid services, or permissions are needed but not authorized;
- required evidence cannot be obtained and proceeding would require claiming an unverified result.

Do not ask the user to repeat repository facts already recorded here. First inspect the latest project log, branch, source and CI. Do not merge, publish releases, change repository security settings, or perform other consequential administration unless explicitly authorized.

## Final handoff contract

Every completed or blocked task ends with:

1. outcome and changed files;
2. commit/branch or PR link;
3. exact verification evidence and tested commit SHA;
4. checks not run, blockers and remaining risks;
5. one prioritized next action.

The goal is reliable independent work with an auditable trail. Autonomy means agents can gather evidence and make bounded decisions—not that they can skip verification or claim certainty where evidence is missing.
