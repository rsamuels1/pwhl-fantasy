import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAndEmitScheduledNotifications } from "@/lib/services/notification-service";

// Called by Vercel Cron daily at 12:00 UTC (08:00 ET).
// Fires LINEUP_INCOMPLETE notifications for team owners with starters
// whose PWHL team has no remaining games in the active scoring period.
// Auth: CRON_SECRET header OR ALLOW_SEASON_ADVANCE env var (dev).
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

  const nowMs = Date.now();

  // Get distinct owner IDs across all IN_SEASON leagues
  const teams = await prisma.fantasyTeam.findMany({
    where: { league: { status: "IN_SEASON" } },
    select: { ownerId: true },
    distinct: ["ownerId"],
  });

  const userIds = teams.map((t) => t.ownerId);
  for (const userId of userIds) {
    await checkAndEmitScheduledNotifications(userId, nowMs, prisma);
  }

  return NextResponse.json({ ok: true, usersChecked: userIds.length });
}
