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
import {
  scoreStatLine,
  scoreStatLineDetailed,
  DEFAULT_SCORING,
  type ScoringSettings,
  type ScoringBreakdown,
} from "./index";
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
  prisma: PrismaClient,
  nowMs?: number
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

  const upperBound = nowMs
    ? new Date(Math.min(nowMs, period.endsAt.getTime()))
    : period.endsAt;

  const lines = await prisma.statLine.findMany({
    where: {
      playerId: { in: playerIds },
      game: {
        startsAt: { gte: period.startsAt, lt: upperBound },
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
  prisma: PrismaClient,
  nowMs?: number
): Promise<{
  total: number;
  players: Array<{
    playerId: string;
    name: string;
    position: string;
    slot: string;
    teamId: string | null;
    teamAbbr: string | null;
    points: number;
    gameCount: number;
    statBreakdown: ScoringBreakdown[];
  }>;
}> {
  const entries = await prisma.rosterEntry.findMany({
    where: {
      fantasyTeamId,
      slot: { notIn: ["BENCH", "IR"] },
    },
    include: {
      player: {
        select: {
          id: true, firstName: true, lastName: true, position: true,
          team: { select: { id: true, abbreviation: true } },
        },
      },
    },
  });

  if (entries.length === 0) return { total: 0, players: [] };

  const playerIds = entries.map((e) => e.playerId);
  const playerMap = new Map(entries.map((e) => [e.playerId, e.player]));
  const slotMap = new Map(entries.map((e) => [e.playerId, e.slot]));

  const lines = await prisma.statLine.findMany({
    where: {
      playerId: { in: playerIds },
      game: { startsAt: { gte: period.startsAt, lt: nowMs ? new Date(Math.min(nowMs, period.endsAt.getTime())) : period.endsAt } },
    },
    include: { player: { select: { position: true } } },
  });

  // Aggregate per player — accumulate breakdown category totals across games
  const byPlayer = new Map<
    string,
    { pts: number; games: number; categoryTotals: Map<string, { stat: number; multiplier: number }> }
  >();

  for (const line of lines) {
    const statInput = {
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
    };
    const { total: pts, breakdown } = scoreStatLineDetailed(
      statInput,
      line.player.position,
      scoringSettings
    );
    const prev = byPlayer.get(line.playerId) ?? { pts: 0, games: 0, categoryTotals: new Map() };
    for (const b of breakdown) {
      const existing = prev.categoryTotals.get(b.label) ?? { stat: 0, multiplier: b.multiplier };
      prev.categoryTotals.set(b.label, { stat: existing.stat + b.stat, multiplier: b.multiplier });
    }
    byPlayer.set(line.playerId, {
      pts: round2(prev.pts + pts),
      games: prev.games + 1,
      categoryTotals: prev.categoryTotals,
    });
  }

  // Include all active roster players, even those with 0 points this period.
  const players = playerIds
    .map((pid) => {
      const p = playerMap.get(pid)!;
      const scored = byPlayer.get(pid);
      const statBreakdown: ScoringBreakdown[] = scored
        ? [...scored.categoryTotals.entries()].map(([label, { stat, multiplier }]) => ({
            label, stat, multiplier, points: round2(stat * multiplier),
          }))
        : [];
      return {
        playerId: pid,
        name: `${p.firstName} ${p.lastName}`,
        position: p.position,
        slot: slotMap.get(pid) ?? "BENCH",
        teamId: p.team?.id ?? null,
        teamAbbr: p.team?.abbreviation ?? null,
        points: scored?.pts ?? 0,
        gameCount: scored?.games ?? 0,
        statBreakdown,
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

function shiftPeriodsToStart(periods: ScoringPeriod[], startAt: Date): ScoringPeriod[] {
  const firstStart = periods.reduce(
    (min, period) => (period.startsAt < min ? period.startsAt : min),
    periods[0].startsAt
  );
  const offsetMs = startAt.getTime() - firstStart.getTime();
  return periods.map((period) => ({
    week: period.week,
    startsAt: new Date(period.startsAt.getTime() + offsetMs),
    endsAt: new Date(period.endsAt.getTime() + offsetMs),
  }));
}

// Generate Matchup rows for a league's full season and upsert them.
// Safe to re-run: upserts on (leagueId, week, homeTeamId).
export async function generateMatchups(
  leagueId: string,
  season: string,
  prisma: PrismaClient,
  options?: { startAt?: Date; reservePlayoffWeeks?: number }
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

  let periods = derivePeriods(gameDates);
  if (periods.length === 0) throw new Error(`No games found for season ${season}`);
  if (options?.startAt) {
    periods = shiftPeriodsToStart(periods, options.startAt);
  }
  if (options?.reservePlayoffWeeks && options.reservePlayoffWeeks > 0) {
    periods = periods.slice(0, periods.length - options.reservePlayoffWeeks);
    if (periods.length === 0) throw new Error("reservePlayoffWeeks exceeds total game weeks");
  }

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

// ── vs-the-field (VTF) scoring ────────────────────────────────────────────────
// Each week every team is compared against every other team. C(N,2) Matchup
// rows per period. A team's weekly record = (wins, losses, ties) across all
// N-1 opponents, accumulated into a season standing.

// Compute one score per active team. Called once per period rather than once
// per matchup pair, so we issue N queries instead of 2*C(N,2).
export async function computeAllTeamScores(
  leagueId: string,
  period: ScoringPeriod,
  scoringSettings: ScoringSettings,
  prisma: PrismaClient,
  nowMs?: number
): Promise<Map<string, number>> {
  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true },
  });
  const scores = new Map<string, number>();
  for (const { id } of teams) {
    scores.set(id, await computeTeamScore(id, period, scoringSettings, prisma, nowMs));
  }
  return scores;
}

// Generate all-vs-all Matchup rows for every scoring period in the season.
// Creates C(N,2) rows per period. Safe to re-run (find-then-create).
// options.weekIndices: if provided, only generate matchups for those 0-based period indices
//   (e.g. [2, 7, 11, 15] picks 4 weeks out of the full 20). Chronological order is preserved.
export async function generateVtfMatchups(
  leagueId: string,
  season: string,
  prisma: PrismaClient,
  options?: { weekIndices?: number[] }
): Promise<ScoringPeriod[]> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    include: { teams: { orderBy: { draftOrder: "asc" } } },
  });
  const teamIds = league.teams.map((t) => t.id);
  if (teamIds.length < 2) throw new Error("Need at least 2 teams");

  const gameDates = await prisma.game
    .findMany({ where: { season }, select: { startsAt: true } })
    .then((rows) => rows.map((r) => r.startsAt));
  const allPeriods = derivePeriods(gameDates);
  if (allPeriods.length === 0) throw new Error(`No games found for season ${season}`);

  // If weekIndices provided, pick only those (sorted to keep chronological order).
  const selectedPeriods = options?.weekIndices
    ? options.weekIndices
        .slice()
        .sort((a, b) => a - b)
        .map((i) => allPeriods[i])
        .filter((p): p is ScoringPeriod => Boolean(p))
    : allPeriods;

  if (selectedPeriods.length === 0) throw new Error("No valid periods after applying weekIndices filter");

  // Renumber weeks consecutively so DB week numbers are 1-based and contiguous.
  const periods = selectedPeriods.map((p, idx) => ({ ...p, week: idx + 1 }));

  // Batch per period: delete any existing rows for this league+week then
  // createMany. Much faster than N*C(N,2) individual find-then-create trips.
  for (const period of periods) {
    await prisma.matchup.deleteMany({ where: { leagueId, week: period.week } });
    const data = [];
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        data.push({
          leagueId,
          week: period.week,
          startsAt: period.startsAt,
          endsAt: period.endsAt,
          homeTeamId: teamIds[i],
          awayTeamId: teamIds[j],
        });
      }
    }
    await prisma.matchup.createMany({ data });
  }
  return periods;
}

