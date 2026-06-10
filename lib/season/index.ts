// lib/season/index.ts
// DB layer for the season lifecycle. Loads data from the DB, calls the pure
// engine, and runs VTF scoring for any periods that are now due.
// Reuses the validated generateVtfMatchups / scoreVtfWeek from lib/scoring/matchups.ts.

import type { PrismaClient } from "@prisma/client";
import { derivePeriods } from "@/lib/scoring/periods";
import { generateVtfMatchups, scoreVtfWeek } from "@/lib/scoring/matchups";
import { computeSeasonState, pendingWeeks, type SeasonState } from "./lifecycle";

// Load everything needed for the lifecycle engine from the DB, then run the pure engine.
export async function getSeasonState(
  leagueId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<SeasonState> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { season: true },
  });

  const [gameDates, scoredMatchups] = await Promise.all([
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
  ]);

  const periods = derivePeriods(gameDates.map((g) => g.startsAt));
  const scoredWeeks = new Set(scoredMatchups.map((m) => m.week));

  return computeSeasonState(periods, gameDates, scoredWeeks, nowMs);
}

// Start the season: generate all VTF matchup rows upfront and set status to IN_SEASON.
// Safe to call again if already started (generateVtfMatchups is idempotent).
export async function startSeason(leagueId: string, prisma: PrismaClient): Promise<void> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { season: true, status: true },
  });

  await generateVtfMatchups(leagueId, league.season, prisma);

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
): Promise<{ scoredWeeks: number[] }> {
  const state = await getSeasonState(leagueId, nowMs, prisma);
  const due = pendingWeeks(state);

  const scoredWeeks: number[] = [];
  for (const period of due) {
    await scoreVtfWeek(leagueId, period.week, period, prisma);
    scoredWeeks.push(period.week);
  }

  // Advance FantasyLeague.status based on the post-scoring state.
  if (due.length > 0) {
    const updated = await getSeasonState(leagueId, nowMs, prisma);
    if (updated.lifecycleStatus === "COMPLETE") {
      await prisma.fantasyLeague.update({
        where: { id: leagueId },
        data: { status: "COMPLETE" },
      });
    } else if (updated.lifecycleStatus === "IN_PROGRESS") {
      await prisma.fantasyLeague.update({
        where: { id: leagueId },
        data: { status: "IN_SEASON" },
      });
    }
  }

  return { scoredWeeks };
}
