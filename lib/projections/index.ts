// lib/projections/index.ts
// Rolling-average projections for players and teams.

import type { PrismaClient } from "@prisma/client";
import { Position } from "@prisma/client";
import { scoreStatLine, type ScoringSettings, DEFAULT_SCORING } from "../scoring";
import type { ScoringPeriod } from "../scoring/periods";

// ── Sanity caps ───────────────────────────────────────────────────────────────
//
// Real PWHL per-game scoring rates (approximate maximums):
//   Top skater: ~0.8 FP/game on a great night
//   Top goalie:  ~8 FP/game on a shutout win
//
// Multiplying an average by several games can produce unrealistic totals when
// the rolling window includes a hot-streak outlier. These caps prevent
// projected team totals from reaching absurd values (e.g. 824+ FP/week).
const MAX_FP_PER_GAME_SKATER = 4.0;
const MAX_FP_PER_GAME_GOALIE  = 8.0;

// ── per-player rolling average ────────────────────────────────────────────────

// Returns the player's average fantasy points per game over their last nGames.
// Returns 0 if no historical stat lines are found.
// NOTE: Call batchAvgFpPerPlayer when projecting multiple players in one request
// to avoid N serial DB queries.
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

// ── batch rolling averages (one DB query for N players) ───────────────────────

// Fetches all stat lines for the given players in one query, groups them
// in-process, and returns a map of playerId → avg FP per game.
// Use this instead of calling projectPlayer in a loop.
async function batchAvgFpPerPlayer(
  players: { playerId: string; position: Position }[],
  scoringSettings: ScoringSettings,
  prisma: PrismaClient,
  nGames = 5
): Promise<Map<string, number>> {
  if (players.length === 0) return new Map();

  const playerIds = players.map((p) => p.playerId);
  const positionMap = new Map(players.map((p) => [p.playerId, p.position]));

  // One query; sorted newest-first so we can take the first nGames per player below.
  const allLines = await prisma.statLine.findMany({
    where: { playerId: { in: playerIds } },
    orderBy: { game: { startsAt: "desc" } },
    select: {
      playerId: true,
      goals: true, assists: true, shots: true, plusMinus: true,
      penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
      saves: true, goalsAgainst: true, shutout: true, win: true,
    },
  });

  const linesByPlayer = new Map<string, typeof allLines>();
  for (const line of allLines) {
    const bucket = linesByPlayer.get(line.playerId);
    if (!bucket) {
      linesByPlayer.set(line.playerId, [line]);
    } else if (bucket.length < nGames) {
      bucket.push(line);
    }
  }

  const result = new Map<string, number>();
  for (const { playerId } of players) {
    const lines = linesByPlayer.get(playerId);
    if (!lines || lines.length === 0) { result.set(playerId, 0); continue; }
    const position = positionMap.get(playerId)!;
    const total = lines.reduce(
      (sum, line) =>
        sum +
        scoreStatLine(
          {
            goals: line.goals, assists: line.assists, shots: line.shots,
            plusMinus: line.plusMinus, penaltyMinutes: line.penaltyMinutes,
            powerPlayPts: line.powerPlayPts, hits: line.hits, blocks: line.blocks,
            saves: line.saves, goalsAgainst: line.goalsAgainst,
            shutout: line.shutout, win: line.win,
          },
          position,
          scoringSettings
        ),
      0
    );
    result.set(playerId, Math.round((total / lines.length) * 100) / 100);
  }

  return result;
}

// ── remaining-period team projection ─────────────────────────────────────────

