import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { scoreStatLine, DEFAULT_SCORING } from "@/lib/scoring";
import type { ScoringSettings } from "@/lib/scoring";
import { getDevNow } from "@/lib/devTime";
import { getSeasonState } from "@/lib/season";
import RosterManager from "./RosterManager";
import type { RosterPlayerRow, FreeAgentRow, SkaterStats, GoalieStats } from "./RosterManager";
import type { RosterSettings } from "@/lib/lineup";

interface Props {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<{ view?: string }>;
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

function buildRosterStats(
  lines: RawLine[],
  playerId: string,
  position: string,
  scoring: ScoringSettings
): SkaterStats | GoalieStats | null {
  const playerLines = lines.filter((l) => l.playerId === playerId);
  if (playerLines.length === 0) return null;
  const fp = playerLines.reduce((s, l) => s + scoreStatLine(l, position as import("@prisma/client").Position, scoring), 0);
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

const STAT_LINE_SELECT = {
  playerId: true, goals: true, assists: true, shots: true, plusMinus: true,
  penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
  saves: true, goalsAgainst: true, shutout: true, win: true,
} as const;

export default async function TeamRosterPage({ params, searchParams }: Props) {
  const { teamId } = await params;
  const sp = await searchParams;
  const user = await requireAuth(`/team/${teamId}/roster`);
  await requireTeamOwner(teamId, user.id);

  const team = await prisma.fantasyTeam.findUnique({
    where: { id: teamId },
    include: {
      league: { select: { id: true, rosterSettings: true, scoringSettings: true, season: true } },
      roster: {
        include: { player: { include: { team: { select: { abbreviation: true } } } } },
        orderBy: { slot: "asc" },
      },
    },
  });
  if (!team) notFound();

  const leagueId = team.league.id;
  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;
  const nowMs = await getDevNow();
  const now = new Date(nowMs);
  const seasonState = await getSeasonState(leagueId, nowMs, prisma);
  const activePeriod = seasonState.activePeriod;
  const upcomingPeriod = seasonState.periods.find((p) => p.status === "UPCOMING")?.period ?? null;
  const periodForGames = activePeriod ?? upcomingPeriod;
  const scoring = (
    team.league.scoringSettings && typeof team.league.scoringSettings === "object" &&
    "skater" in (team.league.scoringSettings as object)
      ? team.league.scoringSettings
      : DEFAULT_SCORING
  ) as ScoringSettings;
  const season = team.league.season;

  // All teams in the league for the selector dropdown
  const allTeams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Own roster stats (always fetched — needed for the FA add/drop tab)
  const ownPlayerIds = team.roster.map((e) => e.playerId);
  const ownLines = ownPlayerIds.length > 0
    ? await prisma.statLine.findMany({
        where: { playerId: { in: ownPlayerIds }, game: { season } },
        select: STAT_LINE_SELECT,
      })
    : [];

  const ownRosterRows: RosterPlayerRow[] = team.roster.map((e) => ({
    entryId: e.id,
    playerId: e.playerId,
    name: `${e.player.firstName} ${e.player.lastName}`,
    position: e.player.position as RosterPlayerRow["position"],
    teamAbbr: e.player.team?.abbreviation ?? null,
    slot: e.slot,
    active: e.player.active,
    acquired: e.acquired.toISOString(),
    stats: buildRosterStats(ownLines as RawLine[], e.playerId, e.player.position, scoring),
  }));

  // Determine which team is being viewed
  const viewTeamIdParam = sp?.view;
  const isOwnRoster = !viewTeamIdParam || viewTeamIdParam === teamId;
  const viewTeamId = isOwnRoster ? teamId : viewTeamIdParam!;

  // If viewing another team, fetch their roster + stats
  let viewRoster: RosterPlayerRow[] = ownRosterRows;
  let viewTeamName = team.name;

  if (!isOwnRoster) {
    const viewedTeam = await prisma.fantasyTeam.findFirst({
      where: { id: viewTeamId, leagueId }, // security: must be in same league
      include: {
        roster: {
          include: { player: { include: { team: { select: { abbreviation: true } } } } },
          orderBy: { slot: "asc" },
        },
      },
    });

    if (!viewedTeam) {
      // Invalid team param — fall back to own roster
      viewRoster = ownRosterRows;
    } else {
      viewTeamName = viewedTeam.name;
      const viewedIds = viewedTeam.roster.map((e) => e.playerId);
      const viewedLines = viewedIds.length > 0
        ? await prisma.statLine.findMany({
            where: { playerId: { in: viewedIds }, game: { season } },
            select: STAT_LINE_SELECT,
          })
        : [];
      viewRoster = viewedTeam.roster.map((e) => ({
        entryId: e.id,
        playerId: e.playerId,
        name: `${e.player.firstName} ${e.player.lastName}`,
        position: e.player.position as RosterPlayerRow["position"],
        teamAbbr: e.player.team?.abbreviation ?? null,
        slot: e.slot,
        active: e.player.active,
        acquired: e.acquired.toISOString(),
        stats: buildRosterStats(viewedLines as RawLine[], e.playerId, e.player.position, scoring),
      }));
    }
  }

  // Free agents (only needed for own-roster add/drop; still fetched so the tab renders instantly)
  type AggRow = {
    id: string; firstName: string; lastName: string;
    position: string; abbreviation: string | null; pwhlTeamId: string | null;
    gp: bigint; goals: bigint; assists: bigint; plusMinus: bigint; penaltyMinutes: bigint;
    ppp: bigint; shots: bigint; hits: bigint; blocks: bigint;
    saves: bigint; goalsAgainst: bigint; wins: bigint; shutouts: bigint;
  };

  const faRows = await prisma.$queryRaw<AggRow[]>`
    SELECT
      p.id,
      p."firstName",
      p."lastName",
      p.position::text,
      t.abbreviation,
      p."teamId" as "pwhlTeamId",
      COUNT(sl.id)                                                    AS gp,
      COALESCE(SUM(sl.goals), 0)                                      AS goals,
      COALESCE(SUM(sl.assists), 0)                                    AS assists,
      COALESCE(SUM(sl."plusMinus"), 0)                                AS "plusMinus",
      COALESCE(SUM(sl."penaltyMinutes"), 0)                           AS "penaltyMinutes",
      COALESCE(SUM(sl."powerPlayPts"), 0)                             AS ppp,
      COALESCE(SUM(sl.shots), 0)                                      AS shots,
      COALESCE(SUM(sl.hits), 0)                                       AS hits,
      COALESCE(SUM(sl.blocks), 0)                                     AS blocks,
      COALESCE(SUM(sl.saves), 0)                                      AS saves,
      COALESCE(SUM(sl."goalsAgainst"), 0)                             AS "goalsAgainst",
      COALESCE(SUM(CASE WHEN sl.win THEN 1 ELSE 0 END), 0)           AS wins,
      COALESCE(SUM(CASE WHEN sl.shutout THEN 1 ELSE 0 END), 0)       AS shutouts
    FROM "Player" p
    LEFT JOIN "Team" t ON t.id = p."teamId"
    LEFT JOIN (
      SELECT sl.* FROM "StatLine" sl
      JOIN "Game" g ON g.id = sl."gameId" AND g.season = ${season}
    ) sl ON sl."playerId" = p.id
    WHERE p.active = true
      AND p.id NOT IN (
        SELECT DISTINCT re."playerId"
        FROM "RosterEntry" re
        JOIN "FantasyTeam" ft ON ft.id = re."fantasyTeamId"
        WHERE ft."leagueId" = ${leagueId}
      )
    GROUP BY p.id, p."firstName", p."lastName", p.position, t.abbreviation, p."teamId"
    ORDER BY (COALESCE(SUM(sl.goals), 0) + COALESCE(SUM(sl.assists), 0)) DESC, p."lastName"
  `;

  // Batch query: period games for all FA PWHL teams — used for games-remaining badge and lock status
  const faTeamIds = [...new Set(faRows.map((r) => r.pwhlTeamId).filter((id): id is string => !!id))];
  const periodGames = periodForGames && faTeamIds.length > 0
    ? await prisma.game.findMany({
        where: {
          startsAt: { gte: periodForGames.startsAt, lt: periodForGames.endsAt },
          OR: [{ homeTeamId: { in: faTeamIds } }, { awayTeamId: { in: faTeamIds } }],
        },
        select: { homeTeamId: true, awayTeamId: true, startsAt: true },
      })
    : [];
  const gamesRemaining = new Map<string, number>();
  const lockedTeamIds = new Set<string>();
  for (const g of periodGames) {
    if (g.startsAt > now) {
      gamesRemaining.set(g.homeTeamId, (gamesRemaining.get(g.homeTeamId) ?? 0) + 1);
      gamesRemaining.set(g.awayTeamId, (gamesRemaining.get(g.awayTeamId) ?? 0) + 1);
    } else {
      lockedTeamIds.add(g.homeTeamId);
      lockedTeamIds.add(g.awayTeamId);
    }
  }

  const sk = scoring.skater;
  const gk = scoring.goalie;

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
        playerId: r.id,
        name: `${r.firstName} ${r.lastName}`,
        position,
        teamAbbr: r.abbreviation ?? null,
        pwhlTeamId: r.pwhlTeamId,
        gamesThisPeriod: periodForGames ? (gamesRemaining.get(r.pwhlTeamId ?? "") ?? 0) : null,
        isLocked: lockedTeamIds.has(r.pwhlTeamId ?? ""),
        stats: gp === 0 ? null : { gp, wins, saves, goalsAgainst: ga, shutouts, savePct: totalFaced > 0 ? saves / totalFaced : null, fantasyPoints } as GoalieStats,
      };
    }
    const goals = Number(r.goals);
    const assists = Number(r.assists);
    const plusMinus = Number(r.plusMinus);
    const ppp = Number(r.ppp);
    const penaltyMinutes = Number(r.penaltyMinutes);
    const shots = Number(r.shots);
    const hits = Number(r.hits);
    const blocks = Number(r.blocks);
    const fantasyPoints = Math.round((
      goals * sk.goal + assists * sk.assist + shots * sk.shot +
      plusMinus * sk.plusMinus + penaltyMinutes * sk.penaltyMinute +
      ppp * sk.powerPlayPoint + hits * sk.hit + blocks * sk.block
    ) * 100) / 100;
    return {
      playerId: r.id,
      name: `${r.firstName} ${r.lastName}`,
      position,
      teamAbbr: r.abbreviation ?? null,
      pwhlTeamId: r.pwhlTeamId,
      gamesThisPeriod: periodForGames ? (gamesRemaining.get(r.pwhlTeamId ?? "") ?? 0) : null,
      isLocked: lockedTeamIds.has(r.pwhlTeamId ?? ""),
      stats: gp === 0 ? null : { gp, goals, assists, points: goals + assists, plusMinus, ppp, shots, hits, blocks, fantasyPoints } as SkaterStats,
    };
  });

  return (
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
    />
  );
}
