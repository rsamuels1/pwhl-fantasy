// DEV/TEST ONLY — this route is blocked in production.
//
// Drives the production advanceSeason() engine with a caller-supplied simulated
// date instead of the real wall clock. No special code path exists — this is a
// thin wrapper over the exact same functions the real season uses.
//
// Gate: NODE_ENV !== "production"  OR  ALLOW_SIM_DATE=true env var.
// Set ALLOW_SIM_DATE=true on a staging Vercel deployment to enable simulation.
// Never set this on the production deployment.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSeasonState, startSeason, advanceSeason } from "@/lib/season";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";

function isAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SIM_DATE === "true"
  );
}

// POST /api/leagues/[leagueId]/season/advance
// Body: { simulatedDate: string (ISO), action?: "start" | "advance" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  if (!isAllowed()) {
    return NextResponse.json({ error: "Not available in production." }, { status: 403 });
  }

  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const body = await req.json() as { simulatedDate?: string; action?: string };

  if (!body.simulatedDate) {
    return NextResponse.json({ error: "simulatedDate is required." }, { status: 400 });
  }

  const nowMs = new Date(body.simulatedDate).getTime();
  if (isNaN(nowMs)) {
    return NextResponse.json({ error: "simulatedDate is not a valid ISO date." }, { status: 400 });
  }

  const action = body.action ?? "advance";

  try {
    if (action === "start") {
      await startSeason(leagueId, prisma);
    }

    const result = await advanceSeason(leagueId, nowMs, prisma);
    const state = await getSeasonState(leagueId, nowMs, prisma);

    return NextResponse.json({
      simulatedDate: new Date(nowMs).toISOString(),
      scoredWeeks: result.scoredWeeks,
      message: result.scoredWeeks.length > 0
        ? `[TEST] Scored week(s) ${result.scoredWeeks.join(", ")} at simulated date ${new Date(nowMs).toISOString()}.`
        : `[TEST] No periods due at simulated date ${new Date(nowMs).toISOString()}.`,
      state,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Advance failed.";
    console.error("[season/advance]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
