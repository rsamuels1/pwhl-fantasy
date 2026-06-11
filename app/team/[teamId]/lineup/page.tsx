import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { eligibleSlots, lockTime } from "@/lib/lineup";
import type { RosterSettings } from "@/lib/lineup";
import { scoreStatLine, DEFAULT_SCORING } from "@/lib/scoring";
import type { ScoringSettings } from "@/lib/scoring";
import { getSeasonState } from "@/lib/season";
import { getDevNow } from "@/lib/devTime";
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

  const nowMs = await getDevNow();
  const now = new Date(nowMs);
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

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
        league: { select: { rosterSettings: true, scoringSettings: true, name: true, season: true } },
      },
    }),
    prisma.game.findMany({
      where: { startsAt: { gte: todayStart, lte: now } },
      select: { homeTeamId: true, awayTeamId: true, startsAt: true },
    }),
  ]);

  if (!fullTeam) notFound();

  const settings = (fullTeam.league.rosterSettings ?? {}) as RosterSettings;
  const scoring = (fullTeam.league.scoringSettings && Object.keys(fullTeam.league.scoringSettings as object).length > 0
    ? fullTeam.league.scoringSettings
    : DEFAULT_SCORING) as ScoringSettings;
  const leagueSeason = fullTeam.league.season;

  const playerIds = fullTeam.roster.map((e) => e.playerId);
  const positionMap = Object.fromEntries(
    fullTeam.roster.map((e) => [e.playerId, e.player.position as Position])
  );

  const seasonState = await getSeasonState(leagueId, nowMs, prisma);
  const lastCompleted = [...seasonState.periods].reverse().find((p) => p.status === "COMPLETE");
  const activePeriod = seasonState.periods.find((p) => p.status === "ACTIVE")?.period ?? null;

  const [seasonLines, lastWeekLines] = await Promise.all([
    playerIds.length > 0
      ? prisma.statLine.findMany({
          where: { playerId: { in: playerIds }, game: { season: leagueSeason } },
          select: STAT_SELECT,
        })
      : Promise.resolve([] as RawStatLine[]),
    lastCompleted && playerIds.length > 0
      ? prisma.statLine.findMany({
          where: {
            playerId: { in: playerIds },
            game: {
              startsAt: {
                gte: lastCompleted.period.startsAt,
                lt: lastCompleted.period.endsAt,
              },
            },
          },
          select: STAT_SELECT,
        })
      : Promise.resolve([] as RawStatLine[]),
  ]);

  const seasonStats = aggregateStats(seasonLines, playerIds, positionMap, scoring);
  const lastWeekStats = aggregateStats(lastWeekLines, playerIds, positionMap, scoring);

  const pwhlTeamIds = [...new Set(
    fullTeam.roster.map((e) => e.player.team?.id).filter((id): id is string => !!id)
  )];
  const remainingGameRows = activePeriod && pwhlTeamIds.length > 0
    ? await prisma.game.findMany({
        where: {
          startsAt: { gt: now, lt: activePeriod.endsAt },
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

  let lastWeekLabel: string | null = null;
  if (lastCompleted) {
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const end = new Date(lastCompleted.period.endsAt.getTime() - 1);
    lastWeekLabel = `Week ${lastCompleted.period.week} (${fmt(lastCompleted.period.startsAt)} – ${fmt(end)})`;
  }

  const roster: RosterEntryRow[] = fullTeam.roster.map((entry) => {
    const pTeamId = entry.player.team?.id ?? null;
    const locked = lockTime(pTeamId, todayGames, nowMs);
    return {
      id: entry.id,
      playerId: entry.playerId,
      name: `${entry.player.firstName} ${entry.player.lastName}`,
      position: entry.player.position as "FORWARD" | "DEFENSE" | "GOALIE",
      teamAbbr: entry.player.team?.abbreviation ?? null,
      active: entry.player.active,
      slot: entry.slot as RosterEntryRow["slot"],
      lockedAt: locked?.toISOString() ?? null,
      eligibleSlots: eligibleSlots(entry.player.position as "FORWARD" | "DEFENSE" | "GOALIE", entry.player.active) as RosterEntryRow["slot"][],
      gamesThisPeriod: activePeriod ? (gamesPerTeam.get(pTeamId ?? "") ?? 0) : null,
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
    />
  );
}
