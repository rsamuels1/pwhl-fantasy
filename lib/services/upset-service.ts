import type { PrismaClient } from "@prisma/client";
import { winProbability } from "@/lib/projections";

export interface Upset {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  underdogProbability: number;
  week: number;
  underdogWasHome: boolean;
}

// Scan all scored matchups and surface the most improbable results.
// An upset = the team that won had win probability ≤ 0.35 going in, computed
// retroactively from final scores as a proxy for pre-game expectation.
// Returns top 3 upsets sorted by underdog probability ascending (most shocking first).
export async function getLeagueUpsets(leagueId: string, prisma: PrismaClient): Promise<Upset[]> {
  const matchups = await prisma.matchup.findMany({
    where: {
      leagueId,
      isPlayoff: false,
      homeScore: { not: null },
      awayScore: { not: null },
    },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { week: "asc" },
  });

  const upsets: Upset[] = [];
  for (const m of matchups) {
    const home = m.homeScore!;
    const away = m.awayScore!;
    if (home === away) continue; // ties can't be upsets

    const homeWon = home > away;
    // winProbability(a, b) returns probability that 'a' beats 'b'
    const homeWinProb = winProbability(home, away);
    const underdogWon = homeWon ? homeWinProb <= 0.35 : (1 - homeWinProb) <= 0.35;
    if (!underdogWon) continue;

    const underdogProb = homeWon ? homeWinProb : 1 - homeWinProb;
    upsets.push({
      homeTeamName: m.homeTeam.name,
      awayTeamName: m.awayTeam.name,
      homeScore: home,
      awayScore: away,
      underdogProbability: underdogProb,
      week: m.week,
      underdogWasHome: homeWon,
    });
  }

  return upsets.sort((a, b) => a.underdogProbability - b.underdogProbability).slice(0, 3);
}
