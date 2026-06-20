import { describe, it, expect } from "vitest";
import {
  eligibleSlots,
  validateSlotMove,
  slotCapacity,
  lockTime,
  computeOptimalLineup,
} from "../lib/lineup";
import type { RosterSettings, RosterEntryWithProjection } from "../lib/lineup";

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

describe("computeOptimalLineup", () => {
  const makePlayer = (overrides: Partial<RosterEntryWithProjection> = {}): RosterEntryWithProjection => ({
    playerId: "default",
    position: "FORWARD",
    active: true,
    slot: "BENCH",
    lockedAt: null,
    hasPlayedThisPeriod: false,
    eligibleSlots: ["FORWARD", "UTIL", "BENCH"],
    projectedFp: 0,
    gamesThisPeriod: 0,
    ...overrides,
  });

  it("places locked players in their current slots", () => {
    const roster = [
      makePlayer({ playerId: "p1", slot: "FORWARD", lockedAt: "2025-12-01T00:00:00Z", projectedFp: 10 }),
      makePlayer({ playerId: "p2", slot: "BENCH", projectedFp: 50 }),
    ];
    const result = computeOptimalLineup(roster, SETTINGS);
    // p1 is locked, must stay in FORWARD despite lower projected FP
    expect(result.get("p1")).toBe("FORWARD");
    // p2 should take the highest-value active slot
    expect(result.get("p2")).toBe("FORWARD");
  });

  it("keeps players with hasPlayedThisPeriod in active slots", () => {
    const roster = [
      makePlayer({ playerId: "p1", slot: "FORWARD", hasPlayedThisPeriod: true, projectedFp: 5 }),
      makePlayer({ playerId: "p2", slot: "BENCH", projectedFp: 50 }),
    ];
    const result = computeOptimalLineup(roster, SETTINGS);
    // p1 played this period, stays in active slot
    expect(result.get("p1")).toBe("FORWARD");
    // p2 fills the next FORWARD slot
    expect(result.get("p2")).toBe("FORWARD");
  });

  it("sorts by projected FP descending", () => {
    const roster = [
      makePlayer({ playerId: "p1", position: "FORWARD", projectedFp: 10, gamesThisPeriod: 0, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p2", position: "FORWARD", projectedFp: 50, gamesThisPeriod: 0, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p3", position: "FORWARD", projectedFp: 30, gamesThisPeriod: 0, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p4", position: "FORWARD", projectedFp: 5, gamesThisPeriod: 0, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p5", position: "DEFENSE", projectedFp: 8, gamesThisPeriod: 0, eligibleSlots: ["DEFENSE", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p6", position: "DEFENSE", projectedFp: 7, gamesThisPeriod: 0, eligibleSlots: ["DEFENSE", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p7", position: "GOALIE", projectedFp: 4, gamesThisPeriod: 0, eligibleSlots: ["GOALIE", "BENCH"] }),
    ];
    const result = computeOptimalLineup(roster, SETTINGS);
    // p2 (50 FP) in first FORWARD slot
    expect(result.get("p2")).toBe("FORWARD");
    // p3 (30 FP) in second FORWARD slot
    expect(result.get("p3")).toBe("FORWARD");
    // p1 (10 FP) in third FORWARD slot (fills available capacity)
    expect(result.get("p1")).toBe("FORWARD");
    // p4 (5 FP) goes to UTIL since FORWARD is full
    expect(result.get("p4")).toBe("UTIL");
  });

  it("uses games remaining as a tiebreaker when projected FP is equal", () => {
    const roster = [
      makePlayer({ playerId: "p1", position: "FORWARD", projectedFp: 20, gamesThisPeriod: 0, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p2", position: "FORWARD", projectedFp: 20, gamesThisPeriod: 3, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p3", position: "FORWARD", projectedFp: 5, gamesThisPeriod: 0, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p4", position: "DEFENSE", projectedFp: 10, gamesThisPeriod: 1, eligibleSlots: ["DEFENSE", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p5", position: "DEFENSE", projectedFp: 5, gamesThisPeriod: 0, eligibleSlots: ["DEFENSE", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p6", position: "GOALIE", projectedFp: 8, gamesThisPeriod: 1, eligibleSlots: ["GOALIE", "BENCH"] }),
      makePlayer({ playerId: "p7", position: "FORWARD", projectedFp: 3, gamesThisPeriod: 2, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
    ];
    const result = computeOptimalLineup(roster, SETTINGS);
    // Sort order prioritizes games-remaining first, then by FP desc:
    // Players with games: p2(20,3) > p4(10,1) > p6(8,1) > p7(3,2)
    // Players with 0 games: p1(20,0) > p3(5,0) > p5(5,0)
    // p2 has most FP + games → gets FORWARD slot 1
    expect(result.get("p2")).toBe("FORWARD");
    // p4 has games and good FP → gets DEFENSE slot 1
    expect(result.get("p4")).toBe("DEFENSE");
    // p6 is goalie with games → gets GOALIE slot
    expect(result.get("p6")).toBe("GOALIE");
    // p7 has games remaining (2) even though lower FP → gets FORWARD slot 2
    expect(result.get("p7")).toBe("FORWARD");
    // p1 (20 FP, 0 games) is demoted below p7 due to no games → gets FORWARD slot 3
    expect(result.get("p1")).toBe("FORWARD");
    // p3 (5 FP, 0 games) goes to UTIL since FORWARD is full
    expect(result.get("p3")).toBe("UTIL");
  });

  it("uses games tiebreaker when equal-FP players compete for limited slots", () => {
    // Scenario: Two forwards with equal FP, but only one slot remains.
    // The one with more games should win the tiebreaker.
    const roster = [
      makePlayer({ playerId: "p1", position: "FORWARD", projectedFp: 8, gamesThisPeriod: 0, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p2", position: "FORWARD", projectedFp: 10, gamesThisPeriod: 3, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p3", position: "FORWARD", projectedFp: 8, gamesThisPeriod: 2, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p4", position: "DEFENSE", projectedFp: 15, gamesThisPeriod: 1, eligibleSlots: ["DEFENSE", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p5", position: "DEFENSE", projectedFp: 5, gamesThisPeriod: 0, eligibleSlots: ["DEFENSE", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p6", position: "GOALIE", projectedFp: 12, gamesThisPeriod: 1, eligibleSlots: ["GOALIE", "BENCH"] }),
      makePlayer({ playerId: "p7", position: "FORWARD", projectedFp: 2, gamesThisPeriod: 0, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
    ];
    const result = computeOptimalLineup(roster, SETTINGS);
    // Sort order: p2(10,3) > p3(8,2) > p1(8,0) > p4(15,1) > p6(12,1) > p5(5,0) > p7(2,0)
    // p2 (10 FP, 3 games) gets FORWARD
    expect(result.get("p2")).toBe("FORWARD");
    // p3 (8 FP, 2 games) ranks higher than p1 (8 FP, 0 games) due to games tiebreaker
    expect(result.get("p3")).toBe("FORWARD");
    // p1 still gets FORWARD (fills available capacity), but p3 beat it in the sort order
    expect(result.get("p1")).toBe("FORWARD");
  });

  it("fills all active slots correctly", () => {
    const roster = [
      makePlayer({ playerId: "p1", position: "FORWARD", projectedFp: 10, gamesThisPeriod: 1, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p2", position: "FORWARD", projectedFp: 9, gamesThisPeriod: 1, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p3", position: "FORWARD", projectedFp: 8, gamesThisPeriod: 1, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p4", position: "DEFENSE", projectedFp: 7, gamesThisPeriod: 1, eligibleSlots: ["DEFENSE", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p5", position: "DEFENSE", projectedFp: 6, gamesThisPeriod: 1, eligibleSlots: ["DEFENSE", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p6", position: "GOALIE", projectedFp: 5, gamesThisPeriod: 1, eligibleSlots: ["GOALIE", "BENCH"] }),
      makePlayer({ playerId: "p7", position: "FORWARD", projectedFp: 4, gamesThisPeriod: 1, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p8", position: "FORWARD", projectedFp: 3, gamesThisPeriod: 1, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p9", position: "FORWARD", projectedFp: 2, gamesThisPeriod: 0, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
    ];
    const result = computeOptimalLineup(roster, SETTINGS);
    // Expected: 3F + 2D + 1G + 1UTIL = 7 active
    const activeSlots = ["FORWARD", "DEFENSE", "GOALIE", "UTIL"];
    const active = [...result.entries()].filter(([, slot]) => activeSlots.includes(slot));
    expect(active).toHaveLength(7);
    // p1, p2, p3 in FORWARD (top 3 FPs)
    expect(result.get("p1")).toBe("FORWARD");
    expect(result.get("p2")).toBe("FORWARD");
    expect(result.get("p3")).toBe("FORWARD");
    // p4, p5 in DEFENSE (next 2)
    expect(result.get("p4")).toBe("DEFENSE");
    expect(result.get("p5")).toBe("DEFENSE");
    // p6 in GOALIE
    expect(result.get("p6")).toBe("GOALIE");
    // p7 in UTIL (next highest, skater eligible)
    expect(result.get("p7")).toBe("UTIL");
    // p8, p9 on bench (lowest FP)
    expect(result.get("p8")).toBe("BENCH");
    expect(result.get("p9")).toBe("BENCH");
  });

  it("handles inactive players correctly", () => {
    const roster = [
      makePlayer({ playerId: "p1", position: "FORWARD", active: true, projectedFp: 10, gamesThisPeriod: 1, eligibleSlots: ["FORWARD", "UTIL", "BENCH"] }),
      makePlayer({ playerId: "p2", position: "FORWARD", active: false, projectedFp: 50, gamesThisPeriod: 0, eligibleSlots: ["BENCH", "IR"] }),
    ];
    const result = computeOptimalLineup(roster, SETTINGS);
    // p1 (active) gets the starting slot
    expect(result.get("p1")).toBe("FORWARD");
    // p2 (inactive) despite high FP cannot play active slots
    expect(result.get("p2")).toMatch(/BENCH|IR/);
  });
});
