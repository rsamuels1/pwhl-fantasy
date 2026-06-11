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

  // Resolve the active scoring period
  const seasonState = await getSeasonState(leagueId, nowMs, prisma);
  const activePeriod = seasonState.activePeriod;

  // Use real LeagueEvent rows; fall back to draft picks if no events yet
  const realEvents = await getLeagueActivity(leagueId, 10, prisma);
  const leagueActivity: ActivityEvent[] =
    realEvents.length > 0 ? realEvents : await getLeagueActivityFallback(leagueId, prisma);

  if (!activePeriod) {
    // Off-season or pre-season — no live matchup to show
    return {
      activeMatchup: null,
      remainingPlayers: [],
      topPerformers: [],
      disappointments: [],
      leagueActivity,
    };
  }

  // Find my matchup this week
  const matchup = await prisma.matchup.findFirst({
    where: {
      leagueId,
      week: activePeriod.week,
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

  // Score both teams in parallel
  const [myDetailed, opponentDetailed] = await Promise.all([
    computeTeamScoreDetailed(myTeamId, activePeriod, scoringSettings, prisma),
    computeTeamScoreDetailed(opponentTeam.id, activePeriod, scoringSettings, prisma),
  ]);

  // Project totals for both teams in parallel
  const [myProjected, opponentProjected] = await Promise.all([
    projectTeamRemainingScore(
      myTeamId,
      myDetailed.total,
      activePeriod,
      scoringSettings,
      prisma
    ),
    projectTeamRemainingScore(
      opponentTeam.id,
      opponentDetailed.total,
      activePeriod,
      scoringSettings,
      prisma
    ),
  ]);

  const winProb = winProbability(myProjected, opponentProjected);

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
  const remainingPlayers = await getRemainingPlayersTonight(
    myTeamId,
    scoringSettings,
    prisma
  );

  return {
    activeMatchup: {
      week: activePeriod.week,
      period: activePeriod,
      myTeam: { ...myTeam, score: myDetailed.total },
      opponentTeam: { ...opponentTeam, score: opponentDetailed.total },
      myProjected,
      opponentProjected,
      winProbability: winProb,
      myPlayers: myDetailed.players,
      opponentPlayers: opponentDetailed.players,
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