// Generate VTF matchups for a beta league: picks 4 random weeks from the fixture,
// remaps their startsAt/endsAt to real consecutive 7-day windows starting the day
// after draftStartsAt, but keeps the original fixture startsAt/endsAt stored in the
// Matchup rows so stat-line queries use the correct historical dates.
//
// Wait — per the plan: "ScoringPeriod.startsAt/endsAt windows are only used for period
// status/lock detection". Stat line queries in scoring already use the period object
// passed in. So for beta leagues we store REMAPPED dates in the Matchup rows, and
// scoring will use those remapped dates as the window for stat line queries.
// This means the stat lines within the original fixture weeks (e.g. Nov 22–28) will
// be queried using the REMAPPED window (e.g. Jul 8–14). This would return zero stat
// lines since the fixture games live at their original dates.
//
// Correct approach per plan §4: "stat line queries still use original fixture game dates".
// We store REMAPPED dates in the Matchup rows for period status/lock detection,
// but scoring must use the ORIGINAL period dates. Since scoreVtfWeek takes a ScoringPeriod
// from the Matchup, we need to pass the original dates separately.
//
// Implementation: store remapped dates in Matchup.startsAt/endsAt for period detection.
// Store original dates in Matchup.homeScore metadata? No — that would require schema changes.
//
// Simpler approach (matches what the plan says): generate matchup rows with ORIGINAL
// fixture dates. The periods for lock detection / week status are derived from the
// Matchup dates. But beta leagues run on real wall clock, so a Nov week would never
// become ACTIVE in July.
//
// Conclusion after re-reading the plan: remapped dates go in Matchup rows. Stat lines
// are for the FIXTURE weeks, not the remapped weeks. This means scoring will use the
// remapped window dates when calling computeTeamScore, which will find zero stat lines.
//
// The plan must intend: store fixture dates in Matchup rows (for stat scoring), but
// use remapped dates for period lifecycle (ACTIVE/SCORING_PENDING detection).
//
// Since we can't store both in the current schema without a new column, the correct
// approach is: store REMAPPED dates in Matchup rows (period lifecycle), and rely on a
// separate ScoringPeriod→fixtureWindow mapping to score. But scoreVtfWeek gets the
// ScoringPeriod from Matchup rows...
//
// Decision: store remapped dates in Matchup.startsAt/endsAt (for period lifecycle),
// and store the fixture window bounds in scoringSettings.betaWeekMappings so
// scoreVtfWeek can look them up. This requires NO schema change.
//
// scoringSettings is already Json. Add: betaWeekMappings: Array<{week, fixtureStart, fixtureEnd}>
export async function generateBetaMatchups(
  leagueId: string,
  league: { draftStartsAt: Date | null; scoringSettings: unknown; season: string },
  prisma: PrismaClient
): Promise<ScoringPeriod[]> {
  const settings = (league.scoringSettings ?? {}) as Record<string, unknown>;
  const weekIndices = (settings.betaWeekIndices as number[] | undefined) ?? [];

  if (weekIndices.length === 0) {
    throw new Error("Beta league has no betaWeekIndices in scoringSettings");
  }

  const gameDates = await prisma.game
    .findMany({ where: { season: league.season }, select: { startsAt: true } })
    .then((rows) => rows.map((r) => r.startsAt));

  const allPeriods = derivePeriods(gameDates);
  if (allPeriods.length === 0) throw new Error(`No games found for season ${league.season}`);

  // Pick the fixture periods for the selected weeks.
  const fixturePeriods = weekIndices
    .slice()
    .sort((a, b) => a - b)
    .map((i) => allPeriods[i])
    .filter((p): p is ScoringPeriod => Boolean(p));

  if (fixturePeriods.length === 0) throw new Error("No valid fixture periods for betaWeekIndices");

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  // Remap to real consecutive weeks starting draftStartsAt + 1 day (noon UTC to be safe).
  const draftStart = league.draftStartsAt?.getTime() ?? Date.now();
  const firstWeekStart = draftStart + 24 * 60 * 60 * 1000; // +1 day

  const remappedPeriods: ScoringPeriod[] = fixturePeriods.map((fp, idx) => ({
    week: idx + 1,
    startsAt: new Date(firstWeekStart + idx * WEEK_MS),
    endsAt: new Date(firstWeekStart + (idx + 1) * WEEK_MS),
  }));

  // Save fixture window mapping into scoringSettings so scoreVtfWeek can look up
  // the original dates when computing scores.
  const betaWeekMappings = fixturePeriods.map((fp, idx) => ({
    week: idx + 1,
    fixtureStart: fp.startsAt.toISOString(),
    fixtureEnd: fp.endsAt.toISOString(),
  }));

  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: {
      scoringSettings: {
        ...(settings as object),
        betaWeekMappings,
      },
    },
  });

  // Fetch teams ordered by draft order.
  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    orderBy: { draftOrder: "asc" },
    select: { id: true },
  });
  const teamIds = teams.map((t) => t.id);
  if (teamIds.length < 2) throw new Error("Need at least 2 teams");

  // Create matchup rows with REMAPPED dates (period lifecycle uses these).
  for (const period of remappedPeriods) {
    await prisma.matchup.deleteMany({ where: { leagueId, week: period.week } });
    const data = [];
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        data.push({
          leagueId,
          week: period.week,
          startsAt: period.startsAt,
          endsAt: period.endsAt,
          homeTeamId: teamIds[i],
          awayTeamId: teamIds[j],
        });
      }
    }
    await prisma.matchup.createMany({ data });
  }

  return remappedPeriods;
}

