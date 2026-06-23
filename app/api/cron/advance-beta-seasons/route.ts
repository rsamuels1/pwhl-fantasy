import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { advanceSeason } from "@/lib/season";

// Called by Vercel Cron daily at 09:00 UTC.
// Also callable manually: POST /api/cron/advance-beta-seasons
// Scores any completed weeks for all active beta replay leagues running on real calendar time.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  const isAllowed =
    (expected !== null && secret === expected) ||
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SEASON_ADVANCE === "true";

  if (!isAllowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all active beta leagues using real-time play (replayCurrentDate is null).
  const betaLeagues = await prisma.fantasyLeague.findMany({
    where: {
      betaStatus: "ACTIVE",
      status: "IN_SEASON",
      replayCurrentDate: null,
    },
    select: { id: true },
  });

  const results: { leagueId: string; scoredWeeks: number[]; error?: string }[] = [];
  const nowMs = Date.now();

  for (const league of betaLeagues) {
    try {
      const { scoredWeeks, playoffError } = await advanceSeason(league.id, nowMs, prisma);
      results.push({ leagueId: league.id, scoredWeeks, error: playoffError });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/advance-beta-seasons] league ${league.id} failed:`, msg);
      results.push({ leagueId: league.id, scoredWeeks: [], error: msg });
    }
  }

  return NextResponse.json({ processed: betaLeagues.length, results });
}
