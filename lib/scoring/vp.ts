// lib/scoring/vp.ts
// Model A VP scoring:
//   Win matchup   = 2 VP
//   Tie matchup   = 1 VP each
//   1st place score in league = +2 VP
//   2nd place score in league = +1 VP

import type { PrismaClient } from "@prisma/client";
import type { ScoringPeriod } from "./periods";
import { computeAllTeamScores } from "./matchups";
import type { ScoringSettings } from "./index";

export const VP_WIN = 2;
export const VP_TIE = 1;
export const VP_RANK_1 = 2;
export const VP_RANK_2 = 1;

export interface VpWeekResult {
  score: number;
  matchupVP: number;
  rankVP: number;
  totalVP: number;
}

// Compute VP for all teams in a week given their scores and matchup pairings.
// Pure function — no IO.
export function computeVpForWeek(
  teamScores: Map<string, number>,
  matchupPairs: Array<{ homeTeamId: string; awayTeamId: string }>
): Map<string, VpWeekResult> {
  const results = new Map<string, VpWeekResult>();

  // Initialise all teams (including those without a pair this week)
  for (const [teamId, score] of teamScores) {
    results.set(teamId, { score, matchupVP: 0, rankVP: 0, totalVP: 0 });
  }

  // Matchup VP — win = 2, tie = 1 each, loss = 0
  for (const { homeTeamId, awayTeamId } of matchupPairs) {
    const home = teamScores.get(homeTeamId) ?? 0;
    const away = teamScores.get(awayTeamId) ?? 0;
    const homeRow = results.get(homeTeamId);
    const awayRow = results.get(awayTeamId);
    if (!homeRow || !awayRow) continue;

    if (home > away) {
      homeRow.matchupVP += VP_WIN;
    } else if (away > home) {
      awayRow.matchupVP += VP_WIN;
    } else {
      homeRow.matchupVP += VP_TIE;
      awayRow.matchupVP += VP_TIE;
    }
  }

  // Rank VP — sort unique scores to find 1st and 2nd place
  const sorted = [...teamScores.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    const topScore = sorted[0][1];
    const topTeams = sorted.filter(([, s]) => s === topScore);
    for (const [teamId] of topTeams) {
      const row = results.get(teamId);
      if (row) row.rankVP += VP_RANK_1;
    }

    // 2nd place only exists if there's a unique second score
    if (topTeams.length === 1 && sorted.length > 1) {
      const secondScore = sorted[1][1];
      // All teams tied for 2nd get the bonus
      for (const [teamId, score] of sorted) {
        if (score === secondScore && teamId !== sorted[0][0]) {
          const row = results.get(teamId);
          if (row) row.rankVP += VP_RANK_2;
        }
      }
    }
  }

  // Total VP
  for (const row of results.values()) {
    row.totalVP = row.matchupVP + row.rankVP;
  }

  return results;
}

// Score a full VP week: compute all team scores, derive VP, persist to Matchup rows.
export async function scoreVpWeek(
  leagueId: string,
  week: number,
  period: ScoringPeriod,
  scoringSettings: ScoringSettings,
  prisma: PrismaClient
): Promise<Map<string, VpWeekResult>> {
  const teamScores = await computeAllTeamScores(leagueId, period, scoringSettings, prisma);

  const matchups = await prisma.matchup.findMany({
    where: { leagueId, week, isPlayoff: false },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });

  const vpResults = computeVpForWeek(teamScores, matchups);

  // Persist scores and VP to all matchup rows
  for (const m of matchups) {
    const homeResult = vpResults.get(m.homeTeamId);
    const awayResult = vpResults.get(m.awayTeamId);
    await prisma.matchup.update({
      where: { id: m.id },
      data: {
        homeScore: homeResult?.score ?? null,
        awayScore: awayResult?.score ?? null,
        homeVP: homeResult?.totalVP ?? null,
        awayVP: awayResult?.totalVP ?? null,
      },
    });
  }

  return vpResults;
}

// Compute cumulative VP standings from scored matchup rows.
export interface VpStanding {
  fantasyTeamId: string;
  teamName: string;
  totalVP: number;
  matchupVP: number;
  rankVP: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
}

export function computeVpStandings(
  teams: Array<{ id: string; name: string }>,
  matchups: Array<{
    homeTeamId: string; awayTeamId: string;
    homeScore: number | null; awayScore: number | null;
    homeVP: number | null; awayVP: number | null;
    isPlayoff: boolean;
  }>
): VpStanding[] {
  const byTeam = new Map<string, VpStanding>();
  for (const t of teams) {
    byTeam.set(t.id, {
      fantasyTeamId: t.id, teamName: t.name,
      totalVP: 0, matchupVP: 0, rankVP: 0,
      wins: 0, losses: 0, ties: 0, pointsFor: 0,
    });
  }

  for (const m of matchups) {
    if (m.isPlayoff || m.homeVP === null || m.awayVP === null) continue;
    const home = byTeam.get(m.homeTeamId);
    const away = byTeam.get(m.awayTeamId);
    if (!home || !away) continue;

    home.totalVP += m.homeVP;
    away.totalVP += m.awayVP;
    home.pointsFor += m.homeScore ?? 0;
    away.pointsFor += m.awayScore ?? 0;

    // W-L-T derived from matchup result
    const hs = m.homeScore ?? 0;
    const as = m.awayScore ?? 0;
    if (hs > as) { home.wins++; away.losses++; }
    else if (as > hs) { away.wins++; home.losses++; }
    else { home.ties++; away.ties++; }

    // Split VP into matchup vs rank components
    // matchupVP = VP_WIN (2) if won, VP_TIE (1) if tied, 0 if lost
    const hmVP = hs > as ? VP_WIN : hs === as ? VP_TIE : 0;
    const amVP = as > hs ? VP_WIN : hs === as ? VP_TIE : 0;
    home.matchupVP += hmVP;
    away.matchupVP += amVP;
    home.rankVP += (m.homeVP - hmVP);
    away.rankVP += (m.awayVP - amVP);
  }

  // Pre-compute H2H wins for tiebreaker (spec order: VP → Wins → H2H → Total FP)
  const h2hWins = new Map<string, Map<string, number>>();
  for (const m of matchups) {
    if (m.isPlayoff || m.homeScore === null || m.awayScore === null) continue;
    if (!h2hWins.has(m.homeTeamId)) h2hWins.set(m.homeTeamId, new Map());
    if (!h2hWins.has(m.awayTeamId)) h2hWins.set(m.awayTeamId, new Map());
    const hmId = m.homeTeamId, awId = m.awayTeamId;
    if (m.homeScore > m.awayScore) {
      h2hWins.get(hmId)!.set(awId, (h2hWins.get(hmId)!.get(awId) ?? 0) + 1);
    } else if (m.awayScore > m.homeScore) {
      h2hWins.get(awId)!.set(hmId, (h2hWins.get(awId)!.get(hmId) ?? 0) + 1);
    }
  }

  return [...byTeam.values()].sort((a, b) => {
    if (b.totalVP !== a.totalVP) return b.totalVP - a.totalVP;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aVsB = h2hWins.get(a.fantasyTeamId)?.get(b.fantasyTeamId) ?? 0;
    const bVsA = h2hWins.get(b.fantasyTeamId)?.get(a.fantasyTeamId) ?? 0;
    if (aVsB !== bVsA) return bVsA - aVsB;
    return b.pointsFor - a.pointsFor;
  });
}
