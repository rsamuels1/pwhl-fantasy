/**
 * GET /api/leagues/[leagueId]/standings
 * 
 * Returns regular season standings, sorted by points.
 * Used pre-playoff to display current rankings and seed info.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeStandings, getPlayoffStandings } from "@/lib/playoffs/seeding";
import { getPlayoffSettings } from "@/lib/playoffs/lifecycle";

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const leagueId = params.leagueId;

    // Fetch league, teams, and all matchups
    const league = await prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      include: {
        teams: {
          include: {
            _count: { select: { homeMatchups: true, awayMatchups: true } },
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    // Fetch all matchups for this league
    const matchups = await prisma.matchup.findMany({
      where: { leagueId },
    });

    // Compute standings
    const standings = computeStandings(league.teams, matchups);

    // Add playoff eligibility info if playoffs are in progress
    const playoffSettings = getPlayoffSettings(league.playoffSettings as any);
    const standingsWithPlayoff = standings.map((standing, index) => ({
      ...standing,
      rank: index + 1,
      isPlayoffEligible: index < playoffSettings.teamsInPlayoff,
      seed: index < playoffSettings.teamsInPlayoff ? index + 1 : null,
    }));

    return NextResponse.json({
      leagueId,
      leagueName: league.name,
      playoffStatus: league.playoffStatus,
      standings: standingsWithPlayoff,
    });
  } catch (error) {
    console.error("Error fetching standings:", error);
    return NextResponse.json(
      { error: "Failed to fetch standings" },
      { status: 500 }
    );
  }
}
