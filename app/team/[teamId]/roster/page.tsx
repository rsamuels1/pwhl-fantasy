import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { scoreStatLine, DEFAULT_SCORING } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";
import type { ScoringSettings } from "@/lib/scoring";
import { eligibleSlots, lockTime } from "@/lib/lineup";
import type { RosterSettings } from "@/lib/lineup";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { getSeasonState } from "@/lib/season";
import { Position } from "@prisma/client";
import RosterManager from "./RosterManager";
import LineupDnD from "@/components/LineupDnD";
import type { LineupEntry, LineupStats } from "@/components/LineupDnD";
import type { RosterPlayerRow, FreeAgentRow, SkaterStats, GoalieStats } from "./RosterManager";

interface Props {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<{ view?: string; tab?: string }>;
}

function maxRosterSize(settings: RosterSettings): number {
  return (
    (settings.forward ?? 0) + (settings.defense ?? 0) + (settings.goalie ?? 0) +
    (settings.util ?? 0) + (settings.bench ?? 0) + (settings.ir ?? 0)
  );
}

type RawLine = {
  playerId: string; goals: number; assists: number; shots: number; plusMinus: number;
  penaltyMinutes: number; powerPlayPts: number; hits: number; blocks: number;
  saves: number; goalsAgainst: number; shutout: boolean; win: boolean;
};

const STAT_LINE_SELECT = {
  playerId: true, goals: true, assists: true, shots: true, plusMinus: true,
  penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
  saves: true, goalsAgainst: true, shutout: true, win: true,
} as const;

function buildRosterStats(lines: RawLine[], playerId: string, position: string, scoring: ScoringSettings): SkaterStats | GoalieStats | null {
  const playerLines = lines.filter((l) => l.playerId === playerId);
  if (playerLines.length === 0) return null;
  const fp = playerLines.reduce((s, l) => s + scoreStatLine(l, position as Position, scoring), 0);
  if (position === "GOALIE") {
    let wins = 0, saves = 0, goalsAgainst = 0, shutouts = 0;
    for (const l of playerLines) {
      if (l.win) wins++;
      saves += l.saves;
      goalsAgainst += l.goalsAgainst;
      if (l.shutout) shutouts++;
    }
    const totalFaced = saves + goalsAgainst;
    return { gp: playerLines.length, wins, saves, goalsAgainst, shutouts, fantasyPoints: Math.round(fp * 100) / 100, savePct: totalFaced > 0 ? saves / totalFaced : null };
  }
  let goals = 0, assists = 0, plusMinus = 0, ppp = 0, shots = 0, hits = 0, blocks = 0;
  for (const l of playerLines) {
    goals += l.goals; assists += l.assists; plusMinus += l.plusMinus;
    ppp += l.powerPlayPts; shots += l.shots; hits += l.hits; blocks += l.blocks;
  }
  return { gp: playerLines.length, goals, assists, points: goals + assists, plusMinus, ppp, shots, hits, blocks, fantasyPoints: Math.round(fp * 100) / 100 };
}

function buildLineupStats(lines: RawLine[], playerId: string, position: string, scoring: ScoringSettings): LineupStats | null {
  const playerLines = lines.filter((l) => l.playerId === playerId);
  if (playerLines.length === 0) return null;
  const fp = playerLines.reduce((s, l) => s + scoreStatLine(l, position as Position, scoring), 0);
  if (position === "GOALIE") {
    let wins = 0, saves = 0, goalsAgainst = 0, shutouts = 0;
    for (const l of playerLines) {
      if (l.win) wins++;
      saves += l.saves;
      goalsAgainst += l.goalsAgainst;
      if (l.shutout) shutouts++;
    }
    const totalFaced = saves + goalsAgainst;
    return { gp: playerLines.length, wins, goalsAgainst, shutouts, savePct: totalFaced > 0 ? saves / totalFaced : null, fantasyPoints: Math.round(fp * 100) / 100 };
  }
  let goals = 0, assists = 0, powerPlayPts = 0, shots = 0, hits = 0, blocks = 0;
  for (const l of playerLines) {
    goals += l.goals; assists += l.assists; powerPlayPts += l.powerPlayPts;
    shots += l.shots; hits += l.hits; blocks += l.blocks;
  }
  return { gp: playerLines.length, goals, assists, powerPlayPts, shots, hits, blocks, fantasyPoints: Math.round(fp * 100) / 100 };
}

