import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const leagueId = params.leagueId;

    const matchups = await prisma.matchup.findMany({
      where: { leagueId },
      orderBy: [{ week: "asc" }, { startsAt: "asc" }],
      include: { homeTeam: true, awayTeam: true },
    });

    return NextResponse.json({
      leagueId,
      matchups: matchups.map((matchup) => ({
        id: matchup.id,
        week: matchup.week,
        startsAt: matchup.startsAt,
        endsAt: matchup.endsAt,
        homeTeam: { id: matchup.homeTeam.id, name: matchup.homeTeam.name },
        awayTeam: { id: matchup.awayTeam.id, name: matchup.awayTeam.name },
        homeScore: matchup.homeScore,
        awayScore: matchup.awayScore,
        isPlayoff: matchup.isPlayoff,
        round: matchup.round,
      })),
    });
  } catch (error) {
    console.error("Error fetching matchups:", error);
    return NextResponse.json(
      { error: "Failed to fetch matchups" },
      { status: 500 }
    );
  }
}
