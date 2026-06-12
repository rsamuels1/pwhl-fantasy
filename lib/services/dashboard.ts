// lib/services/dashboard.ts
// Assembles the complete matchup-centric dashboard view model.
// VTF format: regular season shows all-vs-all weekly standings, not a single opponent.

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
import { parseScoringSettings } from "../scoring/settings";

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

export interface RivalryRecord {
  wins: number;
  losses: number;
  ties: number;
}

export interface WeeklyStanding {
  teamId: string;
  name: string;
  score: number;
}

export interface ActiveMatchup {
  week: number;
  period: ScoringPeriod;
  status: "active" | "upcoming";
  isPlayoff: boolean;
  myTeam: { id: string; name: string; score: number };
  myProjected: number;
  myPlayers: PlayerMatchupRow[];
  // VTF (regular season): all teams ranked by current score + my record
  weeklyStandings: WeeklyStanding[];
  myRecord: { wins: number; losses: number; ties: number };
  // Playoff / 1v1 only (null for regular season VTF)
  opponentTeam: { id: string; name: string; score: number } | null;
  opponentPlayers: PlayerMatchupRow[];
  opponentProjected: number;
  winProbability: number;
  rivalry: RivalryRecord;
}

export interface LineupAlert {
  playerId: string;
  name: string;
  reason: "zero_games";
}

export interface WeeklyRecap {
  week: number;
  result: "win" | "loss" | "tie";
  myScore: number;
  opponentScore: number;
  opponentName: string;
  myTopPerformer: { name: string; points: number } | null;
  myRank: number | null;
  teamsCount: number;
  closestMatchup: { margin: number; teams: [string, string] } | null;
  highestScore: { teamName: string; score: number } | null;
}

export interface DashboardData {
  activeMatchup: ActiveMatchup | null;
  remainingPlayers: RemainingPlayer[];
  topPerformers: PlayerPerfSummary[];
  disappointments: PlayerPerfSummary[];
  lineupAlerts: LineupAlert[];
  lastResult: WeeklyRecap | null;
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

  const seasonState = await getSeasonState(leagueId, nowMs, prisma);
  const activePeriod = seasonState.activePeriod;
  const upcomingPeriod = !activePeriod
    ? seasonState.periods.find((p) => p.status === "UPCOMING")?.period ?? null
    : null;
  const displayPeriod = activePeriod ?? upcomingPeriod;
  const isUpcoming = !activePeriod && !!upcomingPeriod;

  const realEvents = await getLeagueActivity(leagueId, 5, prisma);
  const leagueActivity: ActivityEvent[] =
    realEvents.length > 0 ? realEvents : await getLeagueActivityFallback(leagueId, prisma);

  const lastResult = await getLastResult(leagueId, myTeamId, scoringSettings, prisma);

  const empty: DashboardData = {
    activeMatchup: null,
    remainingPlayers: [],
    topPerformers: [],
    disappointments: [],
    lineupAlerts: [],
    lastResult,
    leagueActivity,
  };

  if (!displayPeriod) return empty;

