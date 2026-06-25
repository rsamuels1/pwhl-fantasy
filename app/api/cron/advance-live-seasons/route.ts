import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { advanceSeason } from "@/lib/season";
import { logger } from "@/lib/logger";
import { LIVE_SEASON } from "@/lib/constants";

// Called by Vercel Cron once nightly at 5 AM UTC (midnight ET), after all games
// from the previous evening are final and their stat lines have been ingested.
// Also callable manually: POST /api/cron/advance-live-seasons
//
// Scores any completed weeks for all live (non-replay) IN_SEASON leagues.
// Replay leagues are handled separately by /api/cron/advance-beta-seasons.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  const isAllowed =
    (expected !== null && secret === expected) ||
    process.env.NODE_ENV !== "production";

  if (!isAllowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Live leagues: 2026-27 season, IN_SEASON, no replay date set.
    const liveLeagues = await prisma.fantasyLeague.findMany({
      where: {
        season: LIVE_SEASON,
        status: "IN_SEASON",
        replayCurrentDate: null,
      },
      select: { id: true },
    });

    const results: { leagueId: string; scoredWeeks: number[]; error?: string }[] = [];
    const nowMs = Date.now();

    for (const league of liveLeagues) {
      try {
        const { scoredWeeks, playoffError } = await advanceSeason(league.id, nowMs, prisma);
        results.push({ leagueId: league.id, scoredWeeks, error: playoffError });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[cron/advance-live-seasons] league ${league.id} failed`, err);
        results.push({ leagueId: league.id, scoredWeeks: [], error: msg });
      }
    }

    return NextResponse.json({ ok: true, processed: liveLeagues.length, results });
  } catch (err) {
    logger.error("[cron/advance-live-seasons] fatal error", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
