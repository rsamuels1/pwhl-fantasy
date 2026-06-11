// lib/services/dashboard.ts
// Assembles the complete matchup-centric dashboard view model in a single call.
// Designed to be the sole data source for the matchup page and API endpoint.

import type { PrismaClient } from "@prisma/client";
import { type ScoringSettings, DEFAULT_SCORING, type ScoringBreakdown } from "../scoring";
import { computeTeamScoreDetailed, computeAllTeamScores } from "../scoring/matchups";
import { getSeasonState } from "../season";
import {
  projectTeamRemainingScore,
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

export interface WeeklyStanding {
  teamId: string;
  name: string;
  score: number;
}

export interface ActiveMatchup {
  week: number;
  period: ScoringPeriod;
  status: "active" | "upcoming"; // "upcoming" = period hasn't started yet; scores are 0
  myTeam: { id: string; name: string; score: number };
  // VTF: all teams ranked by score for this week
  weeklyStandings: WeeklyStanding[];
  myRecord: { wins: number; losses: number; ties: number };
  myProjected: number;
  myPlayers: PlayerMatchupRow[];
}

export interface LineupAlert {
  playerId: string;
  name: string;
  reason: "zero_games";
}

export interface DashboardData {
  activeMatchup: ActiveMatchup | null;
  remainingPlayers: RemainingPlayer[];
  topPerformers: PlayerPerfSummary[];
  disappointments: PlayerPerfSummary[];
  lineupAlerts: LineupAlert[];
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
  const realEvents = await getLeagueActivity(leagueId, 5, prisma);
  const leagueActivity: ActivityEvent[] =
    realEvents.length > 0 ? realEvents : await getLeagueActivityFallback(leagueId, prisma);

  if (!displayPeriod) {
    // Off-season or pre-season with no upcoming periods yet
    return {
      activeMatchup: null,
      remainingPlayers: [],
      topPerformers: [],
      disappointments: [],
      lineupAlerts: [],
      leagueActivity,
    };
  }

  // Confirm this team has a matchup this week
  const hasMatchup = await prisma.matchup.findFirst({
    where: {
      leagueId,
      week: displayPeriod.week,
      isPlayoff: false,
      OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }],
    },
    select: { id: true, startsAt: true },
  });

  if (!hasMatchup) {
    return {
      activeMatchup: null,
      remainingPlayers: [],
      topPerformers: [],
      disappointments: [],
      lineupAlerts: [],
      leagueActivity,
    };
  }

  // Get all teams in the league (for VTF standings)
  const allTeams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true },
  });
  const myTeamName = allTeams.find((t) => t.id === myTeamId)?.name ?? "";

  const activeRosterInclude = {
    player: {
      select: {
        id: true, firstName: true, lastName: true, position: true,
        team: { select: { id: true, abbreviation: true } },
      },
    },
  } as const;

  // For upcoming periods scores are 0; just build roster for lineup editor.
  if (isUpcoming) {
    const [myProjected, myRoster] = await Promise.all([
      projectTeamRemainingScore(myTeamId, 0, displayPeriod, scoringSettings, prisma, nowMs),
      prisma.rosterEntry.findMany({
        where: { fantasyTeamId: myTeamId, slot: { notIn: ["BENCH", "IR"] } },
        include: activeRosterInclude,
      }),
    ]);

    const upcomingPwhlIds = [...new Set(
      myRoster.map((e) => e.player.team?.id).filter((id): id is string => !!id)
    )];
    const upcomingGames = upcomingPwhlIds.length > 0
      ? await prisma.game.findMany({
          where: {
            startsAt: { gte: displayPeriod.startsAt, lt: displayPeriod.endsAt },
            OR: [{ homeTeamId: { in: upcomingPwhlIds } }, { awayTeamId: { in: upcomingPwhlIds } }],
          },
          select: { homeTeamId: true, awayTeamId: true },
        })
      : [];
    const upcomingGamesPerTeam = new Map<string, number>();
    for (const g of upcomingGames) {
      upcomingGamesPerTeam.set(g.homeTeamId, (upcomingGamesPerTeam.get(g.homeTeamId) ?? 0) + 1);
      upcomingGamesPerTeam.set(g.awayTeamId, (upcomingGamesPerTeam.get(g.awayTeamId) ?? 0) + 1);
    }

    const myPlayers: PlayerMatchupRow[] = myRoster.map((e) => ({
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      slot: e.slot,
      teamAbbr: e.player.team?.abbreviation ?? null,
      gamesThisPeriod: e.player.team?.id ? (upcomingGamesPerTeam.get(e.player.team.id) ?? 0) : null,
      points: 0,
      gameCount: 0,
      statBreakdown: [],
    }));

    const weeklyStandings: WeeklyStanding[] = allTeams.map((t) => ({
      teamId: t.id, name: t.name, score: 0,
    }));

    return {
      activeMatchup: {
        week: displayPeriod.week,
        period: displayPeriod,
        status: "upcoming",
        myTeam: { id: myTeamId, name: myTeamName, score: 0 },
        weeklyStandings,
        myRecord: { wins: 0, losses: 0, ties: 0 },
        myProjected,
        myPlayers,
      },
      remainingPlayers: [],
      topPerformers: [],
      disappointments: [],
      lineupAlerts: [],
      leagueActivity,
    };
  }

  // Active period: score all teams + my detailed breakdown in parallel
  const [myDetailed, allScores] = await Promise.all([
    computeTeamScoreDetailed(myTeamId, displayPeriod, scoringSettings, prisma, nowMs),
    computeAllTeamScores(leagueId, displayPeriod, scoringSettings, prisma),
  ]);

  // Build VTF standings
  const weeklyStandings: WeeklyStanding[] = allTeams
    .map((t) => ({ teamId: t.id, name: t.name, score: allScores.get(t.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  // My W-L-T record against the field
  const myScore = allScores.get(myTeamId) ?? 0;
  let wins = 0, losses = 0, ties = 0;
  for (const [tid, score] of allScores) {
    if (tid === myTeamId) continue;
    if (myScore > score) wins++;
    else if (myScore < score) losses++;
    else ties++;
  }

  const myProjected = await projectTeamRemainingScore(
    myTeamId, myDetailed.total, displayPeriod, scoringSettings, prisma, nowMs
  );

  // Games remaining in this period per PWHL team (my roster only)
  const pwhlTeamIds = [...new Set(myDetailed.players.map((p) => p.teamId).filter((id): id is string => !!id))];
  const nowDate = new Date(nowMs);
  const remainingGameRows = pwhlTeamIds.length > 0
    ? await prisma.game.findMany({
        where: {
          startsAt: { gt: nowDate, lt: displayPeriod.endsAt },
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

  const remainingPlayers = await getRemainingPlayersTonight(myTeamId, scoringSettings, prisma, nowMs);

  const lineupAlerts: LineupAlert[] = withGames(myDetailed.players)
    .filter((p) =>
      p.gamesThisPeriod === 0 &&
      p.gameCount === 0 &&
      p.slot !== "BENCH" &&
      p.slot !== "IR"
    )
    .map((p) => ({ playerId: p.playerId, name: p.name, reason: "zero_games" as const }));

  return {
    activeMatchup: {
      week: displayPeriod.week,
      period: displayPeriod,
      status: "active",
      myTeam: { id: myTeamId, name: myTeamName, score: myDetailed.total },
      weeklyStandings,
      myRecord: { wins, losses, ties },
      myProjected,
      myPlayers: withGames(myDetailed.players),
    },
    remainingPlayers,
    topPerformers,
    disappointments,
    lineupAlerts,
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
