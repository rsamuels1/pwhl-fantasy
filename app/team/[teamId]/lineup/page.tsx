import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { eligibleSlots, lockTime } from "@/lib/lineup";
import type { RosterSettings } from "@/lib/lineup";
import { scoreStatLine } from "@/lib/scoring";
import type { ScoringSettings } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { getSeasonState } from "@/lib/season";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { Position } from "@prisma/client";
import LineupManager from "@/app/league/[leagueId]/lineup/LineupManager";
import type { RosterEntryRow, PlayerStatsRow } from "@/app/league/[leagueId]/lineup/LineupManager";

type RawStatLine = {
  playerId: string;
  goals: number; assists: number; shots: number; plusMinus: number;
  penaltyMinutes: number; powerPlayPts: number; hits: number; blocks: number;
  saves: number; goalsAgainst: number; shutout: boolean; win: boolean;
};

function aggregateStats(
  lines: RawStatLine[],
  playerIds: string[],
  positionMap: Record<string, Position>,
  scoring: ScoringSettings
): Record<string, PlayerStatsRow | null> {
  const byPlayer: Record<string, RawStatLine[]> = {};
  for (const l of lines) {
    (byPlayer[l.playerId] ??= []).push(l);
  }
  return Object.fromEntries(
    playerIds.map((id) => {
      const playerLines = byPlayer[id] ?? [];
      if (playerLines.length === 0) return [id, null];
      const fp = playerLines.reduce(
        (sum, l) => sum + scoreStatLine(l, positionMap[id] ?? Position.FORWARD, scoring),
        0
      );
      let goals = 0, assists = 0, shots = 0, plusMinus = 0, penaltyMinutes = 0;
      let powerPlayPts = 0, hits = 0, blocks = 0, saves = 0, goalsAgainst = 0;
      let wins = 0, shutouts = 0;
      for (const l of playerLines) {
        goals += l.goals; assists += l.assists; shots += l.shots;
        plusMinus += l.plusMinus; penaltyMinutes += l.penaltyMinutes;
        powerPlayPts += l.powerPlayPts; hits += l.hits; blocks += l.blocks;
        saves += l.saves; goalsAgainst += l.goalsAgainst;
        if (l.win) wins++; if (l.shutout) shutouts++;
      }
      return [id, {
        gp: playerLines.length, goals, assists, shots, plusMinus, penaltyMinutes,
        powerPlayPts, hits, blocks, saves, goalsAgainst, wins, shutouts,
        fantasyPoints: Math.round(fp * 100) / 100,
      }];
    })
  );
}

const STAT_SELECT = {
  playerId: true, goals: true, assists: true, shots: true, plusMinus: true,
  penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
  saves: true, goalsAgainst: true, shutout: true, win: true,
} as const;

interface Props {
  params: Promise<{ teamId: string }>;
}

