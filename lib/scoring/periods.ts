// lib/scoring/periods.ts
// Pure: derive non-empty 7-day scoring periods from a list of real game dates.
// Never hardcodes dates or assumes games-per-week — the PWHL schedule is irregular
// and has multi-week international breaks with zero games that should be skipped.

export interface ScoringPeriod {
  week: number; // 1-based, counting only non-empty windows
  startsAt: Date; // inclusive: midnight UTC of the window's first day
  endsAt: Date;   // exclusive: = startsAt + 7 days (games where startsAt >= startsAt && < endsAt)
}

// gameDates: UTC datetimes of all real games in the season (any order; dupes ok).
// Returns only windows that contain at least one game, numbered consecutively.
export function derivePeriods(gameDates: Date[]): ScoringPeriod[] {
  if (gameDates.length === 0) return [];

  const ms = gameDates.map((d) => d.getTime()).sort((a, b) => a - b);
  const first = new Date(ms[0]);
  const last = ms[ms.length - 1];

  // Anchor to midnight UTC of the first game's date so windows are calendar-aligned.
  const anchor = Date.UTC(
    first.getUTCFullYear(),
    first.getUTCMonth(),
    first.getUTCDate()
  );

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const periods: ScoringPeriod[] = [];
  let weekNum = 0;
  let windowStart = anchor;

  while (windowStart <= last) {
    const windowEnd = windowStart + WEEK_MS;
    const hasGame = ms.some((t) => t >= windowStart && t < windowEnd);
    if (hasGame) {
      weekNum++;
      periods.push({
        week: weekNum,
        startsAt: new Date(windowStart),
        endsAt: new Date(windowEnd),
      });
    }
    windowStart = windowEnd;
  }

  return periods;
}
