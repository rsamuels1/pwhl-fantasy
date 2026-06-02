// lib/scoring/matchups.ts
// Matchup generation and score computation for head-to-head weekly periods.
//
// Design invariants (from CLAUDE.md):
// - Fantasy points are NEVER stored as source of truth — homeScore/awayScore on
//   Matchup are a cache. This module can recompute them at any time.
// - Scoring periods are derived from real game dates, never from hardcoded dates.
// - Uses the existing scoreStatLine engine — no reimplementation.
// - Active roster = slot NOT IN [BENCH, IR].

import type { PrismaClient } from "@prisma/client";
import { scoreStatLine, DEFAULT_SCORING, type ScoringSettings } from "./index";
import { derivePeriods, type ScoringPeriod } from "./periods";

// ── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseScoringSettings(raw: unknown): ScoringSettings {
  if (
    raw &&
    typeof raw === "object" &&
    "skater" in raw &&
    "goalie" in (raw as Record<string, unknown>)
  ) {
    return raw as ScoringSettings;
  }
  return DEFAULT_SCORING;
}

// ── core scoring ──────────────────────────────────────────────────────────────

// Sum scoreStatLine for all active (non-bench, non-IR) roster entries whose
// players have real stat lines in games falling within the scoring period.
export async function computeTeamScore(
  fantasyTeamId: string,
  period: ScoringPeriod,
  scoringSettings: ScoringSettings,
  prisma: PrismaClient
): Promise<number> {
  const entries = await prisma.rosterEntry.findMany({
    where: {
      fantasyTeamId,
      slot: { notIn: ["BENCH", "IR"] },
    },
    select: { playerId: true },
  });

  if (entries.length === 0) return 0;
  const playerIds = entries.map((e) => e.playerId);

  const lines = await prisma.statLine.findMany({
    where: {
      playerId: { in: playerIds },
      game: {
        startsAt: { gte: period.startsAt, lt: period.endsAt },
      },
    },
    include: { player: { select: { position: true } } },
  });

  let total = 0;
  for (const line of lines) {
    total += scoreStatLine(
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
      line.player.position,
      scoringSettings
    );
  }

  return round2(total);
}

// Detailed breakdown: per-player scores for a team in a period.
// Useful for debugging and the replay script.
export async function computeTeamScoreDetailed(
  fantasyTeamId: string,
  period: ScoringPeriod,
  scoringSettings: ScoringSettings,
  prisma: PrismaClient
): Promise<{
  total: number;
  players: Array<{
    playerId: string;
    name: string;
    position: string;
    points: number;
    gameCount: number;
  }>;
}> {
  const entries = await prisma.rosterEntry.findMany({
    where: {
      fantasyTeamId,
      slot: { notIn: ["BENCH", "IR"] },
    },
    include: { player: { select: { id: true, firstName: true, lastName: true, position: true } } },
  });

  if (entries.length === 0) return { total: 0, players: [] };

  const playerIds = entries.map((e) => e.playerId);
  const playerMap = new Map(entries.map((e) => [e.playerId, e.player]));

  const lines = await prisma.statLine.findMany({
    where: {
      playerId: { in: playerIds },
      game: { startsAt: { gte: period.startsAt, lt: period.endsAt } },
    },
    include: { player: { select: { position: true } } },
  });

  // Aggregate per player
  const byPlayer = new Map<string, { pts: number; games: number }>();
  for (const line of lines) {
    const pts = scoreStatLine(
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
      line.player.position,
      scoringSettings
    );
    const prev = byPlayer.get(line.playerId) ?? { pts: 0, games: 0 };
    byPlayer.set(line.playerId, { pts: round2(prev.pts + pts), games: prev.games + 1 });
  }

  const players = [...byPlayer.entries()]
    .map(([pid, { pts, games }]) => {
      const p = playerMap.get(pid)!;
      return {
        playerId: pid,
        name: `${p.firstName} ${p.lastName}`,
        position: p.position,
        points: pts,
        gameCount: games,
      };
    })
    .sort((a, b) => b.points - a.points);

  const total = round2(players.reduce((s, p) => s + p.points, 0));
  return { total, players };
}

