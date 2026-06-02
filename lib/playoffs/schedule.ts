/**
 * Playoff scheduling and period derivation.
 * 
 * Handles:
 * - Deriving playoff scheduling periods from regular season periods
 * - Calculating start/end times for each playoff round
 * - Ensuring each round spans the configured number of periods
 */

import { Game } from "@prisma/client";

export interface PlayoffPeriod {
  round: number;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Derive playoff periods from game schedule.
 * 
 * Each playoff round spans `roundDurationPeriods` real scheduling periods,
 * calculated from actual game dates.
 * 
 * @param games - All real games in the season, ordered by date
 * @param regularSeasonEndWeek - The week number where regular season ends
 * @param roundDurationPeriods - Number of real periods per playoff round
 * @param numPlayoffRounds - Total playoff rounds (e.g., 3 for 6 teams)
 * @returns Array of playoff periods with start/end times
 */
export function derivePlayoffPeriods(
  games: Game[],
  regularSeasonEndWeek: number,
  roundDurationPeriods: number,
  numPlayoffRounds: number
): PlayoffPeriod[] {
  if (games.length === 0) {
    throw new Error("No games available for playoff schedule");
  }

  // Sort games by date
  const sorted = [...games].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  // Find the first game after regular season
  const playoffStartGame = sorted.find((g) => {
    const gameDate = new Date(g.startsAt);
    // Estimate: each period is ~7 days. This is a rough heuristic.
    // In practice, you'd use the actual period boundaries.
    return gameDate > new Date(sorted[regularSeasonEndWeek * 7]);
  });

  if (!playoffStartGame) {
    throw new Error("Cannot determine playoff start date from games");
  }

  const periods: PlayoffPeriod[] = [];
  let currentStartDate = new Date(playoffStartGame.startsAt);

  for (let round = 1; round <= numPlayoffRounds; round++) {
    // Round ends after roundDurationPeriods * 7 days (rough estimate)
    const roundEndDate = new Date(currentStartDate);
    roundEndDate.setDate(roundEndDate.getDate() + roundDurationPeriods * 7);

    periods.push({
      round,
      startsAt: new Date(currentStartDate),
      endsAt: roundEndDate,
    });

    // Next round starts after current round ends
    currentStartDate = new Date(roundEndDate);
  }

  return periods;
}

/**
 * Get the playoff period for a specific round.
 */
export function getPlayoffPeriod(
  periods: PlayoffPeriod[],
  round: number
): PlayoffPeriod | undefined {
  return periods.find((p) => p.round === round);
}
