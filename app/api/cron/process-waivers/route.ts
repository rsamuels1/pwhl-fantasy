import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processWaivers } from "@/lib/services/waiver-service";
import { logger } from "@/lib/logger";

// Called by Vercel Cron daily at 03:00 ET (08:00 UTC).
// Also callable manually: POST /api/cron/process-waivers
// Auth: CRON_SECRET header OR ALLOW_SEASON_ADVANCE env var (dev).
export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  // In production, require the secret. In dev/test, allow if ALLOW_SEASON_ADVANCE is set.
  const isAllowed =
    (expected !== null && secret === expected) ||
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SEASON_ADVANCE === "true";

  if (!isAllowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowMs = Date.now();

  try {
    // Process all IN_SEASON leagues.
    const leagues = await prisma.fantasyLeague.findMany({
      where: { status: "IN_SEASON" },
      select: { id: true },
    });

    const results: { leagueId: string; awarded: number; denied: number; expired: number }[] = [];
    for (const league of leagues) {
      try {
        const result = await processWaivers(league.id, nowMs, prisma);
        results.push({ leagueId: league.id, ...result });
      } catch (err) {
        logger.error(`[cron/process-waivers] league ${league.id} failed`, err);
        results.push({ leagueId: league.id, awarded: 0, denied: 0, expired: 0 });
      }
    }

    const totals = results.reduce(
      (acc, r) => ({ awarded: acc.awarded + r.awarded, denied: acc.denied + r.denied, expired: acc.expired + r.expired }),
      { awarded: 0, denied: 0, expired: 0 }
    );

    logger.info(`[cron/process-waivers] processed ${leagues.length} leagues`, totals);
    return NextResponse.json({ ok: true, leagues: results.length, ...totals });
  } catch (err) {
    logger.error("[cron/process-waivers] fatal error", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
