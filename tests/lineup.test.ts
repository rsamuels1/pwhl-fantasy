import { describe, it, expect } from "vitest";
import {
  eligibleSlots,
  validateSlotMove,
  slotCapacity,
  lockTime,
} from "../lib/lineup";
import type { RosterSettings } from "../lib/lineup";

const SETTINGS: RosterSettings = {
  forward: 2, defense: 2, goalie: 1, util: 1, bench: 6, ir: 1,
};

describe("eligibleSlots", () => {
  it("forward can play FORWARD, UTIL, BENCH", () => {
    expect(eligibleSlots("FORWARD", true)).toEqual(["FORWARD", "UTIL", "BENCH"]);
  });
  it("defense can play DEFENSE, UTIL, BENCH", () => {
    expect(eligibleSlots("DEFENSE", true)).toEqual(["DEFENSE", "UTIL", "BENCH"]);
  });
  it("goalie can play GOALIE, BENCH", () => {
    expect(eligibleSlots("GOALIE", true)).toEqual(["GOALIE", "BENCH"]);
  });
  it("inactive player can only play BENCH, IR", () => {
    expect(eligibleSlots("FORWARD", false)).toEqual(["BENCH", "IR"]);
    expect(eligibleSlots("GOALIE", false)).toEqual(["BENCH", "IR"]);
  });
});

describe("validateSlotMove", () => {
  const emptyRoster = () => [
    { playerId: "p1", slot: "BENCH" as const },
  ];

  it("allows forward to FORWARD slot when empty", () => {
    expect(validateSlotMove("FORWARD", true, "FORWARD", emptyRoster(), "p1", SETTINGS)).toBeNull();
  });

  it("rejects goalie to UTIL slot", () => {
    const err = validateSlotMove("GOALIE", true, "UTIL", emptyRoster(), "p1", SETTINGS);
    expect(err).toMatch(/UTIL/);
  });

  it("rejects forward to IR when active", () => {
    const err = validateSlotMove("FORWARD", true, "IR", emptyRoster(), "p1", SETTINGS);
    expect(err).toMatch(/inactive/i);
  });

  it("allows inactive player to IR", () => {
    expect(validateSlotMove("FORWARD", false, "IR", emptyRoster(), "p1", SETTINGS)).toBeNull();
  });

  it("rejects when slot is full", () => {
    const roster = [
      { playerId: "p1", slot: "BENCH" as const },
      { playerId: "p2", slot: "FORWARD" as const },
      { playerId: "p3", slot: "FORWARD" as const },
    ];
    // Moving p1 (another forward) to FORWARD — slot already has 2/2
    const err = validateSlotMove("FORWARD", true, "FORWARD", roster, "p1", SETTINGS);
    expect(err).toMatch(/full/i);
  });

  it("does not count the moving player in capacity check", () => {
    // p1 is already in FORWARD slot — moving them to FORWARD again (same slot) should not count themselves
    const roster = [
      { playerId: "p1", slot: "FORWARD" as const },
      { playerId: "p2", slot: "FORWARD" as const },
    ];
    // p1 moving from FORWARD back to FORWARD — they don't count, so only 1 other in slot
    const err = validateSlotMove("FORWARD", true, "FORWARD", roster, "p1", SETTINGS);
    expect(err).toBeNull();
  });

  it("allows active forward to BENCH", () => {
    expect(validateSlotMove("FORWARD", true, "BENCH", emptyRoster(), "p1", SETTINGS)).toBeNull();
  });
});

describe("slotCapacity", () => {
  it("returns correct capacities", () => {
    expect(slotCapacity("FORWARD", SETTINGS)).toBe(2);
    expect(slotCapacity("DEFENSE", SETTINGS)).toBe(2);
    expect(slotCapacity("GOALIE", SETTINGS)).toBe(1);
    expect(slotCapacity("UTIL", SETTINGS)).toBe(1);
    expect(slotCapacity("BENCH", SETTINGS)).toBe(6);
    expect(slotCapacity("IR", SETTINGS)).toBe(1);
  });

  it("returns 0 for missing keys", () => {
    expect(slotCapacity("UTIL", {})).toBe(0);
  });
});

describe("lockTime", () => {
  const makeGame = (teamId: string, startsAt: Date) => ({
    homeTeamId: teamId,
    awayTeamId: "other",
    startsAt,
  });

  it("returns null when no games today", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(lockTime("team1", [makeGame("team1", yesterday)])).toBeNull();
  });

  it("returns null when player has no team", () => {
    expect(lockTime(null, [])).toBeNull();
  });

  it("returns lock time for game started today", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    // Ensure it's still today (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    if (oneHourAgo >= todayStart) {
      const result = lockTime("team1", [makeGame("team1", oneHourAgo)]);
      expect(result).not.toBeNull();
    }
  });

  it("returns null for game starting in the future", () => {
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
    expect(lockTime("team1", [makeGame("team1", inOneHour)])).toBeNull();
  });
});