  // Fetch all teams + confirm a matchup exists for this week
  const [allTeams, matchupCheck] = await Promise.all([
    prisma.fantasyTeam.findMany({ where: { leagueId }, select: { id: true, name: true } }),
    prisma.matchup.findFirst({
      where: {
        leagueId,
        week: displayPeriod.week,
        isPlayoff: false,
        OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }],
      },
      select: { id: true },
    }),
  ]);

  if (!matchupCheck) return empty;

  const myTeamName = allTeams.find((t) => t.id === myTeamId)?.name ?? "";

  const activeRosterInclude = {
    player: {
      select: {
        id: true, firstName: true, lastName: true, position: true,
        team: { select: { id: true, abbreviation: true } },
      },
    },
  } as const;

  if (isUpcoming) {
    const [myRoster, myProjected] = await Promise.all([
      prisma.rosterEntry.findMany({
        where: { fantasyTeamId: myTeamId, slot: { notIn: ["BENCH", "IR"] } },
        include: activeRosterInclude,
      }),
      projectTeamRemainingScore(myTeamId, 0, displayPeriod, scoringSettings, prisma, nowMs),
    ]);

    const myTeamIds = [...new Set(
      myRoster.map((e) => e.player.team?.id).filter((id): id is string => !!id)
    )];
    const gamesPerTeam = await gamesPerTeamInWindow(
      myTeamIds, displayPeriod.startsAt, displayPeriod.endsAt, prisma
    );

    const toRow = (e: (typeof myRoster)[number]): PlayerMatchupRow => ({
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      slot: e.slot,
      teamAbbr: e.player.team?.abbreviation ?? null,
      gamesThisPeriod: e.player.team?.id ? (gamesPerTeam.get(e.player.team.id) ?? 0) : null,
      points: 0,
      gameCount: 0,
      statBreakdown: [],
    });

    const zeroStandings: WeeklyStanding[] = allTeams.map((t) => ({
      teamId: t.id, name: t.name, score: 0,
    }));

    return {
      ...empty,
      activeMatchup: {
        week: displayPeriod.week,
        period: displayPeriod,
        status: "upcoming",
        isPlayoff: false,
        myTeam: { id: myTeamId, name: myTeamName, score: 0 },
        myProjected,
        myPlayers: myRoster.map(toRow),
        weeklyStandings: zeroStandings,
        myRecord: { wins: 0, losses: 0, ties: 0 },
        opponentTeam: null,
        opponentPlayers: [],
        opponentProjected: 0,
        winProbability: 0,
        rivalry: { wins: 0, losses: 0, ties: 0 },
      },
    };
  }

  // Active period: my detailed breakdown + all team scores in parallel
  const [myDetailed, allScores] = await Promise.all([
    computeTeamScoreDetailed(myTeamId, displayPeriod, scoringSettings, prisma, nowMs),
    computeAllTeamScores(leagueId, displayPeriod, scoringSettings, prisma),
  ]);

  const myScore = allScores.get(myTeamId) ?? 0;

  const weeklyStandings: WeeklyStanding[] = allTeams
    .map((t) => ({ teamId: t.id, name: t.name, score: allScores.get(t.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  let wins = 0, losses = 0, ties = 0;
  for (const [tid, score] of allScores) {
    if (tid === myTeamId) continue;
    if (myScore > score) wins++;
    else if (myScore < score) losses++;
    else ties++;
  }

  const myProjected = await projectTeamRemainingScore(
    myTeamId, myScore, displayPeriod, scoringSettings, prisma, nowMs
  );

  const allTeamIds = [...new Set(
    myDetailed.players.map((p) => p.teamId).filter((id): id is string => !!id)
  )];
  const gamesPerTeam = await gamesPerTeamInWindow(
    allTeamIds, new Date(nowMs), displayPeriod.endsAt, prisma, { exclusiveStart: true }
  );

  function withGames(players: typeof myDetailed.players): PlayerMatchupRow[] {
    return players.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      position: p.position,
      slot: p.slot,
      teamAbbr: p.teamAbbr,
      gamesThisPeriod: p.teamId !== null ? (gamesPerTeam.get(p.teamId) ?? 0) : null,
      points: p.points,
      gameCount: p.gameCount,
      statBreakdown: p.statBreakdown,
    }));
  }

  const sorted = [...myDetailed.players].sort((a, b) => b.points - a.points);
  const topPerformers: PlayerPerfSummary[] = sorted.slice(0, 3).map((p) => ({
    playerId: p.playerId, name: p.name, position: p.position, points: p.points,
  }));
  const disappointments: PlayerPerfSummary[] = [...myDetailed.players]
    .filter((p) => p.gameCount > 0)
    .sort((a, b) => a.points - b.points)
    .slice(0, 3)
    .map((p) => ({ playerId: p.playerId, name: p.name, position: p.position, points: p.points }));

  const remainingPlayers = await getRemainingPlayersTonight(myTeamId, scoringSettings, prisma, nowMs);

  const myPlayers = withGames(myDetailed.players);
  const lineupAlerts: LineupAlert[] = myPlayers
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
      isPlayoff: false,
      myTeam: { id: myTeamId, name: myTeamName, score: myScore },
      myProjected,
      myPlayers,
      weeklyStandings,
      myRecord: { wins, losses, ties },
      opponentTeam: null,
      opponentPlayers: [],
      opponentProjected: 0,
      winProbability: 0,
      rivalry: { wins: 0, losses: 0, ties: 0 },
    },
    remainingPlayers,
    topPerformers,
    disappointments,
    lineupAlerts,
    lastResult,
    leagueActivity,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function gamesPerTeamInWindow(
  teamIds: string[],
  start: Date,
  end: Date,
  prisma: PrismaClient,
  opts?: { exclusiveStart?: boolean }
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (teamIds.length === 0) return map;
  const games = await prisma.game.findMany({
    where: {
      startsAt: opts?.exclusiveStart ? { gt: start, lt: end } : { gte: start, lt: end },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    select: { homeTeamId: true, awayTeamId: true },
  });
  for (const g of games) {
    if (teamIds.includes(g.homeTeamId)) map.set(g.homeTeamId, (map.get(g.homeTeamId) ?? 0) + 1);
    if (teamIds.includes(g.awayTeamId)) map.set(g.awayTeamId, (map.get(g.awayTeamId) ?? 0) + 1);
  }
  return map;
}

async function getLastResult(
  leagueId: string,
  myTeamId: string,
  scoringSettings: ScoringSettings,
  prisma: PrismaClient
): Promise<WeeklyRecap | null> {
  const last = await prisma.matchup.findFirst({
    where: {
      leagueId,
      isPlayoff: false,
      homeScore: { not: null },
      awayScore: { not: null },
      OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }],
    },
    orderBy: { week: "desc" },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });
  if (!last) return null;

  const iAmHome = last.homeTeamId === myTeamId;
  const myScore = (iAmHome ? last.homeScore : last.awayScore) ?? 0;
  const opponentScore = (iAmHome ? last.awayScore : last.homeScore) ?? 0;
  const opponentName = iAmHome ? last.awayTeam.name : last.homeTeam.name;
  const result: WeeklyRecap["result"] =
    myScore > opponentScore ? "win" : myScore < opponentScore ? "loss" : "tie";

  const period: ScoringPeriod = { week: last.week, startsAt: last.startsAt, endsAt: last.endsAt };
  const [detailed, weekMatchups] = await Promise.all([
    computeTeamScoreDetailed(myTeamId, period, scoringSettings, prisma),
    prisma.matchup.findMany({
      where: { leagueId, week: last.week, isPlayoff: false, homeScore: { not: null }, awayScore: { not: null } },
      include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    }),
  ]);

  const top = [...detailed.players].sort((a, b) => b.points - a.points)[0];
  const myTopPerformer =
    top && top.points > 0 ? { name: top.name, points: top.points } : null;

  // League-wide stats for this week
  const teamScores = new Map<string, number>();
  const teamNames = new Map<string, string>();
  for (const m of weekMatchups) {
    if (!teamScores.has(m.homeTeamId)) { teamScores.set(m.homeTeamId, m.homeScore!); teamNames.set(m.homeTeamId, m.homeTeam.name); }
    if (!teamScores.has(m.awayTeamId)) { teamScores.set(m.awayTeamId, m.awayScore!); teamNames.set(m.awayTeamId, m.awayTeam.name); }
  }

  // Closest head-to-head matchup (unique pairs only)
  let closestMatchup: WeeklyRecap["closestMatchup"] = null;
  const seenPairs = new Set<string>();
  for (const m of weekMatchups) {
    const pairKey = [m.homeTeamId, m.awayTeamId].sort().join(":");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const margin = Math.abs(m.homeScore! - m.awayScore!);
    if (closestMatchup === null || margin < closestMatchup.margin) {
      closestMatchup = { margin: Math.round(margin * 10) / 10, teams: [m.homeTeam.name, m.awayTeam.name] };
    }
  }

  // Highest score this week
  let highestScore: WeeklyRecap["highestScore"] = null;
  for (const [teamId, score] of teamScores) {
    if (highestScore === null || score > highestScore.score) {
      highestScore = { teamName: teamNames.get(teamId) ?? teamId, score };
    }
  }

  // My rank this week (how many teams scored more than me + 1)
  const allScores = [...teamScores.values()];
  const myRank = allScores.filter((s) => s > myScore).length + 1;

  return {
    week: last.week, result, myScore, opponentScore, opponentName, myTopPerformer,
    myRank, teamsCount: teamScores.size, closestMatchup, highestScore,
  };
}

async function getLeagueActivityFallback(
  leagueId: string,
  prisma: PrismaClient
): Promise<ActivityEvent[]> {
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
