// lib/services/dashboard.ts
// Assembles the complete matchup-centric dashboard view model.
// VTF format: regular season shows all-vs-all weekly standings, not a single opponent.

import type { PrismaClient } from "@prisma/client";
import { type ScoringSettings, DEFAULT_SCORING, type ScoringBreakdown, scoreStatLineDetailed } from "../scoring";
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
import { getReplayNow } from "../replayTime";
import { getRoundLabel } from "../playoffs/brackets";
import { calculatePlayoffRounds } from "../playoffs/lifecycle";

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
  statBreakdown: ScoringBreakdown[];
}

export interface LeaguePerformerRow {
  playerId: string;
  name: string;
  position: string;
  fantasyTeamId: string;
  fantasyTeamName: string;
  points: number;
  gamesPlayed: number;
  isMyPlayer: boolean;
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
  round?: number;
  roundLabel?: string;
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
  isPlayoff?: boolean;
  round?: number;
  roundLabel?: string;
}

export interface ChampionInfo {
  teamId: string;
  teamName: string;
  opponentTeamId: string;
  opponentTeamName: string;
  myScore: number;
  opponentScore: number;
}

export interface DashboardData {
  activeMatchup: ActiveMatchup | null;
  remainingPlayers: RemainingPlayer[];
  topPerformers: PlayerPerfSummary[];
  disappointments: PlayerPerfSummary[];
  lineupAlerts: LineupAlert[];
  lastResult: WeeklyRecap | null;
  leagueActivity: ActivityEvent[];
  leagueTopPerformers: LeaguePerformerRow[];
  leagueDisappointments: LeaguePerformerRow[];
  eliminationInfo?: { round: number; roundLabel: string } | null;
  championInfo?: ChampionInfo | null;
  playoffPending?: boolean;
  // Populated when the active period has no stats yet (SETUP phase) — shows last complete week's stats
  myPlayersLastWeek: PlayerMatchupRow[] | null;
  lastWeekLabel: string | null;
}

// ── main ──────────────────────────────────────────────────────────────────────

