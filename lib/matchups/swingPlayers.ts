// lib/matchups/swingPlayers.ts
// Identifies players most likely to determine the matchup outcome —
// those with the highest projected remaining contribution this period.

import type { PrismaClient } from "@prisma/client";
import { Position } from "@prisma/client";
import { type ScoringSettings, DEFAULT_SCORING } from "../scoring";
import { projectPlayer } from "../projections";
import type { ScoringPeriod } from "../scoring/periods";

export interface SwingPlayer {
  playerId: string;
  name: string;
  position: Position;
  team: "mine" | "opponent";
  gamesRemaining: number;
  projectedImpact: number;
}

// Returns top N players from both rosters ranked by projected remaining points.
// Only includes players who still have games left in the period.
export async function getSwingPlayers(
  myTeamId: string,
  opponentTeamId: string,
  period: ScoringPeriod,
  scoringSettings: ScoringSettings = DEFAULT_SCORING,
  prisma: PrismaClient,
  limit = 5
): Promise<SwingPlayer[]> {
  const now = new Date();

  const [myEntries, opponentEntries] = await Promise.all([
    prisma.rosterEntry.findMany({
      where: { fantasyTeamId: myTeamId, slot: { notIn: ["BENCH", "IR"] } },
      include: {
        player: {
          select: { id: true, firstName: true, lastName: true, position: true, teamId: true },
        },
      },
    }),
    prisma.rosterEntry.findMany({
      where: { fantasyTeamId: opponentTeamId, slot: { notIn: ["BENCH", "IR"] } },
      include: {
        player: {
          select: { id: true, firstName: true, lastName: true, position: true, teamId: true },
        },
      },
    }),
  ]);

  const allEntries = [
    ...myEntries.map((e) => ({ ...e, teamLabel: "mine" as const })),
    ...opponentEntries.map((e) => ({ ...e, teamLabel: "opponent" as const })),
  ];

  if (allEntries.length === 0) return [];

  // Collect all relevant real-team IDs
  const allTeamIds = [
    ...new Set(allEntries.map((e) => e.player.teamId).filter(Boolean)),
  ] as string[];

  if (allTeamIds.length === 0) return [];

  // Count remaining period games per real team.
  // No status filter — historical fixture has all games as FINAL; startsAt >= now proves "future".
  const remainingGames = await prisma.game.findMany({
    where: {
      startsAt: { gte: now, lt: period.endsAt },
      OR: [{ homeTeamId: { in: allTeamIds } }, { awayTeamId: { in: allTeamIds } }],
    },
    select: { homeTeamId: true, awayTeamId: true },
  });

  const gamesPerTeam = new Map<string, number>();
  for (const game of remainingGames) {
    for (const tid of [game.homeTeamId, game.awayTeamId]) {
      if (allTeamIds.includes(tid)) {
        gamesPerTeam.set(tid, (gamesPerTeam.get(tid) ?? 0) + 1);
      }
    }
  }

  // Only consider players whose real team has remaining games
  const playersWithGames = allEntries.filter(
    (e) => e.player.teamId && (gamesPerTeam.get(e.player.teamId) ?? 0) > 0
  );
  if (playersWithGames.length === 0) return [];

  const swingPlayers: SwingPlayer[] = await Promise.all(
    playersWithGames.map(async (entry) => {
      const gamesLeft = gamesPerTeam.get(entry.player.teamId!) ?? 0;
      const avgPpg = await projectPlayer(
        entry.playerId,
        entry.player.position,
        scoringSettings,
        prisma
      );
      return {
        playerId: entry.playerId,
        name: `${entry.player.firstName} ${entry.player.lastName}`,
        position: entry.player.position,
        team: entry.teamLabel,
        gamesRemaining: gamesLeft,
        projectedImpact: Math.round(avgPpg * gamesLeft * 100) / 100,
      };
    })
  );

  return swingPlayers.sort((a, b) => b.projectedImpact - a.projectedImpact).slice(0, limit);
}
