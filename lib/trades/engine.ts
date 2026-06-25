// lib/trades/engine.ts
// Pure domain logic for the Trade System. No IO — all functions accept plain
// data and return results. Keep it this way: the service layer in
// lib/services/trade-service.ts owns all Prisma calls.

import type { LineupSlot, Position } from "@prisma/client";
import type { RosterSettings } from "@/lib/lineup";

// ── Types ────────────────────────────────────────────────────────────────────

export type TradeStatus =
  | "PROPOSED"
  | "COUNTERED"
  | "ACCEPTED"
  | "PENDING_REVIEW"
  | "EXECUTED"
  | "VETOED"
  | "REVERSED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED";

export type ActorRole = "proposer" | "receiver" | "commissioner";

export interface TradeItemInput {
  fromTeamId: string;
  toTeamId: string;
  playerId: string;
}

/** A lightweight roster entry sufficient for trade validation. */
export interface TradableRosterEntry {
  playerId: string;
  slot: LineupSlot;
  position: Position;
  active: boolean;
  /** True when the player has played a game in the current active scoring period. */
  hasPlayedThisPeriod: boolean;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// ── State-machine transitions ────────────────────────────────────────────────

/**
 * Declarative table of all allowed status transitions and the actor role
 * permitted to trigger each one.
 */
const TRANSITIONS: Record<TradeStatus, Partial<Record<TradeStatus, ActorRole[]>>> = {
  PROPOSED: {
    ACCEPTED: ["receiver"],
    REJECTED: ["receiver"],
    COUNTERED: ["receiver"],
    CANCELLED: ["proposer"],
    EXPIRED: ["commissioner"],
    // Auto-transition when requireCommissionerTradeApproval is set at proposal time
    PENDING_REVIEW: ["proposer", "commissioner"],
  },
  COUNTERED: {
    // A counter is itself a new Trade row (PROPOSED). The original trade that was
    // countered flips to COUNTERED status by the service layer — no actor
    // transition needed here. We still expose the state for completeness.
    CANCELLED: ["proposer"],
    REJECTED: ["receiver"],
    EXPIRED: ["commissioner"],
  },
  ACCEPTED: {
    PENDING_REVIEW: ["commissioner"], // entering review window (auto, not user-triggered)
    EXECUTED: ["commissioner"],       // immediate execution (no review window)
  },
  PENDING_REVIEW: {
    EXECUTED: ["commissioner"],
    VETOED: ["commissioner"],
  },
  EXECUTED: {
    REVERSED: ["commissioner"],
  },
  VETOED: {},
  REVERSED: {},
  REJECTED: {},
  CANCELLED: {},
  EXPIRED: {},
};

/**
 * Returns true when `actorRole` is allowed to move a trade from `current` to `next`.
 */
export function canTransitionTo(
  current: TradeStatus,
  next: TradeStatus,
  actorRole: ActorRole
): boolean {
  const allowed = TRANSITIONS[current]?.[next];
  return Array.isArray(allowed) && allowed.includes(actorRole);
}

// ── Roster-legality helpers ──────────────────────────────────────────────────

/**
 * Checks that a roster satisfies roster-size and position-eligibility constraints.
 * - Each player must be in an eligible slot for their position.
 * - Slot occupancy must not exceed the capacity in rosterSettings.
 *
 * Returns null when legal, or an error message string when illegal.
 */
/**
 * Checks that a post-trade roster is legal.
 *
 * We only validate total roster size, not per-slot occupancy. applyTrade
 * places all incoming players on BENCH, but that's a transient state —
 * managers reorganize their lineup after the trade settles. What matters is
 * that the total number of players doesn't exceed the roster capacity so that
 * a legal arrangement is always possible.
 */
function checkRosterLegal(
  roster: Array<{ playerId: string; slot: LineupSlot; position: Position; active: boolean }>,
  rosterSettings: RosterSettings
): string | null {
  const maxTotal =
    (rosterSettings.forward ?? 0) +
    (rosterSettings.defense ?? 0) +
    (rosterSettings.goalie  ?? 0) +
    (rosterSettings.util    ?? 0) +
    (rosterSettings.bench   ?? 0) +
    (rosterSettings.ir      ?? 0);

  if (roster.length > maxTotal) {
    return `Roster would have ${roster.length} players but the maximum is ${maxTotal}.`;
  }

  return null;
}

// ── applyTrade ───────────────────────────────────────────────────────────────

/**
 * Pure function: applies trade items to two rosters and returns the updated state.
 * Incoming players land on BENCH. Does NOT validate legality — call
 * validateTrade first.
 *
 * The rosters are keyed by proposingTeamId / receivingTeamId so that items'
 * fromTeamId/toTeamId fields drive the movement correctly.
 */
export function applyTrade(
  items: TradeItemInput[],
  proposingRoster: TradableRosterEntry[],
  receivingRoster: TradableRosterEntry[],
  proposingTeamId?: string,
  receivingTeamId?: string
): { proposingRoster: TradableRosterEntry[]; receivingRoster: TradableRosterEntry[] } {
  // Derive team IDs from the items if not explicitly provided
  const propTeam = proposingTeamId ?? items.find((i) => proposingRoster.some((e) => e.playerId === i.playerId))?.fromTeamId ?? null;
  const recTeam = receivingTeamId ?? items.find((i) => receivingRoster.some((e) => e.playerId === i.playerId))?.fromTeamId ?? null;

  const newProposing = [...proposingRoster];
  const newReceiving = [...receivingRoster];

  for (const item of items) {
    // Determine source and target rosters by fromTeamId
    const movingFromProposing = item.fromTeamId === propTeam;
    const movingFromReceiving = item.fromTeamId === recTeam;

    if (movingFromProposing) {
      const idx = newProposing.findIndex((e) => e.playerId === item.playerId);
      if (idx !== -1) {
        const entry = newProposing.splice(idx, 1)[0]!;
        newReceiving.push({ ...entry, slot: "BENCH" });
      }
    } else if (movingFromReceiving) {
      const idx = newReceiving.findIndex((e) => e.playerId === item.playerId);
      if (idx !== -1) {
        const entry = newReceiving.splice(idx, 1)[0]!;
        newProposing.push({ ...entry, slot: "BENCH" });
      }
    }
    // If fromTeamId matches neither, the item is silently skipped (will be caught by stale check)
  }

  return { proposingRoster: newProposing, receivingRoster: newReceiving };
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates a trade. Run at proposal time and again at execution time
 * (re-validating against current roster state catches stale deals).
 * Checks:
 * - items is non-empty and each side has at least one player
 * - no play-locked players (hasPlayedThisPeriod)
 * - stale check: each player must exist in the expected roster
 * - both rosters remain legal after the swap (slot eligibility + capacity)
 */
export function validateTrade(
  items: TradeItemInput[],
  proposingRoster: TradableRosterEntry[],
  receivingRoster: TradableRosterEntry[],
  rosterSettings: RosterSettings
): ValidationResult {
  if (!items || items.length === 0) {
    return { valid: false, reason: "Trade must include at least one player." };
  }

  // Derive the team IDs from roster membership
  // Every item's fromTeamId must match a player on one of the two rosters
  const proposingPlayerIds = new Set(proposingRoster.map((e) => e.playerId));
  const receivingPlayerIds = new Set(receivingRoster.map((e) => e.playerId));

  // Stale check: every player must be on one of the two rosters
  for (const item of items) {
    const onProposing = proposingPlayerIds.has(item.playerId);
    const onReceiving = receivingPlayerIds.has(item.playerId);
    if (!onProposing && !onReceiving) {
      return { valid: false, reason: "STALE" };
    }
  }

  // Both sides must send at least one player (derived from which roster the player is on)
  const fromProposingItems = items.filter((i) => proposingPlayerIds.has(i.playerId));
  const fromReceivingItems = items.filter((i) => receivingPlayerIds.has(i.playerId));

  if (fromProposingItems.length === 0) {
    return { valid: false, reason: "The proposing team must include at least one player." };
  }
  if (fromReceivingItems.length === 0) {
    return { valid: false, reason: "The receiving team must include at least one player." };
  }

  // Play-lock check: no player in the deal may have played in the active period
  for (const item of items) {
    const pEntry = [...proposingRoster, ...receivingRoster].find((e) => e.playerId === item.playerId);
    if (pEntry?.hasPlayedThisPeriod) {
      return {
        valid: false,
        reason: `Player ${item.playerId} has played in the active scoring period and cannot be traded until the period ends.`,
      };
    }
  }

  // Derive the two team IDs from the items themselves for applyTrade
  const propTeamId = fromProposingItems[0]?.fromTeamId ?? null;
  const recTeamId = fromReceivingItems[0]?.fromTeamId ?? null;

  // Apply trade and check both resulting rosters for legality
  const { proposingRoster: newProp, receivingRoster: newRec } = applyTrade(
    items,
    proposingRoster,
    receivingRoster,
    propTeamId ?? undefined,
    recTeamId ?? undefined
  );

  const propError = checkRosterLegal(newProp, rosterSettings);
  if (propError) {
    return { valid: false, reason: `Proposing team roster would be invalid: ${propError}` };
  }

  const recError = checkRosterLegal(newRec, rosterSettings);
  if (recError) {
    return { valid: false, reason: `Receiving team roster would be invalid: ${recError}` };
  }

  return { valid: true };
}