export default async function TeamLineupPage({ params }: Props) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/lineup`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

  // For replay leagues, use the DB-persisted simulated date so all members see the same state.
  // Pre-fetch league replay flags before computing nowMs so time windows are correct.
  const leagueReplayInfo = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { isReplay: true, replayCurrentDate: true },
  });
  const devNow = await getDevNow();
  const nowMs = getReplayNow(
    { isReplay: leagueReplayInfo?.isReplay ?? false, replayCurrentDate: leagueReplayInfo?.replayCurrentDate ?? null },
    devNow
  );
  const now = new Date(nowMs);
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCHours(23, 59, 59, 999);

  const [fullTeam, todayGames] = await Promise.all([
    prisma.fantasyTeam.findUnique({
      where: { id: teamId },
      include: {
        roster: {
          include: {
            player: {
              include: { team: { select: { id: true, abbreviation: true } } },
            },
          },
          orderBy: { acquired: "asc" },
        },
        league: { select: { rosterSettings: true, scoringSettings: true, name: true, season: true, isReplay: true, playoffStatus: true } },
      },
    }),
    prisma.game.findMany({
      where: { startsAt: { gte: todayStart, lte: now } },
      select: { homeTeamId: true, awayTeamId: true, startsAt: true },
    }),
  ]);

  if (!fullTeam) notFound();

  const settings = (fullTeam.league.rosterSettings ?? {}) as RosterSettings;
  const scoring = parseScoringSettings(fullTeam.league.scoringSettings);
  const leagueSeason = fullTeam.league.season;

  const playerIds = fullTeam.roster.map((e) => e.playerId);
  const positionMap = Object.fromEntries(
    fullTeam.roster.map((e) => [e.playerId, e.player.position as Position])
  );

  const seasonState = await getSeasonState(leagueId, nowMs, prisma);
  const lastCompleted = [...seasonState.periods].reverse().find((p) => p.status === "COMPLETE");
  const activePeriod = seasonState.periods.find((p) => p.status === "ACTIVE")?.period ?? null;
  const upcomingPeriod = !activePeriod
    ? (seasonState.periods.find((p) => p.status === "UPCOMING")?.period ?? null)
    : null;
  // Period used for games-remaining badge: active if in-week, upcoming if between weeks
  let periodForGames = activePeriod ?? upcomingPeriod;

  // Playoff period fallback: if no regular-season period is active/upcoming,
  // check for a current in-progress playoff matchup (unscored or in-progress)
  if (periodForGames === null && fullTeam.league.playoffStatus !== "NOT_STARTED") {
    const playoffMatchup = await prisma.matchup.findFirst({
      where: {
        leagueId,
        isPlayoff: true,
        OR: [
          { homeScore: null },  // matchup is not yet scored
        ],
        AND: [
          {
            OR: [
              { homeTeamId: teamId },
              { awayTeamId: teamId },
            ],
          },
        ],
      },
    });

    if (playoffMatchup) {
      periodForGames = {
        week: playoffMatchup.week,
        startsAt: playoffMatchup.startsAt,
        endsAt: playoffMatchup.endsAt,
      };
    }
  }

  // Next period for projections — always the first UPCOMING period (may be next week even during an active week)
  const nextPeriod = seasonState.periods.find((p) => p.status === "UPCOMING")?.period ?? null;

  // Projection period: use nextPeriod, or fall back to playoff period if we have one
  const projectionPeriod = nextPeriod ?? (periodForGames?.week ? periodForGames : null);

  const pwhlTeamIds = [...new Set(
    fullTeam.roster.map((e) => e.player.team?.id).filter((id): id is string => !!id)
  )];

  const isReplay = fullTeam.league.isReplay;
  let projectionsAvailable = true;
  const [seasonLines, lastWeekLines, thisWeekLines, projectionLines, nextPeriodGames, periodGames] = await Promise.all([
    playerIds.length > 0
      ? prisma.statLine.findMany({
          where: {
            playerId: { in: playerIds },
            game: {
              season: leagueSeason,
              // Replay leagues: hide stats from games not yet "played" per the simulated date.
              ...(isReplay ? { startsAt: { lt: now } } : {}),
            },
          },
          select: STAT_SELECT,
        })
      : Promise.resolve([] as RawStatLine[]),
    lastCompleted && playerIds.length > 0
      ? prisma.statLine.findMany({
          where: {
            playerId: { in: playerIds },
            game: { startsAt: { gte: lastCompleted.period.startsAt, lt: lastCompleted.period.endsAt } },
          },
          select: STAT_SELECT,
        })
      : Promise.resolve([] as RawStatLine[]),
    // "This week" = games played so far in the active period, up to now
    activePeriod && playerIds.length > 0
      ? prisma.statLine.findMany({
          where: {
            playerId: { in: playerIds },
            game: { startsAt: { gte: activePeriod.startsAt, lte: now } },
          },
          select: STAT_SELECT,
        })
      : Promise.resolve([] as RawStatLine[]),
    // Projection: last 90 days of stat lines (batch, single round-trip)
    projectionPeriod && playerIds.length > 0
      ? prisma.statLine.findMany({
          where: {
            playerId: { in: playerIds },
            game: { startsAt: { gte: new Date(nowMs - 90 * 24 * 60 * 60 * 1000) } },
          },
          orderBy: { game: { startsAt: "desc" } },
          select: STAT_SELECT,
        })
      : Promise.resolve([] as RawStatLine[]),
    // Games scheduled in the next/playoff period for PWHL teams on this roster
    projectionPeriod && pwhlTeamIds.length > 0
      ? prisma.game.findMany({
          where: {
            startsAt: { gte: projectionPeriod.startsAt, lt: projectionPeriod.endsAt },
            OR: [{ homeTeamId: { in: pwhlTeamIds } }, { awayTeamId: { in: pwhlTeamIds } }],
          },
          select: { homeTeamId: true, awayTeamId: true },
        })
      : Promise.resolve([] as { homeTeamId: string; awayTeamId: string }[]),
    // Games that have already started in the current scoring period — used for weekly lock.
    activePeriod && pwhlTeamIds.length > 0
      ? prisma.game.findMany({
          where: {
            startsAt: { gte: activePeriod.startsAt, lte: now },
            OR: [{ homeTeamId: { in: pwhlTeamIds } }, { awayTeamId: { in: pwhlTeamIds } }],
          },
          select: { homeTeamId: true, awayTeamId: true, startsAt: true },
        })
      : Promise.resolve([] as { homeTeamId: string; awayTeamId: string; startsAt: Date }[]),
  ]);

  const seasonStats = aggregateStats(seasonLines, playerIds, positionMap, scoring);
  const lastWeekStats = aggregateStats(lastWeekLines, playerIds, positionMap, scoring);
  const thisWeekStats = aggregateStats(thisWeekLines, playerIds, positionMap, scoring);

  // Games remaining = scheduled games from now → period end (not yet FINAL)
  // No status filter — historical fixture games are FINAL but still "future" relative to sim date.
  // `startsAt > now` already proves the game hasn't been played yet from the manager's perspective.
  const remainingGameRows = periodForGames && pwhlTeamIds.length > 0
    ? await prisma.game.findMany({
        where: {
          startsAt: { gt: now, lt: periodForGames.endsAt },
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

  // Upcoming games today (not yet started) — for lock countdown
  const upcomingTodayRows = pwhlTeamIds.length > 0
    ? await prisma.game.findMany({
        where: {
          startsAt: { gt: now, lte: todayEnd },
          OR: [{ homeTeamId: { in: pwhlTeamIds } }, { awayTeamId: { in: pwhlTeamIds } }],
        },
        select: { homeTeamId: true, awayTeamId: true, startsAt: true },
      })
    : [];
  const nextGamePerTeam = new Map<string, Date>();
  for (const g of upcomingTodayRows) {
    for (const tid of [g.homeTeamId, g.awayTeamId]) {
      if (!pwhlTeamIds.includes(tid)) continue;
      const existing = nextGamePerTeam.get(tid);
      if (!existing || g.startsAt < existing) nextGamePerTeam.set(tid, g.startsAt);
    }
  }

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  let lastWeekLabel: string | null = null;
  if (lastCompleted) {
    const end = new Date(lastCompleted.period.endsAt.getTime() - 1);
    lastWeekLabel = `Week ${lastCompleted.period.week} (${fmt(lastCompleted.period.startsAt)} – ${fmt(end)})`;
  }

  let thisWeekLabel: string | null = null;
  if (activePeriod) {
    const end = new Date(activePeriod.endsAt.getTime() - 1);
    thisWeekLabel = `Week ${activePeriod.week} (${fmt(activePeriod.startsAt)} – ${fmt(end)})`;
  }

  let nextWeekLabel: string | null = null;
  if (nextPeriod) {
    const end = new Date(nextPeriod.endsAt.getTime() - 1);
    nextWeekLabel = `Week ${nextPeriod.week} (${fmt(nextPeriod.startsAt)} – ${fmt(end)})`;
  }

  // Compute projected stats: rolling avg FP/game × games in next period
  let projectedStats: Record<string, { projectedFp: number; avgFpPerGame: number; games: number } | null> = {};
  try {
    const gamesInNextPeriod = new Map<string, number>();
    for (const g of nextPeriodGames) {
      gamesInNextPeriod.set(g.homeTeamId, (gamesInNextPeriod.get(g.homeTeamId) ?? 0) + 1);
      gamesInNextPeriod.set(g.awayTeamId, (gamesInNextPeriod.get(g.awayTeamId) ?? 0) + 1);
    }
    // Group by player, keep only the last 5 (query is DESC)
    const linesByPlayer: Record<string, RawStatLine[]> = {};
    for (const l of projectionLines) {
      linesByPlayer[l.playerId] = linesByPlayer[l.playerId] ?? [];
      if (linesByPlayer[l.playerId].length < 5) linesByPlayer[l.playerId].push(l);
    }
    if (nextPeriod) {
      for (const entry of fullTeam.roster) {
        const pTeamId = entry.player.team?.id ?? null;
        const games = pTeamId ? (gamesInNextPeriod.get(pTeamId) ?? 0) : 0;
        const lines = linesByPlayer[entry.playerId] ?? [];
        if (lines.length === 0) { projectedStats[entry.playerId] = null; continue; }
        const totalFp = lines.reduce(
          (sum, l) => sum + scoreStatLine(l, entry.player.position as Position, scoring), 0
        );
        const avgFpPerGame = Math.round((totalFp / lines.length) * 100) / 100;
        projectedStats[entry.playerId] = {
          projectedFp: Math.round(avgFpPerGame * games * 100) / 100,
          avgFpPerGame,
          games,
        };
      }
    }
  } catch (err) {
    console.error("[lineup] projection computation failed:", err);
    projectionsAvailable = false;
    projectedStats = {};
  }

  const roster: RosterEntryRow[] = fullTeam.roster.map((entry) => {
    const pTeamId = entry.player.team?.id ?? null;
    const locked = lockTime(pTeamId, periodGames, nowMs, activePeriod?.startsAt.getTime());
    return {
      id: entry.id,
      playerId: entry.playerId,
      name: `${entry.player.firstName} ${entry.player.lastName}`,
      position: entry.player.position as "FORWARD" | "DEFENSE" | "GOALIE",
      teamAbbr: entry.player.team?.abbreviation ?? null,
      active: entry.player.active,
      slot: entry.slot as RosterEntryRow["slot"],
      lockedAt: locked?.toISOString() ?? null,
      nextGameStartsAt: pTeamId ? (nextGamePerTeam.get(pTeamId)?.toISOString() ?? null) : null,
      eligibleSlots: eligibleSlots(entry.player.position as "FORWARD" | "DEFENSE" | "GOALIE", entry.player.active) as RosterEntryRow["slot"][],
      gamesThisPeriod: periodForGames ? (gamesPerTeam.get(pTeamId ?? "") ?? 0) : null,
      hasPlayedThisPeriod: (thisWeekStats[entry.playerId]?.gp ?? 0) > 0,
    };
  });

  return (
    <LineupManager
      leagueId={leagueId}
      teamId={teamId}
      teamName={fullTeam.name}
      leagueName={fullTeam.league.name}
      initialRoster={roster}
      rosterSettings={settings}
      seasonStats={seasonStats}
      lastWeekStats={lastWeekStats}
      lastWeekLabel={lastWeekLabel}
      thisWeekStats={thisWeekStats}
      thisWeekLabel={thisWeekLabel}
      projectedStats={projectionPeriod ? projectedStats : undefined}
      nextWeekLabel={nextWeekLabel}
      projectionsAvailable={projectionsAvailable}
    />
  );
}
