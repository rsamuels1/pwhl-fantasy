/**
 * Playoff logic tests
 * 
 * Unit tests for:
 * - Bracket generation and seeding
 * - Standing computation
 * - Playoff configuration
 */

import {
  generateBracket,
  seedTeams,
  recordMatchupResult,
  PlayoffSettings,
  SeededTeam,
} from "@/lib/playoffs/brackets";
import { computeStandings } from "@/lib/playoffs/seeding";
import { Matchup } from "@prisma/client";

describe("Playoff Brackets", () => {
  const mockPlayoffSettings: PlayoffSettings = {
    teamsInPlayoff: 6,
    topSeedsWithBye: 2,
    roundDurationPeriods: 2,
    higherSeedWinsTies: true,
  };

  describe("seedTeams", () => {
    it("should seed teams by points (descending)", () => {
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

    it("should assign byes to top seeds", () => {
      const standings = [
        { fantasyTeamId: "team1", teamName: "Team 1", points: 100 },
        { fantasyTeamId: "team2", teamName: "Team 2", points: 90 },
        { fantasyTeamId: "team3", teamName: "Team 3", points: 80 },
        { fantasyTeamId: "team4", teamName: "Team 4", points: 70 },
        { fantasyTeamId: "team5", teamName: "Team 5", points: 60 },
        { fantasyTeamId: "team6", teamName: "Team 6", points: 50 },
      ];

      const seeded = seedTeams(standings, mockPlayoffSettings);

      expect(seeded[0].hasBye).toBe(true); // Seed 1
      expect(seeded[1].hasBye).toBe(true); // Seed 2
      expect(seeded[2].hasBye).toBe(false); // Seed 3
      expect(seeded[5].hasBye).toBe(false); // Seed 6
    });
  });

  describe("generateBracket", () => {
    it("should generate 3-round bracket for 6 teams", () => {
      const seeded: SeededTeam[] = [
        {
          fantasyTeamId: "team1",
          teamName: "Team 1",
          seed: 1,
          points: 100,
          hasBye: true,
        },
        {
          fantasyTeamId: "team2",
          teamName: "Team 2",
          seed: 2,
          points: 90,
          hasBye: true,
        },
        {
          fantasyTeamId: "team3",
          teamName: "Team 3",
          seed: 3,
          points: 80,
          hasBye: false,
        },
        {
          fantasyTeamId: "team4",
          teamName: "Team 4",
          seed: 4,
          points: 70,
          hasBye: false,
        },
        {
          fantasyTeamId: "team5",
          teamName: "Team 5",
          seed: 5,
          points: 60,
          hasBye: false,
        },
        {
          fantasyTeamId: "team6",
          teamName: "Team 6",
          seed: 6,
          points: 50,
          hasBye: false,
        },
      ];

      const bracket = generateBracket("league1", seeded, mockPlayoffSettings);

      expect(bracket.rounds).toHaveLength(3); // 6 teams = 3 rounds
      expect(bracket.rounds[0]).toHaveLength(2); // Round 1: 3v6, 4v5
      expect(bracket.rounds[1]).toHaveLength(2); // Round 2: 1vs(3/6), 2vs(4/5)
      expect(bracket.rounds[2]).toHaveLength(1); // Round 3: Finals
    });

    it("should pair teams correctly in round 1", () => {
      const seeded: SeededTeam[] = [
        {
          fantasyTeamId: "team1",
          teamName: "Team 1",
          seed: 1,
          points: 100,
          hasBye: true,
        },
        {
          fantasyTeamId: "team2",
          teamName: "Team 2",
          seed: 2,
          points: 90,
          hasBye: true,
        },
        {
          fantasyTeamId: "team3",
          teamName: "Team 3",
          seed: 3,
          points: 80,
          hasBye: false,
        },
        {
          fantasyTeamId: "team4",
          teamName: "Team 4",
          seed: 4,
          points: 70,
          hasBye: false,
        },
        {
          fantasyTeamId: "team5",
          teamName: "Team 5",
          seed: 5,
          points: 60,
          hasBye: false,
        },
        {
          fantasyTeamId: "team6",
          teamName: "Team 6",
          seed: 6,
          points: 50,
          hasBye: false,
        },
      ];

      const bracket = generateBracket("league1", seeded, mockPlayoffSettings);
      const round1 = bracket.rounds[0];

      // Should have matchups: 3v4, 5v6 with higher seed as home
      expect(round1).toHaveLength(2);
      expect(round1[0].homeTeam?.seed).toBe(4);
      expect(round1[0].awayTeam?.seed).toBe(3);
      expect(round1[1].homeTeam?.seed).toBe(6);
      expect(round1[1].awayTeam?.seed).toBe(5);
    });
  });

  describe("recordMatchupResult", () => {
    it("should record winner when home team wins", () => {
      const seeded: SeededTeam[] = [
        {
          fantasyTeamId: "team1",
          teamName: "Team 1",
          seed: 1,
          points: 100,
          hasBye: true,
        },
        {
          fantasyTeamId: "team2",
          teamName: "Team 2",
          seed: 2,
          points: 90,
          hasBye: true,
        },
        {
          fantasyTeamId: "team3",
          teamName: "Team 3",
          seed: 3,
          points: 80,
          hasBye: false,
        },
        {
          fantasyTeamId: "team4",
          teamName: "Team 4",
          seed: 4,
          points: 70,
          hasBye: false,
        },
        {
          fantasyTeamId: "team5",
          teamName: "Team 5",
          seed: 5,
          points: 60,
          hasBye: false,
        },
        {
          fantasyTeamId: "team6",
          teamName: "Team 6",
          seed: 6,
          points: 50,
          hasBye: false,
        },
      ];

      let bracket = generateBracket("league1", seeded, mockPlayoffSettings);

      // Record home team win in first matchup (home = seed 4, away = seed 3)
      bracket = recordMatchupResult(
        bracket,
        1,
        1,
        25.5, // home score (seed 4)
        20.0, // away score (seed 3)
        mockPlayoffSettings.higherSeedWinsTies
      );

      // Home team (seed 4) should win since it has higher score
      expect(bracket.rounds[0][0].winner?.seed).toBe(4);
      expect(bracket.rounds[0][0].homeScore).toBe(25.5);
      expect(bracket.rounds[0][0].awayScore).toBe(20.0);
    });

    it("should award win to higher seed on tie", () => {
      const seeded: SeededTeam[] = [
        {
          fantasyTeamId: "team1",
          teamName: "Team 1",
          seed: 1,
          points: 100,
          hasBye: true,
        },
        {
          fantasyTeamId: "team2",
          teamName: "Team 2",
          seed: 2,
          points: 90,
          hasBye: true,
        },
        {
          fantasyTeamId: "team3",
          teamName: "Team 3",
          seed: 3,
          points: 80,
          hasBye: false,
        },
        {
          fantasyTeamId: "team4",
          teamName: "Team 4",
          seed: 4,
          points: 70,
          hasBye: false,
        },
        {
          fantasyTeamId: "team5",
          teamName: "Team 5",
          seed: 5,
          points: 60,
          hasBye: false,
        },
        {
          fantasyTeamId: "team6",
          teamName: "Team 6",
          seed: 6,
          points: 50,
          hasBye: false,
        },
      ];

      let bracket = generateBracket("league1", seeded, mockPlayoffSettings);

      // Record tie (home = seed 4, away = seed 3, higher seed = lower number = 3)
      bracket = recordMatchupResult(bracket, 1, 1, 22.0, 22.0, true);

      // Higher seed (seed 3) should win on tie (lower seed number = higher rank)
      expect(bracket.rounds[0][0].winner?.seed).toBe(3);
    });
  });
});

describe("Standings", () => {
  it("should compute standings from matchups", () => {
    const teams = [
      { id: "team1", name: "Team 1", leagueId: "league1", ownerId: "user1", draftOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: "team2", name: "Team 2", leagueId: "league1", ownerId: "user2", draftOrder: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: "team3", name: "Team 3", leagueId: "league1", ownerId: "user3", draftOrder: 3, createdAt: new Date(), updatedAt: new Date() },
    ];

    const matchups: Matchup[] = [
      {
        id: "m1",
        leagueId: "league1",
        week: 1,
        startsAt: new Date(),
        endsAt: new Date(),
        homeTeamId: "team1",
        awayTeamId: "team2",
        homeScore: 30,
        awayScore: 20,
        homeVP: null,
        awayVP: null,
        isPlayoff: false,
        round: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "m2",
        leagueId: "league1",
        week: 1,
        startsAt: new Date(),
        endsAt: new Date(),
        homeTeamId: "team1",
        awayTeamId: "team3",
        homeScore: 25,
        awayScore: 25,
        homeVP: null,
        awayVP: null,
        isPlayoff: false,
        round: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "m3",
        leagueId: "league1",
        week: 1,
        startsAt: new Date(),
        endsAt: new Date(),
        homeTeamId: "team2",
        awayTeamId: "team3",
        homeScore: 15,
        awayScore: 35,
        homeVP: null,
        awayVP: null,
        isPlayoff: false,
        round: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const standings = computeStandings(teams, matchups);

    expect(standings).toHaveLength(3);
    expect(standings[0].fantasyTeamId).toBe("team3"); // 1.5 points (1 win + 0.5 tie)
    expect(standings[1].fantasyTeamId).toBe("team1"); // 1.5 points (1 win + 0.5 tie)
    expect(standings[2].fantasyTeamId).toBe("team2"); // 0.5 points (0.5 tie)
  });
});
