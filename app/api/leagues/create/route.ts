import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_SCORING } from "@/lib/scoring";
import { generateShortId } from "@/lib/id";
import { setAuthCookie } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";

const SESSION_COOKIE = "pwhl_user_email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leagueName = String(body.leagueName || "").trim();
    const maxTeams = Number(body.maxTeams || 8);

    if (!leagueName) {
      return NextResponse.json({ error: "League name is required." }, { status: 400 });
    }

    // Prefer authenticated session; fall back to email-based creation for backward compat.
    const sessionEmail = req.cookies.get(SESSION_COOKIE)?.value;
    let commissioner = sessionEmail
      ? await prisma.user.findUnique({ where: { email: sessionEmail } })
      : null;

    if (!commissioner) {
      const commissionerEmail = String(body.commissionerEmail || "").trim();
      const commissionerName = String(body.commissionerName || "").trim();
      if (!commissionerEmail) {
        return NextResponse.json({ error: "Commissioner email is required." }, { status: 400 });
      }
      commissioner = await prisma.user.upsert({
        where: { email: commissionerEmail },
        update: { displayName: commissionerName || commissionerEmail.split("@")[0] },
        create: { email: commissionerEmail, displayName: commissionerName || commissionerEmail.split("@")[0] },
      });
    }

    let leagueSeason = "2026-27";
    let draftStartsAt: Date | null = null;
    let isReplay = false;
    let replayCurrentDate: Date | null = null;

    if (body.useLastSeasonSimulation) {
      const lastSeasonRow = await prisma.game.findMany({
        distinct: ["season"],
        select: { season: true },
        orderBy: { season: "desc" },
        take: 1,
      });
      leagueSeason = lastSeasonRow[0]?.season ?? leagueSeason;
      draftStartsAt = new Date();
      isReplay = true;
      replayCurrentDate = new Date("2026-10-01T09:00:00Z");
    } else if (body.draftStartsAt) {
      draftStartsAt = new Date(body.draftStartsAt);
    }

    const league = await prisma.fantasyLeague.create({
      data: {
        id: generateShortId(leagueName),
        name: leagueName,
        season: leagueSeason,
        maxTeams,
        status: "PRE_DRAFT",
        commissionerId: commissioner.id,
        scoringSettings: DEFAULT_SCORING as object,
        scoringMode: "VP",
        rosterSettings: {
          forward: 3,
          defense: 2,
          goalie: 1,
          util: 1,
          bench: 6,
        },
        draftStartsAt,
        isReplay,
        replayCurrentDate,
      },
    });

    try {
      trackEvent({ event: "league_created", userId: commissioner.id, leagueId: league.id,
        properties: { maxTeams, isReplay, source: sessionEmail ? "wizard" : "form" } });
    } catch {}

    const response = NextResponse.json({
      leagueId: league.id,
      commissionerId: commissioner.id,
      redirectTo: `/league/${league.id}/admin?welcome=1`,
      message: "League created.",
    });
    // Set cookie so unauthenticated creators are logged in after creation
    if (!sessionEmail) {
      setAuthCookie(response, commissioner.email);
    }
    return response;
  } catch (error) {
    console.error("Error creating league:", error);
    return NextResponse.json({ error: "Failed to create league." }, { status: 500 });
  }
}
