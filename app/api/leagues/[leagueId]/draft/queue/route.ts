import { NextRequest, NextResponse } from "next/server";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/leagues/[leagueId]/draft/queue?team=<teamId>
// Returns the team's current draft queue from Draft.queueData.
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
    return NextResponse.json({ error: "Missing ?team= query parameter" }, { status: 400 });
  }

  // Verify the team belongs to this league and is owned by the caller.
  const team = await prisma.fantasyTeam.findFirst({
    where: { id: teamId, leagueId, ownerId: auth.id },
    select: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found or not owned by you" }, { status: 403 });
  }

  const draft = await prisma.draft.findFirst({
    where: { leagueId },
    select: { queueData: true },
  });

  const queueData = (draft?.queueData ?? {}) as Record<string, string[]>;
  const playerIds = queueData[teamId] ?? [];

  return NextResponse.json({ playerIds });
}

// PUT /api/leagues/[leagueId]/draft/queue
// Saves the team's ordered draft queue into Draft.queueData.
// Body: { teamId: string, playerIds: string[] }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;

  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const body = await req.json() as { teamId?: string; playerIds?: unknown };

  if (!body.teamId) {
    return NextResponse.json({ error: "Missing teamId" }, { status: 400 });
  }
  if (!Array.isArray(body.playerIds)) {
    return NextResponse.json({ error: "playerIds must be an array" }, { status: 400 });
  }

  const playerIds = (body.playerIds as unknown[]).filter((id): id is string => typeof id === "string");

  // Verify the team belongs to this league and is owned by the caller.
  const team = await prisma.fantasyTeam.findFirst({
    where: { id: body.teamId, leagueId, ownerId: auth.id },
    select: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found or not owned by you" }, { status: 403 });
  }

  const draft = await prisma.draft.findFirst({
    where: { leagueId },
    select: { id: true, queueData: true },
  });
  if (!draft) {
    return NextResponse.json({ error: "Draft not found for this league" }, { status: 404 });
  }

  const existing = (draft.queueData ?? {}) as Record<string, string[]>;
  const updated = { ...existing, [body.teamId]: playerIds };

  await prisma.draft.update({
    where: { id: draft.id },
    data: { queueData: updated },
  });

  return NextResponse.json({ success: true, playerIds });
}
