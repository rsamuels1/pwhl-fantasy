import { describe, it, expect } from "vitest";
import {
  computeVpForWeek,
  computeVpStandings,
  VP_WIN,
  VP_TIE,
  VP_RANK_1,
  VP_RANK_2,
} from "../lib/scoring/vp";

// ---------------------------------------------------------------------------
// computeVpForWeek
// ---------------------------------------------------------------------------

describe("computeVpForWeek — matchup VP", () => {
  it("win awards 2VP, loss awards 0VP", () => {
    const scores = new Map([["home", 50], ["away", 30]]);
    const pairs = [{ homeTeamId: "home", awayTeamId: "away" }];
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("home")?.matchupVP).toBe(VP_WIN);
    expect(res.get("away")?.matchupVP).toBe(0);
  });

  it("tie awards 1VP each", () => {
    const scores = new Map([["a", 40], ["b", 40]]);
    const pairs = [{ homeTeamId: "a", awayTeamId: "b" }];
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("a")?.matchupVP).toBe(VP_TIE);
    expect(res.get("b")?.matchupVP).toBe(VP_TIE);
  });

  it("away win awards 2VP to away team", () => {
    const scores = new Map([["home", 20], ["away", 55]]);
    const pairs = [{ homeTeamId: "home", awayTeamId: "away" }];
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("away")?.matchupVP).toBe(VP_WIN);
    expect(res.get("home")?.matchupVP).toBe(0);
  });
});

describe("computeVpForWeek — rank VP", () => {
  it("sole first place gets +2VP rank bonus", () => {
    const scores = new Map([["a", 80], ["b", 60], ["c", 40]]);
    const pairs = [
      { homeTeamId: "a", awayTeamId: "b" },
      { homeTeamId: "c", awayTeamId: "a" }, // orphan entry, doesn't matter
    ];
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("a")?.rankVP).toBe(VP_RANK_1);
  });

  it("sole second place gets +1VP rank bonus", () => {
    const scores = new Map([["a", 80], ["b", 60], ["c", 40]]);
    const pairs = [{ homeTeamId: "a", awayTeamId: "c" }];
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("b")?.rankVP).toBe(VP_RANK_2);
    expect(res.get("c")?.rankVP).toBe(0);
  });

  it("two teams tied for first each get +2VP, no second-place bonus awarded", () => {
    const scores = new Map([["a", 70], ["b", 70], ["c", 50], ["d", 30]]);
    const pairs = [
      { homeTeamId: "a", awayTeamId: "c" },
      { homeTeamId: "b", awayTeamId: "d" },
    ];
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("a")?.rankVP).toBe(VP_RANK_1);
    expect(res.get("b")?.rankVP).toBe(VP_RANK_1);
    // No second-place bonus since first is tied
    expect(res.get("c")?.rankVP).toBe(0);
    expect(res.get("d")?.rankVP).toBe(0);
  });

  it("three teams tied for first: all get +2VP", () => {
    const scores = new Map([["a", 60], ["b", 60], ["c", 60], ["d", 30]]);
    const pairs = [
      { homeTeamId: "a", awayTeamId: "b" },
      { homeTeamId: "c", awayTeamId: "d" },
    ];
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("a")?.rankVP).toBe(VP_RANK_1);
    expect(res.get("b")?.rankVP).toBe(VP_RANK_1);
    expect(res.get("c")?.rankVP).toBe(VP_RANK_1);
    expect(res.get("d")?.rankVP).toBe(0);
  });

  it("two teams tied for second both get +1VP", () => {
    const scores = new Map([["a", 80], ["b", 50], ["c", 50], ["d", 20]]);
    const pairs = [
      { homeTeamId: "a", awayTeamId: "d" },
      { homeTeamId: "b", awayTeamId: "c" },
    ];
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("a")?.rankVP).toBe(VP_RANK_1);
    expect(res.get("b")?.rankVP).toBe(VP_RANK_2);
    expect(res.get("c")?.rankVP).toBe(VP_RANK_2);
    expect(res.get("d")?.rankVP).toBe(0);
  });

  it("single team (no matchup): gets rank bonus, 0 matchup VP", () => {
    const scores = new Map([["solo", 100]]);
    const res = computeVpForWeek(scores, []);
    const row = res.get("solo");
    expect(row?.rankVP).toBe(VP_RANK_1);
    expect(row?.matchupVP).toBe(0);
    expect(row?.totalVP).toBe(VP_RANK_1);
  });
});

