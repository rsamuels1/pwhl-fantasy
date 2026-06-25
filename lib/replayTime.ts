export function getReplayNow(
  league: { isReplay: boolean; replayCurrentDate: Date | null },
  devFallback: number
): number {
  if (league.isReplay && league.replayCurrentDate) {
    return league.replayCurrentDate.getTime();
  }
  return devFallback;
}

export interface BetaWeekMapping {
  week: number;
  fixtureStart: string;
  fixtureEnd: string;
}

/**
 * For beta leagues, translates a remapped real-calendar period to its fixture (2025-26) equivalent.
 * Beta leagues use `generateBetaMatchups()` which remaps scoring periods to 2026 calendar dates,
 * but the actual game data lives in 2024-25 date ranges. `betaWeekMappings` in scoringSettings
 * bridges the gap: each entry has { week, fixtureStart, fixtureEnd } pointing at the real game window.
 * For non-beta leagues (no mappings), returns the period unchanged.
 */
export function resolveFixturePeriod<T extends { week: number; startsAt: Date; endsAt: Date }>(
  period: T,
  betaWeekMappings?: BetaWeekMapping[] | null
): T {
  if (!betaWeekMappings || betaWeekMappings.length === 0) return period;
  const mapping = betaWeekMappings.find((m) => m.week === period.week);
  if (!mapping) return period;
  return { ...period, startsAt: new Date(mapping.fixtureStart), endsAt: new Date(mapping.fixtureEnd) };
}
