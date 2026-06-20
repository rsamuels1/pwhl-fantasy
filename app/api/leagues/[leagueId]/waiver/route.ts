import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import type { RosterSettings } from "@/lib/lineup";
import { emitEvent } from "@/lib/services/activity";

function maxRosterSize(settings: RosterSettings): number {
  return (
    (settings.forward ?? 0) +
    (settings.defense ?? 0) +
    (settings.goalie ?? 0) +
    (settings.util ?? 0) +
    (settings.bench ?? 0) +
    (settings.ir ?? 0)
  );
}

// POST /api/leagues/[leagueId]/waiver
// Body: { teamId, addPlayerId, dropPlayerId? }
// Adds a free agent to the team (slot=BENCH). If dropPlayerId is supplied,
// that player is dropped first. Fails if the roster would exceed max size.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const body = await req.json() as { teamId?: string; addPlayerId?: string; dropPlayerId?: string };
  const { teamId, addPlayerId, dropPlayerId } = body;

  if (!teamId || !addPlayerId) {
    return NextResponse.json({ error: "teamId and addPlayerId are required." }, { status: 400 });
  }

  // Verify the caller owns this team and it belongs to the league.
  const team = await prisma.fantasyTeam.findFirst({
    where: { id: teamId, leagueId, ownerId: auth.id },
    include: { league: { select: { rosterSettings: true } } },
  });
  if (!team) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  // Verify addPlayerId is actually a free agent in this league.
  const alreadyRostered = await prisma.rosterEntry.findFirst({
    where: { playerId: addPlayerId, fantasyTeam: { leagueId } },
  });
  if (alreadyRostered) {
    return NextResponse.json({ error: "Player is already on a roster in this league." }, { status: 409 });
  }

  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;
  const maxSize = maxRosterSize(settings);

  await prisma.$transaction(async (tx) => {
    // Drop first if requested.
    if (dropPlayerId) {
      const dropEntry = await tx.rosterEntry.findFirst({
        where: { fantasyTeamId: teamId, playerId: dropPlayerId },
      });
      if (!dropEntry) throw new Error("Drop player not found on your roster.");
      await tx.rosterEntry.delete({ where: { id: dropEntry.id } });
    }

    // Check size after any drop.
    const currentSize = await tx.rosterEntry.count({ where: { fantasyTeamId: teamId } });
    if (currentSize >= maxSize) {
      throw new Error(`Roster is full (${maxSize} players). Drop a player first.`);
    }

    await tx.rosterEntry.create({
      data: { fantasyTeamId: teamId, playerId: addPlayerId, slot: "BENCH" },
    });
  });

  // Emit activity events (best-effort — never fail the request)
  const addedPlayer = await prisma.player.findUnique({
    where: { id: addPlayerId }, select: { firstName: true, lastName: true },
  }).catch(() => null);
  const addedName = addedPlayer ? `${addedPlayer.firstName} ${addedPlayer.lastName}` : "a player";
  emitEvent({ leagueId, teamId, playerId: addPlayerId, type: "PLAYER_ADD",
    data: { description: `${team.name} added ${addedName}` } }, prisma).catch(() => {});

  if (dropPlayerId) {
    const droppedPlayer = await prisma.player.findUnique({
      where: { id: dropPlayerId }, select: { firstName: true, lastName: true },
    }).catch(() => null);
    const droppedName = droppedPlayer ? `${droppedPlayer.firstName} ${droppedPlayer.lastName}` : "a player";
    emitEvent({ leagueId, teamId, playerId: dropPlayerId, type: "PLAYER_DROP",
      data: { description: `${team.name} dropped ${droppedName}` } }, prisma).catch(() => {});
  }

  // Return updated roster for optimistic UI refresh.
  const updated = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: teamId },
    include: { player: { include: { team: { select: { abbreviation: true } } } } },
    orderBy: { slot: "asc" },
  });

  return NextResponse.json({
    roster: updated.map((e) => ({
      entryId: e.id,
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      teamAbbr: e.player.team?.abbreviation ?? null,
      slot: e.slot,
      active: e.player.active,
      acquired: e.acquired.toISOString(),
    })),
  });
}

// DELETE /api/leagues/[leagueId]/waiver
// Body: { teamId, dropPlayerId }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const body = await req.json() as { teamId?: string; dropPlayerId?: string };
  const { teamId, dropPlayerId } = body;

  if (!teamId || !dropPlayerId) {
    return NextResponse.json({ error: "teamId and dropPlayerId are required." }, { status: 400 });
  }

  const team = await prisma.fantasyTeam.findFirst({
    where: { id: teamId, leagueId, ownerId: auth.id },
  });
  if (!team) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const entry = await prisma.rosterEntry.findFirst({
    where: { fantasyTeamId: teamId, playerId: dropPlayerId },
  });
  if (!entry) return NextResponse.json({ error: "Player not on your roster." }, { status: 404 });

  const dropTeam = await prisma.fantasyTeam.findUnique({
    where: { id: teamId }, select: { name: true },
  }).catch(() => null);
  const dropPlayer = await prisma.player.findUnique({
    where: { id: dropPlayerId }, select: { firstName: true, lastName: true },
  }).catch(() => null);

  await prisma.rosterEntry.delete({ where: { id: entry.id } });

  if (dropTeam && dropPlayer) {
    emitEvent({ leagueId, teamId, playerId: dropPlayerId, type: "PLAYER_DROP",
      data: { description: `${dropTeam.name} dropped ${dropPlayer.firstName} ${dropPlayer.lastName}` } }, prisma).catch(() => {});
  }

  return NextResponse.json({ dropped: dropPlayerId });
}
