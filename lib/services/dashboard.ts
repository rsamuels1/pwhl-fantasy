// lib/services/dashboard.ts
// Assembles the complete matchup-centric dashboard view model in a single call.
// Designed to be the sole data source for the matchup page and API endpoint.

import type { PrismaClient } from "@prisma/client";
import { type ScoringSettings, DEFAULT_SCORING, type ScoringBreakdown } from "../scoring";
import { computeTeamScoreDetailed } from "../scoring/matchups";
import { getSeasonState } from "../season";
import {
  projectTeamRemainingScore,
  winProbability,
  getRemainingPlayersTonight,
  type RemainingPlayer,
} from "../projections";
import { getLeagueActivity } from "./activity";
import type { ScoringPeriod } from "../scoring/periods";

// ── types ─────────────────────────────────────────────────────────────────────

export interface PlayerMatchupRow {
  playerId: string;
  name: string;
  position: string;
  slot: string;
  teamAbbr: string | null;
  gamesThisPeriod: number | null;
  points: number;
  gameCount: number;
  statBreakdown: ScoringBreakdown[];
}

export interface PlayerPerfSummary {
  playerId: string;
  name: string;
  position: string;
  points: number;
}

export interface ActivityEvent {
  id: string;
  type: string;
  description: string;
  createdAt: Date;
}

export interface ActiveMatchup {
  week: number;
  period: ScoringPeriod;
  status: "active" | "upcoming"; // "upcoming" = period hasn't started yet; scores are 0
  myTeam: { id: string; name: string; score: number };
  opponentTeam: { id: string; name: string; score: number };
  myProjected: number;
  opponentProjected: number;
  winProbability: number;
  myPlayers: PlayerMatchupRow[];
  opponentPlayers: PlayerMatchupRow[];
}

export interface DashboardData {
  activeMatchup: ActiveMatchup | null;
  remainingPlayers: RemainingPlayer[];
  topPerformers: PlayerPerfSummary[];
  disappointments: PlayerPerfSummary[];
  leagueActivity: ActivityEvent[];
}

// ── main ──────────────────────────────────────────────────────────────────────

