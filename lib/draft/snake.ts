// lib/draft/snake.ts
// Generates the full snake draft order up front. Pure and deterministic, so it's
// trivial to test and the server never has to "figure out whose turn it is" live —
// it just walks this list.

export interface PickSlot {
  overall: number; // 1-based overall pick number
  round: number; // 1-based
  fantasyTeamId: string;
}

// teamIdsInDraftOrder: the round-1 order (index 0 picks first).
// Odd rounds go forward (1..N), even rounds reverse (N..1) — that's the "snake".
export function generateSnakeOrder(
  teamIdsInDraftOrder: string[],
  rounds: number
): PickSlot[] {
  const n = teamIdsInDraftOrder.length;
  if (n === 0) throw new Error("Cannot generate a draft with zero teams");
  if (rounds < 1) throw new Error("Draft must have at least one round");

  const slots: PickSlot[] = [];
  let overall = 1;

  for (let round = 1; round <= rounds; round++) {
    const order =
      round % 2 === 1
        ? teamIdsInDraftOrder
        : [...teamIdsInDraftOrder].reverse();

    for (const fantasyTeamId of order) {
      slots.push({ overall, round, fantasyTeamId });
      overall++;
    }
  }

  return slots;
}

// How many rounds a league needs = total roster slots per team.
// Derive from rosterSettings so it's not hardcoded.
export function rostersToRounds(rosterSettings: {
  forward?: number;
  defense?: number;
  goalie?: number;
  util?: number;
  bench?: number;
  ir?: number; // IR slots are filled from waivers post-draft, not drafted
}): number {
  const { forward = 0, defense = 0, goalie = 0, util = 0, bench = 0 } =
    rosterSettings;
  // IR intentionally excluded — players are not drafted into IR slots.
  const total = forward + defense + goalie + util + bench;
  if (total < 1) throw new Error("Roster settings sum to zero slots");
  return total;
}
