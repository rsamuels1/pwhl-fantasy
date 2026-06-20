/**
 * Playoff logic tests
 *
 * Unit tests for:
 * - Bracket generation and seeding
 * - Standing computation
 * - Playoff configuration
 */

import { describe, it, expect } from "vitest";
import {
  generateBracket,
  seedTeams,
  recordMatchupResult,
  PlayoffSettings,
  SeededTeam,
} from "@/lib/playoffs/brackets";
import { computeStandings, computeRace } from "@/lib/playoffs/seeding";
import { computeVpStandings } from "@/lib/scoring/vp";
import { Matchup } from "@prisma/client";

// ---------------------------------------------------------------------------
// 6-team / 2-bye bracket (kept for regression coverage)
// ---------------------------------------------------------------------------

describe("Playoff Brackets — 6 teams, 2 byes", () => {
  const mockPlayoffSettings: PlayoffSettings = {
    teamsInPlayoff: 6,
    topSeedsWithBye: 2,
    roundDurationPeriods: 2,
    higherSeedWinsTies: true,
  };

  const sixTeamSeeded: SeededTeam[] = [
    { fantasyTeamId: "team1", teamName: "Team 1", seed: 1, points: 100, hasBye: true },
    { fantasyTeamId: "team2", teamName: "Team 2", seed: 2, points: 90,  hasBye: true },
    { fantasyTeamId: "team3", teamName: "Team 3", seed: 3, points: 80,  hasBye: false },
    { fantasyTeamId: "team4", teamName: "Team 4", seed: 4, points: 70,  hasBye: false },
    { fantasyTeamId: "team5", teamName: "Team 5", seed: 5, points: 60,  hasBye: false },
    { fantasyTeamId: "team6", teamName: "Team 6", seed: 6, points: 50,  hasBye: false },
  ];

  describe("seedTeams", () => {
    it("seeds teams by points descending", () => {
      const standings = [
        { fantasyTeamId: "team1", teamName: "Team 1", points: 100 },
        { fantasyTeamId: "team2", teamName: "Team 2", points: 90 },
        { fantasyTeamId: "team3", teamName: "Team 3", points: 80 },
        { fantasyTeamId: "team4", teamName: "Team 4", points: 70 },
        { fantasyTeamId: "team5", teamName: "Team 5", points: 60 },
        { fantasyTeamId: "team6", teamName: "Team 6", points: 50 },
      ];
      const seeded = seedTeams(standings, mockPlayoffSettings);
      expect(seeded).toHaveLength(6);
      expect(seeded[0].seed).toBe(1);
      expect(seeded[0].fantasyTeamId).toBe("team1");
      expect(seeded[5].seed).toBe(6);
      expect(seeded[5].fantasyTeamId).toBe("team6");
    });

    it("assigns byes to top 2 seeds only", () => {
      const standings = Array.from({ length: 6 }, (_, i) => ({
        fantasyTeamId: `team${i + 1}`, teamName: `Team ${i + 1}`, points: 100 - i * 10,
      }));
      const seeded = seedTeams(standings, mockPlayoffSettings);
      expect(seeded[0].hasBye).toBe(true);
      expect(seeded[1].hasBye).toBe(true);
      expect(seeded[2].hasBye).toBe(false);
      expect(seeded[5].hasBye).toBe(false);
    });
  });

  describe("generateBracket", () => {
    it("generates 3-round bracket for 6 teams with 2 byes", () => {
      const bracket = generateBracket("league1", sixTeamSeeded, mockPlayoffSettings);
      expect(bracket.rounds).toHaveLength(3);
      expect(bracket.rounds[0]).toHaveLength(2); // Round 1: 3v6, 4v5
      expect(bracket.rounds[1]).toHaveLength(2); // Round 2: 1v(3/6 winner), 2v(4/5 winner)
      expect(bracket.rounds[2]).toHaveLength(1); // Finals
    });

    it("pairs best-vs-worst in round 1 (3v6, 4v5)", () => {
      const bracket = generateBracket("league1", sixTeamSeeded, mockPlayoffSettings);
      const round1 = bracket.rounds[0];
      expect(round1).toHaveLength(2);
      // Matchup 1: seed3 (away/better) vs seed6 (home/worse)
      expect(round1[0].awayTeam?.seed).toBe(3);
      expect(round1[0].homeTeam?.seed).toBe(6);
      // Matchup 2: seed4 (away/better) vs seed5 (home/worse)
      expect(round1[1].awayTeam?.seed).toBe(4);
      expect(round1[1].homeTeam?.seed).toBe(5);
    });
  });

  describe("recordMatchupResult", () => {
    it("records winner when home team wins (seed6 over seed3)", () => {
      let bracket = generateBracket("league1", sixTeamSeeded, mockPlayoffSettings);
      // home=seed6, away=seed3; home scores higher
      bracket = recordMatchupResult(bracket, 1, 1, 25.5, 20.0, mockPlayoffSettings.higherSeedWinsTies);
      expect(bracket.rounds[0][0].winner?.seed).toBe(6);
      expect(bracket.rounds[0][0].homeScore).toBe(25.5);
      expect(bracket.rounds[0][0].awayScore).toBe(20.0);
    });

    it("awards win to higher seed (seed3) on tie", () => {
      let bracket = generateBracket("league1", sixTeamSeeded, mockPlayoffSettings);
      // home=seed6, away=seed3; tie → lower seed number (seed3) wins
      bracket = recordMatchupResult(bracket, 1, 1, 22.0, 22.0, true);
      expect(bracket.rounds[0][0].winner?.seed).toBe(3);
    });
  });
});

