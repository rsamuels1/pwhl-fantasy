// lib/lineup.ts
// Pure validation for lineup slot moves. No IO.
// Active roster = any slot NOT in [BENCH, IR] — matches computeTeamScore.

import type { LineupSlot, Position } from "@prisma/client";

export interface RosterEntryWithProjection {
  playerId: string;
  position: "FORWARD" | "DEFENSE" | "GOALIE";
  active: boolean;
  slot: LineupSlot;
  lockedAt: string | null;
  hasPlayedThisPeriod: boolean;
  eligibleSlots: LineupSlot[];
  projectedFp?: number | null;
  gamesThisPeriod?: number | null;
}

export interface RosterSettings {
  forward?: number;
  defense?: number;
  goalie?: number;
  util?: number;
  bench?: number;
  ir?: number;
}

const SLOT_KEY: Record<LineupSlot, keyof RosterSettings> = {
  FORWARD: "forward",
  DEFENSE: "defense",
  GOALIE: "goalie",
  UTIL: "util",
  BENCH: "bench",
  IR: "ir",
};

export function slotCapacity(slot: LineupSlot, settings: RosterSettings): number {
  return settings[SLOT_KEY[slot]] ?? 0;
}

// Slots a player may occupy given their position and active status.
export function eligibleSlots(position: Position, active: boolean): LineupSlot[] {
  if (!active) return ["BENCH", "IR"];
  switch (position) {
    case "FORWARD":  return ["FORWARD", "UTIL", "BENCH"];
    case "DEFENSE":  return ["DEFENSE", "UTIL", "BENCH"];
    case "GOALIE":   return ["GOALIE", "BENCH"];
  }
}

// Returns an error string if moving playerId to targetSlot is invalid, else null.
export function validateSlotMove(
  position: Position,
  active: boolean,
  targetSlot: LineupSlot,
  roster: Array<{ playerId: string; slot: LineupSlot }>,
  movingPlayerId: string,
  settings: RosterSettings
): string | null {
  const eligible = eligibleSlots(position, active);
  if (!eligible.includes(targetSlot)) {
    if (targetSlot === "IR") return "Only inactive players can be placed on IR.";
    if (targetSlot === "UTIL") return "Only skaters (forwards and defensemen) can fill the UTIL slot.";
    return `${position} players cannot be placed in the ${targetSlot} slot.`;
  }

  const cap = slotCapacity(targetSlot, settings);
  const occupied = roster.filter(
    (e) => e.slot === targetSlot && e.playerId !== movingPlayerId
  ).length;
  if (occupied >= cap) {
    return `The ${targetSlot} slot is full (${cap}/${cap}). Move someone out first.`;
  }

  return null;
}

// A player is locked once their team has played any game in the current scoring period.
// When periodStartMs is provided, checks games in [periodStart, now] (weekly lock).
// Without periodStartMs, falls back to today-only lock for backward compat.
// Returns the first matching game start time if locked, else null.
export function lockTime(
  playerTeamId: string | null,
  games: Array<{ homeTeamId: string; awayTeamId: string; startsAt: Date }>,
  nowMs?: number,
  periodStartMs?: number
): Date | null {
  if (!playerTeamId) return null;
  const now = nowMs ? new Date(nowMs) : new Date();
  const windowStart = periodStartMs
    ? new Date(periodStartMs)
    : (() => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d; })();

  for (const g of games) {
    if (g.homeTeamId !== playerTeamId && g.awayTeamId !== playerTeamId) continue;
    if (g.startsAt >= windowStart && g.startsAt <= now) return g.startsAt;
  }
  return null;
}

