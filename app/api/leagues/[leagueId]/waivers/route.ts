// app/api/leagues/[leagueId]/waivers/route.ts
// Waiver wire state and claim management.
//
// GET  ?team=<teamId>  — wire state for a team (active entries + my claims + priority order)
// POST { addPlayerId, dropPlayerId? }  — submit a claim
// DELETE ?claimId=<id>  — cancel a PENDING claim

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import { submitClaim, getPlayerWaiverStatus } from "@/lib/services/waiver-service";
import { emitEvent } from "@/lib/services/activity";

// ── GET ───────────────────────────────────────────────────────────────────────

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
  if (!teamId) {
    return NextResponse.json({ error: "team query parameter is required." }, { status: 400 });
  }

  const nowMs = getDevNowFromRequest(req);
  const nowDate = new Date(nowMs);

  // Verify the team belongs to this league and the caller owns it
  const myTeam = await prisma.fantasyTeam.findFirst({
    where: { id: teamId, leagueId, ownerId: auth.id },
  });
  if (!myTeam) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // 1. Active waiver entries (not yet expired)
  const entries = await prisma.waiverEntry.findMany({
    where: { leagueId, expiresAt: { gt: nowDate } },
    include: {
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          team: { select: { abbreviation: true } },
        },
      },
    },
    orderBy: { expiresAt: "asc" },
  });

  const wire = entries.map((e) => ({
    playerId: e.playerId,
    playerName: `${e.player.firstName} ${e.player.lastName}`,
    position: e.player.position,
    teamAbbr: e.player.team?.abbreviation ?? null,
    expiresAt: e.expiresAt.toISOString(),
    hoursRemaining: Math.max(
      0,
      Math.round((e.expiresAt.getTime() - nowMs) / 3_600_000)
    ),
  }));

  // 2. This team's pending claims
  const myClaims = await prisma.waiverClaim.findMany({
    where: { leagueId, fantasyTeamId: teamId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  // Enrich claim player names
  const claimPlayerIds = [
    ...new Set([
      ...myClaims.map((c) => c.addPlayerId),
      ...myClaims.flatMap((c) => (c.dropPlayerId ? [c.dropPlayerId] : [])),
    ]),
  ];
  const claimPlayers = await prisma.player.findMany({
    where: { id: { in: claimPlayerIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const playerNameMap = new Map(claimPlayers.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));

  const enrichedClaims = myClaims.map((c) => ({
    id: c.id,
    addPlayerId: c.addPlayerId,
    addPlayerName: playerNameMap.get(c.addPlayerId) ?? c.addPlayerId,
    dropPlayerId: c.dropPlayerId,
    dropPlayerName: c.dropPlayerId ? (playerNameMap.get(c.dropPlayerId) ?? c.dropPlayerId) : null,
    prioritySnapshot: c.prioritySnapshot,
    createdAt: c.createdAt.toISOString(),
  }));

  // 3. My priority rank
  const myPriorityRow = await prisma.waiverPriority.findUnique({
    where: { leagueId_fantasyTeamId: { leagueId, fantasyTeamId: teamId } },
    select: { priority: true },
  });
  const myPriority = myPriorityRow?.priority ?? null;

  // 4. All priorities for the league
  const allPriorityRows = await prisma.waiverPriority.findMany({
    where: { leagueId },
    include: { fantasyTeam: { select: { name: true } } },
    orderBy: { priority: "asc" },
  });
  const allPriorities = allPriorityRows.map((r) => ({
    priority: r.priority,
    teamId: r.fantasyTeamId,
    teamName: r.fantasyTeam.name,
  }));

  return NextResponse.json({ wire, myClaims: enrichedClaims, myPriority, allPriorities });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const body = await req.json() as { addPlayerId?: string; dropPlayerId?: string };
  const { addPlayerId, dropPlayerId } = body;

  if (!addPlayerId) {
    return NextResponse.json({ error: "addPlayerId is required." }, { status: 400 });
  }

  // Resolve the caller's team in this league
  const myTeam = await prisma.fantasyTeam.findFirst({
    where: { leagueId, ownerId: auth.id },
    select: { id: true },
  });
  if (!myTeam) {
    return NextResponse.json({ error: "You are not a member of this league." }, { status: 403 });
  }

  const nowMs = getDevNowFromRequest(req);

  try {
    const { claim } = await submitClaim(
      leagueId,
      myTeam.id,
      addPlayerId,
      dropPlayerId ?? null,
      nowMs,
      prisma
    );
    return NextResponse.json({ claim }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit claim.";
    // Map domain errors to HTTP status codes
    if (message.includes("not currently on the waiver wire")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes("already have a pending claim")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const claimId = req.nextUrl.searchParams.get("claimId");
  if (!claimId) {
    return NextResponse.json({ error: "claimId query parameter is required." }, { status: 400 });
  }

  // Resolve the caller's team
  const myTeam = await prisma.fantasyTeam.findFirst({
    where: { leagueId, ownerId: auth.id },
    select: { id: true },
  });
  if (!myTeam) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Verify the claim belongs to this team and is still PENDING
  const claim = await prisma.waiverClaim.findFirst({
    where: { id: claimId, fantasyTeamId: myTeam.id, leagueId },
  });
  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }
  if (claim.status !== "PENDING") {
    return NextResponse.json({ error: "Only PENDING claims can be cancelled." }, { status: 409 });
  }

  await prisma.waiverClaim.update({
    where: { id: claimId },
    data: { status: "CANCELLED" },
  });

  emitEvent(
    {
      leagueId,
      teamId: myTeam.id,
      playerId: claim.addPlayerId,
      type: "WAIVER_CLAIM_CANCELLED",
      data: { description: "Waiver claim cancelled" },
    },
    prisma
  ).catch(() => {});

  return NextResponse.json({ cancelled: claimId });
}
