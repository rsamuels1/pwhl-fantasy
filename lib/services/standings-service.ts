// lib/services/standings-service.ts
// Orchestrates standings computation: loads data from DB, calls pure domain functions,
// and decorates results with playoff eligibility.
//
// Pattern mirrors lib/season/index.ts — DB access stays here, pure logic stays in
// lib/playoffs/seeding.ts and lib/playoffs/lifecycle.ts.

import type { PrismaClient } from "@prisma/client";
import { getPlayoffSettings } from "@/lib/playoffs/lifecycle";
import { computeVpStandings } from "@/lib/scoring/vp";

export interface StandingRow {
  fantasyTeamId: string;
  teamName: string;
  totalVP: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  rank: number;
  isPlayoffEligible: boolean;
  seed: number | null;
}

export interface StandingsResult {
  leagueId: string;
  leagueName: string;
  playoffStatus: string;
  standings: StandingRow[];
}

// Returns standings sorted by rank, annotated with playoff seed and eligibility.
export async function getStandings(
  leagueId: string,
  prisma: PrismaClient
): Promise<StandingsResult> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    include: {
      teams: {
        include: {
          _count: { select: { homeMatchups: true, awayMatchups: true } },
        },
      },
    },
  });

  const matchups = await prisma.matchup.findMany({ where: { leagueId } });

  const raw = computeVpStandings(
    league.teams,
    matchups.map((m) => ({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      homeVP: m.homeVP,
      awayVP: m.awayVP,
      isPlayoff: m.isPlayoff,
    }))
  );
  const playoffSettings = getPlayoffSettings(league.playoffSettings as Parameters<typeof getPlayoffSettings>[0]);

  const standings: StandingRow[] = raw.map((s, index) => ({
    fantasyTeamId: s.fantasyTeamId,
    teamName: s.teamName,
    totalVP: s.totalVP,
    wins: s.wins,
    losses: s.losses,
    ties: s.ties,
    pointsFor: s.pointsFor,
    rank: index + 1,
    isPlayoffEligible: index < playoffSettings.teamsInPlayoff,
    seed: index < playoffSettings.teamsInPlayoff ? index + 1 : null,
  }));

  return {
    leagueId,
    leagueName: league.name,
    playoffStatus: league.playoffStatus,
    standings,
  };
}
