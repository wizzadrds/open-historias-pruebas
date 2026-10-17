/*! Open Historia — action resolution helper © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */

/**
 * Record that a planned order was processed by a turn without claiming its
 * intended effect was fulfilled. clearActions is a turn-level signal, not
 * per-order causal evidence; "attempted" is deliberately not "resolved".
 *
 * Per-order verification can promote an attempted order only when the engine
 * supplies evidence tied to that order's stable ID and expected postcondition.
 */
export const resolvePlannedActions = (actions, clearActions) => actions.map((action) => ({
  ...action,
  status: action.status === "planned" && clearActions ? "attempted" : action.status,
}));

/**
 * Return only queued orders eligible for the next simulation pass.
 * Keep this filter shared so resolved/rejected history cannot be replayed.
 */
export const selectPlannedActions = (actions) => actions.filter((action) => action.status === "planned");
