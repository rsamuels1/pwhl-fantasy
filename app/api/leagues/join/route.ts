import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateShortId } from "@/lib/id";
import { setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leagueId = String(body.leagueId || "").trim();
    const teamName = String(body.teamName || "").trim();
    let ownerEmail = String(body.ownerEmail || "").trim();
    const ownerName = String(body.ownerName || "").trim();

    // Check if user is already authenticated (via session cookie)
    const sessionEmail = req.cookies.get("pwhl_user_email")?.value;

    // If ownerEmail is not provided, use the session email (for authenticated team creation in wizard)
    if (!ownerEmail) {
      ownerEmail = sessionEmail || "";
    }

    if (!leagueId || !teamName || !ownerEmail) {
      return NextResponse.json({ error: "League ID, team name, and owner email are required." }, { status: 400 });
    }

    const league = await prisma.fantasyLeague.findUnique({ where: { id: leagueId } });
    if (!league) {
      return NextResponse.json({ error: "League not found." }, { status: 404 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
    
    // Check if user already owns a team in this league (before any updates)
    if (existingUser) {
      const existingTeam = await prisma.fantasyTeam.findFirst({
        where: { leagueId, ownerId: existingUser.id },
      });
      if (existingTeam) {
        return NextResponse.json({ error: "This email already owns a team in the league." }, { status: 400 });
      }
    }

    // For non-commissioners, enforce maxTeams limit
    const isCommissioner = league.commissionerId === (existingUser?.id || null);
    if (!isCommissioner) {
      const teamCount = await prisma.fantasyTeam.count({ where: { leagueId } });
      if (teamCount >= league.maxTeams) {
        return NextResponse.json({ error: "League has reached the maximum number of teams." }, { status: 400 });
      }
    }

    // Create or update user
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { displayName: ownerName || ownerEmail.split("@")[0] },
      create: { email: ownerEmail, displayName: ownerName || ownerEmail.split("@")[0] },
    });

    // Get current team count for draft order
    const teamCount = await prisma.fantasyTeam.count({ where: { leagueId } });
    const draftOrder = teamCount + 1;

    const team = await prisma.fantasyTeam.create({
      data: {
        id: generateShortId(teamName),
        name: teamName,
        leagueId,
        ownerId: owner.id,
        draftOrder,
        isBot: ownerEmail.endsWith(".local"),
      },
    });

    const response = NextResponse.json({
      leagueId,
      teamId: team.id,
      draftOrder,
      redirectTo: `/league/${leagueId}?welcome=1`,
      message: "Team created successfully.",
    });
    // Only set cookie for unauthenticated joiners (invite link flow).
    // Authenticated users (wizard team-creation, admin panel test teams) keep their existing session.
    if (!sessionEmail) {
      setAuthCookie(response, owner.email);
    }
    return response;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error joining league:", errorMsg, error);
    return NextResponse.json({ error: `Failed to join league: ${errorMsg}` }, { status: 500 });
  }
}
