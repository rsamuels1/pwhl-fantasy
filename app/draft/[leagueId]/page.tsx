import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import DraftRoom from "./DraftRoom";
import type { PlayerStats } from "@/app/api/leagues/[leagueId]/draft/players/route";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ team?: string }>;
}

type AggRow = {
  id: string; firstName: string; lastName: string;
  position: string; abbreviation: string | null;
  gp: bigint; goals: bigint; assists: bigint; plusMinus: bigint;
  ppp: bigint; shots: bigint; hits: bigint; blocks: bigint;
  saves: bigint; goalsAgainst: bigint; wins: bigint; shutouts: bigint;
};

export default async function DraftPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const { team: teamId } = await searchParams;

  if (!teamId) {
    return (
      <main style={{ padding: "2rem" }}>
        <p style={{ color: "var(--red)" }}>
          Missing <code>?team=&lt;teamId&gt;</code> in the URL.
        </p>
      </main>
    );
  }

  // Run league fetch and stats aggregation in parallel.
  const [league, latestGame] = await Promise.all([
    prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        name: true,
        commissionerId: true,
        rosterSettings: true,
        teams: {
          select: { id: true, name: true, ownerId: true },
          orderBy: { draftOrder: "asc" },
        },
      },
    }),
    prisma.game.findFirst({
      where: { status: "FINAL" },
      orderBy: { startsAt: "desc" },
      select: { season: true },
    }),
  ]);

  if (!league) notFound();

  const myTeam = league.teams.find((t) => t.id === teamId);
  if (!myTeam) notFound();

  const season = latestGame?.season ?? null;

  const rows = season
    ? await prisma.$queryRaw<AggRow[]>`
        SELECT
          p.id,
          p."firstName",
          p."lastName",
          p.position::text,
          t.abbreviation,
          COUNT(sl.id)                        AS gp,
          COALESCE(SUM(sl.goals), 0)          AS goals,
          COALESCE(SUM(sl.assists), 0)        AS assists,
          COALESCE(SUM(sl."plusMinus"), 0)    AS "plusMinus",
          COALESCE(SUM(sl."powerPlayPts"), 0) AS ppp,
          COALESCE(SUM(sl.shots), 0)          AS shots,
          COALESCE(SUM(sl.hits), 0)           AS hits,
          COALESCE(SUM(sl.blocks), 0)         AS blocks,
          COALESCE(SUM(sl.saves), 0)          AS saves,
          COALESCE(SUM(sl."goalsAgainst"), 0) AS "goalsAgainst",
          COALESCE(SUM(CASE WHEN sl.win THEN 1 ELSE 0 END), 0)     AS wins,
          COALESCE(SUM(CASE WHEN sl.shutout THEN 1 ELSE 0 END), 0) AS shutouts
        FROM "Player" p
        LEFT JOIN "Team" t ON t.id = p."teamId"
        LEFT JOIN "StatLine" sl ON sl."playerId" = p.id
        LEFT JOIN "Game" g ON g.id = sl."gameId" AND g.season = ${season}
        WHERE p.active = true
        GROUP BY p.id, p."firstName", p."lastName", p.position, t.abbreviation
        ORDER BY p.position, p."lastName"
      `
    : [];

  const initialStats: PlayerStats[] = rows.map((r) => {
    const saves = Number(r.saves);
    const goalsAgainst = Number(r.goalsAgainst);
    const totalFaced = saves + goalsAgainst;
    const goals = Number(r.goals);
    const assists = Number(r.assists);
    return {
      id: r.id,
      name: `${r.firstName} ${r.lastName}`,
      position: r.position as PlayerStats["position"],
      team: r.abbreviation ?? null,
      gp: Number(r.gp),
      goals,
      assists,
      points: goals + assists,
      plusMinus: Number(r.plusMinus),
      ppp: Number(r.ppp),
      shots: Number(r.shots),
      hits: Number(r.hits),
      blocks: Number(r.blocks),
      wins: Number(r.wins),
      saves,
      goalsAgainst,
      shutouts: Number(r.shutouts),
      savePct: totalFaced > 0 ? saves / totalFaced : null,
    };
  });

  const teamNames: Record<string, string> = Object.fromEntries(
    league.teams.map((t) => [t.id, t.name])
  );
  const rosterSettings = (league.rosterSettings ?? {}) as Record<string, number>;

  return (
    <DraftRoom
      leagueId={leagueId}
      teamId={teamId}
      teamNames={teamNames}
      isCommissioner={myTeam.ownerId === league.commissionerId}
      rosterSettings={rosterSettings}
      initialStats={initialStats}
      statSeason={season}
    />
  );
}
