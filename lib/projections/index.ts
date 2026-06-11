// lib/projections/index.ts
// Rolling-average projections for players and teams.
// All functions are pure or read-only — no mutations.

import type { PrismaClient } from "@prisma/client";
import { Position } from "@prisma/client";
import { scoreStatLine, type ScoringSettings, DEFAULT_SCORING } from "../scoring";
import type { ScoringPeriod } from "../scoring/periods";

// ── per-player rolling average ────────────────────────────────────────────────

// Returns the player's average fantasy points per game over their last nGames.
// Returns 0 if no historical stat lines are found.
export async function projectPlayer(
  playerId: string,
  position: Position,
  scoringSettings: ScoringSettings = DEFAULT_SCORING,
  prisma: PrismaClient,
  nGames = 5
): Promise<number> {
  const lines = await prisma.statLine.findMany({
    where: { playerId },
    orderBy: { game: { startsAt: "desc" } },
    take: nGames,
  });

  if (lines.length === 0) return 0;

  const total = lines.reduce(
    (sum, line) =>
      sum +
      scoreStatLine(
        {
          goals: line.goals,
          assists: line.assists,
          shots: line.shots,
          plusMinus: line.plusMinus,
          penaltyMinutes: line.penaltyMinutes,
          powerPlayPts: line.powerPlayPts,
          hits: line.hits,
          blocks: line.blocks,
          saves: line.saves,
          goalsAgainst: line.goalsAgainst,
          shutout: line.shutout,
          win: line.win,
        },
        position,
        scoringSettings
      ),
    0
  );

  return Math.round((total / lines.length) * 100) / 100;
}

// ── remaining-period team projection ─────────────────────────────────────────

// Returns the projected total period score for a team by adding projected points
// from remaining games (games not yet final) to what they've already earned.
// Uses Player.teamId to find which games each roster player has remaining.
export async function projectTeamRemainingScore(
  fantasyTeamId: string,
  earnedSoFar: number,
  period: ScoringPeriod,
  scoringSettings: ScoringSettings = DEFAULT_SCORING,
  prisma: PrismaClient
): Promise<number> {
  const entries = await prisma.rosterEntry.findMany({
    where: {
      fantasyTeamId,
      slot: { notIn: ["BENCH", "IR"] },
    },
    include: {
      player: { select: { id: true, position: true, teamId: true } },
    },
  });

  if (entries.length === 0) return earnedSoFar;

  const now = new Date();
  const teamIds = [...new Set(entries.map((e) => e.player.teamId).filter(Boolean))] as string[];

  if (teamIds.length === 0) return earnedSoFar;

  // Find upcoming (not final) games within the period window for those teams
  const remainingGames = await prisma.game.findMany({
    where: {
      startsAt: { gte: now, lt: period.endsAt },
      status: { not: "FINAL" },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    select: { homeTeamId: true, awayTeamId: true },
  });

  // Count remaining games per team
  const gamesPerTeam = new Map<string, number>();
  for (const game of remainingGames) {
    if (teamIds.includes(game.homeTeamId)) {
      gamesPerTeam.set(game.homeTeamId, (gamesPerTeam.get(game.homeTeamId) ?? 0) + 1);
    }
    if (teamIds.includes(game.awayTeamId)) {
      gamesPerTeam.set(game.awayTeamId, (gamesPerTeam.get(game.awayTeamId) ?? 0) + 1);
    }
  }

  // Project each active player's contribution from their remaining games
  let projectedAdditional = 0;
  for (const entry of entries) {
    const { teamId, position } = entry.player;
    if (!teamId) continue;
    const gamesLeft = gamesPerTeam.get(teamId) ?? 0;
    if (gamesLeft === 0) continue;
    const avgPpg = await projectPlayer(entry.playerId, position, scoringSettings, prisma);
    projectedAdditional += avgPpg * gamesLeft;
  }

  return Math.round((earnedSoFar + projectedAdditional) * 100) / 100;
}

// ── win probability ───────────────────────────────────────────────────────────

// Logistic function giving P(me wins) given projected totals.
// k=15 calibrated so a 15-pt lead ≈ 73% chance to win.
export function winProbability(myProjected: number, opponentProjected: number): number {
  const k = 15;
  const p = 1 / (1 + Math.exp(-(myProjected - opponentProjected) / k));
  return Math.round(p * 1000) / 1000;
}

// ── remaining-players-tonight helper ─────────────────────────────────────────

export interface RemainingPlayer {
  playerId: string;
  name: string;
  position: Position;
  slot: string;
  gameStartsAt: Date;
  projectedPoints: number;
}

// Returns active-roster players whose team has a game today that isn't final yet.
export async function getRemainingPlayersTonight(
  fantasyTeamId: string,
  scoringSettings: ScoringSettings = DEFAULT_SCORING,
  prisma: PrismaClient
): Promise<RemainingPlayer[]> {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todayEnd = new Date(todayStart.getTime() + 86400_000);

  const entries = await prisma.rosterEntry.findMany({
    where: {
      fantasyTeamId,
      slot: { notIn: ["BENCH", "IR"] },
    },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, position: true, teamId: true } },
    },
  });

  if (entries.length === 0) return [];

  const teamIds = [...new Set(entries.map((e) => e.player.teamId).filter(Boolean))] as string[];

  if (teamIds.length === 0) return [];

  const games = await prisma.game.findMany({
    where: {
      startsAt: { gte: now, lt: todayEnd },
      status: { not: "FINAL" },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    select: { homeTeamId: true, awayTeamId: true, startsAt: true },
    orderBy: { startsAt: "asc" },
  });

  // Map teamId → earliest game start today
  const teamGameStart = new Map<string, Date>();
  for (const game of games) {
    for (const tid of [game.homeTeamId, game.awayTeamId]) {
      if (teamIds.includes(tid) && !teamGameStart.has(tid)) {
        teamGameStart.set(tid, game.startsAt);
      }
    }
  }

  const result: RemainingPlayer[] = [];
  for (const entry of entries) {
    const { teamId } = entry.player;
    if (!teamId) continue;
    const gameStartsAt = teamGameStart.get(teamId);
    if (!gameStartsAt) continue;

    const projected = await projectPlayer(
      entry.playerId,
      entry.player.position,
      scoringSettings,
      prisma
    );
    result.push({
      playerId: entry.playerId,
      name: `${entry.player.firstName} ${entry.player.lastName}`,
      position: entry.player.position,
      slot: entry.slot,
      gameStartsAt,
      projectedPoints: projected,
    });
  }

  return result.sort((a, b) => a.gameStartsAt.getTime() - b.gameStartsAt.getTime());
}
