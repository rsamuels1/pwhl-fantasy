/**
 * GET /api/leagues/[leagueId]/bracket
 * 
 * Returns playoff bracket structure with current matchups and results.
 * If playoffs haven't started, returns 400 error.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateBracket,
  seedTeams,
  PlayoffBracket,
} from "@/lib/playoffs/brackets";
import { computeStandings } from "@/lib/playoffs/seeding";
import { getPlayoffSettings } from "@/lib/playoffs/lifecycle";

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const leagueId = params.leagueId;

    // Fetch league
    const league = await prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      include: { teams: true },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    // Check if playoffs have started
    if (league.playoffStatus === "NOT_STARTED") {
      return NextResponse.json(
        { error: "Playoffs have not started yet" },
        { status: 400 }
      );
    }

    // Fetch all matchups for standings
    const matchups = await prisma.matchup.findMany({
      where: { leagueId },
    });

    // Compute standings
    const standings = computeStandings(league.teams, matchups);

    // Get playoff settings
    const playoffSettings = getPlayoffSettings(league.playoffSettings as any);

    // Seed teams
    const seededTeams = seedTeams(
      standings.map((s) => ({
        fantasyTeamId: s.fantasyTeamId,
        teamName: s.teamName,
        points: s.points,
      })),
      playoffSettings
    );

    // Generate bracket
    const bracket = generateBracket(leagueId, seededTeams, playoffSettings);

    // Fetch playoff matchups and populate bracket results
    const playoffMatchups = await prisma.matchup.findMany({
      where: { leagueId, isPlayoff: true },
      orderBy: [{ round: "asc" }, { week: "asc" }],
    });

    // Update bracket with scored matchups
    for (const matchup of playoffMatchups) {
      if (
        matchup.homeScore !== null &&
        matchup.awayScore !== null &&
        matchup.round
      ) {
        try {
          // Find the matchup in the bracket rounds by position
          const roundIndex = matchup.round - 1;
          if (roundIndex < bracket.rounds.length) {
            const roundMatchups = bracket.rounds[roundIndex];
            // Try to match by team IDs
            const bracketMatchup = roundMatchups.find(
              (m) =>
                m.homeTeam?.fantasyTeamId === matchup.homeTeamId ||
                m.awayTeam?.fantasyTeamId === matchup.homeTeamId
            );
            if (bracketMatchup) {
              bracketMatchup.homeScore = matchup.homeScore;
              bracketMatchup.awayScore = matchup.awayScore;
              // Determine winner
              if (matchup.homeScore > matchup.awayScore) {
                bracketMatchup.winner = bracketMatchup.homeTeam;
              } else if (matchup.awayScore > matchup.homeScore) {
                bracketMatchup.winner = bracketMatchup.awayTeam;
              }
            }
          }
        } catch (e) {
          // Skip if update fails
        }
      }
    }

    return NextResponse.json({
      leagueId,
      leagueName: league.name,
      playoffStatus: league.playoffStatus,
      bracket: {
        settings: bracket.settings,
        seededTeams: bracket.seededTeams,
        rounds: bracket.rounds,
        currentRound: bracket.currentRound,
        generatedAt: bracket.generatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching bracket:", error);
    return NextResponse.json(
      { error: "Failed to fetch bracket" },
      { status: 500 }
    );
  }
}
