import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/founder/leagues/[leagueId]/beta-users
// Assigns a beta signup as commissioner or manager in a league.
// - commissioner: updates commissionerId; assigns to team 1 if they have no team yet.
// - manager: assigns to the first unowned team slot; 409 if no open slots.
// Returns { role, userId, teamId, inviteUrl }.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;

  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as { email?: string; role?: "commissioner" | "manager" };

  if (!body.email?.trim()) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  if (body.role !== "commissioner" && body.role !== "manager") {
    return NextResponse.json({ error: "role must be 'commissioner' or 'manager'" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();

  // Upsert user by email.
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, displayName: email.split("@")[0] },
  });

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { id: true, commissionerId: true },
  });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    orderBy: { draftOrder: "asc" },
    select: { id: true, name: true, ownerId: true, draftOrder: true, isBot: true },
  });

  let teamId: string | null = null;
  let inviteUrl: string;

  if (body.role === "commissioner") {
    // Update league commissioner.
    await prisma.fantasyLeague.update({
      where: { id: leagueId },
      data: { commissionerId: user.id },
    });

    // If the user has no team in this league, assign them to team 1 (draftOrder = 1).
    const existingTeam = teams.find((t) => t.ownerId === user.id);
    if (!existingTeam) {
      const team1 = teams.find((t) => t.draftOrder === 1);
      if (team1) {
        await prisma.fantasyTeam.update({
          where: { id: team1.id },
          data: { ownerId: user.id },
        });
        teamId = team1.id;
      }
    } else {
      teamId = existingTeam.id;
    }

    inviteUrl = `/login?returnTo=/league/${leagueId}/admin`;
  } else {
    // Find the first bot/placeholder team slot (isBot=true means unfilled).
    const openSlot = teams.find((t) => t.isBot);
    if (!openSlot) {
      return NextResponse.json(
        { error: "No open team slots available in this league" },
        { status: 409 }
      );
    }

    // Also check the user isn't already in the league as a real (non-bot) member.
    const alreadyMember = teams.find((t) => t.ownerId === user.id && !t.isBot);
    if (alreadyMember) {
      return NextResponse.json(
        { error: `${email} is already a manager in this league (Team: ${alreadyMember.name})` },
        { status: 409 }
      );
    }

    await prisma.fantasyTeam.update({
      where: { id: openSlot.id },
      data: { ownerId: user.id, isBot: false },
    });

    teamId = openSlot.id;
    inviteUrl = `/login?returnTo=/team/${teamId}/matchup`;
  }

  return NextResponse.json({
    role: body.role,
    userId: user.id,
    teamId,
    inviteUrl,
  });
}