// Compute optimal lineup slot assignment by projected FP, respecting locks and constraints.
// Returns a Map of playerId → targetSlot showing the optimal arrangement.
// Locked players stay in their current slot. Already-played-this-period active players cannot move to bench.
export function computeOptimalLineup(
  roster: RosterEntryWithProjection[],
  settings: RosterSettings
): Map<string, LineupSlot> {
  const result = new Map<string, LineupSlot>();

  const ACTIVE_SLOTS: LineupSlot[] = ["FORWARD", "DEFENSE", "GOALIE", "UTIL"];

  // Separate roster into categories
  const locked = new Set(roster.filter((p) => p.lockedAt).map((p) => p.playerId));
  const pinnedActive = new Set(
    roster.filter((p) => p.hasPlayedThisPeriod && ACTIVE_SLOTS.includes(p.slot)).map((p) => p.playerId)
  );
  const moveable = roster.filter((p) => !locked.has(p.playerId) && !pinnedActive.has(p.playerId));

  // Sort moveable players descending by projected FP, with games-remaining tiebreaker.
  // Treats null projectedFp differently from 0: null means "no projection data available".
  // When both players have projections, rank by projected FP.
  // When only one has a projection, that one wins.
  // When neither has a projection (between-weeks), fall back to games remaining this period.
  // Players with 0 games remaining are always demoted below those with games available.
  const sorted = moveable.sort((a, b) => {
    // First tier: players with games remaining rank above those without
    const aHasGames = (a.gamesThisPeriod ?? 1) > 0;
    const bHasGames = (b.gamesThisPeriod ?? 1) > 0;
    if (aHasGames !== bHasGames) return aHasGames ? -1 : 1;

    const aFp = a.projectedFp ?? null;
    const bFp = b.projectedFp ?? null;
    if (aFp !== null && bFp !== null) return bFp - aFp;
    if (aFp !== null) return -1;
    if (bFp !== null) return 1;
    // Neither has projections — fall back to games remaining
    const aGames = a.gamesThisPeriod ?? 0;
    const bGames = b.gamesThisPeriod ?? 0;
    if (bGames !== aGames) return bGames - aGames;
    // Final tiebreaker: playerId for determinism
    return a.playerId.localeCompare(b.playerId);
  });

  // Build the list of active seats to fill
  const activeSeats: LineupSlot[] = [];
  for (const slot of ACTIVE_SLOTS) {
    const count = settings[slot.toLowerCase() as keyof RosterSettings] ?? 0;
    for (let i = 0; i < count; i++) activeSeats.push(slot);
  }

  // Pre-fill locked and pinned-active players' slots as occupied
  const occupiedSlots = new Map<LineupSlot, number>();
  for (const slot of ACTIVE_SLOTS) {
    occupiedSlots.set(slot, 0);
  }
  for (const p of roster) {
    if (locked.has(p.playerId) || pinnedActive.has(p.playerId)) {
      if (ACTIVE_SLOTS.includes(p.slot)) {
        occupiedSlots.set(p.slot, (occupiedSlots.get(p.slot) ?? 0) + 1);
        result.set(p.playerId, p.slot);
      }
    }
  }

  // Greedily fill remaining active seats with sorted moveable players
  const placed = new Set(result.keys());
  for (const player of sorted) {
    if (placed.has(player.playerId)) continue;

    // Try to place in an available active slot they're eligible for
    let placed_ = false;
    for (const targetSlot of activeSeats) {
      if (placed_) break;
      if (!player.eligibleSlots.includes(targetSlot)) continue;

      const occupied = occupiedSlots.get(targetSlot) ?? 0;
      const capacity = settings[targetSlot.toLowerCase() as keyof RosterSettings] ?? 0;

      if (occupied < capacity) {
        result.set(player.playerId, targetSlot);
        occupiedSlots.set(targetSlot, occupied + 1);
        placed.add(player.playerId);
        placed_ = true;
      }
    }

    // If not placed in active, put in bench
    if (!placed_) {
      result.set(player.playerId, "BENCH");
      placed.add(player.playerId);
    }
  }

  // All other moveable players go to bench (not placed above)
  for (const player of moveable) {
    if (!placed.has(player.playerId)) {
      result.set(player.playerId, "BENCH");
    }
  }

  return result;
}
