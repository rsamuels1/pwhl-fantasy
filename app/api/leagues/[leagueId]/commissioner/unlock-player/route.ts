import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { logCommissionerAction } from "@/lib/services/audit-service";
import { validateSlotMove, type RosterSettings } from "@/lib/lineup";
import { getSeasonState } from "@/lib/season";
import { getDevNowFromRequest } from "@/lib/devTime";
import type { LineupSlot } from "@prisma/client";

const VALID_SLOTS = ["FORWARD", "DEFENSE", "GOALIE", "UTIL", "BENCH", "IR"] as const;

// POST /api/leagues/[leagueId]/commissioner/unlock-player
// Commissioner-only. Clears period-lock on a player; enforces play-lock.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const body = (await req.json().catch(() => ({}))) as {
    teamId?: string;
    playerId?: string;
    targetSlot?: string;
    reason?: string;
  };

  if (!body.teamId || !body.playerId || !body.targetSlot) {
    return NextResponse.json(
      { error: "Missing teamId, playerId, or targetSlot" },
      { status: 400 }
    );
  }

  // Validate targetSlot
  if (!VALID_SLOTS.includes(body.targetSlot as any)) {
    return NextResponse.json(
      { error: `Invalid target slot: ${body.targetSlot}` },
      { status: 400 }
    );
  }

  const targetSlot = body.targetSlot as LineupSlot;

  // Fetch player
  const player = await prisma.player.findUnique({
    where: { id: body.playerId },
    select: { position: true, active: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Fetch roster
  const roster = await prisma.rosterEntry.findMany({
    where: { fantasyTeam: { id: body.teamId } },
    select: { playerId: true, slot: true },
  });

  // Fetch rosterSettings
  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { rosterSettings: true, status: true },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const settings = (league.rosterSettings ?? {}) as RosterSettings;

  // Validate slot eligibility
  const validationError = validateSlotMove(
    player.position,
    player.active,
    targetSlot,
    roster,
    body.playerId,
    settings
  );

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Fetch active period to check play-lock
  const nowMs = getDevNowFromRequest(req);
  const state = await getSeasonState(leagueId, nowMs, prisma);

  const activePeriod = state.activePeriod;

  // Enforce play-lock: if player has stats in active period and target is BENCH/IR, reject
  if (activePeriod && ["BENCH", "IR"].includes(targetSlot)) {
    const statsInPeriod = await prisma.statLine.count({
      where: {
        playerId: body.playerId,
        game: {
          startsAt: {
            gte: activePeriod.startsAt,
            lte: new Date(nowMs),
          },
        },
      },
    });

    if (statsInPeriod > 0) {
      return NextResponse.json(
        { error: "Player has already scored this period — cannot move to bench" },
        { status: 409 }
      );
    }
  }

  // Update the roster entry
  await prisma.rosterEntry.updateMany(
    {
      where: {
        playerId: body.playerId,
        fantasyTeam: { id: body.teamId },
      },
      data: { slot: targetSlot },
    }
  );

  // Log the action
  await logCommissionerAction(
    leagueId,
    auth.id,
    "COMMISSIONER_FORCE_MOVE",
    {
      playerId: body.playerId,
      targetSlot,
      bypassLock: true,
      reason: body.reason,
    },
    prisma
  );

  return NextResponse.json({ success: true });
}
