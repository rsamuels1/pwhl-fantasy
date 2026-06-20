import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeWeeklyStorylines, emitWeeklyStorylines } from "../lib/services/storyline-service";
import { DEFAULT_SCORING } from "../lib/scoring";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeMatchup(
  homeScore: number,
  awayScore: number,
  homeId = "team-a",
  awayId = "team-b",
  homeName = "Team A",
  awayName = "Team B"
) {
  return {
    homeScore,
    awayScore,
    homeTeam: { id: homeId, name: homeName },
    awayTeam: { id: awayId, name: awayName },
  };
}

function makeStatLine(
  playerId: string,
  firstName: string,
  lastName: string,
  position: "FORWARD" | "DEFENSE" | "GOALIE",
  goals: number,
  assists: number,
  fantasyTeamId = "team-a",
  teamName = "Team A"
) {
  return {
    playerId,
    goals,
    assists,
    shots: 0,
    plusMinus: 0,
    penaltyMinutes: 0,
    powerPlayPts: 0,
    hits: 0,
    blocks: 0,
    saves: 0,
    goalsAgainst: 0,
    shutout: false,
    win: false,
    player: {
      position,
      firstName,
      lastName,
      rosterEntries: [{ fantasyTeamId, fantasyTeam: { name: teamName } }],
    },
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("computeWeeklyStorylines", () => {
  it("returns closest_match and high_score from 2 matchups", () => {
    const matchups = [
      makeMatchup(120.5, 118.0, "team-a", "team-b", "Team A", "Team B"), // margin 2.5
      makeMatchup(95.0, 80.0, "team-c", "team-d", "Team C", "Team D"),   // margin 15.0
    ];

    const results = computeWeeklyStorylines(matchups, [], DEFAULT_SCORING);

    // closest_match
    const closest = results.find((s) => s.kind === "closest_match");
    expect(closest).toBeDefined();
    expect(closest!.value).toBeCloseTo(2.5);
    expect(closest!.headline).toContain("Team A");
    expect(closest!.headline).toContain("Team B");
    expect(closest!.headline).toContain("2.5");

    // high_score (120.5 is the highest across both matchups)
    const high = results.find((s) => s.kind === "high_score");
    expect(high).toBeDefined();
    expect(high!.value).toBeCloseTo(120.5);
    expect(high!.headline).toContain("Team A");
    expect(high!.headline).toContain("120.5");
  });

  it("identifies away-team winner correctly when away score is higher", () => {
    const matchups = [
      makeMatchup(80.0, 95.0, "team-a", "team-b", "Team A", "Team B"), // away wins
      makeMatchup(70.0, 60.0, "team-c", "team-d", "Team C", "Team D"),
    ];

    const results = computeWeeklyStorylines(matchups, [], DEFAULT_SCORING);
    const closest = results.find((s) => s.kind === "closest_match");

    // margin of second matchup is 10, first is 15 — second is closest
    expect(closest!.value).toBeCloseTo(10);
    expect(closest!.headline).toContain("Team C"); // winner (70 > 60)

    // high score: 95.0 belongs to away team (Team B)
    const high = results.find((s) => s.kind === "high_score");
    expect(high!.value).toBeCloseTo(95.0);
    expect(high!.headline).toContain("Team B");
    expect(high!.teamId).toBe("team-b");
  });

  it("identifies player_standout with highest FP", () => {
    const lines = [
      makeStatLine("p1", "Jamie", "Rattray", "FORWARD", 2, 1),  // 2*3 + 1*2 = 8 FP
      makeStatLine("p2", "Laura", "Stacey", "FORWARD", 1, 3),   // 1*3 + 3*2 = 9 FP
      makeStatLine("p3", "Erin", "Ambrose", "DEFENSE", 0, 2),   // 0*3 + 2*2 = 4 FP
    ];

    const results = computeWeeklyStorylines([], lines, DEFAULT_SCORING);
    const standout = results.find((s) => s.kind === "player_standout");

    expect(standout).toBeDefined();
    expect(standout!.value).toBeCloseTo(9);
    expect(standout!.headline).toContain("Laura");
    expect(standout!.headline).toContain("Stacey");
    expect(standout!.playerId).toBe("p2");
  });

  it("omits closest_match when fewer than 2 matchups", () => {
    const matchups = [makeMatchup(100.0, 90.0)];
    const results = computeWeeklyStorylines(matchups, [], DEFAULT_SCORING);

    expect(results.find((s) => s.kind === "closest_match")).toBeUndefined();
    // high_score still comes through
    expect(results.find((s) => s.kind === "high_score")).toBeDefined();
  });

  it("returns empty array and does not throw when no data", () => {
    const results = computeWeeklyStorylines([], [], DEFAULT_SCORING);
    expect(results).toEqual([]);
  });
});

describe("emitWeeklyStorylines", () => {
  it("skips emitting when a matching event already exists (idempotency)", async () => {
    const emitSpy = vi.fn().mockResolvedValue(undefined);

    // Mock prisma: leagueEvent.findFirst returns an existing row → should NOT call create
    const mockPrisma = {
      fantasyLeague: {
        findUnique: vi.fn().mockResolvedValue({
          scoringSettings: null, // triggers DEFAULT_SCORING
          season: "2025-26",
        }),
      },
      matchup: {
        findMany: vi.fn().mockResolvedValue([
          makeMatchup(110.0, 100.0),
          makeMatchup(90.0, 85.0),
        ]),
      },
      statLine: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      leagueEvent: {
        findFirst: vi.fn().mockResolvedValue({ id: "existing-event" }),
        create: emitSpy,
      },
    };

    await emitWeeklyStorylines(
      "league-1",
      1,
      new Date("2026-01-01"),
      new Date("2026-01-08"),
      mockPrisma as unknown as import("@prisma/client").PrismaClient
    );

    // create should never be called because findFirst returned an existing row
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
