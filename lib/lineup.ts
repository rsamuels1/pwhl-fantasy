// lib/lineup.ts
// Pure validation for lineup slot moves. No IO.
// Active roster = any slot NOT in [BENCH, IR] — matches computeTeamScore.

import type { LineupSlot, Position } from "@prisma/client";

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

// A player is locked once their team's game has started today (UTC day).
// Returns the game start time if locked, else null.
export function lockTime(
  playerTeamId: string | null,
  games: Array<{ homeTeamId: string; awayTeamId: string; startsAt: Date }>
): Date | null {
  if (!playerTeamId) return null;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  for (const g of games) {
    if (g.homeTeamId !== playerTeamId && g.awayTeamId !== playerTeamId) continue;
    if (g.startsAt >= todayStart && g.startsAt <= now) return g.startsAt;
  }
  return null;
}
