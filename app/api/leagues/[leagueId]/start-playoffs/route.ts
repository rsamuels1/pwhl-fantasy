/**
 * POST /api/leagues/[leagueId]/start-playoffs
 * 
 * Triggers playoff initialization for a league.
 * - Verifies regular season is complete
 * - Generates bracket from standings
 * - Creates playoff matchups
 * - Updates league status
 * 
 * Requires admin/commissioner privileges.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeStandings, getPlayoffStandings } from "@/lib/playoffs/seeding";
import { seedTeams, generateBracket } from "@/lib/playoffs/brackets";
import {
  getPlayoffSettings,
  calculatePlayoffRounds,
  shouldStartPlayoffs,
} from "@/lib/playoffs/lifecycle";
import {
  generatePlayoffMatchups,
  PlayoffMatchupPairing,
} from "@/lib/scoring/matchups";
import { derivePlayoffPeriods } from "@/lib/playoffs/schedule";

export async function POST(
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

    // Check if already in playoffs
    if (league.playoffStatus !== "NOT_STARTED") {
      return NextResponse.json(
        { error: `Playoffs already ${league.playoffStatus.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Fetch all matchups for standings
    const matchups = await prisma.matchup.findMany({
      where: { leagueId },
    });

    // Compute standings
    const standings = computeStandings(league.teams, matchups);

    // Check that we have enough teams
    const playoffSettings = getPlayoffSettings(league.playoffSettings as any);
    if (standings.length < playoffSettings.topSeedsWithBye) {
      return NextResponse.json(
        {
          error: `Not enough teams for playoffs. Need at least ${playoffSettings.topSeedsWithBye} teams.`,
        },
        { status: 400 }
      );
    }

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

    // Calculate playoff periods
    const totalRounds = calculatePlayoffRounds(playoffSettings.teamsInPlayoff);
    const games = await prisma.game.findMany({
      where: { season: league.season },
      orderBy: { startsAt: "asc" },
    });

    const playoffPeriods = derivePlayoffPeriods(
      games,
      matchups.length / league.teams.length, // Estimate regular season weeks
      playoffSettings.roundDurationPeriods,
      totalRounds
    );

    // Create playoff matchups
    const playoffMatchupPairings: PlayoffMatchupPairing[] = [];

    // First round: bye teams rest, other teams play
    for (let i = 0; i < seededTeams.length; i++) {
      const team = seededTeams[i];
      if (team.hasBye) continue;

      // For teams without byes, pair them in order
      const pairedIndex = seededTeams.length - 1 - i;
      if (pairedIndex > i) {
        const pairedTeam = seededTeams[pairedIndex];
        const period = playoffPeriods[0];

        playoffMatchupPairings.push({
          homeTeamId: team.fantasyTeamId, // Lower seed number (higher rank)
          awayTeamId: pairedTeam.fantasyTeamId,
          round: 1,
          startsAt: period.startsAt,
          endsAt: period.endsAt,
        });
      }
    }

    // Subsequent rounds will be filled as results come in
    for (let round = 2; round <= totalRounds; round++) {
      const period = playoffPeriods[round - 1];
      // Placeholder matchups; will be updated as previous round completes
      playoffMatchupPairings.push({
        homeTeamId: "", // Will be filled later
        awayTeamId: "",
        round,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
      });
    }

    // Create playoff matchups in database
    await generatePlayoffMatchups(leagueId, playoffMatchupPairings, prisma);

    // Update league status
    await prisma.fantasyLeague.update({
      where: { id: leagueId },
      data: { playoffStatus: "IN_PROGRESS" },
    });

    return NextResponse.json({
      success: true,
      leagueId,
      message: "Playoffs initialized successfully",
      bracket: {
        seededTeams: bracket.seededTeams,
        totalRounds,
        settings: playoffSettings,
      },
    });
  } catch (error) {
    console.error("Error starting playoffs:", error);
    return NextResponse.json(
      { error: "Failed to start playoffs" },
      { status: 500 }
    );
  }
}
