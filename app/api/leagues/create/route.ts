import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_SCORING } from "@/lib/scoring";
import { generateShortId } from "@/lib/id";

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

    if (body.useLastSeasonSimulation) {
      const lastSeasonRow = await prisma.game.findMany({
        distinct: ["season"],
        select: { season: true },
        orderBy: { season: "desc" },
        take: 1,
      });
      leagueSeason = lastSeasonRow[0]?.season ?? leagueSeason;
      draftStartsAt = new Date();
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
        rosterSettings: {
          forward: 2,
          defense: 2,
          goalie: 1,
          util: 1,
          bench: 4,
        },
        draftStartsAt,
      },
    });

    return NextResponse.json({
      leagueId: league.id,
      commissionerId: commissioner.id,
      message: "League created. Share the League ID with managers so they can join.",
    });
  } catch (error) {
    console.error("Error creating league:", error);
    return NextResponse.json({ error: "Failed to create league." }, { status: 500 });
  }
}
