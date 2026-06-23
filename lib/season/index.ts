// lib/season/index.ts
// DB layer for the season lifecycle. Loads data from the DB, calls the pure
// engine, and runs VTF scoring for any periods that are now due.
// Reuses the validated generateVtfMatchups / scoreVtfWeek from lib/scoring/matchups.ts.

// ── Season string helpers ─────────────────────────────────────────────────────

// "2025-26" → "2024-25"; handles variable-length end year ("2025-6" would → "2024-05")
export function getPriorSeason(season: string): string {
  const [startStr, endStr] = season.split("-");
  const start = Number(startStr);
  const end = Number(endStr);
  // end is typically a 2-digit suffix (e.g. "26" in "2025-26")
  const newEnd = end - 1;
  return `${start - 1}-${String(newEnd).padStart(2, "0")}`;
}

import type { PrismaClient } from "@prisma/client";
import { derivePeriods } from "@/lib/scoring/periods";
import { generateVtfMatchups, generateMatchups, generateBetaMatchups, scoreVtfWeek } from "@/lib/scoring/matchups";
import { scoreVpWeek } from "@/lib/scoring/vp";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { computeSeasonState, pendingWeeks, validateSeasonBoundary, type SeasonState } from "./lifecycle";
import { startPlayoffs } from "@/lib/services/playoff-service";
import { initializeWaiverPriority } from "@/lib/services/waiver-service";
import { emitWeeklyStorylines } from "@/lib/services/storyline-service";
import { calculatePlayoffRounds, getPlayoffSettings } from "@/lib/playoffs/lifecycle";

// Load everything needed for the lifecycle engine from the DB, then run the pure engine.
export async function getSeasonState(
  leagueId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<SeasonState> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { season: true, scoringSettings: true },
  });

  const [gameDates, scoredMatchups, allRegularMatchups] = await Promise.all([
    prisma.game.findMany({
      where: { season: league.season },
      select: { startsAt: true, status: true },
    }),
    // A week is "scored" when at least one VTF matchup for that week has a cached score.
    prisma.matchup.findMany({
      where: { leagueId, isPlayoff: false, homeScore: { not: null } },
      select: { week: true },
      distinct: ["week"],
    }),
    // All regular-season matchups (scored or not) to cap periods to actual generated weeks.
    prisma.matchup.findMany({
      where: { leagueId, isPlayoff: false },
      select: { week: true, startsAt: true, endsAt: true },
      distinct: ["week"],
      orderBy: { week: "asc" },
    }),
  ]);

  const rawSettings = (league.scoringSettings ?? {}) as Record<string, unknown>;
  const hasBetaMappings =
    Array.isArray(rawSettings.betaWeekMappings) &&
    (rawSettings.betaWeekMappings as unknown[]).length > 0;

  let periods: ReturnType<typeof derivePeriods>;
  if (hasBetaMappings && allRegularMatchups.length > 0) {
    // Beta leagues: matchup rows store remapped real-calendar dates (not 2025-26 dates).
    // Use those so lifecycle (UPCOMING/ACTIVE/SCORING_PENDING) reflects real clock time.
    periods = allRegularMatchups.map((m) => ({
      week: m.week,
      startsAt: m.startsAt,
      endsAt: m.endsAt,
    }));
  } else {
    periods = derivePeriods(gameDates.map((g) => g.startsAt));
    // If regular-season matchups were created with reservePlayoffWeeks, cap periods to match.
    if (allRegularMatchups.length > 0) {
      const maxRegularWeek = Math.max(...allRegularMatchups.map((m) => m.week));
      periods = periods.slice(0, maxRegularWeek);
    }
  }

  const scoredWeeks = new Set(scoredMatchups.map((m) => m.week));

  return computeSeasonState(periods, gameDates, scoredWeeks, nowMs);
}

