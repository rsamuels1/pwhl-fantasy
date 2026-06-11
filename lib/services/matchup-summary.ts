// Lightweight matchup summary for the Fantasy Home dashboard.
// Returns only what a team card needs: current week, opponent, scores, win probability.
// Driven by nowMs (sim-date aware) — uses getSeasonState to find the "current" period
// rather than querying for homeScore: null, so dev simulation works correctly.

import type { PrismaClient } from "@prisma/client";
import { getSeasonState } from "@/lib/season";
import { computeTeamScore } from "@/lib/scoring/matchups";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { winProbability } from "@/lib/projections";

export interface MatchupQuickSummary {
  week: number;
  status: "active" | "upcoming" | "complete";
  opponentName: string;
  myScore: number;
  oppScore: number;
  winProbability: number;
  startsAt: Date;
}

export async function getMatchupQuickSummary(
  teamId: string,
  leagueId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<MatchupQuickSummary | null> {
  const state = await getSeasonState(leagueId, nowMs, prisma);
  if (state.periods.length === 0) return null;

  // Pick the most relevant period based on nowMs.
  // Priority: ACTIVE > SCORING_PENDING > UPCOMING > most-recent COMPLETE
  // This ordering ensures an upcoming week is shown over last week's result,
  // and last week's result is shown when there is nothing else.
  const { periods } = state;
  const active   = periods.find((p) => p.status === "ACTIVE");
  const pending  = periods.find((p) => p.status === "SCORING_PENDING");
  const upcoming = periods.find((p) => p.status === "UPCOMING");
  const complete = [...periods].reverse().find((p) => p.status === "COMPLETE");

  const current = active ?? pending ?? upcoming ?? complete;
  if (!current) return null;

  const { period } = current;

  const matchup = await prisma.matchup.findFirst({
    where: {
      leagueId,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      week: period.week,
      isPlayoff: false,
    },
    include: { homeTeam: true, awayTeam: true },
  });

  if (!matchup) return null;

  const iHome = matchup.homeTeamId === teamId;
  const opponentName = iHome ? matchup.awayTeam.name : matchup.homeTeam.name;
  const opponentTeamId = iHome ? matchup.awayTeamId : matchup.homeTeamId;

  // Already scored — return final result
  if (matchup.homeScore !== null && matchup.awayScore !== null) {
    const myScore  = iHome ? matchup.homeScore  : matchup.awayScore;
    const oppScore = iHome ? matchup.awayScore : matchup.homeScore;
    return {
      week: period.week,
      status: "complete",
      opponentName,
      myScore,
      oppScore,
      winProbability: myScore > oppScore ? 1 : myScore < oppScore ? 0 : 0.5,
      startsAt: matchup.startsAt,
    };
  }

  // Upcoming — period hasn't started yet
  if (current.status === "UPCOMING") {
    return {
      week: period.week,
      status: "upcoming",
      opponentName,
      myScore: 0,
      oppScore: 0,
      winProbability: 0.5,
      startsAt: matchup.startsAt,
    };
  }

  // Active (or scoring_pending with no cached scores) — compute running totals
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { scoringSettings: true },
  });
  const settings = parseScoringSettings(league.scoringSettings);

  const [myScore, oppScore] = await Promise.all([
    computeTeamScore(teamId, period, settings, prisma),
    computeTeamScore(opponentTeamId, period, settings, prisma),
  ]);

  return {
    week: period.week,
    status: "active",
    opponentName,
    myScore,
    oppScore,
    winProbability: winProbability(myScore, oppScore),
    startsAt: matchup.startsAt,
  };
}
