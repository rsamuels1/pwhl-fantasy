import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { logCommissionerAction } from "@/lib/services/audit-service";

// PUT /api/leagues/[leagueId]/teams/[teamId]/owner
// Transfers ownership of a fantasy team to a different user. Commissioner-only.
// The team's roster, standings, and matchups are unchanged.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string; teamId: string }> }
) {
  const { leagueId, teamId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const body = await req.json() as { newOwnerEmail?: string };
  if (!body.newOwnerEmail?.trim()) {
    return NextResponse.json({ error: "Missing newOwnerEmail" }, { status: 400 });
  }

  const email = body.newOwnerEmail.trim().toLowerCase();

  const team = await prisma.fantasyTeam.findFirst({
    where: { id: teamId, leagueId },
    select: { id: true, ownerId: true, name: true },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // Upsert new owner — same pattern as league creation
  const newOwner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, displayName: email.split("@")[0] },
  });

  // Prevent assigning to someone already in this league (different team)
  const existingMembership = await prisma.fantasyTeam.findFirst({
    where: { leagueId, ownerId: newOwner.id, id: { not: teamId } },
  });
  if (existingMembership) {
    return NextResponse.json({
      error: `${email} already owns another team in this league`,
    }, { status: 409 });
  }

  const previousOwnerId = team.ownerId;

  await prisma.fantasyTeam.update({
    where: { id: teamId },
    data: { ownerId: newOwner.id },
  });

  await logCommissionerAction(leagueId, auth.id, "COMMISSIONER_REPLACE_MANAGER", {
    target: teamId,
    details: { teamName: team.name, previousOwnerId, newOwnerId: newOwner.id, newOwnerEmail: email },
  }, prisma);

  return NextResponse.json({ success: true, newOwnerId: newOwner.id });
}
