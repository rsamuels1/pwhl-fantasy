import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LineupSlot } from "@prisma/client";
import { validateSlotMove, lockTime, eligibleSlots } from "@/lib/lineup";
import type { RosterSettings } from "@/lib/lineup";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import { getSeasonState } from "@/lib/season";

const ACTIVE_SLOTS: LineupSlot[] = ["FORWARD", "DEFENSE", "GOALIE", "UTIL"];

// GET /api/leagues/[leagueId]/lineup?team=<teamId>
// Returns the team's roster entries with player info and per-player lock status.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const teamId = req.nextUrl.searchParams.get("team");
  if (!teamId) return NextResponse.json({ error: "Missing team" }, { status: 400 });

  const nowMs = getDevNowFromRequest(req);
  const now = new Date(nowMs);
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const [team, todayGames] = await Promise.all([
    prisma.fantasyTeam.findFirst({
      where: { id: teamId, leagueId },
      include: {
        roster: {
          include: {
            player: {
              include: { team: { select: { id: true, abbreviation: true } } },
            },
          },
          orderBy: { acquired: "asc" },
        },
        league: { select: { rosterSettings: true } },
      },
    }),
    prisma.game.findMany({
      where: { startsAt: { gte: todayStart, lte: now } },
      select: { homeTeamId: true, awayTeamId: true, startsAt: true },
    }),
  ]);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;

  const roster = team.roster.map((entry) => {
    const teamId = entry.player.team?.id ?? null;
    const locked = lockTime(teamId, todayGames, nowMs);
    return {
      id: entry.id,
      playerId: entry.playerId,
      name: `${entry.player.firstName} ${entry.player.lastName}`,
      position: entry.player.position,
      teamAbbr: entry.player.team?.abbreviation ?? null,
      active: entry.player.active,
      slot: entry.slot,
      lockedAt: locked?.toISOString() ?? null,
      eligibleSlots: eligibleSlots(entry.player.position, entry.player.active),
    };
  });

  return NextResponse.json({ roster, rosterSettings: settings });
}

// PUT /api/leagues/[leagueId]/lineup
// Body: { teamId, playerId, slot }
// Validates eligibility + capacity + lock, then updates the slot.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const myTeam = await apiRequireLeagueMember(leagueId, auth.id);
  if (myTeam instanceof NextResponse) return myTeam;

  const body = await req.json() as { teamId?: string; playerId?: string; slot?: string; swapWithPlayerId?: string };

  if (!body.teamId || !body.playerId || !body.slot) {
    return NextResponse.json({ error: "Missing teamId, playerId, or slot" }, { status: 400 });
  }

  // Users may only modify their own team's lineup
  if (body.teamId !== myTeam.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetSlot = body.slot as LineupSlot;
  const validSlots: LineupSlot[] = ["FORWARD","DEFENSE","GOALIE","UTIL","BENCH","IR"];
  if (!validSlots.includes(targetSlot)) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const nowMsPut = getDevNowFromRequest(req);
  const nowPut = new Date(nowMsPut);
  const todayStartPut = new Date(nowPut);
  todayStartPut.setUTCHours(0, 0, 0, 0);

  const [team, todayGames] = await Promise.all([
    prisma.fantasyTeam.findFirst({
      where: { id: body.teamId, leagueId },
      include: {
        roster: {
          include: {
            player: {
              include: { team: { select: { id: true } } },
            },
          },
        },
        league: { select: { rosterSettings: true } },
      },
    }),
    prisma.game.findMany({
      where: { startsAt: { gte: todayStartPut, lte: nowPut } },
      select: { homeTeamId: true, awayTeamId: true, startsAt: true },
    }),
  ]);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const entry = team.roster.find((e) => e.playerId === body.playerId);
  if (!entry) return NextResponse.json({ error: "Player not on roster" }, { status: 404 });

  // Check lock
  const playerTeamId = entry.player.team?.id ?? null;
  const locked = lockTime(playerTeamId, todayGames, nowMsPut);
  if (locked && entry.slot !== "BENCH" && targetSlot !== entry.slot) {
    // Allow moving to bench even if locked (bench-out = scratch), but disallow active slot changes
    if (targetSlot !== "BENCH") {
      return NextResponse.json({
        error: `${entry.player.firstName} ${entry.player.lastName} is locked — their game started at ${locked.toISOString()}.`,
      }, { status: 409 });
    }
  }

  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;

  // Helper: check if a player has played any games in the current active scoring period.
  // Used to block demoting an active player who has already accumulated points.
  async function hasPlayedThisPeriod(playerId: string): Promise<boolean> {
    const seasonState = await getSeasonState(leagueId, nowMsPut, prisma);
    const activePeriod = seasonState.activePeriod;
    if (!activePeriod) return false;
    const count = await prisma.statLine.count({
      where: {
        playerId,
        game: { startsAt: { gte: activePeriod.startsAt, lte: new Date(nowMsPut) } },
      },
    });
    return count > 0;
  }

  // Atomic swap: A ↔ B — capacity-neutral, so skip capacity check; only validate eligibility.
  if (body.swapWithPlayerId) {
    const entryB = team.roster.find((e) => e.playerId === body.swapWithPlayerId);
    if (!entryB) return NextResponse.json({ error: "Swap player not on roster." }, { status: 404 });

    const slotA = entry.slot;
    const slotB = entryB.slot;
    if (slotA === slotB) return NextResponse.json({ success: true }); // no-op

    // Block swapping an active player who has already played this period to bench/IR
    if (ACTIVE_SLOTS.includes(slotA) && !ACTIVE_SLOTS.includes(slotB) && await hasPlayedThisPeriod(entry.playerId)) {
      return NextResponse.json(
        { error: `${entry.player.firstName} ${entry.player.lastName} has already played this week and cannot be moved to bench.` },
        { status: 409 }
      );
    }

    const eligA = eligibleSlots(entry.player.position, entry.player.active);
    const eligB = eligibleSlots(entryB.player.position, entryB.player.active);
    if (!eligA.includes(slotB)) {
      return NextResponse.json(
        { error: `${entry.player.firstName} ${entry.player.lastName} cannot play the ${slotB} slot.` },
        { status: 422 }
      );
    }
    if (!eligB.includes(slotA)) {
      return NextResponse.json(
        { error: `${entryB.player.firstName} ${entryB.player.lastName} cannot play the ${slotA} slot.` },
        { status: 422 }
      );
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

    return NextResponse.json({ success: true });
  }

  // Block moving an active player who has already played this period to bench/IR
  if (ACTIVE_SLOTS.includes(entry.slot) && !ACTIVE_SLOTS.includes(targetSlot) && await hasPlayedThisPeriod(entry.playerId)) {
    return NextResponse.json(
      { error: `${entry.player.firstName} ${entry.player.lastName} has already played this week and cannot be moved to bench.` },
      { status: 409 }
    );
  }

  const rosterMap = team.roster.map((e) => ({ playerId: e.playerId, slot: e.slot }));
  const validationError = validateSlotMove(
    entry.player.position,
    entry.player.active,
    targetSlot,
    rosterMap,
    body.playerId,
    settings
  );
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
  }

  await prisma.rosterEntry.update({
    where: { fantasyTeamId_playerId: { fantasyTeamId: body.teamId, playerId: body.playerId } },
    data: { slot: targetSlot },
  });

  return NextResponse.json({ success: true });
}
