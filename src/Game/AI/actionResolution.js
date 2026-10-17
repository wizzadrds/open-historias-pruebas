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


/**
 * Fallback turns cannot infer that an arbitrary free-text order changed the
 * world. Only a chat order with concrete participants and opening text has a
 * directly representable effect in the fallback engine.
 */
export const selectFallbackChatActions = (actions, limit = Number.POSITIVE_INFINITY) => actions
  .filter((action) =>
    action.kind === "chat"
    && Array.isArray(action.invitees)
    && action.invitees.length > 0
    && typeof action.chatStarter === "string"
    && action.chatStarter.trim().length > 0
  )
  .slice(0, Math.max(0, Number.isFinite(limit) ? Math.floor(limit) : Infinity));

/**
 * Promote an attempted order only when the engine supplies a positive,
 * order-specific postcondition check. Missing, malformed, or negative evidence
 * must leave the order attempted; a generated summary is not evidence.
 *
 * outcomes is keyed by stable action ID and contains:
 * { verified: true, postcondition: string, source: string, observedAt: string }
 */
export const applyVerifiedActionOutcomes = (actions, outcomes = {}) => actions.map((action) => {
  if (action.status !== "attempted" || !action.id) return action;
  const outcome = outcomes[action.id];
  if (
    outcome?.verified !== true
    || typeof outcome.postcondition !== "string"
    || !outcome.postcondition.trim()
    || typeof outcome.source !== "string"
    || !outcome.source.trim()
    || typeof outcome.observedAt !== "string"
    || !outcome.observedAt.trim()
  ) return action;

  return {
    ...action,
    status: "resolved",
    verification: {
      postcondition: outcome.postcondition.trim(),
      source: outcome.source.trim(),
      observedAt: outcome.observedAt.trim(),
    },
  };
});


/**
 * Verify a narrow non-chat postcondition against canonical world snapshots.
 * The order must explicitly carry expectedEffect: { type: "region-owner",
 * regionId, owner }. We require a real owner change to the requested owner;
 * narration, an already-satisfied condition, missing snapshots, and malformed
 * expectations are not evidence. This helper is intentionally not wired into
 * turn resolution until order IDs/expected effects are causally bound to events.
 */
export const verifyPersistedWorldOutcomes = (actions, beforeWorld, afterWorld, observedAt) => {
  if (
    !beforeWorld || typeof beforeWorld !== "object"
    || !afterWorld || typeof afterWorld !== "object"
    || !observedAt
  ) return {};

  const beforeOwners = beforeWorld.regionOwnershipOverrides;
  const afterOwners = afterWorld.regionOwnershipOverrides;
  if (
    !beforeOwners || typeof beforeOwners !== "object" || Array.isArray(beforeOwners)
    || !afterOwners || typeof afterOwners !== "object" || Array.isArray(afterOwners)
  ) return {};

  const outcomes = {};
  for (const action of actions) {
    const effect = action?.expectedEffect;
    if (
      action?.status !== "attempted"
      || !action.id
      || effect?.type !== "region-owner"
      || typeof effect.regionId !== "string" || !effect.regionId.trim()
      || typeof effect.owner !== "string" || !effect.owner.trim()
    ) continue;

    const regionId = effect.regionId.trim();
    const expectedOwner = normalizeEvidenceText(effect.owner);
    const priorOwner = normalizeEvidenceText(beforeOwners[regionId]);
    const observedOwner = normalizeEvidenceText(afterOwners[regionId]);
    if (!observedOwner || observedOwner !== expectedOwner || priorOwner === observedOwner) continue;

    outcomes[action.id] = {
      verified: true,
      postcondition: `Persisted region ${regionId} changed owner to ${effect.owner.trim()}.`,
      source: "canonical-world-state-after-write",
      observedAt: String(observedAt),
    };
  }
  return outcomes;
};


const normalizeEvidenceText = (value) => typeof value === "string"
  ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
  : "";

const participantNames = (chat) => (Array.isArray(chat?.countries) ? chat.countries : [])
  .map((country) => normalizeEvidenceText(typeof country === "string" ? country : country?.name))
  .filter(Boolean)
  .sort();

const hasOpeningText = (chat, text) => (Array.isArray(chat?.messages) ? chat.messages : [])
  .some((message) => normalizeEvidenceText(message?.text) === normalizeEvidenceText(text));

/**
 * Build evidence only from a fresh canonical chat read after persistence.
 * A matching message must be absent from the pre-turn snapshot, and exactly
 * one persisted thread must match the requested participants and opening text.
 */
export const verifyPersistedChatOutcomes = (actions, beforeChats, afterChats, observedAt) => {
  if (!Array.isArray(beforeChats) || !Array.isArray(afterChats) || !observedAt) return {};
  const outcomes = {};
  // A message appended to an existing thread is not evidence that this fallback
  // created the requested new thread. Require stable thread IDs and exclude every
  // thread already present in the exact pre-write snapshot.
  const beforeThreadIds = new Set(beforeChats
    .map((chat) => chat?.id)
    .filter((id) => id !== undefined && id !== null && String(id).trim())
    .map(String));
  // One persisted thread can prove at most one queued order. Without this
  // reservation, duplicate orders could both claim the same canonical effect.
  const claimedThreads = new Set();
  for (const action of actions) {
    if (!action?.id || !Array.isArray(action.invitees) || !action.chatStarter?.trim()) continue;
    const expected = action.invitees.map(normalizeEvidenceText).filter(Boolean).sort();
    if (!expected.length) continue;
    const text = normalizeEvidenceText(action.chatStarter);
    const alreadyExisted = beforeChats.some((chat) =>
      JSON.stringify(participantNames(chat)) === JSON.stringify(expected) && hasOpeningText(chat, text));
    if (alreadyExisted) continue;
    const matches = afterChats.filter((chat) =>
      chat?.id !== undefined
      && chat?.id !== null
      && String(chat.id).trim()
      && !beforeThreadIds.has(String(chat.id))
      && JSON.stringify(participantNames(chat)) === JSON.stringify(expected)
      && hasOpeningText(chat, text));
    if (matches.length !== 1 || claimedThreads.has(matches[0])) continue;
    claimedThreads.add(matches[0]);
    outcomes[action.id] = {
      verified: true,
      postcondition: "The persisted diplomatic thread contains the requested participants and opening message.",
      source: "canonical-chat-state-after-write",
      observedAt: String(observedAt),
    };
  }
  return outcomes;
};
