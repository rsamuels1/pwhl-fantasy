// lib/services/franchise-identity.ts
// Pure function — no IO. Computes the franchise archetype from aggregated stats.

export type FranchiseArchetype =
  | "BOOM_OR_BUST"
  | "DEFENSIVE_FORTRESS"
  | "SNIPER_FACTORY"
  | "GOALTENDER_DRIVEN";

export interface FranchiseIdentityResult {
  archetype: FranchiseArchetype;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  label: string;
  description: string;
}

const ARCHETYPE_META: Record<FranchiseArchetype, { label: string; description: string }> = {
  BOOM_OR_BUST: {
    label: "Boom or Bust",
    description:
      "Your lineup swings wildly — some weeks you dominate, others you struggle. High risk, high reward.",
  },
  DEFENSIVE_FORTRESS: {
    label: "Defensive Fortress",
    description:
      "Your team grinds out points through blocked shots and hits. Not flashy, but consistent.",
  },
  SNIPER_FACTORY: {
    label: "Sniper Factory",
    description:
      "Your team lives and dies by the goal scorers. When the puck goes in, you win.",
  },
  GOALTENDER_DRIVEN: {
    label: "Goaltender Driven",
    description:
      "Your goalie is your backbone. A hot week between the pipes and you're a contender.",
  },
};

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Computes the franchise archetype from aggregated season statistics.
 * Returns null if there is insufficient data (fewer than 3 scoring periods).
 *
 * @param weeklyScores  FP earned per scoring period
 * @param goalsFp       Total FP from goals + power-play points
 * @param defenseFp     Total FP from blocks + hits
 * @param goalieFp      Total FP from goalie stats (saves, wins, shutouts, etc.)
 * @param totalFp       Grand total FP (used for ratio comparisons)
 */
export function computeFranchiseIdentity(
  weeklyScores: number[],
  goalsFp: number,
  defenseFp: number,
  goalieFp: number,
  totalFp: number
): FranchiseIdentityResult | null {
  if (weeklyScores.length < 3 || totalFp <= 0) return null;

  const goalieRatio = goalieFp / totalFp;
  const sniperRatio = goalsFp / totalFp;
  const defenseRatio = defenseFp / totalFp;
  const avgScore = mean(weeklyScores);
  const variability = avgScore > 0 ? stdDev(weeklyScores) / avgScore : 0;

  let archetype: FranchiseArchetype | null = null;
  let confidence: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";

  // Priority order: GOALTENDER_DRIVEN > SNIPER_FACTORY > DEFENSIVE_FORTRESS > BOOM_OR_BUST
  if (goalieRatio > 0.30) {
    archetype = "GOALTENDER_DRIVEN";
    confidence = goalieRatio > 0.40 ? "HIGH" : goalieRatio > 0.35 ? "MEDIUM" : "LOW";
  } else if (sniperRatio > 0.50) {
    archetype = "SNIPER_FACTORY";
    confidence = sniperRatio > 0.65 ? "HIGH" : sniperRatio > 0.57 ? "MEDIUM" : "LOW";
  } else if (defenseRatio > 0.18) {
    archetype = "DEFENSIVE_FORTRESS";
    confidence = defenseRatio > 0.25 ? "HIGH" : defenseRatio > 0.21 ? "MEDIUM" : "LOW";
  } else if (variability > 0.35) {
    archetype = "BOOM_OR_BUST";
    confidence = variability > 0.50 ? "HIGH" : variability > 0.42 ? "MEDIUM" : "LOW";
  }

  if (!archetype) return null;

  const meta = ARCHETYPE_META[archetype];
  return { archetype, confidence, label: meta.label, description: meta.description };
}
