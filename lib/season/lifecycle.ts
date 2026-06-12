// lib/season/lifecycle.ts
// Pure season lifecycle engine. No IO — takes time as a parameter exactly as the
// draft engine does (nowMs instead of Date.now()). The DB layer calls this and
// supplies the real clock; the test harness supplies a simulated clock.

import type { ScoringPeriod } from "@/lib/scoring/periods";

export type PeriodStatus =
  | "UPCOMING"         // startsAt > nowMs
  | "ACTIVE"           // startsAt <= nowMs < endsAt
  | "SCORING_PENDING"  // endsAt <= nowMs, scoring not yet cached
  | "COMPLETE";        // endsAt <= nowMs, scores cached in DB

export type SeasonLifecycleStatus = "PRE_SEASON" | "IN_PROGRESS" | "COMPLETE";

export interface PeriodState {
  period: ScoringPeriod;
  status: PeriodStatus;
  gamesTotal: number;   // real PWHL games in this window
  gamesFinal: number;   // games with status FINAL
}

export interface SeasonState {
  lifecycleStatus: SeasonLifecycleStatus;
  activePeriod: ScoringPeriod | null;
  periods: PeriodState[];
  // Convenience counts
  completedWeeks: number;
  totalWeeks: number;
}

// All inputs are plain data — no Prisma types, no IO.
export function computeSeasonState(
  periods: ScoringPeriod[],
  games: Array<{ startsAt: Date; status: string }>,
  scoredWeeks: Set<number>,
  nowMs: number
): SeasonState {
  if (periods.length === 0) {
    return {
      lifecycleStatus: "PRE_SEASON",
      activePeriod: null,
      periods: [],
      completedWeeks: 0,
      totalWeeks: 0,
    };
  }

  const periodStates: PeriodState[] = periods.map((p) => {
    const windowGames = games.filter(
      (g) => g.startsAt.getTime() >= p.startsAt.getTime() && g.startsAt.getTime() < p.endsAt.getTime()
    );
    const gamesTotal = windowGames.length;
    const gamesFinal = windowGames.filter((g) => g.status === "FINAL").length;

    let status: PeriodStatus;
    const start = p.startsAt.getTime();
    const end = p.endsAt.getTime();

    if (nowMs < start) {
      status = "UPCOMING";
    } else if (nowMs < end) {
      status = "ACTIVE";
    } else if (scoredWeeks.has(p.week)) {
      status = "COMPLETE";
    } else {
      status = "SCORING_PENDING";
    }

    return { period: p, status, gamesTotal, gamesFinal };
  });

  const activePeriod =
    periodStates.find((s) => s.status === "ACTIVE")?.period ?? null;
  const completedWeeks = periodStates.filter((s) => s.status === "COMPLETE").length;
  const totalWeeks = periods.length;

  let lifecycleStatus: SeasonLifecycleStatus;
  if (completedWeeks === totalWeeks) {
    // All periods past and scored — but only "COMPLETE" once at least one period existed and ended.
    const allEnded = periods.every((p) => p.endsAt.getTime() <= nowMs);
    lifecycleStatus = allEnded ? "COMPLETE" : "IN_PROGRESS";
  } else if (periodStates.some((s) => s.status !== "UPCOMING")) {
    lifecycleStatus = "IN_PROGRESS";
  } else {
    lifecycleStatus = "PRE_SEASON";
  }

  return { lifecycleStatus, activePeriod, periods: periodStates, completedWeeks, totalWeeks };
}

// Which weeks need scoring right now given nowMs?
export function pendingWeeks(state: SeasonState): ScoringPeriod[] {
  return state.periods
    .filter((s) => s.status === "SCORING_PENDING")
    .map((s) => s.period);
}

export interface SeasonBoundaryResult {
  valid: boolean;
  conflictingPeriod?: ScoringPeriod;
  message?: string;
}

// Validates that all fantasy scoring periods end before the PWHL playoff start.
// Only called when pwhlPlayoffStartMs is known (non-null on the league).
export function validateSeasonBoundary(
  periods: ScoringPeriod[],
  pwhlPlayoffStartMs: number
): SeasonBoundaryResult {
  if (periods.length === 0) return { valid: true };

  const conflict = periods.find(
    (p) => p.endsAt.getTime() > pwhlPlayoffStartMs
  );

  if (conflict) {
    return {
      valid: false,
      conflictingPeriod: conflict,
      message: `Scoring period week ${conflict.week} ends after the PWHL playoff start date. Shorten the fantasy season or adjust the PWHL playoff start date.`,
    };
  }

  return { valid: true };
}