export default async function TeamRosterPage({ params, searchParams }: Props) {
  const { teamId } = await params;
  const sp = await searchParams;
  const tabParam = sp?.tab;
  const defaultTab = tabParam === "freeAgents" || tabParam === "waiverWire" ? tabParam : undefined;
  const user = await requireAuth(`/team/${teamId}/roster`);
  await requireTeamOwner(teamId, user.id);

  const team = await prisma.fantasyTeam.findUnique({
    where: { id: teamId },
    include: {
      league: { select: { id: true, commissionerId: true, rosterSettings: true, scoringSettings: true, season: true, isReplay: true, replayCurrentDate: true, playoffStatus: true } },
      roster: {
        include: { player: { include: { team: { select: { id: true, abbreviation: true } } } } },
        orderBy: { slot: "asc" },
      },
    },
  });
  if (!team) notFound();

  const leagueId = team.league.id;
  const isCommissioner = user.id === team.league.commissionerId;
  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;
  const scoring = parseScoringSettings(team.league.scoringSettings);
  const scoringFallback = (
    team.league.scoringSettings && typeof team.league.scoringSettings === "object" &&
    "skater" in (team.league.scoringSettings as object)
      ? team.league.scoringSettings
      : DEFAULT_SCORING
  ) as ScoringSettings;
  const season = team.league.season;
  const isReplay = team.league.isReplay ?? false;

  const devNow = await getDevNow();
  const nowMs = getReplayNow(
    { isReplay, replayCurrentDate: team.league.replayCurrentDate ?? null },
    devNow
  );
  const now = new Date(nowMs);

  const seasonState = await getSeasonState(leagueId, nowMs, prisma);
  const lastCompletedEntry = [...seasonState.periods].reverse().find((p) => p.status === "COMPLETE");
  const activePeriod = seasonState.periods.find((p) => p.status === "ACTIVE")?.period ?? null;
  const upcomingPeriod = seasonState.periods.find((p) => p.status === "UPCOMING")?.period ?? null;
  let periodForGames = activePeriod ?? upcomingPeriod;

  if (periodForGames === null && team.league.playoffStatus !== "NOT_STARTED") {
    const playoffMatchup = await prisma.matchup.findFirst({
      where: { leagueId, isPlayoff: true, homeScore: null },
      orderBy: { startsAt: "asc" },
    });
    if (playoffMatchup) {
      periodForGames = { week: playoffMatchup.week, startsAt: playoffMatchup.startsAt, endsAt: playoffMatchup.endsAt };
    }
  }

  const nextPeriod = seasonState.periods.find((p) => p.status === "UPCOMING")?.period ?? null;
  const projectionPeriod = nextPeriod ?? (periodForGames?.week ? periodForGames : null);

  const playerIds = team.roster.map((e) => e.playerId);
  const pwhlTeamIds = [...new Set(team.roster.map((e) => e.player.team?.id).filter((id): id is string => !!id))];

  // Batch all stat queries in parallel
  const [ownLines, lastWeekLines, thisWeekLines, projectionLines, nextPeriodGames, activePeriodGames] = await Promise.all([
    playerIds.length > 0
      ? prisma.statLine.findMany({
          where: {
            playerId: { in: playerIds },
            game: { season, ...(isReplay ? { startsAt: { lt: now } } : {}) },
          },
          select: STAT_LINE_SELECT,
        })
      : Promise.resolve([] as RawLine[]),
    lastCompletedEntry && playerIds.length > 0
      ? prisma.statLine.findMany({
          where: {
            playerId: { in: playerIds },
            game: { startsAt: { gte: lastCompletedEntry.period.startsAt, lt: lastCompletedEntry.period.endsAt } },
          },
          select: STAT_LINE_SELECT,
        })
      : Promise.resolve([] as RawLine[]),
    activePeriod && playerIds.length > 0
      ? prisma.statLine.findMany({
          where: {
            playerId: { in: playerIds },
            game: { startsAt: { gte: activePeriod.startsAt, lte: now } },
          },
          select: STAT_LINE_SELECT,
        })
      : Promise.resolve([] as RawLine[]),
    projectionPeriod && playerIds.length > 0
      ? prisma.statLine.findMany({
          where: {
            playerId: { in: playerIds },
            game: { startsAt: { gte: new Date(nowMs - 90 * 24 * 60 * 60 * 1000) } },
          },
          orderBy: { game: { startsAt: "desc" } },
          select: STAT_LINE_SELECT,
        })
      : Promise.resolve([] as RawLine[]),
    projectionPeriod && pwhlTeamIds.length > 0
      ? prisma.game.findMany({
          where: {
            startsAt: { gte: projectionPeriod.startsAt, lt: projectionPeriod.endsAt },
            OR: [{ homeTeamId: { in: pwhlTeamIds } }, { awayTeamId: { in: pwhlTeamIds } }],
          },
          select: { homeTeamId: true, awayTeamId: true },
        })
      : Promise.resolve([] as { homeTeamId: string; awayTeamId: string }[]),
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

  // Build stats maps
  const seasonStats: Record<string, LineupStats | null> = {};
  const lastWeekStatsMap: Record<string, LineupStats | null> = {};
  const thisWeekStatsMap: Record<string, LineupStats | null> = {};
  for (const e of team.roster) {
    seasonStats[e.playerId] = buildLineupStats(ownLines as RawLine[], e.playerId, e.player.position, scoring);
    lastWeekStatsMap[e.playerId] = buildLineupStats(lastWeekLines as RawLine[], e.playerId, e.player.position, scoring);
    thisWeekStatsMap[e.playerId] = buildLineupStats(thisWeekLines as RawLine[], e.playerId, e.player.position, scoring);
  }

  // Games remaining per PWHL team
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

  // Projected stats
  let projectedStatsMap: Record<string, { projectedFp: number; games: number } | null> | undefined;
  if (nextPeriod) {
    const gamesInNextPeriod = new Map<string, number>();
    for (const g of nextPeriodGames) {
      gamesInNextPeriod.set(g.homeTeamId, (gamesInNextPeriod.get(g.homeTeamId) ?? 0) + 1);
      gamesInNextPeriod.set(g.awayTeamId, (gamesInNextPeriod.get(g.awayTeamId) ?? 0) + 1);
    }
    const linesByPlayer: Record<string, RawLine[]> = {};
    for (const l of projectionLines) {
      linesByPlayer[l.playerId] = linesByPlayer[l.playerId] ?? [];
      if (linesByPlayer[l.playerId].length < 5) linesByPlayer[l.playerId].push(l);
    }
    projectedStatsMap = {};
    for (const entry of team.roster) {
      const pTeamId = entry.player.team?.id ?? null;
      const games = pTeamId ? (gamesInNextPeriod.get(pTeamId) ?? 0) : 0;
      const lines = linesByPlayer[entry.playerId] ?? [];
      if (lines.length === 0) { projectedStatsMap[entry.playerId] = null; continue; }
      const totalFp = lines.reduce((sum, l) => sum + scoreStatLine(l, entry.player.position as Position, scoring), 0);
      const avgFpPerGame = totalFp / lines.length;
      projectedStatsMap[entry.playerId] = {
        projectedFp: Math.round(avgFpPerGame * games * 100) / 100,
        games,
      };
    }
  }

  // Date labels
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const lastWeekLabel = lastCompletedEntry
    ? `Week ${lastCompletedEntry.period.week} (${fmt(lastCompletedEntry.period.startsAt)} – ${fmt(new Date(lastCompletedEntry.period.endsAt.getTime() - 1))})`
    : null;
  const thisWeekLabel = activePeriod
    ? `Week ${activePeriod.week} (${fmt(activePeriod.startsAt)} – ${fmt(new Date(activePeriod.endsAt.getTime() - 1))})`
    : null;
  const nextWeekLabel = nextPeriod
    ? `Week ${nextPeriod.week} (${fmt(nextPeriod.startsAt)} – ${fmt(new Date(nextPeriod.endsAt.getTime() - 1))})`
    : null;

  // Build own roster rows + lineup entries (combined)
  const ownRosterRows: RosterPlayerRow[] = team.roster.map((e) => ({
    entryId: e.id,
    playerId: e.playerId,
    name: `${e.player.firstName} ${e.player.lastName}`,
    position: e.player.position as RosterPlayerRow["position"],
    teamAbbr: e.player.team?.abbreviation ?? null,
    slot: e.slot,
    active: e.player.active,
    acquired: e.acquired.toISOString(),
    stats: buildRosterStats(ownLines as RawLine[], e.playerId, e.player.position, scoringFallback),
  }));

  const lineupEntries: LineupEntry[] = team.roster.map((e) => {
    const pTeamId = e.player.team?.id ?? null;
    const locked = lockTime(pTeamId, activePeriodGames, nowMs, activePeriod?.startsAt.getTime());
    return {
      entryId: e.id,
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position as LineupEntry["position"],
      teamAbbr: e.player.team?.abbreviation ?? null,
      slot: e.slot,
      lockedAt: locked?.toISOString() ?? null,
      hasPlayedThisPeriod: (thisWeekStatsMap[e.playerId]?.gp ?? 0) > 0,
      gamesThisPeriod: periodForGames ? (gamesPerTeam.get(pTeamId ?? "") ?? 0) : null,
      eligibleSlots: eligibleSlots(e.player.position as "FORWARD" | "DEFENSE" | "GOALIE", e.player.active) as string[],
    };
  });

  // All teams for the selector dropdown
  const allTeams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Determine which team is being viewed
  const viewTeamIdParam = sp?.view;
  const isOwnRoster = !viewTeamIdParam || viewTeamIdParam === teamId;
  const viewTeamId = isOwnRoster ? teamId : viewTeamIdParam!;

  // If viewing another team, fetch their roster + stats
  let viewRoster: RosterPlayerRow[] = ownRosterRows;
  let viewTeamName = team.name;
  let viewedLineupEntries: LineupEntry[] | null = null;
  let viewedSeasonStats: Record<string, LineupStats | null> = {};
  let viewedLastWeekStats: Record<string, LineupStats | null> = {};
  let viewedThisWeekStats: Record<string, LineupStats | null> = {};

  if (!isOwnRoster) {
    const viewedTeam = await prisma.fantasyTeam.findFirst({
      where: { id: viewTeamId, leagueId },
      include: {
        roster: {
          include: { player: { include: { team: { select: { id: true, abbreviation: true } } } } },
          orderBy: { slot: "asc" },
        },
      },
    });

    if (!viewedTeam) {
      viewRoster = ownRosterRows;
    } else {
      viewTeamName = viewedTeam.name;
      const viewedIds = viewedTeam.roster.map((e) => e.playerId);
      const viewedPwhlTeamIds = [...new Set(viewedTeam.roster.map((e) => e.player.team?.id).filter((id): id is string => !!id))];

      const [viewedLines, viewedLastWeekLines, viewedThisWeekLines, viewedActivePeriodGames] = await Promise.all([
        viewedIds.length > 0
          ? prisma.statLine.findMany({ where: { playerId: { in: viewedIds }, game: { season } }, select: STAT_LINE_SELECT })
          : Promise.resolve([]),
        lastCompletedEntry && viewedIds.length > 0
          ? prisma.statLine.findMany({ where: { playerId: { in: viewedIds }, game: { startsAt: { gte: lastCompletedEntry.period.startsAt, lt: lastCompletedEntry.period.endsAt } } }, select: STAT_LINE_SELECT })
          : Promise.resolve([]),
        activePeriod && viewedIds.length > 0
          ? prisma.statLine.findMany({ where: { playerId: { in: viewedIds }, game: { startsAt: { gte: activePeriod.startsAt, lte: now } } }, select: STAT_LINE_SELECT })
          : Promise.resolve([]),
        activePeriod && viewedPwhlTeamIds.length > 0
          ? prisma.game.findMany({
              where: { startsAt: { gte: activePeriod.startsAt, lte: now }, OR: [{ homeTeamId: { in: viewedPwhlTeamIds } }, { awayTeamId: { in: viewedPwhlTeamIds } }] },
              select: { homeTeamId: true, awayTeamId: true, startsAt: true },
            })
          : Promise.resolve([] as { homeTeamId: string; awayTeamId: string; startsAt: Date }[]),
      ]);

      viewRoster = viewedTeam.roster.map((e) => ({
        entryId: e.id,
        playerId: e.playerId,
        name: `${e.player.firstName} ${e.player.lastName}`,
        position: e.player.position as RosterPlayerRow["position"],
        teamAbbr: e.player.team?.abbreviation ?? null,
        slot: e.slot,
        active: e.player.active,
        acquired: e.acquired.toISOString(),
        stats: buildRosterStats(viewedLines as RawLine[], e.playerId, e.player.position, scoringFallback),
      }));

      if (isCommissioner) {
        // Build per-player stats for the viewed team's tabs
        for (const e of viewedTeam.roster) {
          viewedSeasonStats[e.playerId] = buildLineupStats(viewedLines as RawLine[], e.playerId, e.player.position, scoring);
          viewedLastWeekStats[e.playerId] = buildLineupStats(viewedLastWeekLines as RawLine[], e.playerId, e.player.position, scoring);
          viewedThisWeekStats[e.playerId] = buildLineupStats(viewedThisWeekLines as RawLine[], e.playerId, e.player.position, scoring);
        }

        viewedLineupEntries = viewedTeam.roster.map((e) => {
          const pTeamId = e.player.team?.id ?? null;
          const locked = lockTime(pTeamId, viewedActivePeriodGames, nowMs, activePeriod?.startsAt.getTime());
          const remaining = periodForGames && pTeamId ? (gamesPerTeam.get(pTeamId) ?? 0) : null;
          return {
            entryId: e.id,
            playerId: e.playerId,
            name: `${e.player.firstName} ${e.player.lastName}`,
            position: e.player.position as LineupEntry["position"],
            teamAbbr: e.player.team?.abbreviation ?? null,
            slot: e.slot,
            lockedAt: locked?.toISOString() ?? null,
            hasPlayedThisPeriod: (viewedThisWeekStats[e.playerId]?.gp ?? 0) > 0,
            gamesThisPeriod: remaining,
            eligibleSlots: eligibleSlots(e.player.position as "FORWARD" | "DEFENSE" | "GOALIE", e.player.active) as string[],
          };
        });
      }
    }
  }

  // Free agents
  type AggRow = {
    id: string; firstName: string; lastName: string;
    position: string; abbreviation: string | null; pwhlTeamId: string | null;
    gp: bigint; goals: bigint; assists: bigint; plusMinus: bigint; penaltyMinutes: bigint;
    ppp: bigint; shots: bigint; hits: bigint; blocks: bigint;
    saves: bigint; goalsAgainst: bigint; wins: bigint; shutouts: bigint;
  };

  const faRows = await prisma.$queryRaw<AggRow[]>`
    SELECT
      p.id, p."firstName", p."lastName", p.position::text,
      t.abbreviation, p."teamId" as "pwhlTeamId",
      COUNT(sl.id) AS gp,
      COALESCE(SUM(sl.goals), 0) AS goals,
      COALESCE(SUM(sl.assists), 0) AS assists,
      COALESCE(SUM(sl."plusMinus"), 0) AS "plusMinus",
      COALESCE(SUM(sl."penaltyMinutes"), 0) AS "penaltyMinutes",
      COALESCE(SUM(sl."powerPlayPts"), 0) AS ppp,
      COALESCE(SUM(sl.shots), 0) AS shots,
      COALESCE(SUM(sl.hits), 0) AS hits,
      COALESCE(SUM(sl.blocks), 0) AS blocks,
      COALESCE(SUM(sl.saves), 0) AS saves,
      COALESCE(SUM(sl."goalsAgainst"), 0) AS "goalsAgainst",
      COALESCE(SUM(CASE WHEN sl.win THEN 1 ELSE 0 END), 0) AS wins,
      COALESCE(SUM(CASE WHEN sl.shutout THEN 1 ELSE 0 END), 0) AS shutouts
    FROM "Player" p
    LEFT JOIN "Team" t ON t.id = p."teamId"
    LEFT JOIN (
      SELECT sl.* FROM "StatLine" sl
      JOIN "Game" g ON g.id = sl."gameId" AND g.season = ${season}
    ) sl ON sl."playerId" = p.id
    WHERE p.active = true
      AND p.id NOT IN (
        SELECT DISTINCT re."playerId" FROM "RosterEntry" re
        JOIN "FantasyTeam" ft ON ft.id = re."fantasyTeamId"
        WHERE ft."leagueId" = ${leagueId}
      )
    GROUP BY p.id, p."firstName", p."lastName", p.position, t.abbreviation, p."teamId"
    ORDER BY p."lastName"
  `;

  const faTeamIds = [...new Set(faRows.map((r) => r.pwhlTeamId).filter((id): id is string => !!id))];
  const faPeriodGames = periodForGames && faTeamIds.length > 0
    ? await prisma.game.findMany({
        where: {
          startsAt: { gte: periodForGames.startsAt, lt: periodForGames.endsAt },
          OR: [{ homeTeamId: { in: faTeamIds } }, { awayTeamId: { in: faTeamIds } }],
        },
        select: { homeTeamId: true, awayTeamId: true, startsAt: true },
      })
    : [];
  const faGamesRemaining = new Map<string, number>();
  const lockedTeamIds = new Set<string>();
  for (const g of faPeriodGames) {
    if (g.startsAt > now) {
      faGamesRemaining.set(g.homeTeamId, (faGamesRemaining.get(g.homeTeamId) ?? 0) + 1);
      faGamesRemaining.set(g.awayTeamId, (faGamesRemaining.get(g.awayTeamId) ?? 0) + 1);
    } else {
      lockedTeamIds.add(g.homeTeamId);
      lockedTeamIds.add(g.awayTeamId);
    }
  }

  const waiverEntries = await prisma.waiverEntry.findMany({
    where: { leagueId, expiresAt: { gt: now } },
    select: { playerId: true },
  });
  const waiverPlayerIds = new Set(waiverEntries.map((e) => e.playerId));

  const sk = scoringFallback.skater;
  const gk = scoringFallback.goalie;

  const freeAgents: FreeAgentRow[] = faRows.map((r) => {
    const gp = Number(r.gp);
    const position = r.position as FreeAgentRow["position"];
    if (position === "GOALIE") {
      const saves = Number(r.saves);
      const ga = Number(r.goalsAgainst);
      const wins = Number(r.wins);
      const shutouts = Number(r.shutouts);
      const totalFaced = saves + ga;
      const fantasyPoints = Math.round((wins * gk.win + saves * gk.save + ga * gk.goalAgainst + shutouts * gk.shutout) * 100) / 100;
      return {
        playerId: r.id, name: `${r.firstName} ${r.lastName}`, position,
        teamAbbr: r.abbreviation ?? null, pwhlTeamId: r.pwhlTeamId,
        gamesThisPeriod: periodForGames ? (faGamesRemaining.get(r.pwhlTeamId ?? "") ?? 0) : null,
        isLocked: lockedTeamIds.has(r.pwhlTeamId ?? ""),
        stats: gp === 0 ? null : { gp, wins, saves, goalsAgainst: ga, shutouts, savePct: totalFaced > 0 ? saves / totalFaced : null, fantasyPoints } as GoalieStats,
        isOnWaivers: waiverPlayerIds.has(r.id),
      };
    }
    const goals = Number(r.goals); const assists = Number(r.assists); const plusMinus = Number(r.plusMinus);
    const ppp = Number(r.ppp); const shots = Number(r.shots); const hits = Number(r.hits); const blocks = Number(r.blocks);
    const fantasyPoints = Math.round((goals * sk.goal + assists * sk.assist + shots * sk.shot + plusMinus * sk.plusMinus + (Number(r.penaltyMinutes)) * sk.penaltyMinute + ppp * sk.powerPlayPoint + hits * sk.hit + blocks * sk.block) * 100) / 100;
    return {
      playerId: r.id, name: `${r.firstName} ${r.lastName}`, position,
      teamAbbr: r.abbreviation ?? null, pwhlTeamId: r.pwhlTeamId,
      gamesThisPeriod: periodForGames ? (faGamesRemaining.get(r.pwhlTeamId ?? "") ?? 0) : null,
      isLocked: lockedTeamIds.has(r.pwhlTeamId ?? ""),
      isOnWaivers: waiverPlayerIds.has(r.id),
      stats: gp === 0 ? null : { gp, goals, assists, points: goals + assists, plusMinus, ppp, shots, hits, blocks, fantasyPoints } as SkaterStats,
    };
  });

  // Which lineup entries and stats to show in the DnD section
  const dndEntries = isOwnRoster ? lineupEntries : (viewedLineupEntries ?? []);
  const dndSeasonStats = isOwnRoster ? seasonStats : viewedSeasonStats;
  const dndLastWeekStats = isOwnRoster ? lastWeekStatsMap : viewedLastWeekStats;
  const dndThisWeekStats = isOwnRoster ? thisWeekStatsMap : viewedThisWeekStats;
  const showDnD = isOwnRoster || (isCommissioner && viewedLineupEntries !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* DnD Lineup section — own roster, or commissioner viewing another team */}
      {showDnD && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569", marginBottom: 12 }}>
            {isOwnRoster ? "Set Lineup" : `Set Lineup — ${viewTeamName}`}
          </div>
          <LineupDnD
            leagueId={leagueId}
            teamId={teamId}
            initialRoster={dndEntries}
            seasonStats={dndSeasonStats}
            lastWeekStats={dndLastWeekStats}
            lastWeekLabel={lastWeekLabel}
            thisWeekStats={dndThisWeekStats}
            thisWeekLabel={thisWeekLabel}
            projectedStats={isOwnRoster ? projectedStatsMap : undefined}
            nextWeekLabel={isOwnRoster ? nextWeekLabel : null}
            projectionsAvailable={isOwnRoster ? !!nextWeekLabel : false}
            forceMove={!isOwnRoster && isCommissioner}
            forceMoveTeamId={!isOwnRoster ? viewTeamId : undefined}
          />
        </div>
      )}

      {/* Roster management — roster table + FA + waiver wire */}
      <RosterManager
        leagueId={leagueId}
        teamId={teamId}
        teamName={team.name}
        maxRosterSize={maxRosterSize(settings)}
        rosterSettings={settings}
        initialRoster={ownRosterRows}
        freeAgents={freeAgents}
        allTeams={allTeams}
        viewTeamId={viewTeamId}
        viewTeamName={viewTeamName}
        viewRoster={viewRoster}
        isOwnRoster={isOwnRoster}
        isCommissioner={isCommissioner}
        defaultTab={defaultTab ?? (isOwnRoster ? "freeAgents" : undefined)}
      />
    </div>
  );
}
