# Test Map for Coding Agents

This index is a discovery shortcut, not proof that a named test covers a particular behavior. Read the test and its assertions before relying on it, and refresh this map when tests move. File names below were confirmed in the repository tree on 2026-10-15; coverage semantics must be verified in the test body.

## Start with the narrowest relevant test

| Change area | Candidate tests to inspect first | Follow the contract into |
|---|---|---|
| AI gameplay schemas and custom stats | `src/Game/AI/gameplaySchemasCustomStats.test.js`, `src/Game/AI/lenientPayloads.test.js`, `server/gameplaySchemas.test.js` | Prompt/output schema, parser, validation and application boundary |
| AI provider selection and failure handling | `src/Game/AI/providerConfig.test.js`, `src/Game/AI/providerErrors.test.js` | Provider adapters, timeout/error normalization and fallback policy |
| Turn ordering and review | `src/Game/AI/turnOrdering.test.js`, `src/Game/AI/turnReview.test.js`, `server/toolTurns.test.js` | Turn orchestration, tool-call lifecycle, state mutation and receipts |
| World-state normalization and identity | `src/runtime/gameState.ownerIdentity.test.js`, `src/runtime/gameState.polityFounding.test.js`, `src/runtime/gameState.regionClaimants.test.js` | Normalizers, ownership invariants, migration behavior and callers |
| World-state ledgers and interactive events | `src/runtime/gameState.ledgers.test.js`, `src/runtime/gameState.interactiveEvents.test.js`, `src/runtime/applicationReceipt.test.js` | Event application, receipts, history and partial-failure behavior |
| Units and movement | `src/runtime/gameState.unitMotion.test.js`, `src/runtime/gameState.unitOrders.test.js`, `src/runtime/gameState.unitSystem.test.js` | Orders, movement constraints, dates, geography and persisted state |
| Territory / GIS basis | `src/runtime/gameState.territoryBasis.test.js`, `src/runtime/gameState.occupierCedes.test.js` | Ownership transfer, territory screening, map references and state consistency |
| Save/load and browser persistence | `src/runtime/native/fileSave.test.js`, `src/runtime/web/libraryStore.test.js`, `src/runtime/web/saveMove.test.js`, `src/Editor/playerCountryAfterSave.test.js` | Serialization, IndexedDB/file adapters, older save formats and round-trip behavior |
| Server payload and response size | `server/payloadChunks.test.js`, `server/payloadUpdate.test.js`, `server/runtimeJsonMinimalReturn.test.js` | API contracts, payload chunking, update semantics and compatibility |
| Performance-sensitive turns | `server/turnPerfR1.test.js`, `server/turnPerfR4.test.js` | Existing performance expectations and repeatability of measurements |

## Repeatable discovery workflow

Run these from the repository root. Do not guess that the candidate file exists or that its name matches the current implementation.

```sh
# Find tests by filename
find src server -type f \\( -name '*.test.js' -o -name '*.spec.js' \\)

# Search for the exact function, exported symbol, route or schema field
rg -n 'ExactFunctionOrField' src server

# Read the candidate test and implementation together, then run the narrow test
node --test path/to/relevant.test.js

# Expand to the complete regression suite after the focused test
npm test
```

If a narrow test command does not match the repository's runner conventions, use the established `npm test` script and record the exact invocation/result rather than silently changing the canonical command.

## Required coverage questions by risk

For a normalizer, schema or AI-output change, check valid, malformed, missing-field, boundary and unknown-reference cases. For a state mutation, assert resulting state and invariants, not merely a return value. For persistence, cover round trips and legacy/missing-field fixtures where applicable. For provider/network behavior, use deterministic mocks and test rejection, timeout and fallback paths without API keys or paid calls.

For Tier 3 work (turn resolution, AI operation application, save/load, migrations, API trust boundaries or GIS ownership), a passing unit test is necessary but may not be sufficient. Record what integration/runtime evidence is missing. The browser smoke test described in `docs/AI_ARCHITECTURE_MAP.md` does not currently establish turn advancement, full save/load UI behavior, real-provider behavior, or device runtime.

## Maintenance rule

When adding or moving a high-value test, update this index only after inspecting the test body and recording what it actually proves. If coverage is uncertain, list the file as a candidate to inspect, not as a verified guarantee. Keep `docs/PROJECT_LOG.md` as the chronological record of observations, exact checks and follow-up work.
