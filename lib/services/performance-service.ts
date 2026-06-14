import type { PrismaClient } from "@prisma/client";
import type { SeasonState, PeriodStatus } from "@/lib/season/lifecycle";
import type { ScoringSettings } from "@/lib/scoring";
import { computeAllTeamScores } from "@/lib/scoring/matchups";

export interface WeekPerformance {
  period: { week: number; startsAt: Date; endsAt: Date };
  status: PeriodStatus;
  myFp: number;
  rank: number;      // 1-based; 0 if not yet scored
  teamCount: number;
  wins: number;
  losses: number;
  ties: number;
}

function deriveResults(
  fantasyTeamId: string,
  scores: Map<string, number>
): Pick<WeekPerformance, "myFp" | "rank" | "teamCount" | "wins" | "losses" | "ties"> {
  const myFp = scores.get(fantasyTeamId) ?? 0;
  const all = [...scores.values()];
  const wins = all.filter((s) => s < myFp).length;
  const losses = all.filter((s) => s > myFp).length;
  const ties = all.filter((s) => s === myFp).length - 1;
  const rank = losses + 1;
  return { myFp, rank, teamCount: all.length, wins, losses, ties };
}

export async function getWeeklyPerformance(
  leagueId: string,
  fantasyTeamId: string,
  nowMs: number,
  prisma: PrismaClient,
  seasonState: SeasonState,
  scoringSettings: ScoringSettings
): Promise<WeekPerformance[]> {
  const { periods } = seasonState;
  if (periods.length === 0) return [];

  // Batch load all scored matchup rows in one query
  const allMatchups = await prisma.matchup.findMany({
    where: { leagueId, isPlayoff: false, homeScore: { not: null } },
    select: { week: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });

  // Build scores map per week: teamId → fp
  const scoresByWeek = new Map<number, Map<string, number>>();
  for (const m of allMatchups) {
    if (!scoresByWeek.has(m.week)) scoresByWeek.set(m.week, new Map());
    const weekMap = scoresByWeek.get(m.week)!;
    if (m.homeScore != null) weekMap.set(m.homeTeamId, m.homeScore);
    if (m.awayScore != null) weekMap.set(m.awayTeamId, m.awayScore);
  }

  // Find the active period to compute live scores
  const activePeriodState = periods.find((p) => p.status === "ACTIVE");

  let liveScores: Map<string, number> | null = null;
  if (activePeriodState) {
    liveScores = await computeAllTeamScores(
      leagueId,
      activePeriodState.period,
      scoringSettings,
      prisma,
      nowMs
    );
  }

  const results: WeekPerformance[] = periods.map((ps) => {
    const { period, status } = ps;

    if (status === "COMPLETE") {
      const weekScores = scoresByWeek.get(period.week) ?? new Map<string, number>();
      return { period, status, ...deriveResults(fantasyTeamId, weekScores) };
    }

    if (status === "ACTIVE" && liveScores) {
      return { period, status, ...deriveResults(fantasyTeamId, liveScores) };
    }

    return { period, status, myFp: 0, rank: 0, teamCount: 0, wins: 0, losses: 0, ties: 0 };
  });

  return results.reverse();
}