// ── matchup generation ────────────────────────────────────────────────────────

// Round-robin schedule using the circle method. Returns pairs of indices into
// `teamIds` for each of W rounds (0-based), cycling if W > N-1.
function roundRobinPairs(n: number, rounds: number): Array<Array<[number, number]>> {
  if (n < 2) throw new Error("Need at least 2 teams");
  const pad = n % 2 === 1; // bye week handling: add phantom team if odd
  const size = pad ? n + 1 : n;
  const ids = Array.from({ length: size }, (_, i) => i);

  const schedule: Array<Array<[number, number]>> = [];
  for (let r = 0; r < rounds; r++) {
    // Use r % (size-1) to cycle
    const rot = r % (size - 1);
    // Build rotated list: fix ids[0], rotate ids[1..]
    const rotated = [ids[0], ...ids.slice(1 + rot), ...ids.slice(1, 1 + rot)];
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < size / 2; i++) {
      const a = rotated[i];
      const b = rotated[size - 1 - i];
      // Skip phantom-team byes
      if (a < n && b < n) pairs.push([a, b]);
    }
    schedule.push(pairs);
  }
  return schedule;
}

// Generate Matchup rows for a league's full season and upsert them.
// Safe to re-run: upserts on (leagueId, week, homeTeamId).
export async function generateMatchups(
  leagueId: string,
  season: string,
  prisma: PrismaClient
): Promise<ScoringPeriod[]> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    include: { teams: { orderBy: { draftOrder: "asc" } } },
  });

  const teamIds = league.teams.map((t) => t.id);
  if (teamIds.length < 2) throw new Error("League needs at least 2 teams");

  const gameDates = await prisma.game
    .findMany({ where: { season }, select: { startsAt: true } })
    .then((rows) => rows.map((r) => r.startsAt));

  const periods = derivePeriods(gameDates);
  if (periods.length === 0) throw new Error(`No games found for season ${season}`);

  const schedule = roundRobinPairs(teamIds.length, periods.length);

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const pairs = schedule[i];
    for (const [ai, bi] of pairs) {
      const homeTeamId = teamIds[ai];
      const awayTeamId = teamIds[bi];
      const existing = await prisma.matchup.findFirst({
        where: { leagueId, week: period.week, homeTeamId },
        select: { id: true },
      });
      if (existing) {
        await prisma.matchup.update({
          where: { id: existing.id },
          data: { startsAt: period.startsAt, endsAt: period.endsAt, awayTeamId },
        });
      } else {
        await prisma.matchup.create({
          data: {
            leagueId,
            week: period.week,
            startsAt: period.startsAt,
            endsAt: period.endsAt,
            homeTeamId,
            awayTeamId,
          },
        });
      }
    }
  }

  return periods;
}

// Score a single matchup and cache the result on the Matchup row.
export async function scoreMatchup(
  matchupId: string,
  prisma: PrismaClient
): Promise<{ homeScore: number; awayScore: number }> {
  const matchup = await prisma.matchup.findUniqueOrThrow({
    where: { id: matchupId },
    include: { league: { select: { scoringSettings: true } } },
  });

  const settings = parseScoringSettings(matchup.league.scoringSettings);
  const period: ScoringPeriod = { week: matchup.week, startsAt: matchup.startsAt, endsAt: matchup.endsAt };

  const [homeScore, awayScore] = await Promise.all([
    computeTeamScore(matchup.homeTeamId, period, settings, prisma),
    computeTeamScore(matchup.awayTeamId, period, settings, prisma),
  ]);

  await prisma.matchup.update({
    where: { id: matchupId },
    data: { homeScore, awayScore },
  });

  return { homeScore, awayScore };
}

// Score all matchups in a league (or just one week if provided).
export async function scoreLeagueMatchups(
  leagueId: string,
  week: number | null,
  prisma: PrismaClient
): Promise<void> {
  const matchups = await prisma.matchup.findMany({
    where: { leagueId, ...(week != null ? { week } : {}) },
    select: { id: true },
  });

  for (const { id } of matchups) {
    await scoreMatchup(id, prisma);
  }
}
