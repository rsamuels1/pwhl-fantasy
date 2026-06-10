import { describe, it, expect } from "vitest";
import { computeSeasonState, pendingWeeks } from "../lib/season/lifecycle";
import { derivePeriods } from "../lib/scoring/periods";

// Build a minimal set of games spread across two 7-day windows.
// Window 1: Jan 6-12  (3 games)
// Window 2: Jan 13-19 (2 games — skip Jan 20+ to simulate a gap)
// Window 3: Feb 3-9   (2 games — after a multi-week break)
const JAN_6  = Date.UTC(2025, 0, 6,  19, 0, 0); // 7 PM UTC
const JAN_8  = Date.UTC(2025, 0, 8,  19, 0, 0);
const JAN_10 = Date.UTC(2025, 0, 10, 19, 0, 0);
const JAN_14 = Date.UTC(2025, 0, 14, 19, 0, 0);
const JAN_16 = Date.UTC(2025, 0, 16, 19, 0, 0);
const FEB_4  = Date.UTC(2025, 1, 4,  19, 0, 0);
const FEB_6  = Date.UTC(2025, 1, 6,  19, 0, 0);

function game(ms: number, status: "FINAL" | "SCHEDULED" = "FINAL") {
  return { startsAt: new Date(ms), status };
}

const GAMES = [
  game(JAN_6),  game(JAN_8),  game(JAN_10),  // week 1
  game(JAN_14), game(JAN_16),                  // week 2
  game(FEB_4),  game(FEB_6),                   // week 3 (after break)
];

const PERIODS = derivePeriods(GAMES.map((g) => g.startsAt));

const BEFORE_SEASON = Date.UTC(2025, 0, 1);
const IN_WEEK_1     = Date.UTC(2025, 0, 7);
const AFTER_WEEK_1  = Date.UTC(2025, 0, 14, 0, 0, 0);
const AFTER_WEEK_2  = Date.UTC(2025, 0, 21);
const AFTER_ALL     = Date.UTC(2025, 2, 1);

describe("derivePeriods", () => {
  it("skips the empty break window", () => {
    expect(PERIODS).toHaveLength(3);
    expect(PERIODS[0].week).toBe(1);
    expect(PERIODS[2].week).toBe(3);
  });
});

describe("computeSeasonState", () => {
  it("all upcoming before season starts", () => {
    const state = computeSeasonState(PERIODS, GAMES, new Set(), BEFORE_SEASON);
    expect(state.lifecycleStatus).toBe("PRE_SEASON");
    expect(state.periods.every((p) => p.status === "UPCOMING")).toBe(true);
    expect(state.activePeriod).toBeNull();
  });

  it("week 1 is ACTIVE during its window", () => {
    const state = computeSeasonState(PERIODS, GAMES, new Set(), IN_WEEK_1);
    expect(state.lifecycleStatus).toBe("IN_PROGRESS");
    expect(state.periods[0].status).toBe("ACTIVE");
    expect(state.activePeriod?.week).toBe(1);
    expect(state.periods[1].status).toBe("UPCOMING");
  });

  it("week 1 becomes SCORING_PENDING once its window closes", () => {
    const state = computeSeasonState(PERIODS, GAMES, new Set(), AFTER_WEEK_1);
    expect(state.periods[0].status).toBe("SCORING_PENDING");
    // week 2 is now active
    expect(state.periods[1].status).toBe("ACTIVE");
  });

  it("week 1 becomes COMPLETE once scored", () => {
    const state = computeSeasonState(PERIODS, GAMES, new Set([1]), AFTER_WEEK_1);
    expect(state.periods[0].status).toBe("COMPLETE");
    expect(state.completedWeeks).toBe(1);
  });

  it("SCORING_PENDING if week 2 ended but not scored yet", () => {
    const state = computeSeasonState(PERIODS, GAMES, new Set([1]), AFTER_WEEK_2);
    expect(state.periods[0].status).toBe("COMPLETE");
    expect(state.periods[1].status).toBe("SCORING_PENDING");
    expect(state.periods[2].status).toBe("UPCOMING");
    expect(state.lifecycleStatus).toBe("IN_PROGRESS");
  });

  it("season COMPLETE when all periods scored", () => {
    const state = computeSeasonState(PERIODS, GAMES, new Set([1, 2, 3]), AFTER_ALL);
    expect(state.lifecycleStatus).toBe("COMPLETE");
    expect(state.completedWeeks).toBe(3);
    expect(state.periods.every((p) => p.status === "COMPLETE")).toBe(true);
  });

  it("counts games per period correctly", () => {
    const state = computeSeasonState(PERIODS, GAMES, new Set(), BEFORE_SEASON);
    expect(state.periods[0].gamesTotal).toBe(3);
    expect(state.periods[1].gamesTotal).toBe(2);
    expect(state.periods[2].gamesTotal).toBe(2);
  });

  it("counts final games correctly", () => {
    const mixedGames = [
      game(JAN_6, "FINAL"), game(JAN_8, "SCHEDULED"), game(JAN_10, "FINAL"),
      game(JAN_14, "FINAL"), game(JAN_16, "FINAL"),
      game(FEB_4, "FINAL"), game(FEB_6, "FINAL"),
    ];
    const state = computeSeasonState(PERIODS, mixedGames, new Set(), IN_WEEK_1);
    expect(state.periods[0].gamesFinal).toBe(2); // one still scheduled
    expect(state.periods[1].gamesFinal).toBe(2);
  });

  it("empty periods list gives PRE_SEASON", () => {
    const state = computeSeasonState([], [], new Set(), Date.now());
    expect(state.lifecycleStatus).toBe("PRE_SEASON");
    expect(state.totalWeeks).toBe(0);
  });
});

describe("pendingWeeks", () => {
  it("returns only SCORING_PENDING periods", () => {
    const state = computeSeasonState(PERIODS, GAMES, new Set([1]), AFTER_WEEK_2);
    const pending = pendingWeeks(state);
    expect(pending).toHaveLength(1);
    expect(pending[0].week).toBe(2);
  });

  it("returns nothing when all scored", () => {
    const state = computeSeasonState(PERIODS, GAMES, new Set([1, 2, 3]), AFTER_ALL);
    expect(pendingWeeks(state)).toHaveLength(0);
  });

  it("returns multiple pending periods if behind", () => {
    // weeks 1 and 2 both ended, neither scored
    const state = computeSeasonState(PERIODS, GAMES, new Set(), AFTER_WEEK_2);
    const pending = pendingWeeks(state);
    expect(pending.map((p) => p.week)).toEqual([1, 2]);
  });
});
