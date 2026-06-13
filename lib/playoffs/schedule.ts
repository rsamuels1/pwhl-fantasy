/**
 * Playoff scheduling and period derivation.
 *
 * Handles:
 * - Deriving playoff scheduling periods from regular season periods
 * - Calculating start/end times for each playoff round
 * - Ensuring each round spans the configured number of periods
 */

export interface PlayoffPeriod {
  round: number;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Derive playoff periods given a playoff start date.
 *
 * Each playoff round spans `roundDurationPeriods` real scheduling periods (~7 days each).
 *
 * @param playoffStartsAt - The date playoff rounds begin (typically one week after last RS game)
 * @param roundDurationPeriods - Number of real periods per playoff round (e.g., 1 for single-week rounds)
 * @param numPlayoffRounds - Total playoff rounds (e.g., 3 for 4-team bracket)
 * @returns Array of playoff periods with start/end times
 */
export function derivePlayoffPeriods(
  playoffStartsAt: Date,
  roundDurationPeriods: number,
  numPlayoffRounds: number
): PlayoffPeriod[] {
  const periods: PlayoffPeriod[] = [];
  let currentStartDate = new Date(playoffStartsAt);

  for (let round = 1; round <= numPlayoffRounds; round++) {
    const roundEndDate = new Date(currentStartDate);
    roundEndDate.setDate(roundEndDate.getDate() + roundDurationPeriods * 7);

    periods.push({
      round,
      startsAt: new Date(currentStartDate),
      endsAt: roundEndDate,
    });

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
