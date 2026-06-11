import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const displayName = String(body.displayName || "").trim() || email.split("@")[0];
    const returnTo = String(body.returnTo || "").trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { displayName },
      create: { email, displayName },
    });

    // Determine where to send the user after login
    let redirectTo = "/dashboard";
    if (returnTo && returnTo.startsWith("/")) {
      // Honour the returnTo param (same-origin only — must start with /)
      redirectTo = returnTo;
    } else {
      // Smart default: 1 team → go straight to that matchup page
      const teams = await prisma.fantasyTeam.findMany({
        where: { ownerId: user.id },
        select: { leagueId: true },
        take: 2,
      });
      if (teams.length === 1) {
        redirectTo = `/league/${teams[0].leagueId}/matchup`;
      }
    }

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      redirectTo,
    });
    setAuthCookie(response, user.email);
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Unable to log in." }, { status: 500 });
  }
}
