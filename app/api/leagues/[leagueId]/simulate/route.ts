import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateMatchups, scoreLeagueMatchups } from "@/lib/scoring/matchups";

export async function POST(req: NextRequest, { params }: { params: { leagueId: string } }) {
  try {
    const leagueId = params.leagueId;
    const body = await req.json();
    const action = String(body.action || "nextWeek");

    const league = await prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      include: { teams: true },
    });
    if (!league) {
      return NextResponse.json({ error: "League not found." }, { status: 404 });
    }

    const hasMatchups = await prisma.matchup.count({ where: { leagueId } });
    if (hasMatchups === 0) {
      if (league.teams.length < 2) {
        return NextResponse.json({
          error: "At least two teams are required to generate a schedule.",
        }, { status: 400 });
      }
      await generateMatchups(leagueId, league.season, prisma, { startAt: new Date() });
    }

    if (action === "all") {
      await scoreLeagueMatchups(leagueId, null, prisma);
      return NextResponse.json({ message: "Simulated all remaining weeks." });
    }

    const nextWeekMatchup = await prisma.matchup.findFirst({
      where: { leagueId, homeScore: null },
      orderBy: { week: "asc" },
    });

    if (!nextWeekMatchup) {
      return NextResponse.json({ message: "All scheduled weeks have already been simulated." });
    }

    await scoreLeagueMatchups(leagueId, nextWeekMatchup.week, prisma);
    return NextResponse.json({ message: `Simulated week ${nextWeekMatchup.week}.` });
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json({ error: "Unable to run simulation." }, { status: 500 });
  }
}
