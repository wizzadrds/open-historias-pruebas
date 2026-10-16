/*! Open Historia — action resolution helper © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */

/**
 * Apply the turn's explicit clear-actions decision to the persisted action
 * ledger. A free-text action is not resolved merely because a turn started.
 */
export const resolvePlannedActions = (actions, clearActions) => actions.map((action) => ({
  ...action,
  status: action.status === "planned" && clearActions ? "resolved" : action.status,
}));
