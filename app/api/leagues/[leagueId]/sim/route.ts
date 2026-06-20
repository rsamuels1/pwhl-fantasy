import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { advanceSeason, startSeason, getSeasonState } from "@/lib/season";
import { getDevNowFromRequest } from "@/lib/devTime";

interface SimRequest {
  action: "simulate" | "advance" | "start" | "skip-to-playoffs";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;

  // Auth check: first authenticate the user
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Then verify they're the commissioner
  const league = await apiRequireCommissioner(leagueId, auth.id);
  if (league instanceof NextResponse) return league;

  // Verify it's a replay league
  if (!league.isReplay) {
    return NextResponse.json(
      { error: "This league is not a replay league" },
      { status: 400 }
    );
  }

  // Parse request
  let body: SimRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  if (!["simulate", "advance", "start", "skip-to-playoffs"].includes(action)) {
    return NextResponse.json(
      { error: `Invalid action: ${action}` },
      { status: 400 }
    );
  }

  try {
    // Use the league's replayCurrentDate from the database, not the cookie
    const nowMs = league.replayCurrentDate?.getTime() ?? getDevNowFromRequest(req);

    if (action === "start") {
      // PRE_SEASON → SETUP: start the season
      await startSeason(leagueId, prisma);

      // Fetch the first period to set replayCurrentDate
      const state = await getSeasonState(leagueId, nowMs, prisma);
      const firstPeriod = state.periods[0];

      if (firstPeriod) {
        await prisma.fantasyLeague.update({
          where: { id: leagueId },
          data: { replayCurrentDate: firstPeriod.period.startsAt },
        });
      }

      return NextResponse.json({ ok: true, phase: "SETUP" });
    }

    if (action === "simulate") {
      // SETUP → RECAP: score the active week
      // We fetch the season state to find the active period's end time
      const state = await getSeasonState(leagueId, nowMs, prisma);
      const activePeriod = state.periods.find((p) => p.status === "ACTIVE")?.period;

      if (!activePeriod) {
        return NextResponse.json(
          { error: "No active period to simulate" },
          { status: 400 }
        );
      }

      // Score the active week by advancing to 1ms after it ends
      const scoreAtMs = activePeriod.endsAt.getTime() + 1;
      await advanceSeason(leagueId, scoreAtMs, prisma);

      // Update replayCurrentDate to just after the active period ended
      await prisma.fantasyLeague.update({
        where: { id: leagueId },
        data: { replayCurrentDate: new Date(scoreAtMs) },
      });

      return NextResponse.json({ ok: true, phase: "RECAP" });
    }

    if (action === "advance") {
      // RECAP → SETUP (next week): move to the next period's start
      const state = await getSeasonState(leagueId, nowMs, prisma);

      const nextPeriod = state.periods.find((p) => p.status === "UPCOMING");
      if (!nextPeriod) {
        return NextResponse.json(
          { error: "No upcoming period to advance to" },
          { status: 400 }
        );
      }

      // Update replayCurrentDate to the start of the next period
      await prisma.fantasyLeague.update({
        where: { id: leagueId },
        data: { replayCurrentDate: nextPeriod.period.startsAt },
      });

      return NextResponse.json({ ok: true, phase: "SETUP" });
    }

    if (action === "skip-to-playoffs") {
      // Advance past all remaining regular-season periods
      const state = await getSeasonState(leagueId, nowMs, prisma);

      const lastRegularSeasonPeriod = [...state.periods]
        .reverse()
        .find((p) => p.status !== "COMPLETE");

      if (!lastRegularSeasonPeriod) {
        return NextResponse.json(
          { error: "No regular season periods to skip" },
          { status: 400 }
        );
      }

      // Advance to 1ms after the last period ends
      const skipToMs = lastRegularSeasonPeriod.period.endsAt.getTime() + 1;
      await advanceSeason(leagueId, skipToMs, prisma);

      // Update replayCurrentDate
      await prisma.fantasyLeague.update({
        where: { id: leagueId },
        data: { replayCurrentDate: new Date(skipToMs) },
      });

      return NextResponse.json({ ok: true, phase: "SEASON_COMPLETE" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error(`[sim] Error handling action ${action}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