export async function getDashboardData(
  leagueId: string,
  myTeamId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<DashboardData> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { scoringSettings: true, season: true },
  });

  const scoringSettings = parseScoringSettings(league.scoringSettings);

  // Resolve the active scoring period, or fall back to the next upcoming one.
  const seasonState = await getSeasonState(leagueId, nowMs, prisma);
  const activePeriod = seasonState.activePeriod;
  const upcomingPeriod = !activePeriod
    ? seasonState.periods.find((p) => p.status === "UPCOMING")?.period ?? null
    : null;
  const displayPeriod = activePeriod ?? upcomingPeriod;
  const isUpcoming = !activePeriod && !!upcomingPeriod;

  // Use real LeagueEvent rows; fall back to draft picks if no events yet
  const realEvents = await getLeagueActivity(leagueId, 10, prisma);
  const leagueActivity: ActivityEvent[] =
    realEvents.length > 0 ? realEvents : await getLeagueActivityFallback(leagueId, prisma);

  if (!displayPeriod) {
    // Off-season or pre-season with no upcoming periods yet
    return {
      activeMatchup: null,
      remainingPlayers: [],
      topPerformers: [],
      disappointments: [],
      leagueActivity,
    };
  }

  // Find my matchup for the display period
  const matchup = await prisma.matchup.findFirst({
    where: {
      leagueId,
      week: displayPeriod.week,
      isPlayoff: false,
      OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }],
    },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });

  if (!matchup) {
    return {
      activeMatchup: null,
      remainingPlayers: [],
      topPerformers: [],
      disappointments: [],
      leagueActivity,
    };
  }

  const isHome = matchup.homeTeamId === myTeamId;
  const myTeam = isHome ? matchup.homeTeam : matchup.awayTeam;
  const opponentTeam = isHome ? matchup.awayTeam : matchup.homeTeam;

  // For upcoming periods scores are 0; skip heavy scoring queries.
  if (isUpcoming) {
    const [myProjected, opponentProjected, upcomingRoster] = await Promise.all([
      projectTeamRemainingScore(myTeamId, 0, displayPeriod, scoringSettings, prisma),
      projectTeamRemainingScore(opponentTeam.id, 0, displayPeriod, scoringSettings, prisma),
      prisma.rosterEntry.findMany({
        where: { fantasyTeamId: myTeamId, slot: { notIn: ["BENCH", "IR"] } },
        include: {
          player: {
            select: {
              id: true, firstName: true, lastName: true, position: true,
              team: { select: { id: true, abbreviation: true } },
            },
          },
        },
      }),
    ]);

    const upcomingTeamIds = [...new Set(
      upcomingRoster.map((e) => e.player.team?.id).filter((id): id is string => !!id)
    )];
    const upcomingGames = upcomingTeamIds.length > 0
      ? await prisma.game.findMany({
          where: {
            startsAt: { gte: displayPeriod.startsAt, lt: displayPeriod.endsAt },
            status: { not: "FINAL" },
            OR: [{ homeTeamId: { in: upcomingTeamIds } }, { awayTeamId: { in: upcomingTeamIds } }],
          },
          select: { homeTeamId: true, awayTeamId: true },
        })
      : [];
    const upcomingGamesPerTeam = new Map<string, number>();
    for (const g of upcomingGames) {
      upcomingGamesPerTeam.set(g.homeTeamId, (upcomingGamesPerTeam.get(g.homeTeamId) ?? 0) + 1);
      upcomingGamesPerTeam.set(g.awayTeamId, (upcomingGamesPerTeam.get(g.awayTeamId) ?? 0) + 1);
    }

    const myUpcomingPlayers: PlayerMatchupRow[] = upcomingRoster.map((e) => ({
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      slot: e.slot,
      teamAbbr: e.player.team?.abbreviation ?? null,
      gamesThisPeriod: e.player.team?.id
        ? (upcomingGamesPerTeam.get(e.player.team.id) ?? 0)
        : null,
      points: 0,
      gameCount: 0,
      statBreakdown: [],
    }));

    return {
      activeMatchup: {
        week: displayPeriod.week,
        period: displayPeriod,
        status: "upcoming",
        myTeam: { ...myTeam, score: 0 },
        opponentTeam: { ...opponentTeam, score: 0 },
        myProjected,
        opponentProjected,
        winProbability: winProbability(myProjected, opponentProjected),
        myPlayers: myUpcomingPlayers,
        opponentPlayers: [],
      },
      remainingPlayers: [],
      topPerformers: [],
      disappointments: [],
      leagueActivity,
    };
  }

  // Score both teams in parallel
  const [myDetailed, opponentDetailed] = await Promise.all([
    computeTeamScoreDetailed(myTeamId, displayPeriod, scoringSettings, prisma),
    computeTeamScoreDetailed(opponentTeam.id, displayPeriod, scoringSettings, prisma),
  ]);

  // Project totals for both teams in parallel
  const [myProjected, opponentProjected] = await Promise.all([
    projectTeamRemainingScore(myTeamId, myDetailed.total, displayPeriod, scoringSettings, prisma),
    projectTeamRemainingScore(opponentTeam.id, opponentDetailed.total, displayPeriod, scoringSettings, prisma),
  ]);

  const winProb = winProbability(myProjected, opponentProjected);

  // Games remaining in this period per PWHL team (for both rosters)
  const allPlayers = [...myDetailed.players, ...opponentDetailed.players];
  const pwhlTeamIds = [...new Set(allPlayers.map((p) => p.teamId).filter((id): id is string => !!id))];
  const now = new Date();
  const remainingGameRows = pwhlTeamIds.length > 0
    ? await prisma.game.findMany({
        where: {
          startsAt: { gt: now, lt: displayPeriod.endsAt },
          status: { not: "FINAL" },
          OR: [{ homeTeamId: { in: pwhlTeamIds } }, { awayTeamId: { in: pwhlTeamIds } }],
        },
        select: { homeTeamId: true, awayTeamId: true },
      })
    : [];
  const gamesPerTeam = new Map<string, number>();
  for (const g of remainingGameRows) {
    gamesPerTeam.set(g.homeTeamId, (gamesPerTeam.get(g.homeTeamId) ?? 0) + 1);
    gamesPerTeam.set(g.awayTeamId, (gamesPerTeam.get(g.awayTeamId) ?? 0) + 1);
  }

  function withGames<T extends { teamId: string | null }>(players: T[]): (T & { gamesThisPeriod: number | null })[] {
    return players.map((p) => ({
      ...p,
      gamesThisPeriod: p.teamId !== null ? (gamesPerTeam.get(p.teamId) ?? 0) : null,
    }));
  }

  // Top performers and disappointments from my roster
  const sorted = [...myDetailed.players].sort((a, b) => b.points - a.points);
  const topPerformers: PlayerPerfSummary[] = sorted.slice(0, 3).map((p) => ({
    playerId: p.playerId,
    name: p.name,
    position: p.position,
    points: p.points,
  }));
  const disappointments: PlayerPerfSummary[] = [...myDetailed.players]
    .filter((p) => p.gameCount > 0)
    .sort((a, b) => a.points - b.points)
    .slice(0, 3)
    .map((p) => ({
      playerId: p.playerId,
      name: p.name,
      position: p.position,
      points: p.points,
    }));

  // Remaining players tonight for my team
  const remainingPlayers = await getRemainingPlayersTonight(myTeamId, scoringSettings, prisma);

  return {
    activeMatchup: {
      week: displayPeriod.week,
      period: displayPeriod,
      status: "active",
      myTeam: { ...myTeam, score: myDetailed.total },
      opponentTeam: { ...opponentTeam, score: opponentDetailed.total },
      myProjected,
      opponentProjected,
      winProbability: winProb,
      myPlayers: withGames(myDetailed.players),
      opponentPlayers: withGames(opponentDetailed.players),
    },
    remainingPlayers,
    topPerformers,
    disappointments,
    leagueActivity,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseScoringSettings(raw: unknown): ScoringSettings {
  if (
    raw &&
    typeof raw === "object" &&
    "skater" in raw &&
    "goalie" in (raw as Record<string, unknown>)
  ) {
    return raw as ScoringSettings;
  }
  return DEFAULT_SCORING;
}

// Fallback until LeagueEvent schema is added — derives activity from existing data.
async function getLeagueActivityFallback(
  leagueId: string,
  prisma: PrismaClient
): Promise<ActivityEvent[]> {
  // Derive activity from draft picks if a draft exists
  const draft = await prisma.draft.findFirst({
    where: { leagueId },
    select: { id: true },
  });
  if (!draft) return [];

  const picks = await prisma.draftPick.findMany({
    where: { draftId: draft.id, playerId: { not: null } },
    orderBy: { overall: "desc" },
    take: 10,
    include: {
      player: { select: { firstName: true, lastName: true } },
      fantasyTeam: { select: { name: true } },
    },
  });

  return picks
    .filter((pick) => pick.player !== null)
    .map((pick) => ({
      id: pick.id,
      type: "DRAFT_PICK",
      description: `${pick.fantasyTeam.name} drafted ${pick.player!.firstName} ${pick.player!.lastName} (Round ${pick.round}, Pick ${pick.overall})`,
      createdAt: pick.pickedAt ?? new Date(0),
    }));
}
