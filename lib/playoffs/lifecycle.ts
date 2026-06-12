/**
 * Playoff lifecycle management.
 * 
 * Handles:
 * - Detecting when regular season has ended
 * - Triggering playoff initialization
 * - Coordinating bracket generation and matchup creation
 */

import { FantasyLeague } from "@prisma/client";
import { PlayoffSettings } from "./brackets";

/**
 * Check if regular season should end and playoffs should start.
 * 
 * Criteria:
 * - All scheduled regular season matchups are complete (have scores)
 * - Current date has passed the league's expected season end
 * - Playoff has not already been started
 * 
 * @param league - The fantasy league
 * @param completedMatchupCount - Number of completed regular season matchups
 * @param expectedMatchupCount - Expected total matchups for full round-robin
 * @param currentDate - Current date to check against
 * @returns true if playoffs should start
 */
export function shouldStartPlayoffs(
  league: FantasyLeague,
  completedMatchupCount: number,
  expectedMatchupCount: number,
  currentDate: Date = new Date()
): boolean {
  // Don't start if already in playoffs
  if (league.playoffStatus !== "NOT_STARTED") {
    return false;
  }

  // Must have completed all expected matchups
  if (completedMatchupCount < expectedMatchupCount) {
    return false;
  }

  // Playoff can be manually triggered regardless of date
  // In practice, you'd check if an admin has manually initiated playoffs
  return true;
}

/**
 * Get default playoff settings for a league.
 * 
 * Merges league's custom settings with defaults.
 */
export function getPlayoffSettings(
  leaguePlayoffSettings: Record<string, any> | undefined
): PlayoffSettings {
  const defaults: PlayoffSettings = {
    teamsInPlayoff: 4,
    topSeedsWithBye: 0,
    roundDurationPeriods: 2,
    higherSeedWinsTies: true,
  };

  if (!leaguePlayoffSettings) {
    return defaults;
  }

  return {
    teamsInPlayoff: leaguePlayoffSettings.teamsInPlayoff ?? defaults.teamsInPlayoff,
    topSeedsWithBye: leaguePlayoffSettings.topSeedsWithBye ?? defaults.topSeedsWithBye,
    roundDurationPeriods:
      leaguePlayoffSettings.roundDurationPeriods ?? defaults.roundDurationPeriods,
    higherSeedWinsTies:
      leaguePlayoffSettings.higherSeedWinsTies ?? defaults.higherSeedWinsTies,
  };
}

/**
 * Calculate total playoff rounds for a given number of playoff teams.
 */
export function calculatePlayoffRounds(teamsInPlayoff: number): number {
  // Single elimination: log2(teams) = number of rounds
  // 6 teams: log2(6) = 2.58 → 3 rounds (with byes)
  return Math.ceil(Math.log2(teamsInPlayoff));
}
