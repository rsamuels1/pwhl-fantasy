// lib/scoring/index.ts
// The scoring engine. Fantasy points are ALWAYS computed from raw StatLines
// against a league's scoringSettings. Never store points as the source of truth.

import { Position } from "@prisma/client";

// The shape of FantasyLeague.scoringSettings (stored as JSON).
export interface ScoringSettings {
  skater: {
    goal: number;
    assist: number;
    shot: number;
    plusMinus: number; // points per +/- unit
    penaltyMinute: number;
    powerPlayPoint: number;
    hit: number;
    block: number;
  };
  goalie: {
    win: number;
    save: number;
    goalAgainst: number; // usually negative
    shutout: number;
  };
}

export const DEFAULT_SCORING: ScoringSettings = {
  skater: {
    goal: 3,
    assist: 2,
    shot: 0.5,
    plusMinus: 1,
    penaltyMinute: -0.5,
    powerPlayPoint: 0.5,
    hit: 0.25,
    block: 0.25,
  },
  goalie: {
    win: 4,
    save: 0.2,
    goalAgainst: -1,
    shutout: 3,
  },
};

// A raw stat line (subset of the Prisma StatLine model).
export interface StatLineInput {
  goals: number;
  assists: number;
  shots: number;
  plusMinus: number;
  penaltyMinutes: number;
  powerPlayPts: number;
  hits: number;
  blocks: number;
  saves: number;
  goalsAgainst: number;
  shutout: boolean;
  win: boolean;
}

export function scoreStatLine(
  line: StatLineInput,
  position: Position,
  settings: ScoringSettings = DEFAULT_SCORING
): number {
  if (position === Position.GOALIE) {
    const g = settings.goalie;
    return round2(
      (line.win ? g.win : 0) +
        line.saves * g.save +
        line.goalsAgainst * g.goalAgainst +
        (line.shutout ? g.shutout : 0)
    );
  }

  const s = settings.skater;
  return round2(
    line.goals * s.goal +
      line.assists * s.assist +
      line.shots * s.shot +
      line.plusMinus * s.plusMinus +
      line.penaltyMinutes * s.penaltyMinute +
      line.powerPlayPts * s.powerPlayPoint +
      line.hits * s.hit +
      line.blocks * s.block
  );
}

export interface ScoringBreakdown {
  label: string;
  stat: number;
  multiplier: number;
  points: number;
}

// Same math as scoreStatLine but returns per-category breakdown for display.
// Only nonzero contributions are included.
export function scoreStatLineDetailed(
  line: StatLineInput,
  position: Position,
  settings: ScoringSettings = DEFAULT_SCORING
): { total: number; breakdown: ScoringBreakdown[] } {
  const breakdown: ScoringBreakdown[] = [];

  function add(label: string, stat: number, multiplier: number) {
    if (stat === 0) return;
    breakdown.push({ label, stat, multiplier, points: round2(stat * multiplier) });
  }

  if (position === Position.GOALIE) {
    const g = settings.goalie;
    if (line.win) add("Win", 1, g.win);
    add("Saves", line.saves, g.save);
    add("Goals Against", line.goalsAgainst, g.goalAgainst);
    if (line.shutout) add("Shutout", 1, g.shutout);
  } else {
    const s = settings.skater;
    add("Goals", line.goals, s.goal);
    add("Assists", line.assists, s.assist);
    add("Shots", line.shots, s.shot);
    add("+/-", line.plusMinus, s.plusMinus);
    add("PIM", line.penaltyMinutes, s.penaltyMinute);
    add("PPP", line.powerPlayPts, s.powerPlayPoint);
    add("Hits", line.hits, s.hit);
    add("Blocks", line.blocks, s.block);
  }

  const total = round2(breakdown.reduce((s, b) => s + b.points, 0));
  return { total, breakdown };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
