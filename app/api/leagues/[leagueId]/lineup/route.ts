import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LineupSlot } from "@prisma/client";
import { validateSlotMove, lockTime, eligibleSlots } from "@/lib/lineup";
import type { RosterSettings } from "@/lib/lineup";

// GET /api/leagues/[leagueId]/lineup?team=<teamId>
// Returns the team's roster entries with player info and per-player lock status.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const teamId = req.nextUrl.searchParams.get("team");
  if (!teamId) return NextResponse.json({ error: "Missing team" }, { status: 400 });

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
    // Today's games for locking
    prisma.game.findMany({
      where: {
        startsAt: {
          gte: (() => { const d = new Date(); d.setUTCHours(0,0,0,0); return d; })(),
          lte: new Date(),
        },
      },
      select: { homeTeamId: true, awayTeamId: true, startsAt: true },
    }),
  ]);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;

  const roster = team.roster.map((entry) => {
    const teamId = entry.player.team?.id ?? null;
    const locked = lockTime(teamId, todayGames);
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
  const body = await req.json() as { teamId?: string; playerId?: string; slot?: string };

  if (!body.teamId || !body.playerId || !body.slot) {
    return NextResponse.json({ error: "Missing teamId, playerId, or slot" }, { status: 400 });
  }
  const targetSlot = body.slot as LineupSlot;
  const validSlots: LineupSlot[] = ["FORWARD","DEFENSE","GOALIE","UTIL","BENCH","IR"];
  if (!validSlots.includes(targetSlot)) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

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
      where: {
        startsAt: {
          gte: (() => { const d = new Date(); d.setUTCHours(0,0,0,0); return d; })(),
          lte: new Date(),
        },
      },
      select: { homeTeamId: true, awayTeamId: true, startsAt: true },
    }),
  ]);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const entry = team.roster.find((e) => e.playerId === body.playerId);
  if (!entry) return NextResponse.json({ error: "Player not on roster" }, { status: 404 });

  // Check lock
  const playerTeamId = entry.player.team?.id ?? null;
  const locked = lockTime(playerTeamId, todayGames);
  if (locked && entry.slot !== "BENCH" && targetSlot !== entry.slot) {
    // Allow moving to bench even if locked (bench-out = scratch), but disallow active slot changes
    if (targetSlot !== "BENCH") {
      return NextResponse.json({
        error: `${entry.player.firstName} ${entry.player.lastName} is locked — their game started at ${locked.toISOString()}.`,
      }, { status: 409 });
    }
  }

  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;
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
