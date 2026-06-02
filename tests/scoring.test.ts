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