export interface WeeklyResult {
  score: number;
  wins: number;
  losses: number;
  ties: number;
}

// Score all VTF matchups for one week. Computes each team's score once, fills
// all matchup rows with the cached scores, and returns W-L-T for each team.
export async function scoreVtfWeek(
  leagueId: string,
  week: number,
  period: ScoringPeriod,
  prisma: PrismaClient
): Promise<Map<string, WeeklyResult>> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { scoringSettings: true },
  });
  const settings = parseScoringSettings(league.scoringSettings);

  // Beta leagues store period dates in real July time for lifecycle/lock detection,
  // but stat lines live at their original fixture dates. Swap in the fixture window
  // before scoring so the stat line query actually finds data.
  const rawSettings = league.scoringSettings as Record<string, unknown>;
  const betaWeekMappings = rawSettings?.betaWeekMappings as
    | { week: number; fixtureStart: string; fixtureEnd: string }[]
    | undefined;
  const fixtureMapping = betaWeekMappings?.find((m) => m.week === week);
  const scoringPeriod: ScoringPeriod = fixtureMapping
    ? { week, startsAt: new Date(fixtureMapping.fixtureStart), endsAt: new Date(fixtureMapping.fixtureEnd) }
    : period;

  const scores = await computeAllTeamScores(leagueId, scoringPeriod, settings, prisma);

  // Persist cached scores to all matchup rows for the week.
  const matchups = await prisma.matchup.findMany({
    where: { leagueId, week },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });
  for (const m of matchups) {
    await prisma.matchup.update({
      where: { id: m.id },
      data: {
        homeScore: scores.get(m.homeTeamId) ?? null,
        awayScore: scores.get(m.awayTeamId) ?? null,
      },
    });
  }

  // Derive W-L-T for each team from the scores map.
  const teamIds = [...scores.keys()];
  const results = new Map<string, WeeklyResult>();
  for (const teamId of teamIds) {
    const myScore = scores.get(teamId)!;
    let wins = 0, losses = 0, ties = 0;
    for (const otherId of teamIds) {
      if (otherId === teamId) continue;
      const theirScore = scores.get(otherId)!;
      if (myScore > theirScore) wins++;
      else if (myScore < theirScore) losses++;
      else ties++;
    }
    results.set(teamId, { score: myScore, wins, losses, ties });
  }
  return results;
}