export async function getDashboardData(
  leagueId: string,
  myTeamId: string,
  nowMsArg: number,
  prisma: PrismaClient
): Promise<DashboardData> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
  });

  const nowMs = getReplayNow(league, nowMsArg);
  const scoringSettings = parseScoringSettings(league.scoringSettings);
  const scoringMode = league.scoringMode ?? "VTF";
  const isVpMode = scoringMode === "VP";

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

  const lastResult = await getLastResult(leagueId, myTeamId, scoringSettings, prisma, isVpMode);

  const empty: DashboardData = {
    activeMatchup: null,
    remainingPlayers: [],
    topPerformers: [],
    disappointments: [],
    lineupAlerts: [],
    lastResult,
    leagueActivity,
    leagueTopPerformers: [],
    leagueDisappointments: [],
    myPlayersLastWeek: null,
    lastWeekLabel: null,
  };

  if (!displayPeriod) {
    // Check if we're in playoffs
    if (league.playoffStatus === "IN_PROGRESS" || league.playoffStatus === "COMPLETE") {
      return await getPlayoffDashboardData(
        leagueId,
        myTeamId,
        nowMs,
        league,
        lastResult,
        leagueActivity,
        scoringSettings,
        prisma
      );
    }
    return empty;
  }

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

  // In VP mode, find the designated 1v1 opponent for this week
  let opponentTeamId: string | null = null;
  if (isVpMode) {
    const myMatchup = await prisma.matchup.findFirst({
      where: { leagueId, week: displayPeriod.week, isPlayoff: false, OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }] },
      select: { homeTeamId: true, awayTeamId: true },
    });
    if (myMatchup) {
      opponentTeamId = myMatchup.homeTeamId === myTeamId ? myMatchup.awayTeamId : myMatchup.homeTeamId;
    }
  }

  // Active period: my detailed breakdown + all team scores in parallel.
  // Pass nowMs to both so mid-period scores only count games up to the current time.
  const [myDetailed, allScores] = await Promise.all([
    computeTeamScoreDetailed(myTeamId, displayPeriod, scoringSettings, prisma, nowMs),
    computeAllTeamScores(leagueId, displayPeriod, scoringSettings, prisma, nowMs),
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

  // Load opponent roster for VP mode
  const opponentTeamName = opponentTeamId ? (allTeams.find((t) => t.id === opponentTeamId)?.name ?? "") : null;
  const opponentScore = opponentTeamId ? (allScores.get(opponentTeamId) ?? 0) : 0;

  const activeRosterInclude2 = {
    player: {
      select: {
        id: true, firstName: true, lastName: true, position: true,
        team: { select: { id: true, abbreviation: true } },
      },
    },
  } as const;

  const [opponentRosterRaw, opponentProjected] = opponentTeamId
    ? await Promise.all([
        prisma.rosterEntry.findMany({
          where: { fantasyTeamId: opponentTeamId, slot: { notIn: ["BENCH", "IR"] } },
          include: activeRosterInclude2,
        }),
        projectTeamRemainingScore(opponentTeamId, opponentScore, displayPeriod, scoringSettings, prisma, nowMs),
      ])
    : [[], 0] as const;

  const allTeamIds = [...new Set([
    ...myDetailed.players.map((p) => p.teamId),
    ...(opponentRosterRaw as Array<{ player: { team: { id: string } | null } }>).map((e) => e.player.team?.id ?? null),
  ].filter((id): id is string => !!id))];

  const [gamesPerTeam, gamesPlayedPerTeam] = await Promise.all([
    gamesPerTeamInWindow(allTeamIds, new Date(nowMs), displayPeriod.endsAt, prisma, { exclusiveStart: true }),
    gamesPerTeamInWindow(allTeamIds, displayPeriod.startsAt, new Date(nowMs), prisma),
  ]);

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
  const topPerformers: PlayerPerfSummary[] = sorted.filter((p) => p.points > 0).slice(0, 3).map((p) => ({
    playerId: p.playerId, name: p.name, position: p.position, points: p.points, statBreakdown: p.statBreakdown,
  }));
  const disappointments: PlayerPerfSummary[] = [...myDetailed.players]
    .filter((p) => p.gameCount > 0)
    .sort((a, b) => a.points - b.points)
    .slice(0, 3)
    .map((p) => ({ playerId: p.playerId, name: p.name, position: p.position, points: p.points, statBreakdown: p.statBreakdown }));

  const [remainingPlayers, { top: leagueTopPerformers, disappointing: leagueDisappointments }] = await Promise.all([
    getRemainingPlayersTonight(myTeamId, scoringSettings, prisma, nowMs),
    getLeaguePerformers(leagueId, myTeamId, displayPeriod, scoringSettings, prisma, nowMs),
  ]);

  const myPlayers = withGames(myDetailed.players);

  // When no games have been played yet in the active period (SETUP phase: replayCurrentDate = period.startsAt),
  // the stat query returns an empty range [startsAt, startsAt). Fall back to the last complete period's stats
  // so the matchup page shows meaningful data instead of all 0s.
  let myPlayersLastWeek: PlayerMatchupRow[] | null = null;
  let lastWeekLabel: string | null = null;
  if (myDetailed.players.length > 0 && myDetailed.players.every((p) => p.gameCount === 0)) {
    const lastComplete = [...seasonState.periods].reverse().find((ps) => ps.status === "COMPLETE");
    if (lastComplete) {
      const lastWeekDetailed = await computeTeamScoreDetailed(
        myTeamId, lastComplete.period, scoringSettings, prisma
      );
      if (lastWeekDetailed.players.some((p) => p.points > 0)) {
        myPlayersLastWeek = lastWeekDetailed.players.map((p) => ({
          playerId: p.playerId,
          name: p.name,
          position: p.position,
          slot: p.slot,
          teamAbbr: p.teamAbbr,
          gamesThisPeriod: null,
          points: p.points,
          gameCount: p.gameCount,
          statBreakdown: p.statBreakdown,
        }));
        lastWeekLabel = `Week ${lastComplete.period.week}`;
      }
    }
  }

  const lineupAlerts: LineupAlert[] = myDetailed.players
    .filter((p) => {
      if (p.slot === "BENCH" || p.slot === "IR") return false;
      const futureGames = p.teamId ? (gamesPerTeam.get(p.teamId) ?? 0) : 0;
      const playedGames = p.teamId ? (gamesPlayedPerTeam.get(p.teamId) ?? 0) : 0;
      return futureGames === 0 && p.gameCount === 0 && playedGames === 0;
    })
    .map((p) => ({ playerId: p.playerId, name: p.name, reason: "zero_games" as const }));

  // VP mode: resolve opponent roster rows
  const opponentPlayers: PlayerMatchupRow[] = opponentTeamId
    ? (opponentRosterRaw as Array<{ playerId: string; slot: string; player: { id: string; firstName: string; lastName: string; position: string; team: { id: string; abbreviation: string } | null } }>).map((e) => ({
        playerId: e.playerId,
        name: `${e.player.firstName} ${e.player.lastName}`,
        position: e.player.position,
        slot: e.slot,
        teamAbbr: e.player.team?.abbreviation ?? null,
        gamesThisPeriod: e.player.team?.id ? (gamesPerTeam.get(e.player.team.id) ?? 0) : null,
        points: 0,
        gameCount: 0,
        statBreakdown: [],
      }))
    : [];

  // Win probability for VP 1v1 mode
  const { winProbability } = await import("../projections");
  const myProj = myProjected;
  const oppProj = opponentProjected as number;
  const winProb = isVpMode && opponentTeamId ? winProbability(myProj, oppProj) : 0;

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
      opponentTeam: isVpMode && opponentTeamId && opponentTeamName
        ? { id: opponentTeamId, name: opponentTeamName, score: opponentScore }
        : null,
      opponentPlayers,
      opponentProjected: oppProj,
      winProbability: winProb,
      rivalry: { wins: 0, losses: 0, ties: 0 },
    },
    remainingPlayers,
    topPerformers,
    disappointments,
    lineupAlerts,
    lastResult,
    leagueActivity,
    leagueTopPerformers,
    leagueDisappointments,
    myPlayersLastWeek,
    lastWeekLabel,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function getPlayoffDashboardData(
  leagueId: string,
  myTeamId: string,
  nowMs: number,
  league: any,
  lastResult: WeeklyRecap | null,
  leagueActivity: ActivityEvent[],
  scoringSettings: ScoringSettings,
  prisma: PrismaClient
): Promise<DashboardData> {
  const empty: DashboardData = {
    activeMatchup: null,
    remainingPlayers: [],
    topPerformers: [],
    disappointments: [],
    lineupAlerts: [],
    lastResult,
    leagueActivity,
    leagueTopPerformers: [],
    leagueDisappointments: [],
    myPlayersLastWeek: null,
    lastWeekLabel: null,
  };

  // P1-A: When playoffs are complete, determine the champion from the final-round matchup.
  if (league.playoffStatus === "COMPLETE") {
    const finalMatchup = await prisma.matchup.findFirst({
      where: {
        leagueId,
        isPlayoff: true,
        homeScore: { not: null },
        awayScore: { not: null },
      },
      orderBy: { round: "desc" },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });

    let championInfo: ChampionInfo | null = null;
    if (finalMatchup && finalMatchup.homeScore !== null && finalMatchup.awayScore !== null) {
      const homeWon = finalMatchup.homeScore >= finalMatchup.awayScore;
      const championTeam = homeWon ? finalMatchup.homeTeam : finalMatchup.awayTeam;
      const runnerUpTeam = homeWon ? finalMatchup.awayTeam : finalMatchup.homeTeam;
      const champScore = homeWon ? finalMatchup.homeScore : finalMatchup.awayScore;
      const runnerUpScore = homeWon ? finalMatchup.awayScore : finalMatchup.homeScore;
      if (championTeam && runnerUpTeam) {
        championInfo = {
          teamId: championTeam.id,
          teamName: championTeam.name,
          opponentTeamId: runnerUpTeam.id,
          opponentTeamName: runnerUpTeam.name,
          myScore: champScore,
          opponentScore: runnerUpScore,
        };
      }
    }
    return { ...empty, championInfo };
  }

  // Find my current playoff matchup (highest round first — eliminates earlier)
  const myMatchup = await prisma.matchup.findFirst({
    where: {
      leagueId,
      isPlayoff: true,
      OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }],
    },
    orderBy: { round: "desc" },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });

  if (!myMatchup) {
    // Team didn't qualify or was eliminated — find their highest-round matchup for context
    const lastPlayoffMatchup = await prisma.matchup.findFirst({
      where: {
        leagueId,
        isPlayoff: true,
        homeScore: { not: null },
        awayScore: { not: null },
        OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }],
      },
      orderBy: { round: "desc" },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });

    if (lastPlayoffMatchup?.round !== null && lastPlayoffMatchup?.round !== undefined) {
      const totalRounds = calculatePlayoffRounds(league.playoffSettings?.teamsInPlayoff || 4);
      const roundLabel = getRoundLabel(lastPlayoffMatchup.round, totalRounds);
      return { ...empty, eliminationInfo: { round: lastPlayoffMatchup.round, roundLabel } };
    }
    return empty;
  }

  // P0-B: Check if myMatchup is already fully scored and the current team lost.
  // In that case, the team is eliminated — we should return eliminationInfo instead
  // of treating the finished matchup as the active one.
  // P1-D: If myMatchup is scored and the team WON, but the period has ended and no
  // next-round matchup exists yet, return playoffPending so the UI can show a helpful message.
  if (myMatchup.homeScore !== null && myMatchup.awayScore !== null) {
    const iAmHome = myMatchup.homeTeamId === myTeamId;
    const myMatchupScore = iAmHome ? myMatchup.homeScore : myMatchup.awayScore;
    const opponentMatchupScore = iAmHome ? myMatchup.awayScore : myMatchup.homeScore;
    const iLost = myMatchupScore < opponentMatchupScore;

    if (iLost && myMatchup.round !== null && myMatchup.round !== undefined) {
      // Team was eliminated — return eliminationInfo.
      const totalRounds = calculatePlayoffRounds(league.playoffSettings?.teamsInPlayoff || 4);
      const roundLabel = getRoundLabel(myMatchup.round, totalRounds);
      return {
        ...empty,
        eliminationInfo: {
          round: myMatchup.round,
          roundLabel,
        },
      };
    }

    // Team won this round. Check if we're between rounds (period ended, no next-round matchup yet).
    if (!iLost && nowMs > myMatchup.endsAt.getTime()) {
      // Check if a next-round matchup exists for this team
      const nextRoundMatchup = await prisma.matchup.findFirst({
        where: {
          leagueId,
          isPlayoff: true,
          round: (myMatchup.round ?? 1) + 1,
          OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }],
        },
        select: { id: true },
      });
      if (!nextRoundMatchup) {
        // Between rounds — commissioner hasn't advanced yet.
        return { ...empty, playoffPending: true };
      }
    }
  }

  const iAmHome = myMatchup.homeTeamId === myTeamId;
  const opponentTeamId = iAmHome ? myMatchup.awayTeamId : myMatchup.homeTeamId;
  const period: ScoringPeriod = {
    week: myMatchup.week,
    startsAt: myMatchup.startsAt,
    endsAt: myMatchup.endsAt,
  };

  const status = nowMs < myMatchup.startsAt.getTime() ? "upcoming" : "active";

  // Compute round and round label for playoff matchup
  const totalRounds = calculatePlayoffRounds(league.playoffSettings?.teamsInPlayoff || 4);
  const roundLabel = myMatchup.round ? getRoundLabel(myMatchup.round, totalRounds) : undefined;

  // Fetch all teams for team name map
  const allTeams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true },
  });

  const activeRosterInclude = {
    player: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        team: { select: { id: true, abbreviation: true } },
      },
    },
  } as const;

  // Compute scores for both teams
  const [myDetailed, opponentDetailed, allScores] = await Promise.all([
    computeTeamScoreDetailed(myTeamId, period, scoringSettings, prisma, nowMs),
    computeTeamScoreDetailed(opponentTeamId, period, scoringSettings, prisma, nowMs),
    computeAllTeamScores(leagueId, period, scoringSettings, prisma, nowMs),
  ]);

  const myScore = allScores.get(myTeamId) ?? 0;
  const opponentScore = allScores.get(opponentTeamId) ?? 0;
  const opponentTeamName = allTeams.find((t) => t.id === opponentTeamId)?.name ?? "";

  // Remaining games batch query
  const allTeamIds = [
    ...new Set([
      ...myDetailed.players.map((p) => p.teamId),
      ...opponentDetailed.players.map((p) => p.teamId),
    ].filter((id): id is string => !!id)),
  ];

  const [gamesPerTeam, gamesPlayedPerTeam] = await Promise.all([
    gamesPerTeamInWindow(allTeamIds, new Date(nowMs), period.endsAt, prisma, { exclusiveStart: true }),
    gamesPerTeamInWindow(allTeamIds, period.startsAt, new Date(nowMs), prisma),
  ]);

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

  const myPlayers = withGames(myDetailed.players);
  const opponentPlayers = withGames(opponentDetailed.players);

  // Lineup alerts for zero-game players
  const lineupAlerts: LineupAlert[] = myDetailed.players
    .filter((p) => {
      if (p.slot === "BENCH" || p.slot === "IR") return false;
      const futureGames = p.teamId ? (gamesPerTeam.get(p.teamId) ?? 0) : 0;
      const playedGames = p.teamId ? (gamesPlayedPerTeam.get(p.teamId) ?? 0) : 0;
      return futureGames === 0 && p.gameCount === 0 && playedGames === 0;
    })
    .map((p) => ({ playerId: p.playerId, name: p.name, reason: "zero_games" as const }));

  // Top performers
  const sorted = [...myDetailed.players].sort((a, b) => b.points - a.points);
  const topPerformers: PlayerPerfSummary[] = sorted.slice(0, 3).map((p) => ({
    playerId: p.playerId,
    name: p.name,
    position: p.position,
    points: p.points,
    statBreakdown: p.statBreakdown,
  }));

  // Disappointments
  const disappointments: PlayerPerfSummary[] = [...myDetailed.players]
    .filter((p) => p.gameCount > 0)
    .sort((a, b) => a.points - b.points)
    .slice(0, 3)
    .map((p) => ({ playerId: p.playerId, name: p.name, position: p.position, points: p.points, statBreakdown: p.statBreakdown }));

  // Remaining players tonight
  const remainingPlayers = await getRemainingPlayersTonight(myTeamId, scoringSettings, prisma, nowMs);

  // Win probability
  const myProjected = await projectTeamRemainingScore(myTeamId, myScore, period, scoringSettings, prisma, nowMs);
  const opponentProjected = await projectTeamRemainingScore(opponentTeamId, opponentScore, period, scoringSettings, prisma, nowMs);
  const { winProbability } = await import("../projections");
  const winProb = winProbability(myProjected, opponentProjected);

  // H2H record in playoffs (count wins/losses so far)
  const h2hMatchups = await prisma.matchup.findMany({
    where: {
      leagueId,
      isPlayoff: true,
      homeScore: { not: null },
      awayScore: { not: null },
      OR: [
        {
          AND: [{ homeTeamId: myTeamId }, { awayTeamId: opponentTeamId }],
        },
        {
          AND: [{ homeTeamId: opponentTeamId }, { awayTeamId: myTeamId }],
        },
      ],
    },
  });

  let h2hWins = 0,
    h2hLosses = 0,
    h2hTies = 0;
  for (const match of h2hMatchups) {
    const myH2hScore = match.homeTeamId === myTeamId ? match.homeScore : match.awayScore;
    const oppH2hScore = match.awayTeamId === myTeamId ? match.awayScore : match.homeScore;
    if (myH2hScore === null || oppH2hScore === null) continue;
    if (myH2hScore > oppH2hScore) h2hWins++;
    else if (myH2hScore < oppH2hScore) h2hLosses++;
    else h2hTies++;
  }

  return {
    activeMatchup: {
      week: myMatchup.week,
      period,
      status: status as "active" | "upcoming",
      isPlayoff: true,
      round: myMatchup.round ?? undefined,
      roundLabel,
      myTeam: { id: myTeamId, name: allTeams.find((t) => t.id === myTeamId)?.name ?? "", score: myScore },
      myProjected,
      myPlayers,
      weeklyStandings: [],
      myRecord: { wins: 0, losses: 0, ties: 0 },
      opponentTeam: { id: opponentTeamId, name: opponentTeamName, score: opponentScore },
      opponentPlayers,
      opponentProjected,
      winProbability: winProb,
      rivalry: { wins: h2hWins, losses: h2hLosses, ties: h2hTies },
    },
    remainingPlayers,
    topPerformers,
    disappointments,
    lineupAlerts,
    lastResult,
    leagueActivity,
    leagueTopPerformers: [],
    leagueDisappointments: [],
    myPlayersLastWeek: null,
    lastWeekLabel: null,
  };
}

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
  prisma: PrismaClient,
  isVpMode: boolean
): Promise<WeeklyRecap | null> {
  const last = await prisma.matchup.findFirst({
    where: {
      leagueId,
      homeScore: { not: null },
      awayScore: { not: null },
      OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }],
    },
    orderBy: [{ round: "desc" }, { week: "desc" }],
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      league: { select: { playoffSettings: true } },
    },
  });
  if (!last) return null;

  const iAmHome = last.homeTeamId === myTeamId;
  const myScore = (iAmHome ? last.homeScore : last.awayScore) ?? 0;
  const opponentScore = (iAmHome ? last.awayScore : last.homeScore) ?? 0;
  const opponentName = iAmHome ? last.awayTeam.name : last.homeTeam.name;

  const period: ScoringPeriod = { week: last.week, startsAt: last.startsAt, endsAt: last.endsAt };
  const [detailed, weekMatchups] = await Promise.all([
    computeTeamScoreDetailed(myTeamId, period, scoringSettings, prisma),
    prisma.matchup.findMany({
      where: { leagueId, week: last.week, homeScore: { not: null }, awayScore: { not: null } },
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
  const result: WeeklyRecap["result"] = isVpMode
    ? (myScore > opponentScore ? "win" : myScore < opponentScore ? "loss" : "tie")
    : (myRank === 1 ? "win" : "loss");

  const isPlayoff = last.isPlayoff;
  const roundLabel = isPlayoff && last.round
    ? getRoundLabel(last.round, calculatePlayoffRounds((last.league?.playoffSettings as any)?.teamsInPlayoff || 4))
    : undefined;

  return {
    week: last.week, result, myScore, opponentScore, opponentName, myTopPerformer,
    myRank, teamsCount: teamScores.size, closestMatchup, highestScore,
    isPlayoff, round: last.round ?? undefined, roundLabel,
  };
}

async function getLeaguePerformers(
  leagueId: string,
  myTeamId: string,
  period: ScoringPeriod,
  scoringSettings: ScoringSettings,
  prisma: PrismaClient,
  nowMs: number
): Promise<{ top: LeaguePerformerRow[]; disappointing: LeaguePerformerRow[] }> {
  const entries = await prisma.rosterEntry.findMany({
    where: {
      fantasyTeam: { leagueId },
      slot: { notIn: ["BENCH", "IR"] },
    },
    select: {
      playerId: true,
      fantasyTeamId: true,
      player: { select: { firstName: true, lastName: true, position: true } },
      fantasyTeam: { select: { name: true } },
    },
  });

  if (entries.length === 0) return { top: [], disappointing: [] };

  const playerIds = entries.map((e) => e.playerId);
  const upperMs = Math.min(nowMs, period.endsAt.getTime());

  const lines = await prisma.statLine.findMany({
    where: {
      playerId: { in: playerIds },
      game: { startsAt: { gte: period.startsAt, lt: new Date(upperMs) } },
    },
    include: { player: { select: { position: true } } },
  });

  const byPlayer = new Map<string, { pts: number; games: number }>();
  for (const line of lines) {
    const { total } = scoreStatLineDetailed(
      {
        goals: line.goals,
        assists: line.assists,
        shots: line.shots,
        plusMinus: line.plusMinus,
        penaltyMinutes: line.penaltyMinutes,
        powerPlayPts: line.powerPlayPts,
        hits: line.hits,
        blocks: line.blocks,
        saves: line.saves,
        goalsAgainst: line.goalsAgainst,
        shutout: line.shutout,
        win: line.win,
      },
      line.player.position,
      scoringSettings
    );
    const prev = byPlayer.get(line.playerId) ?? { pts: 0, games: 0 };
    byPlayer.set(line.playerId, { pts: Math.round((prev.pts + total) * 100) / 100, games: prev.games + 1 });
  }

  const rows: LeaguePerformerRow[] = entries.map((e) => {
    const scored = byPlayer.get(e.playerId);
    return {
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      fantasyTeamId: e.fantasyTeamId,
      fantasyTeamName: e.fantasyTeam.name,
      points: scored?.pts ?? 0,
      gamesPlayed: scored?.games ?? 0,
      isMyPlayer: e.fantasyTeamId === myTeamId,
    };
  });

  const top = [...rows].filter((r) => r.gamesPlayed > 0).sort((a, b) => b.points - a.points).slice(0, 5);
  const disappointing = [...rows]
    .filter((r) => r.gamesPlayed > 0)
    .sort((a, b) => a.points - b.points)
    .slice(0, 5);

  return { top, disappointing };
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