export async function projectTeamRemainingScore(
  fantasyTeamId: string,
  earnedSoFar: number,
  period: ScoringPeriod,
  scoringSettings: ScoringSettings = DEFAULT_SCORING,
  prisma: PrismaClient,
  nowMs: number = Date.now()
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

  const now = new Date(nowMs);
  const teamIds = [...new Set(entries.map((e) => e.player.teamId).filter(Boolean))] as string[];

  if (teamIds.length === 0) return earnedSoFar;

  const remainingGames = await prisma.game.findMany({
    where: {
      startsAt: { gte: now, lt: period.endsAt },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    select: { homeTeamId: true, awayTeamId: true },
  });

  const gamesPerTeam = new Map<string, number>();
  for (const game of remainingGames) {
    if (teamIds.includes(game.homeTeamId)) {
      gamesPerTeam.set(game.homeTeamId, (gamesPerTeam.get(game.homeTeamId) ?? 0) + 1);
    }
    if (teamIds.includes(game.awayTeamId)) {
      gamesPerTeam.set(game.awayTeamId, (gamesPerTeam.get(game.awayTeamId) ?? 0) + 1);
    }
  }

  // Only project players whose team has remaining games — skip the rest.
  const activeEntries = entries.filter(
    (e) => e.player.teamId && (gamesPerTeam.get(e.player.teamId) ?? 0) > 0
  );

  const avgFpByPlayer = await batchAvgFpPerPlayer(
    activeEntries.map((e) => ({ playerId: e.playerId, position: e.player.position })),
    scoringSettings,
    prisma
  );

  let projectedAdditional = 0;
  for (const entry of activeEntries) {
    const { teamId, position } = entry.player;
    if (!teamId) continue;
    const gamesLeft = gamesPerTeam.get(teamId) ?? 0;
    const rawAvgPpg = avgFpByPlayer.get(entry.playerId) ?? 0;
    const cap = position === Position.GOALIE ? MAX_FP_PER_GAME_GOALIE : MAX_FP_PER_GAME_SKATER;
    projectedAdditional += Math.min(rawAvgPpg, cap) * gamesLeft;
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
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  isHomeTeam: boolean;
}

export async function getRemainingPlayersTonight(
  fantasyTeamId: string,
  scoringSettings: ScoringSettings = DEFAULT_SCORING,
  prisma: PrismaClient,
  nowMs: number = Date.now()
): Promise<RemainingPlayer[]> {
  const now = new Date(nowMs);
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
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    select: {
      homeTeamId: true, awayTeamId: true, startsAt: true,
      homeTeam: { select: { abbreviation: true } },
      awayTeam: { select: { abbreviation: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  interface GameCtx {
    homeTeamId: string; awayTeamId: string;
    homeTeamAbbr: string; awayTeamAbbr: string;
    startsAt: Date;
  }
  const teamGameCtx = new Map<string, GameCtx>();
  for (const game of games) {
    const ctx: GameCtx = {
      homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId,
      homeTeamAbbr: game.homeTeam.abbreviation, awayTeamAbbr: game.awayTeam.abbreviation,
      startsAt: game.startsAt,
    };
    if (!teamGameCtx.has(game.homeTeamId)) teamGameCtx.set(game.homeTeamId, ctx);
    if (!teamGameCtx.has(game.awayTeamId)) teamGameCtx.set(game.awayTeamId, ctx);
  }

  // Only project players with a game tonight — batch in one query.
  const activeEntries = entries.filter(
    (e) => e.player.teamId && teamGameCtx.has(e.player.teamId)
  );

  const avgFpByPlayer = await batchAvgFpPerPlayer(
    activeEntries.map((e) => ({ playerId: e.playerId, position: e.player.position })),
    scoringSettings,
    prisma
  );

  return activeEntries
    .map((entry) => {
      const ctx = teamGameCtx.get(entry.player.teamId!)!;
      return {
        playerId: entry.playerId,
        name: `${entry.player.firstName} ${entry.player.lastName}`,
        position: entry.player.position,
        slot: entry.slot,
        gameStartsAt: ctx.startsAt,
        projectedPoints: avgFpByPlayer.get(entry.playerId) ?? 0,
        homeTeamAbbr: ctx.homeTeamAbbr,
        awayTeamAbbr: ctx.awayTeamAbbr,
        isHomeTeam: ctx.homeTeamId === entry.player.teamId,
      };
    })
    .sort((a, b) => a.gameStartsAt.getTime() - b.gameStartsAt.getTime());
}