// ── playoff matchup generation ────────────────────────────────────────────────

export interface PlayoffMatchupPairing {
  homeTeamId: string;
  awayTeamId: string;
  round: number;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Generate playoff matchups for a league.
 * 
 * Creates Matchup rows for each playoff matchup, with isPlayoff=true and round set.
 * Safe to re-run: will update existing matchups.
 */
export async function generatePlayoffMatchups(
  leagueId: string,
  pairings: PlayoffMatchupPairing[],
  prisma: PrismaClient
): Promise<void> {
  // Determine the max regular-season week so playoff weeks get meaningful numbers
  // (maxWeek + round) instead of "Week 0".
  const maxWeekRow = await prisma.matchup.aggregate({
    where: { leagueId, isPlayoff: false },
    _max: { week: true },
  });
  const maxRegularWeek = maxWeekRow._max.week ?? 0;

  for (const pairing of pairings) {
    const playoffWeek = maxRegularWeek + pairing.round;

    const existing = await prisma.matchup.findFirst({
      where: {
        leagueId,
        round: pairing.round,
        homeTeamId: pairing.homeTeamId,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.matchup.update({
        where: { id: existing.id },
        data: {
          week: playoffWeek,
          homeTeamId: pairing.homeTeamId,
          awayTeamId: pairing.awayTeamId,
          startsAt: pairing.startsAt,
          endsAt: pairing.endsAt,
          isPlayoff: true,
          round: pairing.round,
        },
      });
    } else {
      await prisma.matchup.create({
        data: {
          leagueId,
          week: playoffWeek,
          homeTeamId: pairing.homeTeamId,
          awayTeamId: pairing.awayTeamId,
          startsAt: pairing.startsAt,
          endsAt: pairing.endsAt,
          isPlayoff: true,
          round: pairing.round,
        },
      });
    }
  }
}
