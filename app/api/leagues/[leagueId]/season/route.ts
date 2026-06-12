import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSeasonState, startSeason, advanceSeason } from "@/lib/season";
import { apiRequireAuth, apiRequireLeagueMember, apiRequireCommissioner } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";

// GET /api/leagues/[leagueId]/season — any league member
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  try {
    const leagueRow = await prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      select: { isReplay: true, replayCurrentDate: true },
    });
    const nowMs = getReplayNow(
      leagueRow ?? { isReplay: false, replayCurrentDate: null },
      getDevNowFromRequest(req)
    );
    const state = await getSeasonState(leagueId, nowMs, prisma);
    return NextResponse.json(state);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load season state." }, { status: 500 });
  }
}

// POST /api/leagues/[leagueId]/season — commissioner only
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const body = await req.json() as { action?: string };
  const action = body.action ?? "advance";

  try {
    if (action === "start") {
      await startSeason(leagueId, prisma);
      const state = await getSeasonState(leagueId, getDevNowFromRequest(req), prisma);
      return NextResponse.json({ message: "Season started.", state });
    }

    if (action === "advance") {
      const result = await advanceSeason(leagueId, getDevNowFromRequest(req), prisma);
      const state = await getSeasonState(leagueId, getDevNowFromRequest(req), prisma);
      return NextResponse.json({
        message: result.scoredWeeks.length > 0
          ? `Scored week(s) ${result.scoredWeeks.join(", ")}.`
          : "No periods due yet.",
        scoredWeeks: result.scoredWeeks,
        state,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Season action failed.";
    console.error("[season]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
