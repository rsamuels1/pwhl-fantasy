import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scoreVtfWeek } from "@/lib/scoring/matchups";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const { leagueId } = await params;
  const body = await req.json().catch(() => ({})) as { week?: unknown };
  const week = typeof body.week === "number" ? body.week : null;
  if (!week || week < 1) {
    return NextResponse.json({ error: "week must be a positive integer" }, { status: 400 });
  }

  // Load the period dates from existing matchup rows for this week.
  const periodRow = await prisma.matchup.findFirst({
    where: { leagueId, week, isPlayoff: false },
    select: { startsAt: true, endsAt: true },
  });
  if (!periodRow) {
    return NextResponse.json({ error: `No matchups found for week ${week} in this league` }, { status: 404 });
  }

  const period = { week, startsAt: periodRow.startsAt, endsAt: periodRow.endsAt };
  const results = await scoreVtfWeek(leagueId, week, period, prisma);

  // Audit log — fire-and-forget, never blocks the response
  void prisma.leagueEvent.create({
    data: {
      leagueId,
      type: "COMMISSIONER_SETTINGS_CHANGED",
      data: { action: "rescore-week", week, triggeredBy: auth.email ?? "founder", timestamp: new Date().toISOString() },
    },
  }).catch(() => {});

  const summary = Array.from(results.entries()).map(([teamId, r]) => ({
    teamId,
    score: r.score,
    wins: r.wins,
    losses: r.losses,
  }));

  return NextResponse.json({
    week,
    message: `Week ${week} re-scored for ${summary.length} teams`,
    results: summary,
  });
}
