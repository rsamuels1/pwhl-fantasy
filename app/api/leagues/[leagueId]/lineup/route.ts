import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LineupSlot } from "@prisma/client";
import { validateSlotMove, lockTime, eligibleSlots } from "@/lib/lineup";
import type { RosterSettings } from "@/lib/lineup";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
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

  const leagueInfo = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId }, select: { isReplay: true, replayCurrentDate: true },
  });
  if (!leagueInfo) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const nowMs = getReplayNow(
    { isReplay: leagueInfo.isReplay, replayCurrentDate: leagueInfo.replayCurrentDate },
    getDevNowFromRequest(req)
  );
  const now = new Date(nowMs);

  const [team, seasonStateGet] = await Promise.all([
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
    getSeasonState(leagueId, nowMs, prisma),
  ]);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const activePeriodGet = seasonStateGet.periods.find((p) => p.status === "ACTIVE")?.period ?? null;
  const pwhlTeamIdsGet = [...new Set(
    team.roster.map((e) => e.player.team?.id).filter((id): id is string => !!id)
  )];

  const periodGamesGet = activePeriodGet && pwhlTeamIdsGet.length > 0
    ? await prisma.game.findMany({
        where: {
          startsAt: { gte: activePeriodGet.startsAt, lte: now },
          OR: [{ homeTeamId: { in: pwhlTeamIdsGet } }, { awayTeamId: { in: pwhlTeamIdsGet } }],
        },
        select: { homeTeamId: true, awayTeamId: true, startsAt: true },
      })
    : [];

  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;

  const roster = team.roster.map((entry) => {
    const teamId = entry.player.team?.id ?? null;
    const locked = lockTime(teamId, periodGamesGet, nowMs, activePeriodGet?.startsAt.getTime());
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

  const leagueInfoPut = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId }, select: { isReplay: true, replayCurrentDate: true },
  });
  if (!leagueInfoPut) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const nowMsPut = getReplayNow(
    { isReplay: leagueInfoPut.isReplay, replayCurrentDate: leagueInfoPut.replayCurrentDate },
    getDevNowFromRequest(req)
  );
  const nowPut = new Date(nowMsPut);

  const [team, seasonStatePut] = await Promise.all([
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
    getSeasonState(leagueId, nowMsPut, prisma),
  ]);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const activePeriodPut = seasonStatePut.periods.find((p) => p.status === "ACTIVE")?.period ?? null;
  const pwhlTeamIdsPut = [...new Set(
    team.roster.map((e) => e.player.team?.id).filter((id): id is string => !!id)
  )];

  const periodGamesPut = activePeriodPut && pwhlTeamIdsPut.length > 0
    ? await prisma.game.findMany({
        where: {
          startsAt: { gte: activePeriodPut.startsAt, lte: nowPut },
          OR: [{ homeTeamId: { in: pwhlTeamIdsPut } }, { awayTeamId: { in: pwhlTeamIdsPut } }],
        },
        select: { homeTeamId: true, awayTeamId: true, startsAt: true },
      })
    : [];

  const entry = team.roster.find((e) => e.playerId === body.playerId);
  if (!entry) return NextResponse.json({ error: "Player not on roster" }, { status: 404 });

  // Check lock: locked if team has played any game this scoring period.
  const playerTeamId = entry.player.team?.id ?? null;
  const locked = lockTime(playerTeamId, periodGamesPut, nowMsPut, activePeriodPut?.startsAt.getTime());
  if (locked) {
    return NextResponse.json({
      error: `${entry.player.firstName} ${entry.player.lastName} is locked — they played on ${locked.toISOString().slice(0, 10)} this week.`,
    }, { status: 409 });
  }

  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;

  // Helper: check if a player has played any games in the current active scoring period.
  // Used to block demoting an active player who has already accumulated points.
  async function hasPlayedThisPeriod(playerId: string): Promise<boolean> {
    if (!activePeriodPut) return false;
    const count = await prisma.statLine.count({
      where: {
        playerId,
        game: { startsAt: { gte: activePeriodPut.startsAt, lte: nowPut } },
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

  // Detect lineup-complete milestone: all active slots are now filled.
  const finalRoster = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: body.teamId },
    select: { slot: true },
  });
  const activeFilled = finalRoster.filter((e) => ACTIVE_SLOTS.includes(e.slot as (typeof ACTIVE_SLOTS)[number])).length;
  const totalActiveSlots = (settings.forward ?? 3) + (settings.defense ?? 2) + (settings.goalie ?? 1) + (settings.util ?? 1);
  const milestoneTriggered = activeFilled >= totalActiveSlots ? "lineup_complete" : null;

  return NextResponse.json({ success: true, milestoneTriggered });
}
