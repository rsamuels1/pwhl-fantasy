import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_SCORING } from "@/lib/scoring";
import { generateShortId } from "@/lib/id";
import { setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leagueName = String(body.leagueName || "").trim();
    const commissionerEmail = String(body.commissionerEmail || "").trim();
    const commissionerName = String(body.commissionerName || "").trim();
    const maxTeams = Number(body.maxTeams || 10);

    if (!leagueName || !commissionerEmail) {
      return NextResponse.json({ error: "League name and commissioner email are required." }, { status: 400 });
    }

    const commissioner = await prisma.user.upsert({
      where: { email: commissionerEmail },
      update: { displayName: commissionerName || commissionerEmail.split("@")[0] },
      create: { email: commissionerEmail, displayName: commissionerName || commissionerEmail.split("@")[0] },
    });

    let leagueSeason = "2026-27";
    let draftStartsAt = null;
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

    const response = NextResponse.json({
      leagueId: league.id,
      commissionerId: commissioner.id,
      redirectTo: `/league/${league.id}/admin?welcome=1`,
      message: "League created.",
    });
    setAuthCookie(response, commissioner.email);
    return response;
  } catch (error) {
    console.error("Error creating league:", error);
    return NextResponse.json({ error: "Failed to create league." }, { status: 500 });
  }
}
