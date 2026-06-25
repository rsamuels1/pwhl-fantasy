import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HockeytechSource, checkGameFinal, fetchGameStartTime } from "@/lib/ingestion/hockeytech";
import { logger } from "@/lib/logger";
import { LIVE_SEASON } from "@/lib/constants";

// Called by Vercel Cron every 30 min from 5–11 PM ET (UTC 22:00–04:00, "0/30 22-4 * * *").
// Also callable manually: POST /api/cron/ingest-live-stats
//
// Finds games in the live season that started in the past 8 hours and aren't yet
// marked FINAL in the DB. For each, checks HockeyTech — if the game is now final,
// fetches and upserts stat lines so matchup scores are ready for the nightly advance cron.
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
    const nowMs = Date.now();
    // Look back 8 hours (game window) and forward 2 hours (games about to start
    // will be ignored — they can't be final yet).
    const windowStart = new Date(nowMs - 8 * 60 * 60 * 1000);
    const windowEnd = new Date(nowMs);

    const candidates = await prisma.game.findMany({
      where: {
        season: LIVE_SEASON,
        status: { not: "FINAL" },
        startsAt: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, externalId: true },
    });

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, ingested: 0, statLines: 0 });
    }

    const source = new HockeytechSource();
    let ingested = 0;
    let totalStatLines = 0;

    for (const game of candidates) {
      try {
        const { isFinal, startsAt } = await checkGameFinal(game.externalId);
        if (!isFinal) continue;

        // Game is now final — fetch stat lines.
        const lines = await source.fetchStatLines(game.externalId);

        for (const l of lines) {
          const player = await prisma.player.findUnique({
            where: { externalId: l.playerExternalId },
          });
          if (!player) continue;

          await prisma.statLine.upsert({
            where: { playerId_gameId: { playerId: player.id, gameId: game.id } },
            update: {
              goals: l.goals,
              assists: l.assists,
              shots: l.shots,
              plusMinus: l.plusMinus,
              penaltyMinutes: l.penaltyMinutes,
              powerPlayPts: l.powerPlayPts,
              hits: l.hits,
              blocks: l.blocks,
              saves: l.saves,
              goalsAgainst: l.goalsAgainst,
              shutout: l.shutout,
              win: l.win,
              timeOnIceSecs: l.timeOnIceSecs,
            },
            create: {
              playerId: player.id,
              gameId: game.id,
              goals: l.goals,
              assists: l.assists,
              shots: l.shots,
              plusMinus: l.plusMinus,
              penaltyMinutes: l.penaltyMinutes,
              powerPlayPts: l.powerPlayPts,
              hits: l.hits,
              blocks: l.blocks,
              saves: l.saves,
              goalsAgainst: l.goalsAgainst,
              shutout: l.shutout,
              win: l.win,
              timeOnIceSecs: l.timeOnIceSecs,
            },
          });
          totalStatLines++;
        }

        // Mark the game FINAL and backfill the precise start time.
        await prisma.game.update({
          where: { id: game.id },
          data: {
            status: "FINAL",
            ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
          },
        });

        ingested++;
      } catch (err) {
        logger.error(`[cron/ingest-live-stats] game ${game.externalId} failed`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      checked: candidates.length,
      ingested,
      statLines: totalStatLines,
    });
  } catch (err) {
    logger.error("[cron/ingest-live-stats] fatal error", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
