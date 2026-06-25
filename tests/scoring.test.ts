// tests/scoring.test.ts
import { describe, it, expect } from "vitest";
import { scoreStatLine, DEFAULT_SCORING, type StatLineInput } from "../lib/scoring";
import { Position } from "@prisma/client";

const empty: StatLineInput = {
  goals: 0, assists: 0, shots: 0, plusMinus: 0, penaltyMinutes: 0,
  powerPlayPts: 0, hits: 0, blocks: 0, saves: 0, goalsAgainst: 0,
  shutout: false, win: false,
};

describe("scoreStatLine — skaters", () => {
  it("scores a clean stat line correctly", () => {
    const line = { ...empty, goals: 2, assists: 1, shots: 4 };
    // 2*3 + 1*2 + 4*0.5 = 6 + 2 + 2 = 10
    expect(scoreStatLine(line, Position.FORWARD)).toBe(10);
  });

  it("applies negative penalty minutes", () => {
    const line = { ...empty, goals: 1, penaltyMinutes: 2 };
    // 1*3 + 2*(-0.5) = 3 - 1 = 2
    expect(scoreStatLine(line, Position.DEFENSE)).toBe(2);
  });

  it("returns 0 for an empty line", () => {
    expect(scoreStatLine(empty, Position.FORWARD)).toBe(0);
  });
});

describe("scoreStatLine — goalies", () => {
  it("scores a shutout win", () => {
    const line = { ...empty, win: true, saves: 25, shutout: true };
    // 4 (win) + 25*0.2 (saves) + 3 (shutout) = 4 + 5 + 3 = 12
    expect(scoreStatLine(line, Position.GOALIE)).toBe(12);
  });

  it("penalizes goals against", () => {
    const line = { ...empty, win: true, saves: 20, goalsAgainst: 3 };
    // 4 + 20*0.2 + 3*(-1) = 4 + 4 - 3 = 5
    expect(scoreStatLine(line, Position.GOALIE)).toBe(5);
  });

  it("ignores skater stats for goalies", () => {
    const line = { ...empty, goals: 1, win: true };
    // Only the win counts: 4. The goal is ignored under goalie scoring.
    expect(scoreStatLine(line, Position.GOALIE)).toBe(4);
  });
});

describe("custom scoring settings", () => {
  it("respects overridden values", () => {
    const custom = { ...DEFAULT_SCORING, skater: { ...DEFAULT_SCORING.skater, goal: 5 } };
    const line = { ...empty, goals: 2 };
    expect(scoreStatLine(line, Position.FORWARD, custom)).toBe(10);
  });
});

describe("scoreStatLine — edge cases", () => {
  // Shutout derivation: scoreStatLine treats shutout as a boolean flag on the input.
  // These tests confirm the engine correctly applies (or withholds) the bonus based on
  // what the ingest layer computes (goalie played full game alone with 0 GA & saves > 0).
  it("awards shutout bonus when shutout=true, saves>0", () => {
    const line = { ...empty, saves: 30, goalsAgainst: 0, shutout: true };
    // 30*0.2 + 3 (shutout) = 6 + 3 = 9
    expect(scoreStatLine(line, Position.GOALIE)).toBe(9);
  });

  it("does NOT award shutout bonus when shutout=false even with 0 GA", () => {
    // shutout=false represents: second goalie played (ingest sets shutout=false in that case)
    const line = { ...empty, saves: 20, goalsAgainst: 0, shutout: false };
    // 20*0.2 = 4, no shutout bonus
    expect(scoreStatLine(line, Position.GOALIE)).toBe(4);
  });

  // PPP calculation: powerPlayPts field carries the total power-play point count
  // (goals + assists on the power play), applied at the powerPlayPoint multiplier.
  it("awards PPP multiplier for a power-play goal", () => {
    const line = { ...empty, goals: 1, powerPlayPts: 1 };
    // 1*3 (goal) + 1*0.5 (PPP) = 3.5
    expect(scoreStatLine(line, Position.FORWARD)).toBe(3.5);
  });

  it("awards PPP multiplier for a power-play assist", () => {
    const line = { ...empty, assists: 1, powerPlayPts: 1 };
    // 1*2 (assist) + 1*0.5 (PPP) = 2.5
    expect(scoreStatLine(line, Position.FORWARD)).toBe(2.5);
  });

  it("does NOT award PPP for an even-strength goal (powerPlayPts=0)", () => {
    const line = { ...empty, goals: 1, powerPlayPts: 0 };
    // 1*3 only
    expect(scoreStatLine(line, Position.FORWARD)).toBe(3);
  });

  // Goalie win: engine applies win bonus when win=true regardless of scoreline context.
  it("awards win bonus to winning goalie", () => {
    const line = { ...empty, saves: 25, goalsAgainst: 2, win: true };
    // 4 (win) + 25*0.2 + 2*(-1) = 4 + 5 - 2 = 7
    expect(scoreStatLine(line, Position.GOALIE)).toBe(7);
  });

  it("does NOT award win bonus to losing goalie", () => {
    const line = { ...empty, saves: 25, goalsAgainst: 4, win: false };
    // 25*0.2 + 4*(-1) = 5 - 4 = 1
    expect(scoreStatLine(line, Position.GOALIE)).toBe(1);
  });

  it("does NOT award win bonus when team won in OT but win=false (ingest responsibility)", () => {
    // CLAUDE.md: win = team won AND goalie played. If ingest passes win=false, engine respects it.
    const line = { ...empty, saves: 28, goalsAgainst: 2, win: false };
    // 28*0.2 + 2*(-1) = 5.6 - 2 = 3.6
    expect(scoreStatLine(line, Position.GOALIE)).toBe(3.6);
  });

  // Zero stat line: all-zeros input must return exactly 0, not NaN or null.
  it("returns exactly 0 for an all-zeros skater stat line", () => {
    expect(scoreStatLine(empty, Position.FORWARD)).toBe(0);
  });

  it("returns exactly 0 for an all-zeros goalie stat line", () => {
    expect(scoreStatLine(empty, Position.GOALIE)).toBe(0);
  });
});
