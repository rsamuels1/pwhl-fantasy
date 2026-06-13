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

export interface MatchupSlateRow {
  homeTeam: { id: string; name: string; score: number; projected: number };
  awayTeam: { id: string; name: string; score: number; projected: number };
  isMyMatchup: boolean;
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
  // VP mode only: all matchups this week with projected scores
  leagueMatchupSlate: MatchupSlateRow[];
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
  leagueTopPerformers: LeaguePerformerRow[];
  leagueDisappointments: LeaguePerformerRow[];
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
        leagueMatchupSlate: [],
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
  const lineupAlerts: LineupAlert[] = myPlayers
    .filter((p) =>
      p.gamesThisPeriod === 0 &&
      p.gameCount === 0 &&
      p.slot !== "BENCH" &&
      p.slot !== "IR"
    )
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

  // VP mode: build full matchup slate with projected scores
  let leagueMatchupSlate: MatchupSlateRow[] = [];
  if (isVpMode) {
    const weekPairings = await prisma.matchup.findMany({
      where: { leagueId, week: displayPeriod.week, isPlayoff: false },
      select: { homeTeamId: true, awayTeamId: true },
    });
    if (weekPairings.length > 0) {
      const teamIds = allTeams.map((t) => t.id);
      const projectedResults = await Promise.all(
        teamIds.map((id) =>
          projectTeamRemainingScore(id, allScores.get(id) ?? 0, displayPeriod, scoringSettings, prisma, nowMs)
        )
      );
      const projectedByTeam = new Map(teamIds.map((id, i) => [id, projectedResults[i]]));
      leagueMatchupSlate = weekPairings.map((p) => ({
        homeTeam: {
          id: p.homeTeamId,
          name: allTeams.find((t) => t.id === p.homeTeamId)?.name ?? "",
          score: allScores.get(p.homeTeamId) ?? 0,
          projected: projectedByTeam.get(p.homeTeamId) ?? 0,
        },
        awayTeam: {
          id: p.awayTeamId,
          name: allTeams.find((t) => t.id === p.awayTeamId)?.name ?? "",
          score: allScores.get(p.awayTeamId) ?? 0,
          projected: projectedByTeam.get(p.awayTeamId) ?? 0,
        },
        isMyMatchup: p.homeTeamId === myTeamId || p.awayTeamId === myTeamId,
      }));
    }
  }

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
      leagueMatchupSlate,
    },
    remainingPlayers,
    topPerformers,
    disappointments,
    lineupAlerts,
    lastResult,
    leagueActivity,
    leagueTopPerformers,
    leagueDisappointments,
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
  prisma: PrismaClient,
  isVpMode: boolean
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
  const result: WeeklyRecap["result"] = isVpMode
    ? (myScore > opponentScore ? "win" : myScore < opponentScore ? "loss" : "tie")
    : (myRank === 1 ? "win" : "loss");

  return {
    week: last.week, result, myScore, opponentScore, opponentName, myTopPerformer,
    myRank, teamsCount: teamScores.size, closestMatchup, highestScore,
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

  const top = [...rows].sort((a, b) => b.points - a.points).slice(0, 5);
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
