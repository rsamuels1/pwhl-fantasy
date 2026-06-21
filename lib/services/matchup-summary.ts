// Lightweight matchup summary for the Fantasy Home dashboard.
// VTF format: returns weekly W-L-T record against the full field, not a single opponent.

import type { PrismaClient } from "@prisma/client";
import { getSeasonState } from "@/lib/season";
import { computeAllTeamScores } from "@/lib/scoring/matchups";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { scoreStatLine, DEFAULT_SCORING } from "@/lib/scoring";

export interface TopPerformer {
  name: string;
  points: number;
}

export interface MatchupQuickSummary {
  week: number;
  status: "active" | "upcoming" | "complete";
  myScore: number;
  wins: number;
  losses: number;
  ties: number;
  teamsCount: number;
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

  const { periods } = state;
  const active   = periods.find((p) => p.status === "ACTIVE");
  const pending  = periods.find((p) => p.status === "SCORING_PENDING");
  const upcoming = periods.find((p) => p.status === "UPCOMING");
  const complete = [...periods].reverse().find((p) => p.status === "COMPLETE");

  const current = active ?? pending ?? upcoming ?? complete;
  if (!current) return null;

  const { period } = current;

  // Total team count for the denominator
  const teamsCount = await prisma.fantasyTeam.count({ where: { leagueId } });

  // All matchup rows for my team this week
  const myMatchups = await prisma.matchup.findMany({
    where: {
      leagueId,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      week: period.week,
      isPlayoff: false,
    },
  });

  if (myMatchups.length === 0) return null;

  const startsAt = myMatchups[0].startsAt;

  // Already scored — read cached scores for all matchup rows
  const allScored = myMatchups.every((m) => m.homeScore !== null && m.awayScore !== null);
  if (allScored) {
    let wins = 0, losses = 0, ties = 0, myScore = 0;
    for (const m of myMatchups) {
      const iAmHome = m.homeTeamId === teamId;
      const mine = iAmHome ? m.homeScore! : m.awayScore!;
      const theirs = iAmHome ? m.awayScore! : m.homeScore!;
      myScore = mine; // consistent across all rows
      if (mine > theirs) wins++;
      else if (mine < theirs) losses++;
      else ties++;
    }
    return { week: period.week, status: "complete", myScore, wins, losses, ties, teamsCount, startsAt };
  }

  // Upcoming — period hasn't started yet
  if (current.status === "UPCOMING") {
    return {
      week: period.week, status: "upcoming",
      myScore: 0, wins: 0, losses: 0, ties: 0, teamsCount, startsAt,
    };
  }

  // Active — compute live scores for all teams
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { scoringSettings: true },
  });
  const settings = parseScoringSettings(league.scoringSettings);
  const allScores = await computeAllTeamScores(leagueId, period, settings, prisma);

  const myScore = allScores.get(teamId) ?? 0;
  let wins = 0, losses = 0, ties = 0;

  // Check if setup phase: all teams have 0 score (no games played yet)
  const isSetupPhase = [...allScores.values()].every(score => score === 0);

  for (const [tid, score] of allScores) {
    if (tid === teamId) continue;
    if (myScore > score) wins++;
    else if (myScore < score) losses++;
    else ties++;
  }

  // In setup phase (all 0s), show "Week in progress" instead of misleading 0-0-N record
  if (isSetupPhase) {
    return { week: period.week, status: "active", myScore: 0, wins: -1, losses: -1, ties: -1, teamsCount, startsAt };
  }

  return { week: period.week, status: "active", myScore, wins, losses, ties, teamsCount, startsAt };
}

// Returns the top 2 active-slot scorers for a team in the current scoring period.
// Returns [] when there is no active/scoring-pending period or no stat lines yet.
export async function getTeamTopPerformers(
  teamId: string,
  leagueId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<TopPerformer[]> {
  const state = await getSeasonState(leagueId, nowMs, prisma);
  const current =
    state.periods.find((p) => p.status === "ACTIVE") ??
    state.periods.find((p) => p.status === "SCORING_PENDING");
  if (!current) return [];

  const { period } = current;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { scoringSettings: true },
  });
  const settings = parseScoringSettings(league?.scoringSettings ?? DEFAULT_SCORING);

  const entries = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: teamId, slot: { notIn: ["BENCH", "IR"] } },
    select: { playerId: true, player: { select: { firstName: true, lastName: true, position: true } } },
  });
  if (entries.length === 0) return [];

  const playerIds = entries.map((e) => e.playerId);
  const lines = await prisma.statLine.findMany({
    where: { playerId: { in: playerIds }, game: { startsAt: { gte: period.startsAt, lt: period.endsAt } } },
    include: { player: { select: { position: true } } },
  });

  const byPlayer = new Map<string, number>();
  for (const line of lines) {
    const fp = scoreStatLine(
      { goals: line.goals, assists: line.assists, shots: line.shots, plusMinus: line.plusMinus,
        penaltyMinutes: line.penaltyMinutes, powerPlayPts: line.powerPlayPts, hits: line.hits,
        blocks: line.blocks, saves: line.saves, goalsAgainst: line.goalsAgainst,
        shutout: line.shutout, win: line.win },
      line.player.position,
      settings
    );
    byPlayer.set(line.playerId, (byPlayer.get(line.playerId) ?? 0) + fp);
  }

  const nameMap = new Map(entries.map((e) => [e.playerId, `${e.player.firstName} ${e.player.lastName}`]));

  return [...byPlayer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .filter(([, pts]) => pts > 0)
    .map(([id, pts]) => ({ name: nameMap.get(id) ?? id, points: Math.round(pts * 10) / 10 }));
}
