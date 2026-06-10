import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { eligibleSlots, lockTime } from "@/lib/lineup";
import type { RosterSettings } from "@/lib/lineup";
import { scoreStatLine, DEFAULT_SCORING } from "@/lib/scoring";
import type { ScoringSettings } from "@/lib/scoring";
import { getSeasonState } from "@/lib/season";
import { Position } from "@prisma/client";
import LineupManager from "./LineupManager";
import type { RosterEntryRow, PlayerStatsRow } from "./LineupManager";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ team?: string }>;
}

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

export default async function LineupPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const { team: teamId } = await searchParams;

  if (!teamId) {
    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (!teams.length) notFound();
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Set Lineup</h1>
        <p style={{ color: "#94a3b8", marginBottom: 16 }}>Choose a team to manage:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {teams.map((t) => (
            <a
              key={t.id}
              href={`/league/${leagueId}/lineup?team=${t.id}`}
              style={{
                display: "block", padding: "12px 16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(148,163,184,0.14)",
                borderRadius: 12, color: "#e2e8f0", textDecoration: "none",
              }}
            >
              {t.name}
            </a>
          ))}
        </div>
      </div>
    );
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [team, todayGames] = await Promise.all([
    prisma.fantasyTeam.findFirst({
      where: { id: teamId, leagueId },
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
      where: { startsAt: { gte: todayStart, lte: new Date() } },
      select: { homeTeamId: true, awayTeamId: true, startsAt: true },
    }),
  ]);

  if (!team) notFound();

  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;
  const scoring = (team.league.scoringSettings && Object.keys(team.league.scoringSettings as object).length > 0
    ? team.league.scoringSettings
    : DEFAULT_SCORING) as ScoringSettings;
  const leagueSeason = team.league.season;

  const playerIds = team.roster.map((e) => e.playerId);
  const positionMap = Object.fromEntries(
    team.roster.map((e) => [e.playerId, e.player.position as Position])
  );

  // Find last completed period using the season-lifecycle engine.
  const seasonState = await getSeasonState(leagueId, Date.now(), prisma);
  const lastCompleted = [...seasonState.periods].reverse().find((p) => p.status === "COMPLETE");

  // Fetch season stats and last-week stats in parallel.
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

  let lastWeekLabel: string | null = null;
  if (lastCompleted) {
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const end = new Date(lastCompleted.period.endsAt.getTime() - 1);
    lastWeekLabel = `Week ${lastCompleted.period.week} (${fmt(lastCompleted.period.startsAt)} – ${fmt(end)})`;
  }

  const roster: RosterEntryRow[] = team.roster.map((entry) => {
    const pTeamId = entry.player.team?.id ?? null;
    const locked = lockTime(pTeamId, todayGames);
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
    };
  });

  return (
    <LineupManager
      leagueId={leagueId}
      teamId={teamId}
      teamName={team.name}
      leagueName={team.league.name}
      initialRoster={roster}
      rosterSettings={settings}
      seasonStats={seasonStats}
      lastWeekStats={lastWeekStats}
      lastWeekLabel={lastWeekLabel}
    />
  );
}
