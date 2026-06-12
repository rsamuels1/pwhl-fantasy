import { describe, it, expect } from "vitest";
import {
  eligibleSlots,
  validateSlotMove,
  slotCapacity,
  lockTime,
} from "../lib/lineup";
import type { RosterSettings } from "../lib/lineup";

const SETTINGS: RosterSettings = {
  forward: 3, defense: 2, goalie: 1, util: 1, bench: 6, ir: 1,
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
      { playerId: "p4", slot: "FORWARD" as const },
    ];
    // Moving p1 (another forward) to FORWARD — slot already has 3/3
    const err = validateSlotMove("FORWARD", true, "FORWARD", roster, "p1", SETTINGS);
    expect(err).toMatch(/full/i);
  });

  it("does not count the moving player in capacity check", () => {
    // p1 is already in FORWARD slot — moving them to FORWARD again (same slot) should not count themselves
    const roster = [
      { playerId: "p1", slot: "FORWARD" as const },
      { playerId: "p2", slot: "FORWARD" as const },
      { playerId: "p3", slot: "FORWARD" as const },
    ];
    // p1 moving from FORWARD back to FORWARD — they don't count, so only 2 others in slot (under cap of 3)
    const err = validateSlotMove("FORWARD", true, "FORWARD", roster, "p1", SETTINGS);
    expect(err).toBeNull();
  });

  it("allows active forward to BENCH", () => {
    expect(validateSlotMove("FORWARD", true, "BENCH", emptyRoster(), "p1", SETTINGS)).toBeNull();
  });
});

describe("slotCapacity", () => {
  it("returns correct capacities", () => {
    expect(slotCapacity("FORWARD", SETTINGS)).toBe(3);
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

  const NOW = new Date("2025-12-10T18:00:00Z").getTime(); // Wednesday 6pm UTC
  const PERIOD_START = new Date("2025-12-08T09:00:00Z").getTime(); // Monday 9am

  it("returns null when player has no team", () => {
    expect(lockTime(null, [], NOW, PERIOD_START)).toBeNull();
  });

  it("returns null when no games in the period", () => {
    const beforePeriod = new Date("2025-12-07T20:00:00Z");
    expect(lockTime("team1", [makeGame("team1", beforePeriod)], NOW, PERIOD_START)).toBeNull();
  });

  it("locks when team played earlier this period (not today)", () => {
    const monday = new Date("2025-12-08T20:00:00Z"); // Monday game
    const result = lockTime("team1", [makeGame("team1", monday)], NOW, PERIOD_START);
    expect(result).not.toBeNull();
    expect(result?.toISOString()).toBe(monday.toISOString());
  });

  it("locks when team played today in the period", () => {
    const thisAfternoon = new Date("2025-12-10T15:00:00Z");
    const result = lockTime("team1", [makeGame("team1", thisAfternoon)], NOW, PERIOD_START);
    expect(result).not.toBeNull();
  });

  it("returns null for game starting in the future", () => {
    const tomorrow = new Date("2025-12-11T20:00:00Z");
    expect(lockTime("team1", [makeGame("team1", tomorrow)], NOW, PERIOD_START)).toBeNull();
  });

  it("falls back to today-only lock when no periodStartMs provided", () => {
    const now = new Date();
    const nowMs = now.getTime();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const yesterdayGame = new Date(todayStart.getTime() - 3600_000);
    // Game yesterday → should NOT lock (no periodStartMs, today-only mode)
    expect(lockTime("team1", [makeGame("team1", yesterdayGame)], nowMs)).toBeNull();
  });
});
