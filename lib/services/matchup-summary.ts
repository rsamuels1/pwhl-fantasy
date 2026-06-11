// Lightweight matchup summary for the Fantasy Home dashboard.
// Returns just what a team card needs: current week, opponent, scores, win probability.
// For upcoming matchups (no games started yet), returns 0 scores immediately without
// hitting the scoring engine. For active matchups, computes running scores.

import type { PrismaClient } from "@prisma/client";
import { getSeasonState } from "@/lib/season";
import { computeTeamScore } from "@/lib/scoring/matchups";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { winProbability } from "@/lib/projections";

export interface MatchupQuickSummary {
  week: number;
  status: "active" | "upcoming";
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
  // Single query: find this team's current unscored matchup
  const matchup = await prisma.matchup.findFirst({
    where: {
      leagueId,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      homeScore: null,
      isPlayoff: false,
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { week: "asc" },
  });

  if (!matchup) return null;

  const opponentTeamId =
    matchup.homeTeamId === teamId ? matchup.awayTeamId : matchup.homeTeamId;
  const opponentName =
    matchup.homeTeamId === teamId
      ? matchup.awayTeam.name
      : matchup.homeTeam.name;

  // If the scoring period hasn't started yet, skip score computation
  const periodStarted = new Date(matchup.startsAt).getTime() <= nowMs;

  if (!periodStarted) {
    return {
      week: matchup.week,
      status: "upcoming",
      opponentName,
      myScore: 0,
      oppScore: 0,
      winProbability: 0.5,
      startsAt: matchup.startsAt,
    };
  }

  // Period is active — compute running scores from stat lines
  const state = await getSeasonState(leagueId, nowMs, prisma);
  const activePeriod = state.periods.find((p) => p.status === "ACTIVE");

  if (!activePeriod) {
    // Period ended but not scored yet (SCORING_PENDING) — return without scores
    return {
      week: matchup.week,
      status: "active",
      opponentName,
      myScore: 0,
      oppScore: 0,
      winProbability: 0.5,
      startsAt: matchup.startsAt,
    };
  }

  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { scoringSettings: true },
  });
  const settings = parseScoringSettings(league.scoringSettings);

  const [myScore, oppScore] = await Promise.all([
    computeTeamScore(teamId, activePeriod.period, settings, prisma),
    computeTeamScore(opponentTeamId, activePeriod.period, settings, prisma),
  ]);

  return {
    week: matchup.week,
    status: "active",
    opponentName,
    myScore,
    oppScore,
    winProbability: winProbability(myScore, oppScore),
    startsAt: matchup.startsAt,
  };
}