describe("computeVpForWeek — totalVP", () => {
  it("totalVP = matchupVP + rankVP", () => {
    const scores = new Map([["a", 90], ["b", 70]]);
    const pairs = [{ homeTeamId: "a", awayTeamId: "b" }];
    const res = computeVpForWeek(scores, pairs);
    const a = res.get("a")!;
    const b = res.get("b")!;
    expect(a.totalVP).toBe(a.matchupVP + a.rankVP);
    expect(b.totalVP).toBe(b.matchupVP + b.rankVP);
  });

  it("winner who is also first gets 2+2=4VP; loser who is 2nd gets 0+1=1VP", () => {
    // a wins and has highest score → 2 (win) + 2 (rank1) = 4
    // b loses but is sole 2nd → 0 (loss) + 1 (rank2) = 1
    const scores = new Map([["a", 90], ["b", 40]]);
    const pairs = [{ homeTeamId: "a", awayTeamId: "b" }];
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("a")?.totalVP).toBe(VP_WIN + VP_RANK_1); // 4
    expect(res.get("b")?.totalVP).toBe(VP_RANK_2); // 1 (rank only)
  });
});

// ---------------------------------------------------------------------------
// 8-team week simulation
// ---------------------------------------------------------------------------

describe("computeVpForWeek — 8-team week", () => {
  // Scores: a > b > c > d > e > f > g > h (all distinct)
  const scores = new Map([
    ["a", 100], ["b", 80], ["c", 70], ["d", 60],
    ["e", 50], ["f", 40], ["g", 30], ["h", 20],
  ]);
  // Matchups: a vs h (a wins), b vs g (b wins), c vs f (c wins), d vs e (d wins)
  const pairs = [
    { homeTeamId: "a", awayTeamId: "h" },
    { homeTeamId: "b", awayTeamId: "g" },
    { homeTeamId: "c", awayTeamId: "f" },
    { homeTeamId: "d", awayTeamId: "e" },
  ];

  it("winner gets 2VP for win", () => {
    const res = computeVpForWeek(scores, pairs);
    for (const id of ["a", "b", "c", "d"]) {
      expect(res.get(id)?.matchupVP).toBe(VP_WIN);
    }
    for (const id of ["e", "f", "g", "h"]) {
      expect(res.get(id)?.matchupVP).toBe(0);
    }
  });

  it("only team a gets rank bonus (highest score)", () => {
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("a")?.rankVP).toBe(VP_RANK_1);
    expect(res.get("b")?.rankVP).toBe(VP_RANK_2);
    for (const id of ["c", "d", "e", "f", "g", "h"]) {
      expect(res.get(id)?.rankVP).toBe(0);
    }
  });

  it("team a total VP is 4 (2 win + 2 rank1)", () => {
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("a")?.totalVP).toBe(4);
  });

  it("team b total VP is 3 (2 win + 1 rank2)", () => {
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("b")?.totalVP).toBe(3);
  });

  it("team c and d total VP is 2 (2 win + 0 rank)", () => {
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("c")?.totalVP).toBe(2);
    expect(res.get("d")?.totalVP).toBe(2);
  });

  it("losing teams get 0 VP", () => {
    const res = computeVpForWeek(scores, pairs);
    for (const id of ["e", "f", "g", "h"]) {
      expect(res.get(id)?.totalVP).toBe(0);
    }
  });

  it("score stored in result matches input", () => {
    const res = computeVpForWeek(scores, pairs);
    expect(res.get("a")?.score).toBe(100);
    expect(res.get("h")?.score).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// computeVpStandings
// ---------------------------------------------------------------------------

describe("computeVpStandings", () => {
  const teams = [
    { id: "t1", name: "Team 1" },
    { id: "t2", name: "Team 2" },
    { id: "t3", name: "Team 3" },
  ];

  const makeMatchup = (
    homeTeamId: string, awayTeamId: string,
    homeScore: number, awayScore: number,
    homeVP: number, awayVP: number,
    isPlayoff = false
  ) => ({ homeTeamId, awayTeamId, homeScore, awayScore, homeVP, awayVP, isPlayoff });

  it("sorts by totalVP descending", () => {
    const matchups = [
      makeMatchup("t1", "t2", 80, 60, 4, 0),
      makeMatchup("t3", "t1", 70, 90, 0, 2),
    ];
    const standings = computeVpStandings(teams, matchups);
    expect(standings[0].fantasyTeamId).toBe("t1"); // 4+2=6 VP
    expect(standings[1].fantasyTeamId).toBe("t3"); // 0 VP but PF>t2
    expect(standings[2].fantasyTeamId).toBe("t2"); // 0 VP
  });

  it("uses pointsFor as tiebreaker when VP equal", () => {
    // t2 and t3 both have 0 VP, but t3 scored more total points
    const matchups = [
      makeMatchup("t1", "t2", 100, 60, 4, 0),
      makeMatchup("t1", "t3", 90, 70, 4, 0), // t1 plays twice for points context
    ];
    const standings = computeVpStandings(teams, matchups);
    const t2idx = standings.findIndex(s => s.fantasyTeamId === "t2");
    const t3idx = standings.findIndex(s => s.fantasyTeamId === "t3");
    // t3 (70 PF) should rank above t2 (60 PF)
    expect(t3idx).toBeLessThan(t2idx);
  });

  it("excludes playoff matchups from standings", () => {
    const matchups = [
      makeMatchup("t1", "t2", 80, 60, 4, 0, false),   // regular season
      makeMatchup("t2", "t3", 90, 50, 4, 0, true),     // playoff — excluded
    ];
    const standings = computeVpStandings(teams, matchups);
    // t2 regular-season VP = 0; playoff matchup ignored
    const t2 = standings.find(s => s.fantasyTeamId === "t2");
    expect(t2?.totalVP).toBe(0);
    // t3 should also have 0 VP (playoff excluded)
    const t3 = standings.find(s => s.fantasyTeamId === "t3");
    expect(t3?.totalVP).toBe(0);
  });

  it("ignores matchups with null VP (unscored weeks)", () => {
    const matchups = [
      { homeTeamId: "t1", awayTeamId: "t2", homeScore: null, awayScore: null, homeVP: null, awayVP: null, isPlayoff: false },
    ];
    const standings = computeVpStandings(teams, matchups);
    expect(standings.every(s => s.totalVP === 0)).toBe(true);
  });

  it("accumulates VP across multiple weeks correctly", () => {
    const matchups = [
      makeMatchup("t1", "t2", 80, 60, 4, 0),
      makeMatchup("t1", "t3", 70, 50, 4, 0),
    ];
    const standings = computeVpStandings(teams, matchups);
    const t1 = standings.find(s => s.fantasyTeamId === "t1");
    expect(t1?.totalVP).toBe(8);
  });

  it("W-L-T correctly derived from score results", () => {
    const matchups = [
      makeMatchup("t1", "t2", 80, 60, 4, 0),   // t1 wins
      makeMatchup("t1", "t3", 40, 40, 1, 1),   // tie
    ];
    const standings = computeVpStandings(teams, matchups);
    const t1 = standings.find(s => s.fantasyTeamId === "t1");
    expect(t1?.wins).toBe(1);
    expect(t1?.ties).toBe(1);
    expect(t1?.losses).toBe(0);
  });

  it("pointsFor accumulates across weeks", () => {
    const matchups = [
      makeMatchup("t1", "t2", 80, 60, 4, 0),
      makeMatchup("t1", "t3", 70, 50, 4, 0),
    ];
    const standings = computeVpStandings(teams, matchups);
    const t1 = standings.find(s => s.fantasyTeamId === "t1");
    expect(t1?.pointsFor).toBe(150);
  });

  it("returns all teams even if they have no matchups", () => {
    const standings = computeVpStandings(teams, []);
    expect(standings.length).toBe(3);
    expect(standings.every(s => s.totalVP === 0)).toBe(true);
  });

  it("matchupVP and rankVP split correctly", () => {
    // homeVP=4 = win(2) + rank1(2); awayVP=0
    const matchups = [makeMatchup("t1", "t2", 80, 60, 4, 0)];
    const standings = computeVpStandings(teams, matchups);
    const t1 = standings.find(s => s.fantasyTeamId === "t1");
    // matchupVP for t1 should be 2 (won), rankVP should be 2 (4 total - 2 matchup)
    expect(t1?.matchupVP).toBe(2);
    expect(t1?.rankVP).toBe(2);
  });

  it("teamName is preserved from teams array", () => {
    const standings = computeVpStandings(teams, []);
    const t1 = standings.find(s => s.fantasyTeamId === "t1");
    expect(t1?.teamName).toBe("Team 1");
  });
});
