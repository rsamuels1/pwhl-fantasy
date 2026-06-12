import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LineupSlot } from "@prisma/client";
import { validateSlotMove, lockTime, eligibleSlots } from "@/lib/lineup";
import type { RosterSettings } from "@/lib/lineup";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import { getSeasonState } from "@/lib/season";
import { logCommissionerAction } from "@/lib/services/audit-service";

const VALID_SLOTS: LineupSlot[] = ["FORWARD", "DEFENSE", "GOALIE", "UTIL", "BENCH", "IR"];

// POST /api/leagues/[leagueId]/commissioner/force-move
// Commissioner override for lineup moves on any team. Respects eligibility and lock rules.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const body = await req.json() as {
    teamId?: string;
    playerId?: string;
    slot?: string;
    swapWithPlayerId?: string;
    reason?: string;
  };

  if (!body.teamId || !body.playerId || !body.slot) {
    return NextResponse.json({ error: "Missing teamId, playerId, or slot" }, { status: 400 });
  }

  const targetSlot = body.slot as LineupSlot;
  if (!VALID_SLOTS.includes(targetSlot)) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const nowMs = getDevNowFromRequest(req);
  const now = new Date(nowMs);

  const [team, seasonState] = await Promise.all([
    prisma.fantasyTeam.findFirst({
      where: { id: body.teamId, leagueId },
      include: {
        roster: {
          include: {
            player: { include: { team: { select: { id: true } } } },
          },
        },
        league: { select: { rosterSettings: true } },
      },
    }),
    getSeasonState(leagueId, nowMs, prisma),
  ]);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const activePeriod = seasonState.periods.find((p) => p.status === "ACTIVE")?.period ?? null;
  const pwhlTeamIds = [...new Set(
    team.roster.map((e) => e.player.team?.id).filter((id): id is string => !!id)
  )];

  const periodGames = activePeriod && pwhlTeamIds.length > 0
    ? await prisma.game.findMany({
        where: {
          startsAt: { gte: activePeriod.startsAt, lte: now },
          OR: [{ homeTeamId: { in: pwhlTeamIds } }, { awayTeamId: { in: pwhlTeamIds } }],
        },
        select: { homeTeamId: true, awayTeamId: true, startsAt: true },
      })
    : [];

  const entry = team.roster.find((e) => e.playerId === body.playerId);
  if (!entry) return NextResponse.json({ error: "Player not on roster" }, { status: 404 });

  const playerTeamId = entry.player.team?.id ?? null;
  const locked = lockTime(playerTeamId, periodGames, nowMs, activePeriod?.startsAt.getTime());
  if (locked) {
    return NextResponse.json({
      error: `${entry.player.firstName} ${entry.player.lastName} is locked for this scoring period.`,
    }, { status: 409 });
  }

  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;
  const fromSlot = entry.slot;

  // Swap path
  if (body.swapWithPlayerId) {
    const entryB = team.roster.find((e) => e.playerId === body.swapWithPlayerId);
    if (!entryB) return NextResponse.json({ error: "Swap player not on roster" }, { status: 404 });

    const slotA = entry.slot;
    const slotB = entryB.slot;
    if (slotA === slotB) return NextResponse.json({ success: true });

    const eligA = eligibleSlots(entry.player.position, entry.player.active);
    const eligB = eligibleSlots(entryB.player.position, entryB.player.active);
    if (!eligA.includes(slotB)) {
      return NextResponse.json({ error: `${entry.player.firstName} ${entry.player.lastName} cannot play the ${slotB} slot.` }, { status: 422 });
    }
    if (!eligB.includes(slotA)) {
      return NextResponse.json({ error: `${entryB.player.firstName} ${entryB.player.lastName} cannot play the ${slotA} slot.` }, { status: 422 });
    }

    await prisma.$transaction([
      prisma.rosterEntry.update({
        where: { fantasyTeamId_playerId: { fantasyTeamId: body.teamId, playerId: body.playerId } },
        data: { slot: slotB },
      }),
      prisma.rosterEntry.update({
        where: { fantasyTeamId_playerId: { fantasyTeamId: body.teamId, playerId: body.swapWithPlayerId } },
        data: { slot: slotA },
      }),
    ]);

    await logCommissionerAction(leagueId, auth.id, "COMMISSIONER_FORCE_MOVE", {
      target: body.teamId,
      details: { playerId: body.playerId, fromSlot: slotA, toSlot: slotB, swappedWith: body.swapWithPlayerId, reason: body.reason ?? null },
    }, prisma);

    return NextResponse.json({ success: true });
  }

  // Single-player move
  const rosterMap = team.roster.map((e) => ({ playerId: e.playerId, slot: e.slot }));
  const validationError = validateSlotMove(
    entry.player.position,
    entry.player.active,
    targetSlot,
    rosterMap,
    body.playerId,
    settings
  );
  if (validationError) return NextResponse.json({ error: validationError }, { status: 422 });

  await prisma.rosterEntry.update({
    where: { fantasyTeamId_playerId: { fantasyTeamId: body.teamId, playerId: body.playerId } },
    data: { slot: targetSlot },
  });

  await logCommissionerAction(leagueId, auth.id, "COMMISSIONER_FORCE_MOVE", {
    target: body.teamId,
    details: { playerId: body.playerId, fromSlot, toSlot: targetSlot, reason: body.reason ?? null },
  }, prisma);

  return NextResponse.json({ success: true });
}