// Start the season: generate all VTF matchup rows upfront and set status to IN_SEASON.
// Safe to call again if already started (generateVtfMatchups is idempotent).
export async function startSeason(leagueId: string, prisma: PrismaClient): Promise<void> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
  });

  // Detect season mismatch before hitting the internal error from generateVtfMatchups.
  const gameCount = await prisma.game.count({ where: { season: league.season } });
  if (gameCount === 0) {
    const available = await prisma.game.findMany({
      distinct: ["season"],
      select: { season: true },
    });
    const seasons = available.map((g) => g.season).join(", ");
    throw new Error(
      `League season is "${league.season}" but no games exist for that season. ` +
      `Available seasons in DB: ${seasons || "none"}. ` +
      `Load the fixture with: npm run seed-fixture -- --season ${seasons || "<season>"}`
    );
  }

  // Check season boundary if PWHL playoff start is configured on this league.
  const pwhlPlayoffStartsAt = (league as { pwhlPlayoffStartsAt?: Date | null }).pwhlPlayoffStartsAt;
  if (pwhlPlayoffStartsAt) {
    const { derivePeriods } = await import("@/lib/scoring/periods");
    const gameDates = await prisma.game.findMany({
      where: { season: league.season },
      select: { startsAt: true },
    });
    const periods = derivePeriods(gameDates.map((g) => g.startsAt));
    const boundary = validateSeasonBoundary(periods, pwhlPlayoffStartsAt.getTime());
    if (!boundary.valid) {
      throw new Error(boundary.message ?? "Fantasy season overlaps PWHL playoff window.");
    }
  }

  // VP mode uses 1v1 round-robin matchups; VTF uses all-vs-all.
  // Beta leagues (betaStatus === "ACTIVE") use a subset of weeks from the fixture,
  // remapped to real July 2026 dates for period lifecycle detection.
  const scoringMode = league.scoringMode ?? "VTF";
  if (league.betaStatus === "ACTIVE") {
    await generateBetaMatchups(leagueId, {
      draftStartsAt: league.draftStartsAt,
      scoringSettings: league.scoringSettings,
      season: league.season,
    }, prisma);
  } else if (scoringMode === "VP") {
    const ps = getPlayoffSettings(league.playoffSettings as Parameters<typeof getPlayoffSettings>[0]);
    const playoffRounds = calculatePlayoffRounds(ps.teamsInPlayoff);
    await generateMatchups(leagueId, league.season, prisma, { reservePlayoffWeeks: playoffRounds });
  } else {
    await generateVtfMatchups(leagueId, league.season, prisma);
  }

  // Initialize waiver priority (reverse VP standings; pre-season falls back to reverse draft order).
  await initializeWaiverPriority(leagueId, prisma);

  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: { status: "IN_SEASON" },
  });
}

// Advance the season: score any periods whose window has closed (endsAt <= nowMs)
// and whose matchup scores haven't been cached yet.
// This is the exact same code path in production and in the test harness — the only
// difference is the nowMs value passed in.
export async function advanceSeason(
  leagueId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<{ scoredWeeks: number[]; playoffError?: string }> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
  });
  const scoringMode = league.scoringMode ?? "VTF";
  const scoringSettings = parseScoringSettings(league.scoringSettings);

  const state = await getSeasonState(leagueId, nowMs, prisma);
  const due = pendingWeeks(state);

  const scoredWeeks: number[] = [];
  for (const period of due) {
    if (scoringMode === "VP") {
      await scoreVpWeek(leagueId, period.week, period, scoringSettings, prisma);
    } else {
      await scoreVtfWeek(leagueId, period.week, period, prisma);
    }
    scoredWeeks.push(period.week);
    // Emit storylines after scoring — fire-and-forget, never blocks the advance.
    void emitWeeklyStorylines(leagueId, period.week, period.startsAt, period.endsAt, prisma).catch(() => {});
  }

  let playoffError: string | undefined;
  // Advance FantasyLeague.status based on the post-scoring state.
  if (due.length > 0) {
    const updated = await getSeasonState(leagueId, nowMs, prisma);
    if (updated.lifecycleStatus === "COMPLETE") {
      await prisma.fantasyLeague.update({
        where: { id: leagueId },
        data: { status: "COMPLETE" },
      });
      // Auto-initialize playoffs. startPlayoffs() is a no-op when
      // playoffStatus !== "NOT_STARTED", so this is safe to call unconditionally.
      try {
        await startPlayoffs(leagueId, prisma);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[advanceSeason] auto-startPlayoffs failed:", errMsg);
        playoffError = errMsg;
      }
    } else if (updated.lifecycleStatus === "IN_PROGRESS") {
      await prisma.fantasyLeague.update({
        where: { id: leagueId },
        data: { status: "IN_SEASON" },
      });
    }
  }

  return { scoredWeeks, playoffError };
}
