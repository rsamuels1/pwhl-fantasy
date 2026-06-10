import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSeasonState, startSeason, advanceSeason } from "@/lib/season";

// GET /api/leagues/[leagueId]/season
// Returns the current season state using the real wall clock.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  try {
    const state = await getSeasonState(leagueId, Date.now(), prisma);
    return NextResponse.json(state);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load season state." }, { status: 500 });
  }
}

// POST /api/leagues/[leagueId]/season
// Body: { action: "start" | "advance" }
// "start"   — generates VTF matchups and sets status to IN_SEASON.
// "advance" — scores any periods due right now (uses real wall clock).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const body = await req.json() as { action?: string };
  const action = body.action ?? "advance";

  try {
    if (action === "start") {
      await startSeason(leagueId, prisma);
      const state = await getSeasonState(leagueId, Date.now(), prisma);
      return NextResponse.json({ message: "Season started.", state });
    }

    if (action === "advance") {
      const result = await advanceSeason(leagueId, Date.now(), prisma);
      const state = await getSeasonState(leagueId, Date.now(), prisma);
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
    console.error(err);
    return NextResponse.json({ error: "Season action failed." }, { status: 500 });
  }
}
