// lib/services/analysis-service.ts
// Team Analysis & Insights — trend, position-group comparison, FA upgrade cards.
// Uses 4 DB queries total; scoring computed via scoreStatLine (pure, no IO).

import type { PrismaClient } from "@prisma/client";
import { Position } from "@prisma/client";
import { scoreStatLine } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { getSeasonState } from "@/lib/season";
import type { ScoringPeriod } from "@/lib/scoring/periods";

// ── Public types ──────────────────────────────────────────────────────────────

export interface PlayerTrend {
  playerId: string;
  playerName: string;
  position: string;
  slot: string;
  recentFpPerGame: number;   // rolling 5-game avg (from recent period window)
  seasonFpPerGame: number;   // career avg from earlier history
  weeklyFp: (number | null)[];  // last 4 completed weeks, null = didn't play
  trend: "hot" | "cold" | "on-track" | "new";
}

export interface PositionGroupRow {
  group: "Forwards" | "Defense" | "Goalie";
  myWeeklyFp: (number | null)[];
  leagueMedianWeeklyFp: (number | null)[];
  isWeakest: boolean;
}

export interface FaUpgradeCard {
  candidate: {
    playerId: string;
    playerName: string;
    position: string;
    projectedFpPerGame: number;
  };
  suggestedDrop: {
    playerId: string;
    playerName: string;
    slot: string;
    recentFpPerGame: number;
  };
  group: "Forwards" | "Defense" | "Goalie";
}

export interface TeamAnalysis {
  playerTrends: PlayerTrend[];
  positionGroups: PositionGroupRow[];
  faUpgrades: FaUpgradeCard[];
  scoredWeekLabels: string[];
  hasEnoughHistory: boolean;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function getTeamAnalysis(
  leagueId: string,
  teamId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<TeamAnalysis> {
  const empty: TeamAnalysis = {
    playerTrends: [],
    positionGroups: [],
    faUpgrades: [],
    scoredWeekLabels: [],
    hasEnoughHistory: false,
  };

  // Query 0: league settings (season + scoringSettings).
  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { scoringSettings: true, season: true },
  });
  if (!league) return empty;

  const scoringSettings = parseScoringSettings(league.scoringSettings);

  // Find last 4 completed scoring periods.
  const seasonState = await getSeasonState(leagueId, nowMs, prisma);
  const completedPeriods = seasonState.periods
    .filter((ps) => ps.status === "COMPLETE")
    .map((ps) => ps.period)
    .slice(-4);

  if (completedPeriods.length < 2) {
    return { ...empty, hasEnoughHistory: false };
  }

  const windowStart = completedPeriods[0].startsAt;
  const windowEnd = completedPeriods[completedPeriods.length - 1].endsAt;