// ---------------------------------------------------------------------------
// 4-team / 0-bye bracket (new default format)
// ---------------------------------------------------------------------------

describe("Playoff Brackets — 4 teams, 0 byes (default format)", () => {
  const settings4: PlayoffSettings = {
    teamsInPlayoff: 4,
    topSeedsWithBye: 0,
    roundDurationPeriods: 2,
    higherSeedWinsTies: true,
  };

  const fourTeamSeeded: SeededTeam[] = [
    { fantasyTeamId: "t1", teamName: "Alpha",   seed: 1, points: 40, hasBye: false },
    { fantasyTeamId: "t2", teamName: "Bravo",   seed: 2, points: 30, hasBye: false },
    { fantasyTeamId: "t3", teamName: "Charlie", seed: 3, points: 20, hasBye: false },
    { fantasyTeamId: "t4", teamName: "Delta",   seed: 4, points: 10, hasBye: false },
  ];

  describe("seedTeams", () => {
    it("assigns no byes when topSeedsWithBye=0", () => {
      const standings = fourTeamSeeded.map(s => ({
        fantasyTeamId: s.fantasyTeamId, teamName: s.teamName, points: s.points,
      }));
      const seeded = seedTeams(standings, settings4);
      expect(seeded.every(s => s.hasBye === false)).toBe(true);
    });

    it("seeds top 4 teams from standings", () => {
      const standings = [
        { fantasyTeamId: "t1", teamName: "Alpha",   points: 40 },
        { fantasyTeamId: "t2", teamName: "Bravo",   points: 30 },
        { fantasyTeamId: "t3", teamName: "Charlie", points: 20 },
        { fantasyTeamId: "t4", teamName: "Delta",   points: 10 },
        { fantasyTeamId: "t5", teamName: "Extra",   points: 5  }, // should be excluded
      ];
      const seeded = seedTeams(standings, settings4);
      expect(seeded).toHaveLength(4);
      expect(seeded.find(s => s.fantasyTeamId === "t5")).toBeUndefined();
    });
  });

  describe("generateBracket", () => {
    it("produces exactly 2 rounds (semis + finals)", () => {
      const bracket = generateBracket("league1", fourTeamSeeded, settings4);
      expect(bracket.rounds).toHaveLength(2);
    });

    it("round 1 has exactly 2 matchups", () => {
      const bracket = generateBracket("league1", fourTeamSeeded, settings4);
      expect(bracket.rounds[0]).toHaveLength(2);
    });

    it("round 1 matchups are seed1 vs seed4 and seed2 vs seed3", () => {
      const bracket = generateBracket("league1", fourTeamSeeded, settings4);
      const round1 = bracket.rounds[0];

      // Matchup 1: seed1 (away/better) vs seed4 (home/worse)
      expect(round1[0].awayTeam?.seed).toBe(1);
      expect(round1[0].homeTeam?.seed).toBe(4);

      // Matchup 2: seed2 (away/better) vs seed3 (home/worse)
      expect(round1[1].awayTeam?.seed).toBe(2);
      expect(round1[1].homeTeam?.seed).toBe(3);
    });

    it("finals round has 1 matchup with no teams yet", () => {
      const bracket = generateBracket("league1", fourTeamSeeded, settings4);
      expect(bracket.rounds[1]).toHaveLength(1);
      expect(bracket.rounds[1][0].homeTeam).toBeNull();
      expect(bracket.rounds[1][0].awayTeam).toBeNull();
    });
  });

  describe("recordMatchupResult", () => {
    it("higher seed (seed1) wins tie-breaker over seed4", () => {
      let bracket = generateBracket("league1", fourTeamSeeded, settings4);
      // Matchup 1: home=seed4, away=seed1; tie → seed1 wins
      bracket = recordMatchupResult(bracket, 1, 1, 35.0, 35.0, true);
      expect(bracket.rounds[0][0].winner?.seed).toBe(1);
    });

    it("upset: home team (seed4) can win when they score more", () => {
      let bracket = generateBracket("league1", fourTeamSeeded, settings4);
      bracket = recordMatchupResult(bracket, 1, 1, 50.0, 20.0, true);
      // home=seed4 scored more → seed4 wins
      expect(bracket.rounds[0][0].winner?.seed).toBe(4);
    });

    it("away team (seed2) wins matchup 2 when scoring more", () => {
      let bracket = generateBracket("league1", fourTeamSeeded, settings4);
      bracket = recordMatchupResult(bracket, 1, 2, 25.0, 40.0, true);
      // home=seed3 (25), away=seed2 (40) → away (seed2) wins
      expect(bracket.rounds[0][1].winner?.seed).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// VP-based seeding (the new authoritative source)
// ---------------------------------------------------------------------------

describe("VP-based playoff seeding", () => {
  const settings4: PlayoffSettings = {
    teamsInPlayoff: 4, topSeedsWithBye: 0,
    roundDurationPeriods: 2, higherSeedWinsTies: true,
  };

  const teams = [
    { id: "t1", name: "Alpha" },
    { id: "t2", name: "Bravo" },
    { id: "t3", name: "Charlie" },
    { id: "t4", name: "Delta" },
  ];

  const makeMatchup = (
    homeTeamId: string, awayTeamId: string,
    homeScore: number, awayScore: number,
    homeVP: number, awayVP: number,
  ) => ({ homeTeamId, awayTeamId, homeScore, awayScore, homeVP, awayVP, isPlayoff: false });

  it("highest-VP team gets seed 1", () => {
    const matchups = [
      makeMatchup("t1", "t2", 80, 60, 4, 0),
      makeMatchup("t3", "t4", 70, 50, 4, 0),
      makeMatchup("t1", "t3", 90, 70, 4, 0),
    ];
    const vpStandings = computeVpStandings(teams, matchups);
    const seeded = seedTeams(
      vpStandings.map(s => ({ fantasyTeamId: s.fantasyTeamId, teamName: s.teamName, points: s.totalVP })),
      settings4
    );
    expect(seeded[0].fantasyTeamId).toBe("t1"); // most VP
    expect(seeded[0].seed).toBe(1);
  });

  it("produces a valid 1v4 / 2v3 bracket from VP standings", () => {
    const matchups = [
      makeMatchup("t1", "t4", 80, 20, 4, 0),
      makeMatchup("t2", "t3", 70, 40, 4, 0),
    ];
    const vpStandings = computeVpStandings(teams, matchups);
    const seeded = seedTeams(
      vpStandings.map(s => ({ fantasyTeamId: s.fantasyTeamId, teamName: s.teamName, points: s.totalVP })),
      settings4
    );
    const bracket = generateBracket("league1", seeded, settings4);
    const round1 = bracket.rounds[0];
    // Higher VP = seed1 (away), lower VP = seed4 (home)
    expect(round1[0].awayTeam?.seed).toBe(1);
    expect(round1[0].homeTeam?.seed).toBe(4);
    expect(round1[1].awayTeam?.seed).toBe(2);
    expect(round1[1].homeTeam?.seed).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Standings (legacy W-L-T function — kept for regression)
// ---------------------------------------------------------------------------

describe("Standings (W-L-T)", () => {
  it("computes standings from matchup results", () => {
    const teams = [
      { id: "team1", name: "Team 1", leagueId: "league1", ownerId: "user1", draftOrder: 1, isBot: false, createdAt: new Date(), updatedAt: new Date() },
      { id: "team2", name: "Team 2", leagueId: "league1", ownerId: "user2", draftOrder: 2, isBot: false, createdAt: new Date(), updatedAt: new Date() },
      { id: "team3", name: "Team 3", leagueId: "league1", ownerId: "user3", draftOrder: 3, isBot: false, createdAt: new Date(), updatedAt: new Date() },
    ];

    const matchups: Matchup[] = [
      {
        id: "m1", leagueId: "league1", week: 1,
        startsAt: new Date(), endsAt: new Date(),
        homeTeamId: "team1", awayTeamId: "team2",
        homeScore: 30, awayScore: 20,
        homeVP: null, awayVP: null, isPlayoff: false, round: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: "m2", leagueId: "league1", week: 1,
        startsAt: new Date(), endsAt: new Date(),
        homeTeamId: "team1", awayTeamId: "team3",
        homeScore: 25, awayScore: 25,
        homeVP: null, awayVP: null, isPlayoff: false, round: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: "m3", leagueId: "league1", week: 1,
        startsAt: new Date(), endsAt: new Date(),
        homeTeamId: "team2", awayTeamId: "team3",
        homeScore: 15, awayScore: 35,
        homeVP: null, awayVP: null, isPlayoff: false, round: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ];

    const standings = computeStandings(teams, matchups);
    expect(standings).toHaveLength(3);
    // team3: 1W+0.5T=1.5pts, team1: 1W+0.5T=1.5pts, team2: 0.5T=0.5pts
    expect(standings[2].fantasyTeamId).toBe("team2");
  });
});

// ---------------------------------------------------------------------------
// computeRace ceiling with VP mode (maxPointsPerWeek = 4)
// ---------------------------------------------------------------------------

describe("computeRace with VP mode", () => {
  it("computes race ceiling correctly with maxPointsPerWeek=4", () => {
    // 4-team race, cutoff at 2 (top 2 make playoffs). 3 total weeks (1 unplayed).
    // t1 at 20 VP (2 weeks played), t2 at 18 VP (2 weeks played).
    // t3 at 14 VP (2 weeks played, 1 left): max 14 + 1*4 = 18 VP (ties line team).
    // t4 at 8 VP (1 week played, 2 left): max 8 + 2*4 = 16 VP (below line, so "out").
    const standings = [
      { fantasyTeamId: "t1", points: 20, wins: 5, losses: 0, ties: 1 },
      { fantasyTeamId: "t2", points: 18, wins: 4, losses: 1, ties: 1 }, // playoff line
      { fantasyTeamId: "t3", points: 14, wins: 3, losses: 2, ties: 1 }, // 4 behind, 1 week left
      { fantasyTeamId: "t4", points: 8, wins: 2, losses: 3, ties: 0 },   // 10 behind, 2 weeks left
    ];
    const matchups: Matchup[] = [
      // Week 1
      { id: "m1", leagueId: "league1", week: 1, startsAt: new Date(), endsAt: new Date(),
        homeTeamId: "t1", awayTeamId: "t2", homeScore: 100, awayScore: 90, homeVP: 2, awayVP: 0, isPlayoff: false, round: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "m2", leagueId: "league1", week: 1, startsAt: new Date(), endsAt: new Date(),
        homeTeamId: "t3", awayTeamId: "t4", homeScore: 85, awayScore: 75, homeVP: 2, awayVP: 0, isPlayoff: false, round: null, createdAt: new Date(), updatedAt: new Date() },
      // Week 2
      { id: "m3", leagueId: "league1", week: 2, startsAt: new Date(), endsAt: new Date(),
        homeTeamId: "t1", awayTeamId: "t3", homeScore: 105, awayScore: 80, homeVP: 2, awayVP: 0, isPlayoff: false, round: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "m4", leagueId: "league1", week: 2, startsAt: new Date(), endsAt: new Date(),
        homeTeamId: "t2", awayTeamId: "t4", homeScore: 95, awayScore: 70, homeVP: 2, awayVP: 0, isPlayoff: false, round: null, createdAt: new Date(), updatedAt: new Date() },
      // Week 3 — unplayed
      { id: "m5", leagueId: "league1", week: 3, startsAt: new Date(), endsAt: new Date(),
        homeTeamId: "t1", awayTeamId: "t4", homeScore: null, awayScore: null, homeVP: null, awayVP: null, isPlayoff: false, round: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const race = computeRace(standings, matchups, 2, 4); // cutoff=2, VP mode
    // t3: max = 14 + 1*4 = 18, lineTeam.points = 18, so 18 < 18 is false → "out"
    expect(race.get("t3")?.status).toBe("out");
    // t4: max = 8 + 2*4 = 16, lineTeam.points = 18, so 16 < 18 is true → "eliminated"
    expect(race.get("t4")?.status).toBe("eliminated");
  });
});
