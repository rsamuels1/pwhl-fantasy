// lib/services/trophy-service.ts
// Determines end-of-season trophy winners and persists them to the DB.
// Idempotent: deletes existing trophies for leagueId+season before writing.

import type { PrismaClient } from "@prisma/client";

export type TrophyType =
  | "CHAMPION"
  | "BEST_RECORD"
  | "TOP_SCORER"
  | "MOST_IMPROVED"
  | "MOST_TRANSACTIONS";

export interface TrophyAward {
  teamId: string;
  type: TrophyType;
  data: Record<string, unknown>;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── main ──────────────────────────────────────────────────────────────────────

export async function awardTrophies(
  leagueId: string,
  season: string,
  prisma: PrismaClient
): Promise<TrophyAward[]> {
  // Load matchups for this league
  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      week: true,
      isPlayoff: true,
      round: true,
    },
  });

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true },
  });

  if (teams.length === 0 || matchups.length === 0) return [];

  const regularMatchups = matchups.filter((m) => !m.isPlayoff && m.homeScore !== null);
  const playoffMatchups = matchups.filter((m) => m.isPlayoff);

  // Build per-team stats from regular season
  interface TeamStats {
    wins: number;
    losses: number;
    ties: number;
    totalFp: number;
    // FP by week for MOST_IMPROVED calculation
    fpByWeek: Map<number, number>;
  }

  const statsMap = new Map<string, TeamStats>();
  for (const t of teams) {
    statsMap.set(t.id, { wins: 0, losses: 0, ties: 0, totalFp: 0, fpByWeek: new Map() });
  }

  // VTF: each matchup row = homeTeamId's score for that week. All teams are "home".
  const weeks = [...new Set(regularMatchups.map((m) => m.week))];
  for (const week of weeks) {
    const weekRows = regularMatchups.filter((m) => m.week === week && m.homeScore !== null);
    const entries = weekRows.map((m) => ({ teamId: m.homeTeamId, score: m.homeScore! }));

    for (const e of entries) {
      const s = statsMap.get(e.teamId);
      if (!s) continue;
      s.totalFp += e.score;
      s.fpByWeek.set(week, (s.fpByWeek.get(week) ?? 0) + e.score);
      const beaten = entries.filter((x) => x.score < e.score).length;
      const lost = entries.filter((x) => x.score > e.score).length;
      const tied = entries.filter((x) => x.score === e.score).length - 1;
      s.wins += beaten;
      s.losses += lost;
      s.ties += Math.max(0, tied);
    }
  }

  const awards: TrophyAward[] = [];

  // ── CHAMPION ─────────────────────────────────────────────────────────────────
  if (playoffMatchups.length > 0) {
    const maxRound = Math.max(...playoffMatchups.map((m) => m.round ?? 0));
    const finalMatchups = playoffMatchups.filter(
      (m) => m.round === maxRound && m.homeScore !== null && m.awayScore !== null
    );
    if (finalMatchups.length > 0) {
      const final = finalMatchups[0];
      const homeScore = final.homeScore!;
      const awayScore = final.awayScore!;
      const championTeamId = homeScore >= awayScore ? final.homeTeamId : final.awayTeamId;
      const opponentTeamId = homeScore >= awayScore ? final.awayTeamId : final.homeTeamId;
      const championScore = homeScore >= awayScore ? homeScore : awayScore;
      const opponentScore = homeScore >= awayScore ? awayScore : homeScore;
      const championTeam = teams.find((t) => t.id === championTeamId);
      const opponentTeam = teams.find((t) => t.id === opponentTeamId);
      awards.push({
        teamId: championTeamId,
        type: "CHAMPION",
        data: {
          teamName: championTeam?.name ?? "",
          score: championScore,
          opponentTeamName: opponentTeam?.name ?? "",
          opponentScore,
        },
      });
    }
  }

  // ── BEST_RECORD ───────────────────────────────────────────────────────────────
  {
    let bestTeamId: string | null = null;
    let bestWins = -1;
    let bestFp = -Infinity;
    for (const [teamId, s] of statsMap) {
      if (s.wins > bestWins || (s.wins === bestWins && s.totalFp > bestFp)) {
        bestWins = s.wins;
        bestFp = s.totalFp;
        bestTeamId = teamId;
      }
    }
    if (bestTeamId) {
      const s = statsMap.get(bestTeamId)!;
      awards.push({
        teamId: bestTeamId,
        type: "BEST_RECORD",
        data: { wins: s.wins, losses: s.losses, ties: s.ties, totalFp: s.totalFp },
      });
    }
  }

  // ── TOP_SCORER ────────────────────────────────────────────────────────────────
  {
    let topTeamId: string | null = null;
    let topFp = -Infinity;
    for (const [teamId, s] of statsMap) {
      if (s.totalFp > topFp) {
        topFp = s.totalFp;
        topTeamId = teamId;
      }
    }
    // Don't double-award if same team got BEST_RECORD and TOP_SCORER
    if (topTeamId) {
      awards.push({
        teamId: topTeamId,
        type: "TOP_SCORER",
        data: { totalFp: topFp },
      });
    }
  }

  // ── MOST_IMPROVED ─────────────────────────────────────────────────────────────
  {
    const sortedWeeks = weeks.sort((a, b) => a - b);
    const midpoint = Math.floor(sortedWeeks.length / 2);
    const firstHalf = new Set(sortedWeeks.slice(0, midpoint));
    const secondHalf = new Set(sortedWeeks.slice(midpoint));

    if (firstHalf.size >= 2 && secondHalf.size >= 2) {
      let bestImprovedTeamId: string | null = null;
      let bestImprovement = -Infinity;

      for (const [teamId, s] of statsMap) {
        const firstScores = [...s.fpByWeek.entries()]
          .filter(([w]) => firstHalf.has(w))
          .map(([, v]) => v);
        const secondScores = [...s.fpByWeek.entries()]
          .filter(([w]) => secondHalf.has(w))
          .map(([, v]) => v);
        if (firstScores.length === 0 || secondScores.length === 0) continue;
        const improvement = mean(secondScores) - mean(firstScores);
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestImprovedTeamId = teamId;
        }
      }
      if (bestImprovedTeamId) {
        awards.push({
          teamId: bestImprovedTeamId,
          type: "MOST_IMPROVED",
          data: { improvement: Math.round(bestImprovement * 10) / 10 },
        });
      }
    }
  }

  // ── MOST_TRANSACTIONS ─────────────────────────────────────────────────────────
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leagueEventModel = (prisma as any).leagueEvent;
    if (leagueEventModel) {
      try {
        const txnCounts = await leagueEventModel.groupBy({
          by: ["teamId"],
          where: {
            leagueId,
            type: { in: ["PLAYER_ADD", "PLAYER_DROP"] },
            teamId: { not: null },
          },
          _count: { id: true },
        });
        let mostActiveTeamId: string | null = null;
        let mostCount = 0;
        for (const row of txnCounts as Array<{ teamId: string | null; _count: { id: number } }>) {
          if (!row.teamId) continue;
          if (row._count.id > mostCount) {
            mostCount = row._count.id;
            mostActiveTeamId = row.teamId;
          }
        }
        if (mostActiveTeamId && mostCount > 0) {
          awards.push({
            teamId: mostActiveTeamId,
            type: "MOST_TRANSACTIONS",
            data: { count: mostCount },
          });
        }
      } catch {
        // leagueEvent table may not exist yet — skip this trophy
      }
    }
  }

  if (awards.length === 0) return [];

  // Idempotent: wipe existing trophies for this league+season then re-insert
  await prisma.trophy.deleteMany({ where: { leagueId, season } });
  await prisma.trophy.createMany({
    data: awards.map((a) => ({
      leagueId,
      teamId: a.teamId,
      season,
      type: a.type as import("@prisma/client").TrophyType,
      data: a.data as object,
    })),
  });

  return awards;
}