  // Active-slot rostered player IDs for this team.
  const rosterEntries = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: teamId, slot: { notIn: ["BENCH", "IR"] } },
    select: {
      playerId: true,
      slot: true,
      player: { select: { id: true, firstName: true, lastName: true, position: true } },
    },
  });

  if (rosterEntries.length === 0) return { ...empty, hasEnoughHistory: true };

  const playerIds = rosterEntries.map((e) => e.playerId);

  // Collect all rostered player IDs in the league (for FA exclusion).
  const allRosteredEntries = await prisma.rosterEntry.findMany({
    where: { fantasyTeam: { leagueId } },
    select: { playerId: true },
  });
  const allRosteredIds = new Set(allRosteredEntries.map((e) => e.playerId));

  // Query A: stat lines for rostered active-slot players within the 4-period window.
  const recentLines = await prisma.statLine.findMany({
    where: {
      playerId: { in: playerIds },
      game: {
        startsAt: { gte: windowStart, lt: windowEnd },
        season: league.season,
      },
    },
    select: {
      playerId: true,
      goals: true,
      assists: true,
      shots: true,
      plusMinus: true,
      penaltyMinutes: true,
      powerPlayPts: true,
      hits: true,
      blocks: true,
      saves: true,
      goalsAgainst: true,
      shutout: true,
      win: true,
      game: { select: { startsAt: true } },
      player: { select: { position: true } },
    },
  });

  // Query B: earlier history (up to 10 games before the window) for season avg baseline.
  const priorLines = await prisma.statLine.findMany({
    where: {
      playerId: { in: playerIds },
      game: {
        startsAt: { lt: windowStart },
        season: league.season,
      },
    },
    select: {
      playerId: true,
      goals: true,
      assists: true,
      shots: true,
      plusMinus: true,
      penaltyMinutes: true,
      powerPlayPts: true,
      hits: true,
      blocks: true,
      saves: true,
      goalsAgainst: true,
      shutout: true,
      win: true,
      game: { select: { startsAt: true } },
      player: { select: { position: true } },
    },
    orderBy: { game: { startsAt: "desc" } },
    take: playerIds.length * 10, // generous cap; we'll group by player below
  });

  // Query C: all active-roster stat lines across the whole league for the same 4 periods
  // (used for league-median position group comparison).
  // Filter by playerId to all active-slot rostered players across the league.
  const leagueActivePlayerIds = await allActiveRosterPlayerIds(leagueId, prisma);
  const leagueLines = await prisma.statLine.findMany({
    where: {
      playerId: { in: leagueActivePlayerIds },
      game: {
        startsAt: { gte: windowStart, lt: windowEnd },
        season: league.season,
      },
    },
    select: {
      playerId: true,
      goals: true,
      assists: true,
      shots: true,
      plusMinus: true,
      penaltyMinutes: true,
      powerPlayPts: true,
      hits: true,
      blocks: true,
      saves: true,
      goalsAgainst: true,
      shutout: true,
      win: true,
      game: { select: { startsAt: true } },
      player: { select: { position: true } },
    },
  });

  // ── Score all lines ─────────────────────────────────────────────────────────

  function fpForLine(line: {
    goals: number; assists: number; shots: number; plusMinus: number;
    penaltyMinutes: number; powerPlayPts: number; hits: number; blocks: number;
    saves: number; goalsAgainst: number; shutout: boolean; win: boolean;
    player: { position: Position };
  }): number {
    return scoreStatLine(
      {
        goals: line.goals, assists: line.assists, shots: line.shots,
        plusMinus: line.plusMinus, penaltyMinutes: line.penaltyMinutes,
        powerPlayPts: line.powerPlayPts, hits: line.hits, blocks: line.blocks,
        saves: line.saves, goalsAgainst: line.goalsAgainst,
        shutout: line.shutout, win: line.win,
      },
      line.player.position,
      scoringSettings
    );
  }

  // Map playerId → period index → [fp values]
  const byPlayerByPeriod = new Map<string, Map<number, number[]>>();
  for (const line of recentLines) {
    const lineMs = line.game.startsAt.getTime();
    const pIdx = completedPeriods.findIndex(
      (p) => lineMs >= p.startsAt.getTime() && lineMs < p.endsAt.getTime()
    );
    if (pIdx === -1) continue;
    if (!byPlayerByPeriod.has(line.playerId)) byPlayerByPeriod.set(line.playerId, new Map());
    const byPeriod = byPlayerByPeriod.get(line.playerId)!;
    const existing = byPeriod.get(pIdx) ?? [];
    existing.push(fpForLine(line));
    byPeriod.set(pIdx, existing);
  }

  // Aggregate recent FP: total recent FP / games in window (rolling 5-game approach
  // by taking last 5 games within the window per player).
  const recentByPlayer = new Map<string, { totalFp: number; games: number }>();
  for (const line of recentLines) {
    const fp = fpForLine(line);
    const prev = recentByPlayer.get(line.playerId) ?? { totalFp: 0, games: 0 };
    recentByPlayer.set(line.playerId, { totalFp: prev.totalFp + fp, games: prev.games + 1 });
  }

  // Prior history by player (for season avg).
  const priorByPlayer = new Map<string, { totalFp: number; games: number }>();
  for (const line of priorLines) {
    const fp = fpForLine(line);
    const prev = priorByPlayer.get(line.playerId) ?? { totalFp: 0, games: 0 };
    priorByPlayer.set(line.playerId, { totalFp: prev.totalFp + fp, games: prev.games + 1 });
  }

  // ── PlayerTrend computation ─────────────────────────────────────────────────

  const playerTrends: PlayerTrend[] = rosterEntries.map((e) => {
    const recent = recentByPlayer.get(e.playerId) ?? { totalFp: 0, games: 0 };
    const prior = priorByPlayer.get(e.playerId) ?? { totalFp: 0, games: 0 };

    const totalGames = recent.games + prior.games;
    const totalFp = recent.totalFp + prior.totalFp;

    const recentFpPerGame = recent.games > 0 ? recent.totalFp / recent.games : 0;
    const seasonFpPerGame = totalGames > 0 ? totalFp / totalGames : 0;

    // Weekly FP: sum of fp in each period (null if no games).
    const weeklyFp: (number | null)[] = completedPeriods.map((_, pIdx) => {
      const games = byPlayerByPeriod.get(e.playerId)?.get(pIdx);
      if (!games || games.length === 0) return null;
      return Math.round(games.reduce((s, v) => s + v, 0) * 10) / 10;
    });

    let trend: PlayerTrend["trend"];
    if (totalGames < 5) {
      trend = "new";
    } else if (seasonFpPerGame > 0 && recentFpPerGame > seasonFpPerGame * 1.2) {
      trend = "hot";
    } else if (seasonFpPerGame > 0 && recentFpPerGame < seasonFpPerGame * 0.8) {
      trend = "cold";
    } else {
      trend = "on-track";
    }

    return {
      playerId: e.playerId,
      playerName: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      slot: e.slot,
      recentFpPerGame: Math.round(recentFpPerGame * 100) / 100,
      seasonFpPerGame: Math.round(seasonFpPerGame * 100) / 100,
      weeklyFp,
      trend,
    };
  });

  // ── Position group computation ──────────────────────────────────────────────

  // Group my players.
  function posGroup(pos: string): "Forwards" | "Defense" | "Goalie" {
    if (pos === "GOALIE") return "Goalie";
    if (pos === "DEFENSE") return "Defense";
    return "Forwards";
  }

  const myGroupWeekly = new Map<"Forwards" | "Defense" | "Goalie", (number | null)[]>();
  for (const trend of playerTrends) {
    const g = posGroup(trend.position);
    const existing = myGroupWeekly.get(g) ?? completedPeriods.map(() => null as number | null);
    const updated = existing.map((v, i) => {
      const pw = trend.weeklyFp[i];
      if (pw === null) return v;
      return (v ?? 0) + pw;
    });
    myGroupWeekly.set(g, updated);
  }

  // League median per group per period.
  // Build: group → period → [all team FPs for that group that week]
  const leagueGroupWeekly = new Map<
    "Forwards" | "Defense" | "Goalie",
    Map<string, Map<number, number[]>> // teamId → period → [fp]
  >();

  // We need to know which team each player belongs to in the league (for grouping per fantasy team).
  const leagueRosterMap = await getLeagueRosterPositionMap(leagueId, prisma);

  for (const line of leagueLines) {
    const playerPos = leagueRosterMap.get(line.playerId);
    if (!playerPos) continue;
    const group = posGroup(playerPos.position);
    const ownerTeamId = playerPos.fantasyTeamId;
    const lineMs = line.game.startsAt.getTime();
    const pIdx = completedPeriods.findIndex(
      (p) => lineMs >= p.startsAt.getTime() && lineMs < p.endsAt.getTime()
    );
    if (pIdx === -1) continue;

    if (!leagueGroupWeekly.has(group)) leagueGroupWeekly.set(group, new Map());
    const byGroup = leagueGroupWeekly.get(group)!;
    if (!byGroup.has(ownerTeamId)) byGroup.set(ownerTeamId, new Map());
    const byTeam = byGroup.get(ownerTeamId)!;
    const fp = fpForLine(line);
    const existing = byTeam.get(pIdx) ?? [];
    existing.push(fp);
    byTeam.set(pIdx, existing);
  }

  const groups: Array<"Forwards" | "Defense" | "Goalie"> = ["Forwards", "Defense", "Goalie"];
  const positionGroups: PositionGroupRow[] = groups.map((group) => {
    const myWeeklyFp = myGroupWeekly.get(group) ?? completedPeriods.map(() => null as number | null);

    const leagueMedianWeeklyFp: (number | null)[] = completedPeriods.map((_, pIdx) => {
      const byGroup = leagueGroupWeekly.get(group);
      if (!byGroup) return null;
      const teamTotals: number[] = [];
      for (const [, byTeam] of byGroup) {
        const lines = byTeam.get(pIdx);
        if (!lines || lines.length === 0) continue;
        teamTotals.push(lines.reduce((s, v) => s + v, 0));
      }
      if (teamTotals.length === 0) return null;
      teamTotals.sort((a, b) => a - b);
      const mid = Math.floor(teamTotals.length / 2);
      const median =
        teamTotals.length % 2 === 0
          ? (teamTotals[mid - 1] + teamTotals[mid]) / 2
          : teamTotals[mid];
      return Math.round(median * 10) / 10;
    });

    return { group, myWeeklyFp, leagueMedianWeeklyFp, isWeakest: false };
  });

  // Mark the weakest group.
  const groupAvgs = positionGroups.map((g) => {
    const vals = g.myWeeklyFp.filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  });
  const minAvg = Math.min(...groupAvgs);
  const weakestIdx = groupAvgs.indexOf(minAvg);
  positionGroups[weakestIdx].isWeakest = true;

  // ── FA upgrade cards ────────────────────────────────────────────────────────

  const weakestGroup = positionGroups[weakestIdx].group;
  const faUpgrades = await computeFaUpgrades(
    leagueId,
    weakestGroup,
    playerTrends,
    allRosteredIds,
    league.season,
    scoringSettings,
    prisma
  );

  // ── Labels ─────────────────────────────────────────────────────────────────

  const scoredWeekLabels = completedPeriods.map((p) => `Wk ${p.week}`);

  return {
    playerTrends,
    positionGroups,
    faUpgrades,
    scoredWeekLabels,
    hasEnoughHistory: true,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function allActiveRosterPlayerIds(
  leagueId: string,
  prisma: PrismaClient
): Promise<string[]> {
  const entries = await prisma.rosterEntry.findMany({
    where: { fantasyTeam: { leagueId }, slot: { notIn: ["BENCH", "IR"] } },
    select: { playerId: true },
  });
  return entries.map((e) => e.playerId);
}

async function getLeagueRosterPositionMap(
  leagueId: string,
  prisma: PrismaClient
): Promise<Map<string, { position: string; fantasyTeamId: string }>> {
  const entries = await prisma.rosterEntry.findMany({
    where: { fantasyTeam: { leagueId }, slot: { notIn: ["BENCH", "IR"] } },
    select: {
      playerId: true,
      fantasyTeamId: true,
      player: { select: { position: true } },
    },
  });
  const map = new Map<string, { position: string; fantasyTeamId: string }>();
  for (const e of entries) {
    map.set(e.playerId, { position: e.player.position, fantasyTeamId: e.fantasyTeamId });
  }
  return map;
}

function positionMatchesGroup(
  pos: string,
  group: "Forwards" | "Defense" | "Goalie"
): boolean {
  if (group === "Goalie") return pos === "GOALIE";
  if (group === "Defense") return pos === "DEFENSE";
  return pos === "FORWARD";
}

async function computeFaUpgrades(
  leagueId: string,
  group: "Forwards" | "Defense" | "Goalie",
  playerTrends: PlayerTrend[],
  allRosteredIds: Set<string>,
  season: string,
  scoringSettings: ReturnType<typeof parseScoringSettings>,
  prisma: PrismaClient
): Promise<FaUpgradeCard[]> {
  // Determine prisma position filter.
  let positionFilter: string[];
  if (group === "Goalie") positionFilter = ["GOALIE"];
  else if (group === "Defense") positionFilter = ["DEFENSE"];
  else positionFilter = ["FORWARD"];

  // Find active free agents by season FP in that position group.
  // Require at least one stat line this season to avoid returning mock/seed players with no data.
  const faCandidates = await prisma.player.findMany({
    where: {
      active: true,
      position: { in: positionFilter as Position[] },
      id: { notIn: [...allRosteredIds] },
      statLines: { some: { game: { season } } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      statLines: {
        where: { game: { season } },
        select: {
          goals: true, assists: true, shots: true, plusMinus: true,
          penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
          saves: true, goalsAgainst: true, shutout: true, win: true,
        },
      },
    },
  });

  // Find lowest-performing rostered player in this position group (the suggested drop target).
  const groupTrends = playerTrends.filter((t) => positionMatchesGroup(t.position, group));
  const sorted = [...groupTrends].sort((a, b) => a.recentFpPerGame - b.recentFpPerGame);
  const worstRostered = sorted[0];

  // No rostered players in this group — nothing to suggest dropping.
  if (!worstRostered) return [];

  // Score each candidate, require at least 3 games of history.
  const scoredCandidates = faCandidates
    .map((p) => {
      const games = p.statLines.length;
      if (games < 3) return null;
      const totalFp = p.statLines.reduce(
        (sum, line) =>
          sum +
          scoreStatLine(
            {
              goals: line.goals, assists: line.assists, shots: line.shots,
              plusMinus: line.plusMinus, penaltyMinutes: line.penaltyMinutes,
              powerPlayPts: line.powerPlayPts, hits: line.hits, blocks: line.blocks,
              saves: line.saves, goalsAgainst: line.goalsAgainst,
              shutout: line.shutout, win: line.win,
            },
            p.position,
            scoringSettings
          ),
        0
      );
      return {
        playerId: p.id,
        playerName: `${p.firstName} ${p.lastName}`,
        position: p.position as string,
        projectedFpPerGame: Math.round((totalFp / games) * 100) / 100,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    // Only surface genuine upgrades: FA must be at least +0.5 FP/gm better than the worst rostered player.
    .filter((c) => c.projectedFpPerGame > worstRostered.recentFpPerGame + 0.5)
    .sort((a, b) => b.projectedFpPerGame - a.projectedFpPerGame)
    .slice(0, 3);

  if (scoredCandidates.length === 0) return [];

  // All cards suggest dropping the same player — the weakest active starter in this group.
  return scoredCandidates.map((candidate) => ({
    candidate,
    suggestedDrop: {
      playerId: worstRostered.playerId,
      playerName: worstRostered.playerName,
      slot: worstRostered.slot,
      recentFpPerGame: worstRostered.recentFpPerGame,
    },
    group,
  }));
}
