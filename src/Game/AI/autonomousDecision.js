/*! Open Historia — deterministic autonomous decision adapter © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */

// Pure first slice of the autonomous loop. This module deliberately does not
// execute orders or infer effects from generated prose: callers supply the
// canonical persisted snapshot and the existing order-outcome ledger.
const asArray = (value) => Array.isArray(value) ? value : [];
const clean = (value) => typeof value === "string" ? value.trim() : "";

const outcomeStatus = (outcome) => {
  if (outcome?.status === "verified" || outcome?.verified === true) return "verified";
  if (outcome?.status === "failed" || outcome?.status === "blocked") return outcome.status;
  return "uncertain";
};

export const buildAutonomousObservation = ({
  gameState = {},
  worldState = {},
  actionOutcomes = [],
} = {}) => ({
  game: {
    date: clean(gameState.gameDate),
    player: clean(gameState.country),
    round: Number.isFinite(gameState.round) ? gameState.round : null,
  },
  world: {
    resources: worldState.resources && typeof worldState.resources === "object"
      ? { ...worldState.resources }
      : {},
    events: asArray(worldState.events).map((event) => ({
      id: clean(event?.id),
      title: clean(event?.title),
    })),
    goals: asArray(worldState.playerGoals).map((goal) => ({
      id: clean(goal?.id),
      title: clean(goal?.title || goal?.text),
      status: clean(goal?.status) || "unknown",
    })),
  },
  pendingActions: asArray(worldState.actions)
    .filter((action) => action?.status === "planned")
    .map((action) => ({
      id: clean(action?.id),
      title: clean(action?.title || action?.text),
      status: "planned",
    }))
    .filter((action) => action.id),
  priorOutcomes: asArray(actionOutcomes).map((outcome) => ({
    actionId: clean(outcome?.actionId || outcome?.id),
    title: clean(outcome?.title),
    status: outcomeStatus(outcome),
    postcondition: outcomeStatus(outcome) === "verified"
      ? clean(outcome?.verification?.postcondition || outcome?.postcondition)
      : "",
    reason: outcomeStatus(outcome) === "verified" ? "" : clean(outcome?.reason),
  })).filter((outcome) => outcome.actionId),
});

// Select from caller-provided, already validated candidates. The policy is
// intentionally conservative and deterministic: never repeat a verified
// effect, prefer an explicit alternative after a blocked/failed attempt, and
// return null when evidence is insufficient or no viable candidate exists.
export const chooseDeterministicAction = (observation, candidates = []) => {
  const prior = asArray(observation?.priorOutcomes);
  const verified = new Set(prior
    .filter((item) => item.status === "verified")
    .map((item) => item.actionId));
  const failedTitles = new Set(prior
    .filter((item) => item.status === "failed" || item.status === "blocked")
    .map((item) => item.title.toLocaleLowerCase()));
  const pending = new Set(asArray(observation?.pendingActions).map((item) => item.id));

  for (const candidate of asArray(candidates)) {
    const id = clean(candidate?.id);
    const title = clean(candidate?.title);
    if (!id || !title || candidate.valid !== true) continue;
    if (verified.has(id) || pending.has(id)) continue;
    if (failedTitles.has(title.toLocaleLowerCase())) continue;
    if (candidate.requiresVerifiedEvidence === true && !prior.some((item) => item.status === "verified")) continue;
    return { id, title, expectedEffect: clean(candidate.expectedEffect) };
  }
  return null;
};
